// ================================================================
//  AQUA GATEWAY (LoRa <-> WiFi/FIREBASE) v3.0  -  ESP32 + SX1278/Ra-02
//  Baliq ko'llari tizimi SHLYUZI  —  FIREBASE versiyasi
//
//  VAZIFASI:
//    [Ko'l NODE'lari] --LoRa 433MHz--> [SHU SHLYUZ] --WiFi--> [Firebase RTDB]
//                                            <-- buyruqlar (commands) <--
//
//  =========  FIREBASE'GA YOZILADIGAN MA'LUMOT  =========
//   /nodes/<AQid>/latest   : oxirgi o'lchov (do, ph, t, aer, rssi, ts ...)
//   /nodes/<AQid>/history  : tarix (grafik uchun, oxirgi nuqtalar)
//   /gateway/<gwid>/status : shlyuzning o'z holati
//   /commands              : web ilovadan kelgan buyruqlar (o'qiladi, bajariladi, o'chiriladi)
//
//  --- KUTUBXONALAR (Arduino Library Manager) ---
//    RadioLib (jgromes)              >= 6.0
//    Firebase Arduino Client Library for ESP8266 and ESP32 (mobizt) >= 4.4   ← MUHIM
//    ArduinoJson (bblanchon)         >= 6.x
//    WiFiManager (tzapu)             >= 2.0.16
//    LiquidCrystal_I2C                       (ixtiyoriy)
//
//  --- LoRa ULASH (node bilan BIR XIL) — SX1278/Ra-02 -> ESP32 ---
//      SCK->18 | MISO->35 | MOSI->23 | NSS->15 | RST->2 | DIO0->34
//      VCC->3.3V (5V EMAS!) | GND->GND | ANTENNA 433MHz (antennasiz yoqmang!)
//  --- HOLAT LCD (ixtiyoriy 16x2 I2C): SDA->21 | SCL->22 ---
//
//  >>> BIRINCHI YOQILGANDA: WiFi "AquaGW-XXXXXX" tarmog'iga ulanib,
//      telefon orqali WiFi + Firebase (API key, DB URL, email, parol) kiritiladi.
// ================================================================

#include <WiFi.h>
#include <WiFiManager.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <esp_task_wdt.h>
#include <SPI.h>
#include <RadioLib.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// ================================================================
//  KOMPILYATSIYA SOZLAMALARI
// ================================================================
#define USE_LCD            1     // 0 -> LCD'siz (headless) ishlaydi

// WiFi tiklanish siyosati
#define WIFI_KICK_S        45    // shuncha soniya uzilsa -> qayta ulanishni "turtish"
#define WIFI_FAIL_PORTAL_DK 10   // shuncha DAQIQA ulanmasa -> avtomatik portal ochiladi
#define PORTAL_TIMEOUT_S   300   // avtomatik portal shuncha soniya ochiq turadi (5 daq)

// ================================================================
//  LoRa PINLAR (node bilan bir xil)
// ================================================================
#define LORA_SCK   18
#define LORA_MISO  35
#define LORA_MOSI  23
#define LORA_NSS   15
#define LORA_RST   2
#define LORA_DIO0  34

// ================================================================
//  LoRa RADIO — NODE bilan AYNAN BIR XIL bo'lishi SHART
// ================================================================
static const float    LORA_FREQ     = 433.0;
static const float    LORA_BW       = 125.0;
static const uint8_t  LORA_SF       = 9;
static const uint8_t  LORA_CR       = 7;
static const uint8_t  LORA_SYNCWORD = 0x55;
static const int8_t   LORA_POWER    = 17;
static const uint16_t LORA_PREAMBLE = 10;

// ================================================================
//  PROTOKOL (node bilan bir xil) — O'ZGARTIRILMAGAN
// ================================================================
#define LORA_MAGIC    0xA9
#define LORA_VER      0x01
#define FT_TELE       1
#define FT_ACK        2
#define FT_CMD        3
#define FT_CMDACK     4
#define FLAG_WANTACK  0x01

static const uint32_t GATEWAY_ID   = 0x00000001UL;
static const uint32_t BROADCAST_ID = 0xFFFFFFFFUL;

#define CMD_AER_ON    0x01
#define CMD_AER_AUTO  0x02
#define CMD_MINDO     0x03
#define CMD_FARQ      0x04
#define CMD_KRITIK    0x05
#define CMD_MODE      0x06
#define CMD_STATUS    0x07

