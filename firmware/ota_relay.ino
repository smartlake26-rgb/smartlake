// ================================================================
//  OTA RELAY — Gateway'dan Node'ga LoRa orqali firmware uzatish
//  
//  ISHLASH:
//    1. Admin RTDB'ga /ota/node/version yozadi
//    2. Gateway tekshiradi → /ota/node/url dan .bin yuklab oladi
//    3. .bin ni 200-baytli LoRa paketlarga bo'ladi
//    4. Har paketni Node'ga yuboradi, ACK kutadi
//    5. ACK kelmasa → qayta yuboradi (5 marta)
//    6. Barcha paketlar yuborilgach → CMD_OTA_END
//
//  QANDAY QO'SHILADI:
//    1. Shu faylni gateway firmware'ga qo'shing
//    2. loop() ga: otaRelayCheck();
//    3. Gateway OTA check'dan keyin Node OTA ham tekshiriladi
// ================================================================

#include <HTTPClient.h>

// ---- Node OTA sozlamalari ----
#define OTA_NODE_CHECK_MS    300000UL   // 5 daqiqa
#define OTA_NODE_PATH_VER    "ota/node/version"
#define OTA_NODE_PATH_URL    "ota/node/url"
#define OTA_NODE_PATH_CRC    "ota/node/crc32"
#define OTA_NODE_FW_VER      "16.2"
#define OTA_RELAY_CHUNK      200        // LoRa payload (bayt)
#define OTA_RELAY_ACK_TIMEOUT 5000UL    // 5s ACK kutish
#define OTA_RELAY_MAX_RETRY  5

static unsigned long lastNodeOtaCheck = 0;
static bool relayActive = false;
static uint8_t* relayBuf = nullptr;     // Butun firmware keshi (PSRAM/heap)
static uint32_t relayBufSize = 0;
static uint32_t relayCrc = 0;
static uint16_t relaySeq = 0;
static uint32_t relaySent = 0;
static uint32_t relayTarget = 0;        // Maqsad Node ID
static uint8_t relayRetries = 0;

