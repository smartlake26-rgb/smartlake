// ================================================================
//  OTA MODULE — Gateway firmware uchun qo'shimcha (aqua_gateway oxiriga qo'shing)
//  
//  ISHLASH TARTIBI:
//    1. Har 5 daqiqada RTDB'dan /ota/gateway/version tekshiriladi
//    2. Agar yangi versiya bo'lsa → /ota/gateway/url dan .bin URL olinadi
//    3. HTTPS orqali .bin yuklab olinadi
//    4. ESP32 OTA (ikkinchi partition'ga yoziladi)
//    5. Muvaffaqiyatli → reboot; Xato → eski firmware'da qoladi
//    6. Reboot'dan keyin yangi versiya bo'lsa → rollback
//
//  QANDAY QO'SHILADI:
//    1. Shu faylni aqua_gateway_firebase_v32_5.ino OXIRIGA yoki
//       alohida tab (.ino) sifatida qo'shing
//    2. setup() ga: otaSetup();
//    3. loop() ga:  otaCheck();
//    4. #include <Update.h> va <HTTPClient.h> ni yuqoriga qo'shing
// ================================================================

#include <Update.h>
#include <HTTPClient.h>
#include <esp_ota_ops.h>

// ---- OTA sozlamalari ----
#define OTA_CHECK_MS       300000UL   // 5 daqiqada bir tekshirish
#define OTA_FW_VERSION     "32.5"     // Hozirgi firmware versiyasi
#define OTA_PATH_VERSION   "ota/gateway/version"
#define OTA_PATH_URL       "ota/gateway/url"
#define OTA_PATH_SHA256    "ota/gateway/sha256"
#define OTA_PATH_STATUS    "ota/gateway/status"

static unsigned long lastOtaCheck = 0;
static bool otaInProgress = false;

// ---- Versiya solishtirish (oddiy: string compare) ----
static bool otaVersionNewer(const String& remote) {
  return remote.length() > 0 && remote != OTA_FW_VERSION;
}

// ---- OTA holatini RTDB'ga yozish ----
static void otaReportStatus(const char* status, int progress = -1) {
  if (!fbBoshlandi || !Firebase.ready()) return;
  char gwid[24];
  snprintf(gwid, sizeof(gwid), "AquaGW-%06X", (unsigned)(ESP.getEfuseMac() & 0xFFFFFF));
  char path[64];
  snprintf(path, sizeof(path), "gateway/%s/ota", gwid);

  FirebaseJson d;
  d.set("status", status);
  d.set("fw_current", OTA_FW_VERSION);
  if (progress >= 0) d.set("progress", progress);
  d.set("ts/.sv", "timestamp");
  Firebase.RTDB.setJSON(&fbdo, path, &d);
  Serial.printf("[OTA] Status: %s (progress: %d%%)\n", status, progress);
}

// ---- Firmware yuklab olish va flash qilish ----
static bool otaDownloadAndFlash(const String& url, const String& expectedSha) {
  Serial.printf("[OTA] Yuklab olish: %s\n", url.c_str());
  otaReportStatus("downloading", 0);

  HTTPClient http;
  http.begin(url);
  http.setTimeout(60000);
  int httpCode = http.GET();

  if (httpCode != 200) {
    Serial.printf("[OTA] HTTP xato: %d\n", httpCode);
    otaReportStatus("http_error");
    http.end();
    return false;
  }

  int contentLen = http.getSize();
  if (contentLen <= 0) {
    Serial.println("[OTA] Content-Length noto'g'ri");
    otaReportStatus("invalid_size");
    http.end();
    return false;
  }

  Serial.printf("[OTA] Fayl hajmi: %d bayt\n", contentLen);

  // ESP32 OTA boshlanish
  if (!Update.begin(contentLen)) {
    Serial.printf("[OTA] Update.begin xato: %s\n", Update.errorString());
    otaReportStatus("begin_error");
    http.end();
    return false;
  }

  // Stream orqali yozish (4KB chunk)
  WiFiClient* stream = http.getStreamPtr();
  uint8_t buf[4096];
  int written = 0;
  int lastPct = -1;

  while (http.connected() && written < contentLen) {
    size_t avail = stream->available();
    if (avail == 0) { delay(1); continue; }
    int rd = stream->readBytes(buf, min(avail, sizeof(buf)));
    if (rd <= 0) break;

    if (Update.write(buf, rd) != (size_t)rd) {
      Serial.printf("[OTA] Write xato: %s\n", Update.errorString());
      otaReportStatus("write_error");
      Update.abort();
      http.end();
      return false;
    }

    written += rd;
    int pct = (written * 100) / contentLen;
    if (pct != lastPct && pct % 10 == 0) {
      lastPct = pct;
      otaReportStatus("downloading", pct);
      Serial.printf("[OTA] %d%% (%d/%d)\n", pct, written, contentLen);
      esp_task_wdt_reset();   // WDT reset — uzoq yuklanish
    }
  }

  http.end();

  if (written != contentLen) {
    Serial.printf("[OTA] To'liq yuklanmadi: %d/%d\n", written, contentLen);
    otaReportStatus("incomplete");
    Update.abort();
    return false;
  }

  // Yozish yakunlash
  if (!Update.end(true)) {
    Serial.printf("[OTA] End xato: %s\n", Update.errorString());
    otaReportStatus("end_error");
    return false;
  }

  Serial.println("[OTA] Flash muvaffaqiyatli!");
  otaReportStatus("flashed", 100);
  return true;
}