#define ST_DOXATO     0x01
#define ST_PHXATO     0x02
#define ST_ALARM      0x04
#define ST_BOSHLAN    0x08
#define ST_QOLRELE    0x10

// ================================================================
//  FIREBASE sozlamalari (NVS'dan, portal orqali to'ldiriladi)
// ================================================================
static char fbApiKey[48] = "";
static char fbDbUrl[96]  = "";
static char fbEmail[48]  = "";
static char fbPass[40]   = "";

// Noyob sozlash WiFi nomi/paroli (MAC'dan, setup'da to'ldiriladi)
static char apNom[24]   = "AquaGW-Setup";
static char apParol[16] = "aqua12345";

// ================================================================
//  OBYEKTLAR
// ================================================================
SPIClass    loraSPI(VSPI);
SX1278      radio = new Module(LORA_NSS, LORA_DIO0, LORA_RST, RADIOLIB_NC,
                               loraSPI, RADIOLIB_DEFAULT_SPI_SETTINGS);
Preferences   prefs;

FirebaseData   fbdo;
FirebaseAuth   fbauth;
FirebaseConfig fbconfig;
static bool    fbBoshlandi = false;

#if USE_LCD
LiquidCrystal_I2C lcd(0x27, 16, 2);
#endif

// ================================================================
//  GLOBALLAR
// ================================================================
static volatile bool loraFlag = false;
static bool          loraOk   = false;
static unsigned long lastReinit = 0;
static const unsigned long LORA_REINIT_MS = 30000UL;

#define MAX_NODES 32
static uint32_t ulanganNodelar[MAX_NODES];
static uint8_t  ulanganSoni = 0;

static uint32_t paketSoni   = 0;
static uint32_t oxirgiSrc   = 0;
static int16_t  oxirgiRssi  = 0;
static float    oxirgiSnr   = 0;
static unsigned long oxirgiPaketVaqti = 0;

static unsigned long lastLcdYangi = 0;
static unsigned long lastGwTele   = 0;
static const unsigned long GW_TELE_MS = 30000UL;   // shlyuz holati har 30s
static unsigned long lastCmdPoll  = 0;
static const unsigned long CMD_POLL_MS = 2000UL;   // buyruqlarni har 2s tekshirish

// WiFi nazorati
static unsigned long wifiUzilganVaqt = 0;          // qachondan beri uzilgan (0 = ulangan)
static unsigned long lastWifiKick    = 0;

// CAD/TX
static const uint8_t  CAD_TRIES        = 2;
static const uint16_t CAD_BACKOFF_MIN  = 10;
static const uint16_t CAD_BACKOFF_SPAN = 40;

// ----------------------------------------------------------------
//  STORE-AND-FORWARD bufferi (Firebase uzilganda telemetriya saqlanadi)
// ----------------------------------------------------------------
#define BUF_N    20
struct TeleBuf {
  uint32_t id;
  int16_t  do_x10, ph_x10, t_x10;
  uint8_t  aer, mode, status;
  uint16_t upt;
  int16_t  rssi;
  float    snr;
};
static TeleBuf  buf[BUF_N];
static uint8_t  bufBosh = 0;
static uint8_t  bufSoni = 0;

// ================================================================
//  PROTOTIPLAR
// ================================================================
void     loraBoshlash();
uint16_t loraCrc16(const uint8_t* d, uint16_t n);
bool     loraKadrYubor(uint8_t* buf, uint16_t len);
void     loraAckYubor(uint8_t seq, uint32_t dst);
void     loraCmdYubor(uint32_t dst, uint8_t cmd, int16_t val);
void     loraQabulTekshir();
void     telemetriyaniYubor(uint32_t src, const uint8_t* p, int16_t rssi, float snr);
bool     fbWriteTele(const TeleBuf& t);
void     buferGaQosh(const TeleBuf& t);
void     buferniBoshat();
void     nodeniRoyxat(uint32_t id);
void     gatewayHolatYubor();
void     buyruqlarniTekshir();
void     firebaseBoshla();
void     apNomParolHisobla();
bool     sozlashPortali(bool cheksiz);
void     ishchiWifiBoshla();
void     wifiNazorat();
void     sozlamalarniYukla();
void     lcdHolat();
void     idGaNom(uint32_t id, char* out);
uint32_t nomdanId(const char* nom);

