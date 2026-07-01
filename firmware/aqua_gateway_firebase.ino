// ================================================================
//  AQUA GATEWAY (LoRa <-> WiFi/FIREBASE) v3.1  -  ESP32 + SX1278/Ra-02
//  Baliq ko'llari tizimi SHLYUZI  —  FIREBASE versiyasi
//
//  v3.1 TUZATILGAN MUAMMOLAR:
//    Fix A  — LoRa RST GPIO 2 → GPIO 25 (boot strapping pin muammosi hal qilindi)
//    Fix B  — Firebase credentials kod ichidan NVS + WiFiManager portaliga ko'chirildi
//    Fix C  — GATEWAY_ID runtime o'zgaruvchiga aylandi (NVS, multi-gateway qo'llab-quvvatlash)
//    Fix D  — apNomParolHisobla: x%31 → x%32 (barcha 32 belgi ishlatiladi)
//    Fix E  — loraBoshlash: loraSPI.begin() faqat bir marta chaqiriladi
//    Fix F  — loraQabulTekshir: len<42 → len<40 (haqiqiy kadr = 40 bayt; KRITIK FIX)
//    Fix G  — fbWriteTele: nodeniRoyxat() ikki marta chaqirilishi o'chirildi
//    Fix H  — fbWriteTele: history yozuv xatosi endi aniqlanadi va loglanadi
//    Fix I  — gatewayHolatYubor: gw_uptime int overflow (24 kun) → double bilan hal qilindi
//    Fix J  — buyruqlarniTekshir CMD_MODE: qolReleYoq reset — node v16 da tuzatildi
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
//      SCK->18 | MISO->35 | MOSI->23 | NSS->15 | RST->25 | DIO0->34  // BUG-H2 FIX
//      VCC->3.3V (5V EMAS!) | GND->GND | ANTENNA 433MHz (antennasiz yoqmang!)
//  --- HOLAT LCD (ixtiyoriy 16x2 I2C): SDA->21 | SCL->22 ---
//
//  >>> FIREBASE sozlamalari pastda KOD ICHIDA (hamma qurilma uchun bir xil).
//      Qurilmaga faqat WiFi sozlanadi: "AquaGW-XXXXXX" tarmog'iga ulanib,
//      telefon orqali WiFi nomi va paroli kiritiladi. Qurilma o'z chip ID'si
//      bilan o'zini tanitadi -> /nodes/AQxxxxxx, /gateway/AquaGW-xxxxxx.
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
#include <time.h>   // FIX #4: NTP vaqt tekshiruvi uchun

#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// ================================================================
//  FIREBASE SOZLAMALARI — Fix B: Credentials endi KOD ICHIDA EMAS.
//  Birinchi yoqilishda WiFiManager portali orqali kiritiladi va NVS'ga saqlanadi.
//  Keyingi yoqilishlarda NVS'dan avtomatik o'qiladi.
//  Portalni qayta ochish: 3x tez yoqib-o'chirish yoki BOOT tugmasini bosib yoqish.
// ================================================================
static char fbApiKey[80]    = "";   // Firebase API Key  (AIza... bilan boshlanadi)
static char fbDbUrl[128]    = "";   // Realtime DB URL   (https://...firebasedatabase.app)
static char fbEmail[64]     = "";   // Device user email (device@yourdomain.uz)
static char fbPassword[64]  = "";   // Device user paroli

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
#define LORA_RST   25   // Fix A: GPIO 2 (boot strapping pin) dan GPIO 25 ga ko'chirildi
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

// Fix C: GATEWAY_ID endi const emas — NVS dan yuklanadi, portal orqali o'zgartirilishi mumkin.
// Bir maydonda 2+ gateway uchun har birida boshqa ID o'rnatiladi.
// Mos node'larda ham "gwid" NVS kaliti o'zgartiriladi.
// Standart: 0x00000001 (barcha mavjud node'lar bilan mos keladi).
static uint32_t       GATEWAY_ID   = 0x00000001UL;  // Fix C: NVS dan yuklanadi
static const uint32_t BROADCAST_ID = 0xFFFFFFFFUL;

#define CMD_AER_ON    0x01
#define CMD_AER_AUTO  0x02
#define CMD_MINDO     0x03
#define CMD_FARQ      0x04
#define CMD_KRITIK    0x05
#define CMD_MODE      0x06
#define CMD_STATUS    0x07
#define CMD_TIME      0x08   // Fix 6: val = Unix timestamp — Node RTC ni sinxronlash
#define CMD_HIST      0x09   // Fix 13: NVS tarixini so'rash

