// ================================================================
//  OTA MODULE — Node firmware uchun qo'shimcha
//  
//  ISHLASH TARTIBI:
//    1. Gateway LoRa orqali CMD_OTA_BEGIN yuboradi (fayl hajmi, CRC)
//    2. Node OTA rejimiga o'tadi, telemetriyani to'xtatadi
//    3. Gateway 200-baytli paketlar yuboradi (CMD_OTA_DATA)
//    4. Node har paketni flash'ga yozadi, ACK qaytaradi
//    5. Oxirgi paketdan keyin Gateway CMD_OTA_END yuboradi
//    6. Node CRC tekshiradi → muvaffaqiyatli bo'lsa reboot
//    7. Xato bo'lsa → eski firmware'da qoladi (rollback)
//
//  PAKETLAR ORASIDA YO'QOLISH BO'LSA:
//    - Node 10s ACK kutadi, kelmasa → NACK yuboradi
//    - Gateway NACK olsa shu paketni qayta yuboradi
//    - 5 marta urinishdan keyin OTA bekor qilinadi
//
//  QANDAY QO'SHILADI:
//    1. Shu faylni aqua_node oxiriga yoki alohida tab sifatida qo'shing
//    2. LoRa qabul qilish funksiyasida CMD_OTA_* ni handle qiling
//    3. loop() ga: otaNodeCheck();
// ================================================================

#include <Update.h>
#include <esp_ota_ops.h>

// ---- OTA buyruq kodlari (Gateway va Node bir xil) ----
#define CMD_OTA_BEGIN   0xF0   // {totalSize:4, crc32:4, version:N}
#define CMD_OTA_DATA    0xF1   // {seqNum:2, data:200}
#define CMD_OTA_END     0xF2   // {totalWritten:4}
#define CMD_OTA_ACK     0xF3   // {seqNum:2, status:1}  (0=ok, 1=retry, 2=abort)
#define CMD_OTA_ABORT   0xF4   // OTA bekor qilish

// ---- Node OTA holati ----
static bool nodeOtaActive = false;
static uint32_t nodeOtaTotalSize = 0;
static uint32_t nodeOtaExpectedCrc = 0;
static uint32_t nodeOtaWritten = 0;
static uint16_t nodeOtaLastSeq = 0xFFFF;
static unsigned long nodeOtaLastPkt = 0;
static uint8_t nodeOtaRetries = 0;
#define NODE_OTA_TIMEOUT_MS  15000UL   // 15s paket kutish
#define NODE_OTA_MAX_RETRY   5
#define NODE_OTA_CHUNK_SIZE  200       // LoRa paket ichidagi data hajmi