inline bool taymerOtdimi(unsigned long t0, unsigned long dt) {
  return (millis() - t0) >= dt;
}

// ================================================================
//  ID <-> NOM
// ================================================================
void idGaNom(uint32_t id, char* out) {
  sprintf(out, "AQ%06X", (unsigned)(id & 0xFFFFFF));
}
uint32_t nomdanId(const char* nom) {
  if (!nom || strlen(nom) < 8) return 0;
  return (uint32_t)strtoul(nom + 2, NULL, 16) & 0xFFFFFF;
}

// ================================================================
//  NOYOB AP NOMI VA PAROLI (MAC'dan) — har qurilmada boshqacha
// ================================================================
void apNomParolHisobla() {
  uint64_t mac = ESP.getEfuseMac();
  uint32_t s = (uint32_t)(mac & 0xFFFFFF);
  snprintf(apNom, sizeof(apNom), "AquaGW-%06X", (unsigned)s);

  static const char* T = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  uint32_t x = (uint32_t)(mac ^ (mac >> 24));
  for (int i = 0; i < 8; i++) {
    apParol[i] = T[x % 31];
    x = x * 1103515245u + 12345u;
  }
  apParol[8] = '\0';
}

// ================================================================
//  ============   LoRa   ============  (O'ZGARTIRILMAGAN MANTIQ)
// ================================================================
IRAM_ATTR void loraISR() { loraFlag = true; }

uint16_t loraCrc16(const uint8_t* d, uint16_t n) {
  uint16_t crc = 0xFFFF;
  for (uint16_t i = 0; i < n; i++) {
    crc ^= (uint16_t)d[i] << 8;
    for (uint8_t b = 0; b < 8; b++)
      crc = (crc & 0x8000) ? (uint16_t)((crc << 1) ^ 0x1021) : (uint16_t)(crc << 1);
  }
  return crc;
}

void loraBoshlash() {
  loraSPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);
  esp_task_wdt_reset();
  int st = radio.begin(LORA_FREQ, LORA_BW, LORA_SF, LORA_CR,
                       LORA_SYNCWORD, LORA_POWER, LORA_PREAMBLE);
  lastReinit = millis();
  if (st != RADIOLIB_ERR_NONE) { loraOk = false; return; }
  radio.setCRC(true);
  radio.setPacketReceivedAction(loraISR);
  radio.startReceive();
  loraFlag = false;
  loraOk   = true;
}

static uint16_t loraSarlavha(uint8_t* b, uint8_t type, uint8_t flags, uint8_t seq, uint32_t dst) {
  b[0]=LORA_MAGIC; b[1]=LORA_VER; b[2]=type; b[3]=flags; b[4]=seq;
  b[5]=(uint8_t)GATEWAY_ID; b[6]=(uint8_t)(GATEWAY_ID>>8);
  b[7]=(uint8_t)(GATEWAY_ID>>16); b[8]=(uint8_t)(GATEWAY_ID>>24);
  b[9]=(uint8_t)dst; b[10]=(uint8_t)(dst>>8);
  b[11]=(uint8_t)(dst>>16); b[12]=(uint8_t)(dst>>24);
  return 13;
}
static void loraCrcYoz(uint8_t* b, uint16_t pos) {
  uint16_t c = loraCrc16(b, pos);
  b[pos]=(uint8_t)c; b[pos+1]=(uint8_t)(c>>8);
}

bool loraKadrYubor(uint8_t* buf, uint16_t len) {
  if (!loraOk) return false;
  esp_task_wdt_reset();
  for (uint8_t i = 0; i < CAD_TRIES; i++) {
    int cad = radio.scanChannel();
    if (cad == RADIOLIB_CHANNEL_FREE) break;
    delay(CAD_BACKOFF_MIN + (esp_random() % CAD_BACKOFF_SPAN));
    esp_task_wdt_reset();
  }
  loraFlag = false;
  int st = radio.transmit(buf, len);
  esp_task_wdt_reset();
  radio.startReceive();
  loraFlag = false;
  return (st == RADIOLIB_ERR_NONE);
}

void loraAckYubor(uint8_t seq, uint32_t dst) {
  uint8_t b[20];
  uint16_t p = loraSarlavha(b, FT_ACK, 0, seq, dst);
  b[p++] = seq;
  loraCrcYoz(b, p);
  loraKadrYubor(b, p + 2);
}