#define FT_HIST       5      // Fix 13: node -> gateway tarix paketi

#define ST_DOXATO      0x01
#define ST_PHXATO      0x02
#define ST_ALARM       0x04
#define ST_BOSHLAN     0x08
#define ST_QOLRELE     0x10
#define ST_KRITIK_XATO 0x20  // Fix 9: kritikDo >= minDo

// ================================================================
//  (Firebase sozlamalari NVS'da saqlanadi — WiFiManager portal orqali kiritiladi)
// ================================================================

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

// BUG-S5 FIX: StaticJsonDocument global (fragmentatsiya yo'q)
static StaticJsonDocument<3072> cmdDoc;

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
#define NODE_IDX_OVERFLOW 0xFF  // BUG-S2 FIX: MAX_NODES to'ldi signali
static uint32_t ulanganNodelar[MAX_NODES];
static uint8_t  ulanganSoni = 0;
// Fix 11: ring buffer indekslari (288 slot = 24 soat)
static uint16_t nodeHistIdx[MAX_NODES];

static uint32_t paketSoni   = 0;
static uint32_t oxirgiSrc   = 0;
static int16_t  oxirgiRssi  = 0;
static float    oxirgiSnr   = 0;
static unsigned long oxirgiPaketVaqti = 0;

static unsigned long lastLcdYangi = 0;
static unsigned long lastGwTele   = 0;
static const unsigned long GW_TELE_MS = 30000UL;
static unsigned long lastCmdPoll  = 0;
static const unsigned long CMD_POLL_MS = 2000UL;
// Fix 6: NTP → Node RTC sinxronizatsiyasi
static unsigned long lastTimeSent  = 0;
static const unsigned long TIME_SYNC_MS = 3600000UL;  // har 1 soat

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
  int16_t  mindo, farqdo, kritik;   // Fix #1
  uint32_t rtc_ts;                   // Fix 10: qurilma RTC Unix timestamp
  uint8_t  data_age;                 // Fix 7:  ma'lumot necha daqiqa oldingi
  uint8_t  sched_cnt;                // Fix 6:  vaqt jadvali yozuvlari soni
  uint16_t man_remain;               // Fix 12: manual timeout qolgan daqiqalar
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
void     loraCmdYubor(uint32_t dst, uint8_t cmd, int32_t val);  // Fix 6: int32_t
void     loraQabulTekshir();
void     telemetriyaniYubor(uint32_t src, const uint8_t* p, int16_t rssi, float snr);
bool     fbWriteTele(const TeleBuf& t);
void     buferGaQosh(const TeleBuf& t);
void     buferniBoshat();
uint8_t  nodeniRoyxat(uint32_t id);   // Fix 11: indeks qaytaradi
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
void     histKaydYoz(uint32_t src, uint8_t idx, uint8_t total,   // Fix 13
                      uint8_t oy, uint8_t kun, uint8_t soat,
                      uint8_t daqiqa, uint8_t doB);
void     nodegaVaqtYuborish();         // Fix 6: NTP→Node RTC sinxronizatsiya
uint32_t nomdanId(const char* nom);

inline bool taymerOtdimi(unsigned long t0, unsigned long dt) {
  return (millis() - t0) >= dt;
}

// ================================================================
//  ID <-> NOM
// ================================================================
// FIX #5: 06X -> 08X (Node bilan to'liq mos: AQ + 8 hex belgi)
void idGaNom(uint32_t id, char* out) {
  sprintf(out, "AQ%08X", (unsigned)id);
}
uint32_t nomdanId(const char* nom) {
  if (!nom || strlen(nom) < 10) return 0;   // FIX #5: "AQ" + 8 belgi = 10 minimum
  return (uint32_t)strtoul(nom + 2, NULL, 16);  // FIX #5: & 0xFFFFFF olib tashlandi
}