// ---- CRC32 ----
static uint32_t crc32Calc(const uint8_t* data, size_t len) {
  uint32_t crc = 0xFFFFFFFF;
  for (size_t i = 0; i < len; i++) {
    crc ^= data[i];
    for (int j = 0; j < 8; j++)
      crc = (crc >> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  return crc ^ 0xFFFFFFFF;
}

// ---- Holatni RTDB'ga yozish ----
static void otaRelayStatus(const char* status, int pct = -1) {
  if (!fbBoshlandi || !Firebase.ready()) return;
  char gwid[24];
  snprintf(gwid, sizeof(gwid), "AquaGW-%06X", (unsigned)(ESP.getEfuseMac() & 0xFFFFFF));
  char path[64];
  snprintf(path, sizeof(path), "gateway/%s/nodeOta", gwid);
  FirebaseJson d;
  d.set("status", status);
  if (pct >= 0) d.set("progress", pct);
  d.set("ts/.sv", "timestamp");
  Firebase.RTDB.setJSON(&fbdo, path, &d);
  Serial.printf("[OTA-RELAY] %s (%d%%)\n", status, pct);
}

// ---- Firmware faylni yuklab olish ----
static bool otaRelayDownload(const String& url) {
  Serial.printf("[OTA-RELAY] Node firmware yuklanmoqda: %s\n", url.c_str());
  otaRelayStatus("downloading", 0);

  HTTPClient http;
  http.begin(url);
  http.setTimeout(120000);
  int code = http.GET();
  if (code != 200) {
    Serial.printf("[OTA-RELAY] HTTP xato: %d\n", code);
    otaRelayStatus("http_error");
    http.end();
    return false;
  }

  int size = http.getSize();
  if (size <= 0 || size > 1500000) {
    otaRelayStatus("invalid_size");
    http.end();
    return false;
  }

  // RAM'ga yuklash (ESP32 ~280KB free heap, PSRAM bo'lsa 4MB)
  if (relayBuf) { free(relayBuf); relayBuf = nullptr; }

#ifdef BOARD_HAS_PSRAM
  relayBuf = (uint8_t*)ps_malloc(size);
#else
  relayBuf = (uint8_t*)malloc(size);
#endif

  if (!relayBuf) {
    Serial.printf("[OTA-RELAY] RAM yetmadi: %d bayt kerak\n", size);
    otaRelayStatus("out_of_memory");
    http.end();
    return false;
  }

  WiFiClient* stream = http.getStreamPtr();
  int read = 0;
  while (http.connected() && read < size) {
    size_t avail = stream->available();
    if (avail == 0) { delay(1); continue; }
    int rd = stream->readBytes(relayBuf + read, min(avail, (size_t)(size - read)));
    if (rd <= 0) break;
    read += rd;
    esp_task_wdt_reset();
  }
  http.end();

  if (read != size) {
    free(relayBuf); relayBuf = nullptr;
    otaRelayStatus("incomplete");
    return false;
  }

  relayBufSize = size;
  relayCrc = crc32Calc(relayBuf, size);
  Serial.printf("[OTA-RELAY] Yuklandi: %d bayt, CRC=%08X\n", size, relayCrc);
  otaRelayStatus("downloaded", 100);
  return true;
}

// ---- Node'ga OTA_BEGIN yuborish ----
static void otaRelaySendBegin() {
  uint8_t pkt[8];
  memcpy(pkt, &relayBufSize, 4);
  memcpy(pkt + 4, &relayCrc, 4);
  // loraCmdYubor(relayTarget, CMD_OTA_BEGIN, pkt, 8);
  Serial.printf("[OTA-RELAY] BEGIN: target=%08X, size=%u, crc=%08X\n",
                relayTarget, relayBufSize, relayCrc);
}

// ---- Bitta paket yuborish ----
static void otaRelaySendChunk() {
  uint32_t offset = relaySeq * OTA_RELAY_CHUNK;
  uint16_t chunkLen = min((uint32_t)OTA_RELAY_CHUNK, relayBufSize - offset);

  uint8_t pkt[2 + OTA_RELAY_CHUNK];
  memcpy(pkt, &relaySeq, 2);
  memcpy(pkt + 2, relayBuf + offset, chunkLen);
  // loraCmdYubor(relayTarget, CMD_OTA_DATA, pkt, 2 + chunkLen);

  int pct = ((offset + chunkLen) * 100) / relayBufSize;
  if (pct % 10 == 0) {
    otaRelayStatus("sending", pct);
  }
}

// ---- Node ACK qabul qilish (LoRa callback'dan chaqiriladi) ----
void otaRelayHandleAck(uint16_t seq, uint8_t status) {
  if (!relayActive) return;

  if (status == 2) {
    // Node abort qildi
    Serial.println("[OTA-RELAY] Node ABORT qildi");
    otaRelayAbort();
    return;
  }

  if (status == 1) {
    // Retry so'rayapti
    relayRetries++;
    if (relayRetries >= OTA_RELAY_MAX_RETRY) {
      otaRelayAbort();
      return;
    }
    otaRelaySendChunk();   // qayta yuborish
    return;
  }

  // OK — keyingi paket
  relayRetries = 0;
  relaySeq++;
  relaySent = relaySeq * OTA_RELAY_CHUNK;

  if (relaySent >= relayBufSize) {
    // Barcha paketlar yuborildi
    Serial.println("[OTA-RELAY] Barcha paketlar yuborildi → END");
    // loraCmdYubor(relayTarget, CMD_OTA_END, ...);
    otaRelayStatus("complete", 100);
    relayActive = false;
    free(relayBuf); relayBuf = nullptr;
    return;
  }

  otaRelaySendChunk();   // keyingi paket
}

// ---- Bekor qilish ----
static void otaRelayAbort() {
  Serial.println("[OTA-RELAY] BEKOR");
  // loraCmdYubor(relayTarget, CMD_OTA_ABORT, nullptr, 0);
  relayActive = false;
  free(relayBuf); relayBuf = nullptr;
  otaRelayStatus("aborted");
}

// ---- loop() da chaqirish ----
void otaRelayCheck() {
  if (relayActive) return;   // Hozir yuborilmoqda
  if (WiFi.status() != WL_CONNECTED || !fbBoshlandi || !Firebase.ready()) return;
  if (!taymerOtdimi(lastNodeOtaCheck, OTA_NODE_CHECK_MS)) return;
  lastNodeOtaCheck = millis();

  // RTDB'dan versiya tekshirish
  if (!Firebase.RTDB.getString(&fbdo, OTA_NODE_PATH_VER)) return;
  String remoteVer = fbdo.to<String>();
  remoteVer.trim();

  if (remoteVer.length() == 0 || remoteVer == OTA_NODE_FW_VER) return;

  Serial.printf("[OTA-RELAY] Node uchun yangi versiya: %s\n", remoteVer.c_str());

  // URL olish
  if (!Firebase.RTDB.getString(&fbdo, OTA_NODE_PATH_URL)) return;
  String fwUrl = fbdo.to<String>();
  fwUrl.trim();

  // Yuklab olish
  if (!otaRelayDownload(fwUrl)) return;

  // Birinchi Node'ga yuborish boshlash
  // TODO: barcha node'larga navbat bilan yuborish
  relayTarget = 0;   // Broadcast yoki birinchi node
  relaySeq = 0;
  relaySent = 0;
  relayRetries = 0;
  relayActive = true;

  otaRelaySendBegin();
  delay(2000);   // Node tayyorlanishi uchun
  otaRelaySendChunk();
}