void loraCmdYubor(uint32_t dst, uint8_t cmd, int16_t val) {
  uint8_t b[24];
  uint16_t p = loraSarlavha(b, FT_CMD, FLAG_WANTACK, 0, dst);
  b[p++] = cmd;
  b[p++] = (uint8_t)val; b[p++] = (uint8_t)(val >> 8);
  loraCrcYoz(b, p);
  loraKadrYubor(b, p + 2);
  Serial.printf("[LoRa] CMD -> %06X cmd=%u val=%d\n", (unsigned)(dst & 0xFFFFFF), cmd, val);
}

void loraQabulTekshir() {
  if (!loraOk || !loraFlag) return;
  loraFlag = false;

  uint8_t buf[64];
  size_t  len = radio.getPacketLength();
  if (len == 0 || len > sizeof(buf)) { radio.startReceive(); return; }

  int st = radio.readData(buf, len);
  int16_t rssi = (int16_t)radio.getRSSI();
  float   snr  = radio.getSNR();
  radio.startReceive();
  loraFlag = false;
  if (st != RADIOLIB_ERR_NONE || len < 15) return;

  if (buf[0] != LORA_MAGIC || buf[1] != LORA_VER) return;
  uint16_t crcPos = len - 2;
  uint16_t crcH = loraCrc16(buf, crcPos);
  uint16_t crcK = (uint16_t)buf[crcPos] | ((uint16_t)buf[crcPos+1] << 8);
  if (crcH != crcK) return;

  uint8_t  type = buf[2];
  uint8_t  seq  = buf[4];
  uint32_t src  = (uint32_t)buf[5] | ((uint32_t)buf[6]<<8) |
                  ((uint32_t)buf[7]<<16) | ((uint32_t)buf[8]<<24);
  uint32_t dst  = (uint32_t)buf[9] | ((uint32_t)buf[10]<<8) |
                  ((uint32_t)buf[11]<<16) | ((uint32_t)buf[12]<<24);

  if (dst != GATEWAY_ID && dst != BROADCAST_ID) return;

  if (type == FT_TELE) {
    if (len < 26) return;
    loraAckYubor(seq, src);                       // AVVAL ACK (node tez javob kutadi)
    paketSoni++; oxirgiSrc = src; oxirgiRssi = rssi; oxirgiSnr = snr;
    oxirgiPaketVaqti = millis();
    telemetriyaniYubor(src, buf + 13, rssi, snr); // -> Firebase yoki bufferga
  } else if (type == FT_CMDACK) {
    if (len < 17) return;
    uint8_t cmd = buf[13]; uint8_t ok = buf[14];
    Serial.printf("[LoRa] CMDACK <- %06X cmd=%u ok=%u\n",
                  (unsigned)(src & 0xFFFFFF), cmd, ok);
  }
}

// ================================================================
//  TELEMETRIYA -> Firebase + STORE-AND-FORWARD
//  payload (13 dan): do(i16) ph(i16) t(i16) aer(u8) mode(u8) status(u8) uptime(u16)
// ================================================================
void telemetriyaniYubor(uint32_t src, const uint8_t* p, int16_t rssi, float snr) {
  TeleBuf t;
  t.id     = src;
  t.do_x10 = (int16_t)((uint16_t)p[0] | ((uint16_t)p[1] << 8));
  t.ph_x10 = (int16_t)((uint16_t)p[2] | ((uint16_t)p[3] << 8));
  t.t_x10  = (int16_t)((uint16_t)p[4] | ((uint16_t)p[5] << 8));
  t.aer    = p[6];
  t.mode   = p[7];
  t.status = p[8];
  t.upt    = (uint16_t)p[9] | ((uint16_t)p[10] << 8);
  t.rssi   = rssi;
  t.snr    = snr;

  if (fbBoshlandi && Firebase.ready()) {
    if (!fbWriteTele(t)) buferGaQosh(t);
  } else {
    buferGaQosh(t);
    char nom[16]; idGaNom(src, nom);
    Serial.printf("[FB] ulanish yo'q -> %s bufferga (%u/%u)\n", nom, bufSoni, BUF_N);
  }
}