// ================================================================
//  NOYOB AP NOMI VA PAROLI (MAC'dan) — har qurilmada boshqacha
// ================================================================
void apNomParolHisobla() {
  uint64_t mac = ESP.getEfuseMac();
  uint32_t s = (uint32_t)(mac & 0xFFFFFF);
  snprintf(apNom, sizeof(apNom), "AquaGW-%06X", (unsigned)s);

  static const char* T = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";  // 32 belgi (indeks 0-31)
  uint32_t x = (uint32_t)(mac ^ (mac >> 24));
  for (int i = 0; i < 8; i++) {
    apParol[i] = T[x % 32];   // Fix D: % 31 → % 32 (barcha 32 belgi ishlatiladi, '9' ham)
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
  // Fix E: SPI shinasi faqat birinchi marta ishga tushiriladi.
  // Har 30s qayta init chaqiruvida loraSPI.begin() takrorlanmaydi.
  static bool spiInit = false;
  if (!spiInit) {
    loraSPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);
    spiInit = true;
  }
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

// Fix 6: val int32_t (CMD_TIME uchun katta Unix timestamp qo'llab-quvvatlanadi)
void loraCmdYubor(uint32_t dst, uint8_t cmd, int32_t val) {
  uint8_t b[24];
  uint16_t p = loraSarlavha(b, FT_CMD, FLAG_WANTACK, 0, dst);
  b[p++] = cmd;
  b[p++] = (uint8_t)val;        b[p++] = (uint8_t)(val >> 8);
  b[p++] = (uint8_t)(val >> 16); b[p++] = (uint8_t)(val >> 24);
  loraCrcYoz(b, p);
  loraKadrYubor(b, p + 2);
  Serial.printf("[LoRa] CMD -> %08X cmd=%u val=%ld\n", (unsigned)dst, cmd, (long)val);  // FIX #5
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
    if (len < 40) return;   // Fix F (KRITIK): header(13)+payload(25)+CRC(2)=40 bayt.
                             // Avvalgi len<42 barcha node telemetriyasini rad etardi!
    loraAckYubor(seq, src);
    paketSoni++; oxirgiSrc = src; oxirgiRssi = rssi; oxirgiSnr = snr;
    oxirgiPaketVaqti = millis();
    telemetriyaniYubor(src, buf + 13, rssi, snr);
  } else if (type == FT_CMDACK) {
    if (len < 17) return;
    uint8_t cmd = buf[13]; uint8_t ok = buf[14];
    // FIX #3: buyruq bajarilgani Firebase ga yoziladi
    if (fbBoshlandi && Firebase.ready()) {
      char nom[16]; idGaNom(src, nom);
      char path[64];
      snprintf(path, sizeof(path), "nodes/%s/latest", nom);
      FirebaseJson js;
      js.set("last_cmd",        (int)cmd);
      js.set("last_cmd_ok",     (int)ok);
      js.set("last_cmd_ts/.sv", "timestamp");
      Firebase.RTDB.updateNode(&fbdo, path, &js);
    }
    Serial.printf("[LoRa] CMDACK <- %08X cmd=%u ok=%u\n", (unsigned)src, cmd, ok);
  } else if (type == FT_HIST) {
    // Fix 13: NVS tarix yozuvi keldi — Firebase ga yozamiz
    if (len < 23) return;   // 13+8+2=23
    uint8_t hidx  = buf[13]; uint8_t htot = buf[14];
    uint8_t hoy   = buf[15]; uint8_t hkun = buf[16];
    uint8_t hsoat = buf[17]; uint8_t hdaq = buf[18];
    uint8_t hdob  = buf[19];
    histKaydYoz(src, hidx, htot, hoy, hkun, hsoat, hdaq, hdob);
  }
}