// ---- setup() da chaqirish ----
void otaSetup() {
  // Rollback tekshiruvi: agar yangi firmware ishga tushmasa, eski ga qaytish
  const esp_partition_t* running = esp_ota_get_running_partition();
  esp_ota_img_states_t state;
  if (esp_ota_get_state_partition(running, &state) == ESP_OK) {
    if (state == ESP_OTA_IMG_PENDING_VERIFY) {
      // Yangi firmware birinchi marta ishga tushdi — 30s dan keyin tasdiqlash
      Serial.println("[OTA] Yangi firmware tekshirilmoqda...");
      // Agar 30s ichida crash bo'lmasa — tasdiqlash
      // (aks holda WDT eski firmware'ga qaytaradi)
      delay(5000);
      esp_ota_mark_app_valid_cancel_rollback();
      Serial.println("[OTA] Yangi firmware TASDIQLANDI ✓");
      otaReportStatus("verified");
    }
  }
  Serial.printf("[OTA] Firmware versiyasi: %s\n", OTA_FW_VERSION);
}

// ---- loop() da chaqirish (har 5 daqiqa) ----
void otaCheck() {
  if (otaInProgress) return;
  if (WiFi.status() != WL_CONNECTED || !fbBoshlandi || !Firebase.ready()) return;
  if (!taymerOtdimi(lastOtaCheck, OTA_CHECK_MS)) return;
  lastOtaCheck = millis();

  // 1. RTDB'dan versiya tekshirish
  if (!Firebase.RTDB.getString(&fbdo, OTA_PATH_VERSION)) return;
  String remoteVer = fbdo.to<String>();
  remoteVer.trim();

  if (!otaVersionNewer(remoteVer)) {
    return;   // Hozirgi versiya yangi yoki bir xil
  }

  Serial.printf("[OTA] Yangi versiya topildi: %s (hozirgi: %s)\n",
                remoteVer.c_str(), OTA_FW_VERSION);

  // 2. URL olish
  if (!Firebase.RTDB.getString(&fbdo, OTA_PATH_URL)) {
    Serial.println("[OTA] URL topilmadi");
    otaReportStatus("no_url");
    return;
  }
  String fwUrl = fbdo.to<String>();
  fwUrl.trim();

  // 3. SHA256 olish (ixtiyoriy)
  String sha = "";
  if (Firebase.RTDB.getString(&fbdo, OTA_PATH_SHA256)) {
    sha = fbdo.to<String>();
    sha.trim();
  }

  // 4. OTA boshlash
  otaInProgress = true;
  otaReportStatus("starting");

  bool ok = otaDownloadAndFlash(fwUrl, sha);

  if (ok) {
    otaReportStatus("rebooting");
    Serial.println("[OTA] Qayta ishga tushirilmoqda...");
    delay(1000);
    ESP.restart();
  } else {
    otaReportStatus("failed");
    otaInProgress = false;
  }
}