// Bitta o'lchovni Firebase'ga yozish: /nodes/<id>/latest + /nodes/<id>/history
bool fbWriteTele(const TeleBuf& t) {
  char nom[16]; idGaNom(t.id, nom);
  nodeniRoyxat(t.id);

  char pathLatest[48], pathHist[48];
  snprintf(pathLatest, sizeof(pathLatest), "nodes/%s/latest", nom);
  snprintf(pathHist,   sizeof(pathHist),   "nodes/%s/history", nom);

  FirebaseJson js;
  js.set("do",         t.do_x10 / 10.0);
  if (t.status & ST_DOXATO) js.set("do_err", 1);
  js.set("ph",         t.ph_x10 / 10.0);
  if (t.status & ST_PHXATO) js.set("ph_err", 1);
  js.set("t",          t.t_x10 / 10.0);
  js.set("aer",        (int)t.aer);
  js.set("mode",       (int)t.mode);
  js.set("alarm",      (t.status & ST_ALARM)   ? 1 : 0);
  js.set("init",       (t.status & ST_BOSHLAN) ? 1 : 0);
  js.set("manual",     (t.status & ST_QOLRELE) ? 1 : 0);
  js.set("rssi",       (int)t.rssi);
  js.set("snr",        t.snr);
  js.set("uptime_min", (int)t.upt);
  js.set("ts/.sv",     "timestamp");     // server vaqti (ms) — web ilova shu bilan tozaligini tekshiradi

  bool ok = Firebase.RTDB.setJSON(&fbdo, pathLatest, &js);
  if (!ok) { Serial.printf("[FB] latest xato: %s\n", fbdo.errorReason().c_str()); return false; }

  // Tarix uchun yengilroq nuqta
  FirebaseJson h;
  h.set("do",     t.do_x10 / 10.0);
  h.set("ph",     t.ph_x10 / 10.0);
  h.set("t",      t.t_x10 / 10.0);
  h.set("ts/.sv", "timestamp");
  Firebase.RTDB.pushJSON(&fbdo, pathHist, &h);   // tarix yozilmasa ham latest yetarli

  Serial.printf("[FB] %s yozildi (do=%.1f ph=%.1f t=%.1f)\n",
                nom, t.do_x10/10.0, t.ph_x10/10.0, t.t_x10/10.0);
  return true;
}

// ----------------------------------------------------------------
//  Store-and-forward buffer
// ----------------------------------------------------------------
void buferGaQosh(const TeleBuf& t) {
  uint8_t yoz = (bufBosh + bufSoni) % BUF_N;
  if (bufSoni == BUF_N) bufBosh = (bufBosh + 1) % BUF_N;  // to'ldi -> eng eskisini tashlaymiz
  else                  bufSoni++;
  buf[yoz] = t;
}

void buferniBoshat() {
  uint8_t yuborildi = 0;
  while (bufSoni > 0 && yuborildi < 5 && fbBoshlandi && Firebase.ready()) {
    if (fbWriteTele(buf[bufBosh])) {
      bufBosh = (bufBosh + 1) % BUF_N;
      bufSoni--;
      yuborildi++;
      esp_task_wdt_reset();
    } else break;
  }
  if (yuborildi) Serial.printf("[FB] buferdan %u ta yuborildi (qoldi %u)\n", yuborildi, bufSoni);
}

// Qurilmani ichki ro'yxatga olish (faqat hisob uchun)
void nodeniRoyxat(uint32_t id) {
  for (uint8_t i = 0; i < ulanganSoni; i++)
    if (ulanganNodelar[i] == id) return;
  if (ulanganSoni < MAX_NODES) ulanganNodelar[ulanganSoni++] = id;
}

// ----------------------------------------------------------------
//  SHLYUZNING O'Z HOLATI -> /gateway/<gwid>/status
// ----------------------------------------------------------------
void gatewayHolatYubor() {
  if (!fbBoshlandi || !Firebase.ready()) return;
  if (!taymerOtdimi(lastGwTele, GW_TELE_MS)) return;
  lastGwTele = millis();

  char gwid[24];
  snprintf(gwid, sizeof(gwid), "AquaGW-%06X", (unsigned)(ESP.getEfuseMac() & 0xFFFFFF));
  char path[48];
  snprintf(path, sizeof(path), "gateway/%s/status", gwid);

  FirebaseJson d;
  d.set("gw_rssi",   (WiFi.status() == WL_CONNECTED) ? (int)WiFi.RSSI() : 0);
  d.set("gw_heap",   (int)ESP.getFreeHeap());
  d.set("gw_uptime", (int)(millis() / 1000));
  d.set("lora",      loraOk ? 1 : 0);
  d.set("nodes",     (int)ulanganSoni);
  d.set("pkts",      (int)paketSoni);
  d.set("buf",       (int)bufSoni);
  d.set("ts/.sv",    "timestamp");
  Firebase.RTDB.setJSON(&fbdo, path, &d);
}