// ================================================================
//  TELEMETRIYA -> Firebase + STORE-AND-FORWARD
//  payload (13 dan): 27 bayt ma'lumot
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
  // Fix #1
  t.mindo  = (int16_t)((uint16_t)p[11] | ((uint16_t)p[12] << 8));
  t.farqdo = (int16_t)((uint16_t)p[13] | ((uint16_t)p[14] << 8));
  t.kritik = (int16_t)((uint16_t)p[15] | ((uint16_t)p[16] << 8));
  // Fix 10: RTC Unix timestamp
  t.rtc_ts = (uint32_t)p[17] | ((uint32_t)p[18] << 8) |
             ((uint32_t)p[19] << 16) | ((uint32_t)p[20] << 24);
  // Fix 7: data eskirganlik
  t.data_age  = p[21];
  // Fix 6: vaqt jadvali soni
  t.sched_cnt = p[22];
  // Fix 12: manual timeout qolgan vaqt
  t.man_remain = (uint16_t)p[23] | ((uint16_t)p[24] << 8);
  t.rssi = rssi;
  t.snr  = snr;

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
  // Fix G: nodeniRoyxat() faqat bir marta chaqiriladi va indeksi saqlanadi.
  //        Avvalgi versiyada yuqorida return qiymati e'tiborga olinmagan ortiqcha chaqiruv bor edi.
  uint8_t nodeIdx = nodeniRoyxat(t.id);

  char pathLatest[64], pathHist[72];
  snprintf(pathLatest, sizeof(pathLatest), "nodes/%s/latest", nom);

  FirebaseJson js;
  js.set("do",          t.do_x10 / 10.0);
  if (t.status & ST_DOXATO) js.set("do_err", 1);
  js.set("ph",          t.ph_x10 / 10.0);
  if (t.status & ST_PHXATO) js.set("ph_err", 1);
  js.set("t",           t.t_x10 / 10.0);
  js.set("aer",         (int)t.aer);
  js.set("mode",        (int)t.mode);
  js.set("alarm",       (t.status & ST_ALARM)       ? 1 : 0);
  js.set("init",        (t.status & ST_BOSHLAN)     ? 1 : 0);
  js.set("manual",      (t.status & ST_QOLRELE)     ? 1 : 0);
  js.set("kritik_xato", (t.status & ST_KRITIK_XATO) ? 1 : 0);  // Fix 9
  js.set("rssi",        (int)t.rssi);
  js.set("snr",         t.snr);
  js.set("uptime_min",  (int)t.upt);
  js.set("mindo",       t.mindo  / 10.0);   // Fix #1
  js.set("farqdo",      t.farqdo / 10.0);   // Fix #1
  js.set("kritik",      t.kritik / 10.0);   // Fix #1
  js.set("rtc_ts",      (int)t.rtc_ts);     // Fix 10: qurilma RTC vaqti
  js.set("data_age",    (int)t.data_age);   // Fix 7: ma'lumot eskirganlik (daqiqa)
  js.set("sched_cnt",   (int)t.sched_cnt);  // Fix 6: vaqt jadvali yozuvlari
  js.set("man_remain",  (int)t.man_remain); // Fix 12: manual timeout qolgan vaqt
  js.set("ts/.sv",      "timestamp");

  bool ok = Firebase.RTDB.setJSON(&fbdo, pathLatest, &js);
  if (!ok) { Serial.printf("[FB] latest xato: %s\n", fbdo.errorReason().c_str()); return false; }

  // BUG-S2 FIX: MAX_NODES to'lgan node uchun history guard.
  // nodeIdx == NODE_IDX_OVERFLOW bo'lsa history yozilmaydi (data corruption yo'q).
  bool histMumkin = (nodeIdx != NODE_IDX_OVERFLOW);
  char slot[4] = "---";
  if (histMumkin) {
    snprintf(slot, sizeof(slot), "%03u", nodeHistIdx[nodeIdx] % 288);
    snprintf(pathHist, sizeof(pathHist), "nodes/%s/history/%s", nom, slot);
    FirebaseJson h;
    h.set("do",     t.do_x10 / 10.0);
    h.set("ph",     t.ph_x10 / 10.0);
    h.set("t",      t.t_x10 / 10.0);
    h.set("ts/.sv", "timestamp");
    bool histOk = Firebase.RTDB.setJSON(&fbdo, pathHist, &h);
    if (!histOk) {
      Serial.printf("[FB] history xato (slot=%s): %s\n", slot, fbdo.errorReason().c_str());
      // indeks oshirilmaydi — keyingi muvaffaqiyatli yozuvda shu slot ishlatiladi
    } else {
      nodeHistIdx[nodeIdx] = (nodeHistIdx[nodeIdx] + 1) % 288;
    }
  }

  Serial.printf("[FB] %s yozildi (do=%.1f ph=%.1f t=%.1f slot=%s)\n",
                nom, t.do_x10/10.0, t.ph_x10/10.0, t.t_x10/10.0, slot);
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