// ---- CRC32 (oddiy) ----
static uint32_t nodeOtaCrc = 0;
static void crc32Update(const uint8_t* data, size_t len) {
  uint32_t crc = nodeOtaCrc ^ 0xFFFFFFFF;
  for (size_t i = 0; i < len; i++) {
    crc ^= data[i];
    for (int j = 0; j < 8; j++)
      crc = (crc >> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  nodeOtaCrc = crc ^ 0xFFFFFFFF;
}

// ---- OTA BEGIN: Gateway firmware yuborishni boshladi ----
void nodeOtaHandleBegin(const uint8_t* payload, uint8_t len) {
  if (len < 8) return;
  nodeOtaTotalSize   = *(uint32_t*)(payload);
  nodeOtaExpectedCrc = *(uint32_t*)(payload + 4);

  Serial.printf("[NODE-OTA] BEGIN: hajm=%u, CRC=%08X\n",
                nodeOtaTotalSize, nodeOtaExpectedCrc);

  if (nodeOtaTotalSize == 0 || nodeOtaTotalSize > 1500000) {
    Serial.println("[NODE-OTA] Noto'g'ri hajm — bekor");
    nodeOtaSendAck(0, 2);   // abort
    return;
  }

  // ESP32 OTA boshlash
  if (!Update.begin(nodeOtaTotalSize)) {
    Serial.printf("[NODE-OTA] Update.begin xato: %s\n", Update.errorString());
    nodeOtaSendAck(0, 2);   // abort
    return;
  }

  nodeOtaActive = true;
  nodeOtaWritten = 0;
  nodeOtaLastSeq = 0xFFFF;
  nodeOtaCrc = 0;
  nodeOtaRetries = 0;
  nodeOtaLastPkt = millis();

  nodeOtaSendAck(0, 0);   // OK — tayyor
  Serial.println("[NODE-OTA] OTA rejimi YOQILDI — telemetriya to'xtatildi");
}

// ---- OTA DATA: bitta paket keldi ----
void nodeOtaHandleData(const uint8_t* payload, uint8_t len) {
  if (!nodeOtaActive || len < 3) return;

  uint16_t seq = *(uint16_t*)(payload);
  const uint8_t* data = payload + 2;
  uint8_t dataLen = len - 2;

  // Takroriy paket (allaqachon yozilgan) — ACK qaytarish
  if (seq == nodeOtaLastSeq) {
    nodeOtaSendAck(seq, 0);
    return;
  }

  // Ketma-ketlik tekshiruvi
  if (seq != (uint16_t)(nodeOtaLastSeq + 1) && nodeOtaLastSeq != 0xFFFF) {
    Serial.printf("[NODE-OTA] Paket tartib xatosi: kutilgan=%u, kelgan=%u\n",
                  nodeOtaLastSeq + 1, seq);
    nodeOtaSendAck(seq, 1);   // retry so'rash
    nodeOtaRetries++;
    if (nodeOtaRetries >= NODE_OTA_MAX_RETRY) {
      nodeOtaAbort("ko'p retry");
    }
    return;
  }

  // Flash'ga yozish
  if (Update.write(data, dataLen) != dataLen) {
    Serial.printf("[NODE-OTA] Write xato: %s\n", Update.errorString());
    nodeOtaAbort("write xato");
    return;
  }

  crc32Update(data, dataLen);
  nodeOtaWritten += dataLen;
  nodeOtaLastSeq = seq;
  nodeOtaLastPkt = millis();
  nodeOtaRetries = 0;

  // Progress (har 10%)
  int pct = (nodeOtaWritten * 100) / nodeOtaTotalSize;
  if (pct % 10 == 0) {
    Serial.printf("[NODE-OTA] %d%% (%u/%u)\n", pct, nodeOtaWritten, nodeOtaTotalSize);
  }

  nodeOtaSendAck(seq, 0);   // OK
}

// ---- OTA END: oxirgi paket ----
void nodeOtaHandleEnd(const uint8_t* payload, uint8_t len) {
  if (!nodeOtaActive) return;

  Serial.printf("[NODE-OTA] END: yozilgan=%u, kutilgan=%u\n",
                nodeOtaWritten, nodeOtaTotalSize);

  // CRC tekshiruvi
  if (nodeOtaCrc != nodeOtaExpectedCrc) {
    Serial.printf("[NODE-OTA] CRC XATO: %08X != %08X\n",
                  nodeOtaCrc, nodeOtaExpectedCrc);
    nodeOtaAbort("CRC xato");
    return;
  }

  // OTA yakunlash
  if (!Update.end(true)) {
    Serial.printf("[NODE-OTA] End xato: %s\n", Update.errorString());
    nodeOtaAbort("end xato");
    return;
  }

  Serial.println("[NODE-OTA] ✓ MUVAFFAQIYATLI — qayta ishga tushirilmoqda...");
  nodeOtaSendAck(0xFFFF, 0);   // yakuniy ACK
  nodeOtaActive = false;
  delay(1000);
  ESP.restart();
}

// ---- ACK yuborish (Gateway'ga) ----
void nodeOtaSendAck(uint16_t seq, uint8_t status) {
  uint8_t pkt[3] = { (uint8_t)(seq & 0xFF), (uint8_t)(seq >> 8), status };
  // loraCmdYubor mavjud funksiyasi bilan yuboriladi
  // Bu yerda loyihaga mos LoRa yuborish chaqiruvi bo'lishi kerak:
  // loraYuborOtaAck(pkt, 3);
  Serial.printf("[NODE-OTA] ACK: seq=%u, status=%u\n", seq, status);
}

// ---- OTA bekor qilish ----
void nodeOtaAbort(const char* reason) {
  Serial.printf("[NODE-OTA] BEKOR: %s\n", reason);
  Update.abort();
  nodeOtaActive = false;
  nodeOtaSendAck(0xFFFF, 2);   // abort
}

// ---- loop() da chaqirish — timeout tekshiruvi ----
void otaNodeCheck() {
  if (!nodeOtaActive) return;

  // Paket kutish vaqti o'tdi
  if (millis() - nodeOtaLastPkt > NODE_OTA_TIMEOUT_MS) {
    Serial.println("[NODE-OTA] Timeout — kutilmoqda...");
    nodeOtaRetries++;
    nodeOtaLastPkt = millis();

    if (nodeOtaRetries >= NODE_OTA_MAX_RETRY) {
      nodeOtaAbort("timeout — ko'p urinish");
    } else {
      // NACK — Gateway qayta yuborsin
      nodeOtaSendAck(nodeOtaLastSeq + 1, 1);
    }
  }
}

// ---- Rollback (setup() da chaqiring) ----
void otaNodeSetup() {
  const esp_partition_t* running = esp_ota_get_running_partition();
  esp_ota_img_states_t state;
  if (esp_ota_get_state_partition(running, &state) == ESP_OK) {
    if (state == ESP_OTA_IMG_PENDING_VERIFY) {
      Serial.println("[NODE-OTA] Yangi firmware tekshirilmoqda...");
      delay(5000);   // 5s barqaror ishlasa → tasdiqlash
      esp_ota_mark_app_valid_cancel_rollback();
      Serial.println("[NODE-OTA] ✓ Firmware tasdiqlandi");
    }
  }
}