// ================================================================
//  ============   BUYRUQLAR (web ilovadan)   ============
//  Web ilova /commands ga push qiladi: {node:"AQxxxxxx", aer:1, ts:...}
//  Bu yerda o'qiladi -> LoRa CMD yuboriladi -> Firebase'dan o'chiriladi.
// ================================================================
void buyruqlarniTekshir() {
  if (!fbBoshlandi || !Firebase.ready()) return;
  if (!taymerOtdimi(lastCmdPoll, CMD_POLL_MS)) return;
  lastCmdPoll = millis();

  if (!Firebase.RTDB.getJSON(&fbdo, "commands")) return;
  String all = fbdo.to<String>();
  if (all.length() < 3 || all == "null") return;

  DynamicJsonDocument doc(3072);
  if (deserializeJson(doc, all)) return;
  if (!doc.is<JsonObject>()) return;

  for (JsonPair kv : doc.as<JsonObject>()) {
    const char* key = kv.key().c_str();
    JsonObject c = kv.value().as<JsonObject>();
    const char* node = c["node"] | (const char*)nullptr;
    uint32_t id = nomdanId(node);

    if (id) {
      uint8_t cmd = 0; int16_t val = 0; bool ok = true;
      if      (c.containsKey("aer"))    cmd = ((int)c["aer"] ? CMD_AER_ON : CMD_AER_AUTO);
      else if (c.containsKey("mindo")){ cmd = CMD_MINDO;  val = (int16_t)c["mindo"]; }
      else if (c.containsKey("farq")) { cmd = CMD_FARQ;   val = (int16_t)c["farq"]; }
      else if (c.containsKey("kritik")){cmd = CMD_KRITIK; val = (int16_t)c["kritik"]; }
      else if (c.containsKey("mode"))  { cmd = CMD_MODE;  val = (int16_t)c["mode"]; }
      else if (c.containsKey("status")) cmd = CMD_STATUS;
      else ok = false;
      if (ok) loraCmdYubor(id, cmd, val);
    }

    // Bajarilgan (yoki noto'g'ri) buyruqni o'chiramiz
    String dpath = String("commands/") + key;
    Firebase.RTDB.deleteNode(&fbdo, dpath.c_str());
    esp_task_wdt_reset();
  }
}

// ================================================================
//  ============   FIREBASE init   ============
// ================================================================
void firebaseBoshla() {
  if (fbApiKey[0] == '\0' || fbDbUrl[0] == '\0' || fbEmail[0] == '\0') {
    Serial.println("[FB] sozlamalar to'liq emas — portaldan kiriting");
    fbBoshlandi = false;
    return;
  }
  fbconfig.api_key      = fbApiKey;
  fbconfig.database_url = fbDbUrl;
  fbauth.user.email     = fbEmail;
  fbauth.user.password  = fbPass;
  fbconfig.token_status_callback = tokenStatusCallback;  // addons/TokenHelper.h

  Firebase.reconnectWiFi(true);
  fbdo.setBSSLBufferSize(4096, 1024);
  fbdo.setResponseSize(4096);
  Firebase.begin(&fbconfig, &fbauth);
  fbBoshlandi = true;
  Serial.printf("[FB] boshlandi | DB: %s\n", fbDbUrl);
}

// ================================================================
//  ============   WiFi + SOZLAMALAR (NVS)   ============
// ================================================================
void sozlamalarniYukla() {
  prefs.getString("apikey", fbApiKey, sizeof(fbApiKey));
  prefs.getString("dburl",  fbDbUrl,  sizeof(fbDbUrl));
  prefs.getString("email",  fbEmail,  sizeof(fbEmail));
  prefs.getString("pass",   fbPass,   sizeof(fbPass));
}