// BUG-S2 FIX: nodeniRoyxat() — sanoat darajali yechim.
// NODE_IDX_OVERFLOW (0xFF) qaytsa: MAX_NODES to'ldi.
//   fbWriteTele() bu holatda FAQAT latest yozadi (data corruption yo'q).
uint8_t nodeniRoyxat(uint32_t id) {
  for (uint8_t i = 0; i < ulanganSoni; i++)
    if (ulanganNodelar[i] == id) return i;
  if (ulanganSoni < MAX_NODES) {
    ulanganNodelar[ulanganSoni] = id;
    nodeHistIdx[ulanganSoni]    = 0;
    Serial.printf("[GW] Yangi node: %08X (idx=%u, jami=%u)\n",
                  (unsigned)id, (unsigned)ulanganSoni, (unsigned)(ulanganSoni + 1));
    return ulanganSoni++;
  }
  // MAX_NODES to'ldi — history yozilmaydi, latest davom etadi
  Serial.printf("[GW] OGOHLANTIRISH: MAX_NODES(%u) to'ldi! %08X history saqlanmaydi.\n",
                MAX_NODES, (unsigned)id);
  return NODE_IDX_OVERFLOW;
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
  d.set("gw_uptime", (double)(millis() / 1000UL)); // Fix I: int cast 24 kundan keyin negatif berardi → double ishlatiladi
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

  // BUG-S5 FIX: Global cmdDoc ishlatiladi (bir marta ajratilgan, har safar tozalanadi)
  cmdDoc.clear();
  if (deserializeJson(cmdDoc, all)) return;
  if (!cmdDoc.is<JsonObject>()) return;

  // FIX #4: joriy vaqt (NTP sinxronlangan bo'lsa)
  time_t now_t;
  time(&now_t);
  bool vaqtSinxron = (now_t > 1700000000L);   // 2023-yildan katta = NTP ishlagan

  for (JsonPair kv : cmdDoc.as<JsonObject>()) {
    const char* key = kv.key().c_str();
    JsonObject c = kv.value().as<JsonObject>();
    String dpath = String("commands/") + key;

    // FIX #4: 10 daqiqadan eski buyruqlarni bajarmasdan o'chiramiz
    if (vaqtSinxron && c.containsKey("ts")) {
      long long ts_ms  = c["ts"].as<long long>();
      long long now_ms = (long long)now_t * 1000LL;
      if (ts_ms > 0 && (now_ms - ts_ms) > 600000LL) {
        Serial.printf("[CMD] Eski buyruq o'chirildi: key=%s\n", key);
        Firebase.RTDB.deleteNode(&fbdo, dpath.c_str());
        esp_task_wdt_reset();
        continue;
      }
    }

    const char* node = c["node"] | (const char*)nullptr;
    uint32_t id = nomdanId(node);

    if (id) {
      uint8_t cmd = 0; int32_t val = 0; bool ok = true;
      bool validatsiyaXato = false;

      if (c.containsKey("aer")) {
        int aerVal = (int)c["aer"];
        cmd = (aerVal ? CMD_AER_ON : CMD_AER_AUTO);
        // Fix 12: ixtiyoriy timeout daqiqada (0=cheksiz)
        if (aerVal && c.containsKey("timeout")) {
          int tm = (int)c["timeout"];
          val = (int32_t)(tm >= 0 && tm <= 1440 ? tm : 0);
        }
      }
      else if (c.containsKey("mindo")) {
        int v = (int)c["mindo"];
        // Fix 8: qiymat tekshiruvi
        if (v < 1 || v > 20) { ok = false; validatsiyaXato = true; }
        else { cmd = CMD_MINDO; val = (int32_t)v; }
      }
      else if (c.containsKey("farq")) {
        int v = (int)c["farq"];
        if (v < 1 || v > 10) { ok = false; validatsiyaXato = true; }
        else { cmd = CMD_FARQ; val = (int32_t)v; }
      }
      else if (c.containsKey("kritik")) {
        int v = (int)c["kritik"];
        if (v < 1 || v > 20) { ok = false; validatsiyaXato = true; }
        else { cmd = CMD_KRITIK; val = (int32_t)v; }
      }
      else if (c.containsKey("mode")) {
        int v = (int)c["mode"];
        if (v != 0 && v != 1) { ok = false; validatsiyaXato = true; }
        else { cmd = CMD_MODE; val = (int32_t)v; }
      }
      else if (c.containsKey("time")) {
        // Fix 6: ilovadan vaqt yuborish (Unix seconds)
        int32_t ts = (int32_t)c["time"].as<long>();
        if (ts > 1700000000L) { cmd = CMD_TIME; val = ts; }
        else { ok = false; validatsiyaXato = true; }
      }
      else if (c.containsKey("hist")) {
        cmd = CMD_HIST; val = 0;  // Fix 13: NVS tarix so'rash
      }
      else if (c.containsKey("status")) { cmd = CMD_STATUS; }
      else { ok = false; }

      // Fix 8: xato qiymat haqida Firebase ga xabar
      if (validatsiyaXato && fbBoshlandi && Firebase.ready()) {
        Serial.printf("[CMD] Noto'g'ri qiymat: %s\n", key);
        char errPath[72];
        snprintf(errPath, sizeof(errPath), "nodes/%s/cmd_error",
                 node ? node : "unknown");
        FirebaseJson ej;
        ej.set("msg",    "Noto'g'ri buyruq qiymati");
        ej.set("key",    key);
        ej.set("ts/.sv", "timestamp");
        Firebase.RTDB.updateNode(&fbdo, errPath, &ej);
      }

      if (ok) loraCmdYubor(id, cmd, val);
    }

    Firebase.RTDB.deleteNode(&fbdo, dpath.c_str());
    esp_task_wdt_reset();
  }
}