// Sozlash portali (lokal WiFiManager — joriy qiymatlarni ko'rsatadi).
bool sozlashPortali(bool cheksiz) {
  WiFiManager wm;
  WiFiManagerParameter p_apikey("apikey", "Firebase API key",  fbApiKey, 47);
  WiFiManagerParameter p_dburl ("dburl",  "Database URL",      fbDbUrl,  95);
  WiFiManagerParameter p_email ("email",  "Qurilma email",     fbEmail,  47);
  WiFiManagerParameter p_pass  ("pass",   "Qurilma parol",     fbPass,   39);
  wm.addParameter(&p_apikey);
  wm.addParameter(&p_dburl);
  wm.addParameter(&p_email);
  wm.addParameter(&p_pass);
  wm.setConnectTimeout(20);
  wm.setConfigPortalTimeout(cheksiz ? 0 : PORTAL_TIMEOUT_S);

#if USE_LCD
  lcd.clear();
  lcd.setCursor(0,0); lcd.print(apNom);
  lcd.setCursor(0,1); lcd.print("P:"); lcd.print(apParol);
#endif
  Serial.printf("[WiFi] Sozlash portali: SSID=%s  PAROL=%s\n", apNom, apParol);

  esp_task_wdt_delete(NULL);
  bool ok = wm.startConfigPortal(apNom, apParol);
  esp_task_wdt_add(NULL);

  // Kiritilgan Firebase qiymatlarini saqlash
  strncpy(fbApiKey, p_apikey.getValue(), sizeof(fbApiKey)-1);
  strncpy(fbDbUrl,  p_dburl.getValue(),  sizeof(fbDbUrl)-1);
  strncpy(fbEmail,  p_email.getValue(),  sizeof(fbEmail)-1);
  strncpy(fbPass,   p_pass.getValue(),   sizeof(fbPass)-1);
  fbApiKey[sizeof(fbApiKey)-1]=0; fbDbUrl[sizeof(fbDbUrl)-1]=0;
  fbEmail[sizeof(fbEmail)-1]=0;   fbPass[sizeof(fbPass)-1]=0;

  prefs.putString("apikey", fbApiKey);
  prefs.putString("dburl",  fbDbUrl);
  prefs.putString("email",  fbEmail);
  prefs.putString("pass",   fbPass);

  if (ok) {
    prefs.putBool("wifiok", true);
    firebaseBoshla();                        // yangi sozlama bilan qayta ulanamiz
    Serial.println("[WiFi] ulandi | Firebase qayta boshlandi");
  } else {
    Serial.println("[WiFi] portal vaqti tugadi/yopildi");
  }
  return ok;
}

void ishchiWifiBoshla() {
  Serial.println("[WiFi] saqlangan tarmoqqa ulanyapti...");
#if USE_LCD
  lcd.clear();
  lcd.setCursor(0,0); lcd.print("WiFi ulanyapti  ");
#endif
  WiFi.begin();
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - t0) < 25000UL) {
    delay(250);
    esp_task_wdt_reset();
  }
  Serial.printf("[WiFi] %s\n",
    WiFi.status() == WL_CONNECTED ? "ulandi" : "hozircha ulanmadi (fonda davom etadi)");
}

// ----------------------------------------------------------------
//  WiFi NAZORATI — abadiy uzilib qolmaslik (SANOAT)
// ----------------------------------------------------------------
void wifiNazorat() {
  if (WiFi.status() == WL_CONNECTED) { wifiUzilganVaqt = 0; return; }

  if (wifiUzilganVaqt == 0) {
    wifiUzilganVaqt = millis();
    lastWifiKick    = millis();
    Serial.println("[WiFi] uzildi — kuzatuv boshlandi");
    return;
  }
  if (taymerOtdimi(lastWifiKick, (unsigned long)WIFI_KICK_S * 1000UL)) {
    lastWifiKick = millis();
    Serial.println("[WiFi] qayta ulanishga urinish...");
    WiFi.disconnect();
    WiFi.begin();
  }
  if (taymerOtdimi(wifiUzilganVaqt, (unsigned long)WIFI_FAIL_PORTAL_DK * 60000UL)) {
    Serial.println("[WiFi] uzoq ulanmadi -> AVTOMATIK SOZLASH PORTALI");
    sozlashPortali(false);
    wifiUzilganVaqt = 0;
    if (WiFi.status() != WL_CONNECTED) ishchiWifiBoshla();
  }
}

// ================================================================
//  ============   HOLAT LCD   ============
// ================================================================
void lcdHolat() {
#if USE_LCD
  if (!taymerOtdimi(lastLcdYangi, 1000UL)) return;
  lastLcdYangi = millis();

  lcd.setCursor(0, 0);
  bool w = (WiFi.status() == WL_CONNECTED);
  bool f = (fbBoshlandi && Firebase.ready());
  lcd.print("W:"); lcd.print(w ? "OK " : "-- ");
  lcd.print("FB:"); lcd.print(f ? "OK " : "-- ");
  lcd.print("L:"); lcd.print(loraOk ? "OK" : "--");

  lcd.setCursor(0, 1);
  if (paketSoni == 0) {
    lcd.print("Paket kutilyapti");
  } else {
    char nom[16]; idGaNom(oxirgiSrc, nom);
    char l[17];
    snprintf(l, sizeof(l), "%s %ddBm   ", nom, oxirgiRssi);
    l[16] = '\0';
    lcd.print(l);
  }
#endif
}

// ================================================================
//  SETUP
// ================================================================
void setup() {
  Serial.begin(115200);
  delay(100);

  prefs.begin("gw", false);
  apNomParolHisobla();

  // 3x TEZ YOQIB-O'CHIRISH = sozlash rejimi
  uint8_t rstCnt = prefs.getUChar("rstcnt", 0) + 1;
  prefs.putUChar("rstcnt", rstCnt);
  bool uchKarra = (rstCnt >= 3);
  if (uchKarra) prefs.putUChar("rstcnt", 0);

  pinMode(0, INPUT_PULLUP);
  delay(50);
  bool majburiyPortal = (digitalRead(0) == LOW) || uchKarra;
  if (majburiyPortal) Serial.println("[GW] >>> SOZLASH REJIMI <<<");

#if USE_LCD
  Wire.begin(21, 22);
  Wire.setClock(100000);
  Wire.setTimeOut(50);
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("AQUA GW v3 (FB) ");
  lcd.setCursor(0, 1); lcd.print("ishga tushmoqda ");
  delay(1000);
#endif

  sozlamalarniYukla();
  loraBoshlash();
  Serial.printf("[LoRa] %s\n", loraOk ? "OK" : "NOSOZ");

#if ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_task_wdt_config_t wdt_config = { .timeout_ms = 10000, .idle_core_mask = 0, .trigger_panic = true };
  esp_task_wdt_reconfigure(&wdt_config);
#else
  esp_task_wdt_init(10, true);
#endif
  esp_task_wdt_add(NULL);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);

  bool sozlangan = prefs.getBool("wifiok", false);
  if (majburiyPortal || !sozlangan) {
    sozlashPortali(true);          // birinchi o'rnatish — cheksiz (firebaseBoshla ichida chaqiriladi)
  } else {
    ishchiWifiBoshla();            // saqlangan tarmoqqa ulanish
    firebaseBoshla();              // Firebase'ni ishga tushiramiz
  }

#if USE_LCD
  lcd.clear();
#endif
  Serial.println("[GW] tayyor");
}

// ================================================================
//  LOOP
// ================================================================
void loop() {
  esp_task_wdt_reset();

  static bool rstTozalandi = false;
  if (!rstTozalandi && millis() > 8000UL) {
    prefs.putUChar("rstcnt", 0);
    rstTozalandi = true;
  }

  // 1) LoRa qabul (telemetriya/CMDACK) — ACK darhol
  loraQabulTekshir();

  // 2) WiFi nazorati (uzilsa tiklash / avariya portali)
  wifiNazorat();

  // 3) Firebase ishlari (faqat WiFi va token tayyor bo'lsa)
  if (WiFi.status() == WL_CONNECTED && fbBoshlandi && Firebase.ready()) {
    buferniBoshat();          // saqlangan telemetriyani yuborish
    gatewayHolatYubor();      // shlyuz holati (30s)
    buyruqlarniTekshir();     // web ilovadan buyruqlar (2s)
  }

  // 4) LoRa nosoz bo'lsa davriy qayta urinish
  if (!loraOk && taymerOtdimi(lastReinit, LORA_REINIT_MS)) loraBoshlash();

  // 5) Holat LCD
  lcdHolat();
}