// ================================================================
//  ============   FIREBASE init   ============
// ================================================================
void firebaseBoshla() {
  // Fix B: #define FB_* o'rniga NVS'dan yuklangan char array o'zgaruvchilar ishlatiladi.
  // Agar biron kalit bo'sh bo'lsa — Firebase'ni ishga tushurmaymiz (portal kerak).
  if (strlen(fbApiKey) == 0 || strlen(fbEmail) == 0 ||
      strlen(fbPassword) == 0 || strlen(fbDbUrl) == 0) {
    Serial.println("[FB] DIQQAT: Firebase sozlamalari to'ldirilmagan — portal orqali kiriting!");
    fbBoshlandi = false;
    return;
  }
  fbconfig.api_key      = fbApiKey;
  fbconfig.database_url = fbDbUrl;
  fbauth.user.email     = fbEmail;
  fbauth.user.password  = fbPassword;
  fbconfig.token_status_callback = tokenStatusCallback;  // addons/TokenHelper.h

  // FIX #4: NTP vaqt sinxronizatsiyasi (eski buyruqlarni aniqlash uchun)
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

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
// ================================================================
//  ============   WiFi + SOZLAMALAR (NVS)   ============
// ================================================================
void sozlamalarniYukla() {
  // Fix B: Firebase credentials NVS'dan yuklanadi (kod ichida emas).
  prefs.getString("fbApiKey",   fbApiKey,   sizeof(fbApiKey));
  prefs.getString("fbDbUrl",    fbDbUrl,    sizeof(fbDbUrl));
  prefs.getString("fbEmail",    fbEmail,    sizeof(fbEmail));
  prefs.getString("fbPassword", fbPassword, sizeof(fbPassword));
  // Fix C: GATEWAY_ID NVS'dan yuklanadi. Standart 0x00000001.
  uint32_t gwid = prefs.getUInt("gwid", 0x00000001UL);
  if (gwid == 0 || gwid == BROADCAST_ID) gwid = 0x00000001UL;
  GATEWAY_ID = gwid;
  Serial.printf("[CFG] GATEWAY_ID=0x%08X | FB API: %s\n",
                (unsigned)GATEWAY_ID, strlen(fbApiKey) > 0 ? "✓" : "bo'sh");
}

// Sozlash portali (WiFi + Firebase credentials + Gateway ID).
bool sozlashPortali(bool cheksiz) {
  WiFiManager wm;
  wm.setConnectTimeout(20);
  wm.setConfigPortalTimeout(cheksiz ? 0 : PORTAL_TIMEOUT_S);

  // Fix B: Firebase credentials portali parametrlari (mavjud bo'lsa prefilled)
  WiFiManagerParameter p_apikey("apikey",  "Firebase API Key (AIza...)",     fbApiKey,   79);
  WiFiManagerParameter p_dburl ("dburl",   "Firebase DB URL (https://...)",   fbDbUrl,   127);
  WiFiManagerParameter p_email ("fbemail", "Firebase Email",                  fbEmail,    63);
  WiFiManagerParameter p_pass  ("fbpass",  "Firebase Password",               fbPassword, 63);
  // Fix C: Gateway LoRa ID (hex format, standart: 00000001)
  char gwIdStr[9]; snprintf(gwIdStr, sizeof(gwIdStr), "%08X", (unsigned)GATEWAY_ID);
  WiFiManagerParameter p_gwid  ("gwid",    "Gateway LoRa ID (hex, e.g. 00000001)", gwIdStr, 8);

  wm.addParameter(&p_apikey);
  wm.addParameter(&p_dburl);
  wm.addParameter(&p_email);
  wm.addParameter(&p_pass);
  wm.addParameter(&p_gwid);

#if USE_LCD
  lcd.clear();
  lcd.setCursor(0,0); lcd.print(apNom);
  lcd.setCursor(0,1); lcd.print("P:"); lcd.print(apParol);
#endif
  Serial.printf("[WiFi] Sozlash portali: SSID=%s  PAROL=%s\n", apNom, apParol);
  Serial.println("[WiFi] Firebase va Gateway ID ni portal orqali kiriting.");

  esp_task_wdt_delete(NULL);
  bool ok = wm.startConfigPortal(apNom, apParol);
  esp_task_wdt_add(NULL);

  if (ok) {
    prefs.putBool("wifiok", true);

    // Fix B: Portal orqali kiritilgan Firebase credentials NVS'ga saqlanadi
    const char* v_apikey = p_apikey.getValue();
    const char* v_dburl  = p_dburl.getValue();
    const char* v_email  = p_email.getValue();
    const char* v_pass   = p_pass.getValue();
    if (strlen(v_apikey) > 0) { strlcpy(fbApiKey,   v_apikey, sizeof(fbApiKey));   prefs.putString("fbApiKey",   fbApiKey);   }
    if (strlen(v_dburl)  > 0) { strlcpy(fbDbUrl,    v_dburl,  sizeof(fbDbUrl));    prefs.putString("fbDbUrl",    fbDbUrl);    }
    if (strlen(v_email)  > 0) { strlcpy(fbEmail,    v_email,  sizeof(fbEmail));    prefs.putString("fbEmail",    fbEmail);    }
    if (strlen(v_pass)   > 0) { strlcpy(fbPassword, v_pass,   sizeof(fbPassword)); prefs.putString("fbPassword", fbPassword); }

    // Fix C: Portal orqali kiritilgan Gateway ID NVS'ga saqlanadi
    const char* v_gwid = p_gwid.getValue();
    if (strlen(v_gwid) > 0) {
      uint32_t newId = (uint32_t)strtoul(v_gwid, NULL, 16);
      if (newId != 0 && newId != BROADCAST_ID) {
        GATEWAY_ID = newId;
        prefs.putUInt("gwid", GATEWAY_ID);
        Serial.printf("[CFG] GATEWAY_ID saqlandi: 0x%08X\n", (unsigned)GATEWAY_ID);
      }
    }

    firebaseBoshla();
    Serial.println("[WiFi] ulandi | Firebase boshlandi");
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
  // BUG-S6 FIX: Faqat QUVVAT bilan yoqilganda (POWERON/EXT) counter oshiriladi.
  // WDT/crash restartda counter tozalanadi — crash loop'dan keyin portal ochilmaydi.
  esp_reset_reason_t rstSabab = esp_reset_reason();
  bool quvvatReset = (rstSabab == ESP_RST_POWERON || rstSabab == ESP_RST_EXT);
  bool crashReset  = (rstSabab == ESP_RST_WDT   || rstSabab == ESP_RST_INT_WDT ||
                      rstSabab == ESP_RST_TASK_WDT || rstSabab == ESP_RST_PANIC);
  uint8_t rstCnt  = 0;
  bool    uchKarra = false;
  if (quvvatReset) {
    rstCnt = prefs.getUChar("rstcnt", 0) + 1;
    prefs.putUChar("rstcnt", rstCnt);
    uchKarra = (rstCnt >= 3);
    if (uchKarra) prefs.putUChar("rstcnt", 0);
  } else if (crashReset) {
    prefs.putUChar("rstcnt", 0);   // crash loop'da portal ochilmasin
    Serial.printf("[GW] Crash-restart (sabab=%d) — rstCnt nolga tushurildi\n", (int)rstSabab);
  }
  // ESP.restart() (software) — rstCnt o'zgarmaydi

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

  bool sozlangan  = prefs.getBool("wifiok", false);
  // Fix B: Firebase sozlamalari NVS'da bor-yo'qligi tekshiriladi.
  //        Agar WiFi bor lekin FB credentials yo'q bo'lsa — portal ochiladi.
  bool fbTayyor   = (fbApiKey[0] != '\0' && fbEmail[0] != '\0' &&
                     fbPassword[0] != '\0' && fbDbUrl[0] != '\0');
  bool portalKerak = majburiyPortal || !sozlangan || !fbTayyor;
  if (portalKerak) {
    // FB credentials yo'q bo'lsa portal cheksiz ochiq turadi (foydalanuvchi kiritguncha)
    sozlashPortali(!fbTayyor || !sozlangan);
  } else {
    ishchiWifiBoshla();
    firebaseBoshla();
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

  // 1) LoRa qabul (telemetriya/CMDACK/HIST) — ACK darhol
  loraQabulTekshir();

  // 2) WiFi nazorati (uzilsa tiklash / avariya portali)
  wifiNazorat();

  // 3) Firebase ishlari (faqat WiFi va token tayyor bo'lsa)
  if (WiFi.status() == WL_CONNECTED && fbBoshlandi && Firebase.ready()) {
    buferniBoshat();          // saqlangan telemetriyani yuborish
    gatewayHolatYubor();      // shlyuz holati (30s)
    buyruqlarniTekshir();     // web ilovadan buyruqlar (2s)
  }

  // 4) Fix 6: Node RTC larni NTP bilan sinxronlash (har 1 soat, broadcast)
  nodegaVaqtYuborish();

  // 5) LoRa nosoz bo'lsa davriy qayta urinish
  if (!loraOk && taymerOtdimi(lastReinit, LORA_REINIT_MS)) loraBoshlash();

  // 6) Holat LCD
  lcdHolat();
}

// ================================================================
//  Fix 6: NTP dan olingan vaqtni barcha Node larga yuborish
//  Birinchi yuborish: yoqilgandan 2 daqiqa so'ng (NTP sinxronlanishini kutish)
//  Keyin: har 1 soatda broadcast CMD_TIME
// ================================================================
void nodegaVaqtYuborish() {
  if (!loraOk) return;
  static bool birinchiYuborildi = false;
  if (!birinchiYuborildi) {
    if (millis() < 120000UL) return;  // 2 daqiqa kut
  } else {
    if (!taymerOtdimi(lastTimeSent, TIME_SYNC_MS)) return;
  }
  time_t now_t;
  time(&now_t);
  if (now_t < 1700000000L) return;   // NTP hali sinxronlanmagan

  lastTimeSent = millis();
  birinchiYuborildi = true;
  loraCmdYubor(BROADCAST_ID, CMD_TIME, (int32_t)now_t);
  Serial.printf("[NTP] Barcha Node larga vaqt yuborildi: %ld\n", (long)now_t);
}

// ================================================================
//  Fix 13: NVS tarix yozuvini Firebase ga saqlash
//  /nodes/<id>/nvsHistory/<MMDDHHMM>
// ================================================================
// BUG-S3 FIX: histKaydYoz() — path ga YILNI qo'shamiz (YYYYMMDDHHMM).
// Avval MMDDHHMM kalit yiliga bir marta ma'lumotni qayta yozib ketardi.
void histKaydYoz(uint32_t src, uint8_t idx, uint8_t total,
                  uint8_t oy, uint8_t kun, uint8_t soat,
                  uint8_t daqiqa, uint8_t doB) {
  if (!fbBoshlandi || !Firebase.ready()) return;
  char nom[16]; idGaNom(src, nom);

  // Yilni NTP vaqtidan olamiz
  time_t now_t; time(&now_t);
  struct tm tmBuf; gmtime_r(&now_t, &tmBuf);
  uint16_t rekordYil = (uint16_t)(1900 + tmBuf.tm_year);
  // Yanvar-Fevralda kelgan Noyabr-Dekabr yozuvlari o'tgan yilga tegishli:
  if (tmBuf.tm_mon <= 1 && oy >= 11) rekordYil--;

  char slot[16];  // YYYYMMDDHHMM = 12 belgi + null
  snprintf(slot, sizeof(slot), "%04u%02u%02u%02u%02u",
           (unsigned)rekordYil, (unsigned)oy, (unsigned)kun,
           (unsigned)soat, (unsigned)daqiqa);
  char path[84];  // "nodes/" + nom + "/nvsHistory/" + slot + null
  snprintf(path, sizeof(path), "nodes/%s/nvsHistory/%s", nom, slot);

  FirebaseJson h;
  h.set("do",    doB / 10.0);
  h.set("idx",   (int)idx);
  h.set("total", (int)total);
  Firebase.RTDB.setJSON(&fbdo, path, &h);

  Serial.printf("[HIST] %s %u/%u -> %04u/%02u/%02u %02u:%02u do=%.1f\n",
                nom, idx+1, total, (unsigned)rekordYil, oy, kun, soat, daqiqa, doB/10.0);
}
