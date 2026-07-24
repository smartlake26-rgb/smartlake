// ================================================================
//  AQUA NODE (LoRa) v16.2 - ESP32 DevKit USB-C + SX1278/Ra-02 433MHz
//  Baliq ko'llari uchun avtonom aeratsiya NODE'i
//
//  v16.2 O'ZGARISHLAR (IKKI TOMONLAMA SINXRON):
//    Fix N1 — Klaviaturadan sozlama saqlanganda (MinDO/Farq/Kritik/Rejim)
//             forceUplink=true -> telemetriya DARHOL yuboriladi -> ilova
//             5 daqiqalik slotni kutmasdan bir necha soniyada yangilanadi.
//    Fix N2 — Ilovadan buyruq kelganda LCD'da xabar chiqadi (masalan
//             "Ilova:MinDO=3") — qurilma yonidagi odam o'zgarishni ko'radi.
//             Buyruq qo'llangach forceUplink=true — ilova ham darhol
//             yangi qiymatni oladi (gateway v32.5 bo'lmasa ham ishlaydi).
//
//  v16.0 TUZATILGAN MUAMMOLAR:
//    Fix A — LoRa RST GPIO 2 → GPIO 25 (boot strapping pin muammosi hal qilindi)
//    Fix B — GATEWAY_ID runtime o'zgaruvchiga aylandi, NVS'dan yuklanadi ("gwid" kalit)
//             Gateway v3.1 bilan mos: agar gateway ID o'zgartirilsa, node ham o'sha qiymatni
//             prefs "gwid" kalitigabekitish orqali ishlata oladi. Standart: 0x00000001.
//    Fix C — loraBoshlash: loraSPI.begin() faqat bir marta chaqiriladi (static flag)
//    Fix D — loraBuyruqQolla CMD_MODE: qolReleYoq = false qo'shildi
//             Rejim o'zgartirilganda qo'lda yoqilgan aerator avtomatik o'chadi.
//  ENDI: SIM/GSM YO'Q, WiFi YO'Q. Ma'lumot FAQAT LoRa orqali uzatiladi.
//
//  ARXITEKTURA:
//    [Ko'l NODE'i] --LoRa 433MHz--> [SHLYUZ (LoRa+WiFi)] --> Internet --> ThingsBoard
//    Bu fayl — NODE (ko'lda turadigan qurilma). Shlyuz kodi alohida yoziladi.
//
//  NODE NIMA QILADI:
//    - DO/pH/harorat o'lchaydi (RS485/Modbus), aeratorni AVTONOM boshqaradi
//      (internetsiz ham to'liq ishlaydi — xavfsizlik birinchi o'rinda).
//    - Telemetriyani LoRa orqali shlyuzga yuboradi (ikkilik kadr + CRC16).
//    - Shlyuzdan LoRa orqali BUYRUQ qabul qiladi (aerator ON/AUTO, MINDO,
//      FARQ, KRITIK, MODE, STATUS) va ACK qaytaradi — ikki tomonlama boshqaruv.
//
//  TO'QNASHUVGA QARSHI (industrial):
//    1) VAQT TAQSIMLASH (TDMA): har node DS3231 soatiga ko'ra o'z "slot"ida
//       yuboradi (srcId % MAX_SLOT). Soatlar barqaror (DS3231 ~2ppm) bo'lgani
//       uchun nodalar bir-biriga xalaqit bermaydi.
//    2) CAD / LISTEN-BEFORE-TALK: yuborishdan oldin kanal bandligini tekshiradi.
//    3) ACK + QAYTA YUBORISH: ACK kelmasa, backoff bilan 3 martagacha takror.
//
//  --- KUTUBXONALAR (Arduino Library Manager) ---
//    RadioLib (jgromes)  >= 6.0   <-- SX1278/Ra-02 uchun (CAD'ni qo'llab-quvvatlaydi)
//    Keypad, LiquidCrystal_I2C, ModbusMaster, RTClib, Preferences (o'rnatilgan)
//
//  --- LoRa SIMINI ULASH (SX1278 / Ra-02) -> ESP32 ---
//    (SIM800L olib tashlangani uchun GPIO18/23/35 bo'shadi)
//      Ra-02 SCK   -> GPIO 18
//      Ra-02 MISO  -> GPIO 35   (faqat-kirish pin — MISO uchun ideal)
//      Ra-02 MOSI  -> GPIO 23
//      Ra-02 NSS   -> GPIO 15   (boot'da HIGH — CS uchun mos)
//      Ra-02 RST   -> ULANMAYDI  // v16.1 BUG-H3 FIX: RST simi olib tashlanadi (RADIOLIB_NC)
//      Ra-02 DIO0  -> GPIO 34   (faqat-kirish pin — RxDone/TxDone interrupt)
//      Ra-02 3.3V  -> 3.3V  (DIQQAT: Ra-02 5V EMAS! to'g'ridan-to'g'ri 3.3V)
//      Ra-02 GND   -> GND
//    ANTENNA: 433 MHz (boshqa chastota EMAS!). Sinov uchun arzon 433+U.FL->SMA;
//             uzoq masofa (7-8 km) uchun 12 dBi yoki Yagi, baland va ochiq joyga.
//             ANTENNASIZ YOQMANG — modul kuyishi mumkin.
//
//  PIN TAQISH (o'zgarmagan qism):
//    KEYPAD ROW : GPIO 12,14,27,26,25 | COL : GPIO 33,32,13,19  // v16.1: Row5=25 (GPIO 2 TAQIQ — bort LED)
//    LCD/RTC I2C: SDA 21, SCL 22
//    RS485 RX/TX/DE: GPIO 16 / 17 / 4
//    RELE       : GPIO 5
//
//  BOSHQARUV (LCD + klaviatura) — o'zgarmagan:
//    [L]      -> Rejim (1x Kislorod, 2x Vaqt)
//    KISLOROD: [#]=Min DO, [##]=Kritik DO, [*]=Farq, [F]=DO kalibr, [B]=T kalibr,
//              [E]=DO tarixi, [U]=RTC sozlash, [R]=LoRa holati ekrani,
//              [T uzun bosish]=darhol TEST telemetriya yuborish
//    VAQT    : [R]=yangi oraliq (SSDDBBOO), [T]=saqlash, [E]=ko'rsatish, [D]=o'chirish
//    UMUMIY  : [000T]=zavod reseti
//
//  TSIKL (boshlang'ich 1 soatdan keyin, KISLOROD rejimida):
//    [0-19] uxlash, [20-29] ishlash, [30-49] uxlash, [50-59] ishlash (xotira oynasi)
// ================================================================

#include <Wire.h>
#include <Keypad.h>
#include <LiquidCrystal_I2C.h>
#include <ModbusMaster.h>
#include <RTClib.h>
#include <Preferences.h>
#include <esp_task_wdt.h>
#include <ctype.h>
#include <SPI.h>
#include <RadioLib.h>

// ================================================================
//  PINLAR
// ================================================================
static const uint8_t RELE_PIN = 5;
static const uint8_t RS485_DE = 4;
#define MODBUS_RX 16
#define MODBUS_TX 17

// --- LoRa SX1278 (Ra-02) ---
#define LORA_SCK   18
#define LORA_MISO  35    // faqat-kirish pin (MISO uchun ideal)
#define LORA_MOSI  23
#define LORA_NSS   15
#define LORA_RST   RADIOLIB_NC  // v16.1 BUG-H3 FIX: RST simi ULANMAYDI (modul ichki pullup bilan ishlaydi).
                                 // GPIO 25 keypad Row5 ga qaytarildi, GPIO 2 esa BUTUNLAY bo'sh
                                 // (bortdagi LED tufayli GPIO 2 keypad row bo'la olmaydi!)
#define LORA_DIO0  34    // faqat-kirish pin (RxDone/TxDone)

// ================================================================
//  LoRa RADIO SOZLAMALARI — SHLYUZ bilan BIR XIL bo'lishi SHART
// ================================================================
static const float    LORA_FREQ     = 433.0;   // MHz (UZ ISM 433)
static const float    LORA_BW       = 125.0;    // kHz
static const uint8_t  LORA_SF       = 9;        // 7..12 (kattaroq = uzoqroq, sekinroq). 7-8km uchun 10-12 sinab ko'ring
static const uint8_t  LORA_CR       = 7;        // 4/7
static const uint8_t  LORA_SYNCWORD = 0x55;     // shaxsiy tarmoq (LoRaWAN 0x34 EMAS)
static const int8_t   LORA_POWER    = 17;       // dBm (PA_BOOST, 20 gacha)
static const uint16_t LORA_PREAMBLE = 10;

// ================================================================
//  LoRa PROTOKOL — ikkilik kadr (little-endian) + CRC16
//  Sarlavha (13 bayt): magic, ver, type, flags, seq, srcId[4], dstId[4]
//  So'ng type'ga qarab payload, oxirida CRC16 (LE).
// ================================================================
#define LORA_MAGIC    0xA9
#define LORA_VER      0x01
#define FT_TELE       1     // node -> shlyuz : telemetriya
#define FT_ACK        2     // shlyuz -> node : ACK
#define FT_CMD        3     // shlyuz -> node : buyruq
#define FT_CMDACK     4     // node -> shlyuz : buyruq ACK
#define FLAG_WANTACK  0x01

// Fix B: GATEWAY_ID endi const emas — NVS'dan yuklanadi (kalit: "gwid", namespace: "aqua").
// Gateway v3.1 da ham xuddi shu mexanizm: agar maydon operator ID'ni o'zgartirsa,
// node'da ham prefs "gwid" yangilanadi. Standart: 0x00000001 (barcha avvalgi node'lar uchun mos).
static uint32_t       GATEWAY_ID   = 0x00000001UL;  // prefsTekshir() da NVS'dan yuklanadi
static const uint32_t BROADCAST_ID = 0xFFFFFFFFUL;

// Buyruq kodlari (shlyuzdan keladi)
#define CMD_AER_ON    0x01
#define CMD_AER_AUTO  0x02
#define CMD_MINDO     0x03   // val = mg/L
#define CMD_FARQ      0x04   // val = mg/L
#define CMD_KRITIK    0x05   // val = mg/L
#define CMD_MODE      0x06   // val = 0 (kislorod) / 1 (vaqt)
#define CMD_STATUS    0x07   // darhol telemetriya yuborishni so'raydi
#define CMD_TIME      0x08   // Fix 6: val = Unix timestamp — RTC ni internetdan sinxronlash
#define CMD_HIST      0x09   // Fix 13: NVS tarixini ilovaga yuborish

#define FT_HIST       5      // Fix 13: node -> gateway: tarix yozuvi paketi

// Telemetriya status bitlari
#define ST_DOXATO      0x01
#define ST_PHXATO      0x02
#define ST_ALARM       0x04  // DO < kritik
#define ST_BOSHLAN     0x08  // boshlang'ich 1 soat rejimi
#define ST_QOLRELE     0x10  // aerator qo'lda majburan yoniq
#define ST_KRITIK_XATO 0x20  // Fix 9: kritikDo >= minDo (noto'g'ri sozlama)

// ================================================================
//  TDMA (vaqt taqsimlash) — DS3231 soatiga ko'ra
// ================================================================
static const uint32_t TELEM_PERIOD_S = 300;   // 5 daqiqa — telemetriya davri
static const uint32_t SLOT_WIDTH_S   = 5;     // har slot 5 soniya
static const uint32_t MAX_SLOTS      = 24;    // 24 ta to'qnashmaydigan slot (CAD qolganini hal qiladi)

// LoRa vaqtlash
static const unsigned long ACK_TIMEOUT_MS   = 1500UL;
static const uint8_t       MAX_TX_TRIES     = 3;
static const uint8_t       CAD_TRIES        = 3;
static const uint16_t      CAD_BACKOFF_MIN  = 15;
static const uint16_t      CAD_BACKOFF_SPAN = 60;
static const unsigned long LORA_REINIT_MS   = 30000UL;  // init muvaffaqiyatsiz bo'lsa qayta urinish

// ================================================================
//  AERATSIYA REJIMI
// ================================================================
#define REJIM_KISLOROD  0
#define REJIM_VAQT      1

// TSIKL HOLATI
#define TSIKL_ISHLASH  0
#define TSIKL_UXLASH   1

// ================================================================
//  HARDWARE
// ================================================================
LiquidCrystal_I2C lcd(0x27, 16, 2);
RTC_DS3231        rtc;
Preferences       prefs;
HardwareSerial    modbusSerial(2);
ModbusMaster      node;

// LoRa: alohida SPI shinasi (VSPI) + SX1278
SPIClass          loraSPI(VSPI);
SX1278            radio = new Module(LORA_NSS, LORA_DIO0, LORA_RST, RADIOLIB_NC,
                                     loraSPI, RADIOLIB_DEFAULT_SPI_SETTINGS);

void preTransmission()  { digitalWrite(RS485_DE, HIGH); }
void postTransmission() { digitalWrite(RS485_DE, LOW);  }

// ================================================================
//  KEYPAD
// ================================================================
static const byte ROWS = 5;
static const byte COLS = 4;
char keys[ROWS][COLS] = {
  {'*', '#', 'B', 'F'},
  {'U', '3', '2', '1'},
  {'D', '6', '5', '4'},
  {'E', '9', '8', '7'},
  {'T', 'R', '0', 'L'}
};
byte rowPins[ROWS] = {12, 14, 27, 26, 25};  // v16.1 BUG-H3 FIX: Row5 GPIO2->25 QAYTARILDI.
                                             // GPIO 2 da bortdagi ko'k LED bor — INPUT_PULLUP ni
                                             // yengib, Row5 doimiy "bosilgan" o'qilardi va soxta
                                             // tugmalar butun klaviaturani bloklardi.
                                             // LoRa RST endi RADIOLIB_NC (sim ulanmaydi).
byte colPins[COLS] = {33, 32, 13, 19};
Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

// ================================================================
//  GLOBAL O'ZGARUVCHILAR — YADRO (o'zgarmagan)
// ================================================================
static uint8_t aeratsiyaRejimi = REJIM_KISLOROD;
static uint8_t tsikilRejim     = TSIKL_ISHLASH;

static const unsigned long BOSHLANGICH_MUDDAT_MS = 3600000UL;
static bool          boshlangichRejimda = true;
static unsigned long boshlangichBosh    = 0;

static uint16_t oxirgiYozuvKaliti = 0xFFFF;

static int16_t do_x10 = 0;
static int16_t ph_x10 = 0;
static int16_t t_x10  = 0;

static bool    doXato             = false;
static bool    phXato             = false;
static bool    doAktivmi          = true;
static bool    phAktivmi          = true;
static uint8_t qaysiSensorNavbati = 1;

static unsigned long lastDoCheckTime      = 0;
static unsigned long lastPhCheckTime      = 0;
static unsigned long lastMeasureTime      = 0;
static unsigned long lastEkranVaqti       = 0;
static unsigned long lastUxlashEkranVaqti = 0;
static unsigned long lastTsikilTekshir    = 0;

static int16_t minDo_x10  = 50;   // 5.0 mg/L
static int16_t farqDo_x10 = 20;   // 2.0 mg/L

static const uint8_t MAX_VAQT_ORALIQ = 5;
struct VaqtOraliq { uint8_t boshH; uint8_t boshM; uint8_t oxirH; uint8_t oxirM; bool faol; };
static VaqtOraliq vaqtJadvali[MAX_VAQT_ORALIQ];
static uint8_t    vaqtOraliqSoni = 0;

static bool          releHolati        = false;
static unsigned long releOzgarishVaqti = 0;

static const uint8_t MAX_RECORDS       = 48;
static uint8_t       eeprom_head_cache  = 0;
static uint8_t       eeprom_count_cache = 0;

static char    inputText[10]      = "";
static uint8_t inputLen           = 0;
static char    joriyRejimKiritish = ' ';
static bool    isCalibrating      = false;
static int8_t  kiritilganHarorat  = -1;

static uint8_t       lTugmaHolati = 0;
static unsigned long lTugmaVaqti  = 0;

static unsigned long nonBlockStart = 0;
static uint16_t      nonBlockMs    = 0;
static bool          nonBlockAktiv = false;

// Kritik DO (alarm/telemetriya chegarasi), ×10. 0 = o'rnatilmagan
static int16_t kritikDo_x10 = 0;
static bool    alarmFaol     = false;   // DO < kritik (telemetriya/LCD uchun)

// Qo'lda (LoRa buyruq bilan) aeratorni majburan yoqish
static bool    qolReleYoq = false;

// Uzun T (test) aniqlash
static bool          tBosildi   = false;
static unsigned long tBoshVaqti = 0;
static const unsigned long T_UZUN_MS = 3000UL;

// ================================================================
//  QURILMA ID
// ================================================================
static char     deviceId[16]  = "";    // "AQxxxxxx"
static uint32_t deviceNumId    = 0;     // 24-bit son (LoRa srcId)

// ================================================================
//  LoRa HOLATI
// ================================================================
#define LORA_RX        0    // tinglash (bo'sh)
#define LORA_WAIT_ACK  1    // telemetriya yuborildi, ACK kutilmoqda

static volatile bool loraFlag    = false;  // ISR -> RxDone bayrog'i
static bool          loraOk      = false;  // radio init muvaffaqiyatli
static uint8_t       loraState   = LORA_RX;
static uint8_t       txSeq       = 0;      // joriy uplink ketma-ket raqami
static uint8_t       txTries     = 0;
static unsigned long ackDeadline = 0;
static unsigned long lastReinit  = 0;
static uint32_t      lastSentPeriod = 0xFFFFFFFFUL;  // TDMA: shu davrda yuborilganmi
static bool          forceUplink = false;  // test/STATUS -> slotni e'tiborsiz qoldirib yubor

// Link diagnostikasi
static int16_t       lastRssi   = 0;
static float         lastSnr    = 0;
static bool          linkOk     = false;   // yaqinda ACK olindi
static unsigned long lastAckVaqti = 0;
static const unsigned long LINK_LOST_MS = 1200000UL;  // 20 daq ACK yo'q -> "link lost"

// BUG-S1 FIX: RTC lostPower() bayrog'i — batareya yo'q/birinchi yoqilish
// true bo'lsa: CMD_TIME kelguncha tarix yozilmaydi, TDMA millis() asosida ishlaydi
static bool rtcVaqtYoq = false;

// Telemetriya kadri buferi — Fix 6-13: frame 40 baytga yetdi, 48 xavfsiz
static uint8_t loraTxBuf[48];

// Fix 12: manual rejim timeout
static uint16_t      qolReleTimeoutMin = 0;      // daqiqada (0=cheksiz)
static unsigned long qolReleYoqVaqti   = 0;      // manual boshlangan millis()

// Fix 13: NVS tarix yuborish holati (async — har loop iteratsiyasida 1 paket)
static bool    histSendActive = false;
static uint8_t histSendIdx    = 0;
static uint8_t histSendTotal  = 0;
static uint8_t histSendBosh   = 0;

// ================================================================
//  KONSTANTALAR
// ================================================================
static const unsigned long SENSOR_RETRY_MS    =  300000UL;  // 5 daqiqa
static const unsigned long SENSOR_INTERVAL_MS =     400UL;
static const unsigned long EKRAN_INTERVAL_MS  =     400UL;
static const unsigned long RELE_DEBOUNCE_MS   =    5000UL;
static const unsigned long TSIKL_TEKSHIR_MS   =    5000UL;
static const unsigned long L_TIMEOUT          =    3000UL;

// ================================================================
//  FUNKSIYA PROTOTIPLARI
// ================================================================
void ekranniYangilash();
void xotiragaYozish(const DateTime& now);
void tsikilniYangilash();
void boshqarishRele();
void readSensorDataSmart();
bool sensorOqishKerakmi();
void nonBlockXabar(const char* xabar, uint16_t ms);
void showClock();
void uxlashEkrani();
void doTarixiKorsat();
void vaqtJadvaliniKorsat();
void standartgaQaytarish();
void runKislorodKalibrlash();
void runHaroratKalibrlash();
void klaviaturaBoshqar(char key);
void saqlashTugmasi();
void lTugmasiBosildi();
void prefsTekshir();
void prefsYozHead(uint8_t val);
void prefsYozCount(uint8_t val);
void prefsYozuvSaqla(uint8_t idx, uint8_t h, uint8_t m, uint8_t kun, uint8_t oy, uint8_t doB);
void prefsYozuvOqish(uint8_t idx, uint8_t &h, uint8_t &m, uint8_t &kun, uint8_t &oy, uint8_t &doB);
void vaqtJadvaliniSaqla();
void vaqtJadvaliniYukla();
void datchikBoshlanishTekshir();
bool vaqtRejimiReleHolati();
void nonBlockTekshir();
uint8_t daqiqadanTsikilAniqla(uint8_t daqiqa);
uint16_t yozuvKalitHisopla(uint8_t oy, uint8_t kun, uint8_t soat);
uint8_t oyningKunlari(uint8_t oy, uint16_t yil);
void deviceIdYarat();

// --- LoRa ---
void     loraBoshlash();
void     loraGlyphYarat();
void     loRaStatusLCDga();
void     loraInfoKorsat();
uint16_t loraCrc16(const uint8_t* d, uint16_t n);
uint16_t loraTelemKadrTayyorla(uint8_t* buf);
bool     loraKadrYubor(uint8_t* buf, uint16_t len);
void     loraUplinkBoshla();
void     loraUplinkYangilash();
void     loraQabulTekshir();
void     loraBuyruqQolla(uint8_t cmd, int32_t val);          // Fix 6: int32_t (CMD_TIME uchun)
void     loraHistKadrYubor(uint8_t idx, uint8_t total,       // Fix 13
                            uint8_t oy, uint8_t kun,
                            uint8_t soat, uint8_t daqiqa, uint8_t doB);
void     loraAckYubor(uint8_t ackSeq, uint32_t dst);
void     loraCmdAckYubor(uint8_t cmd, uint8_t ok, uint32_t dst);
bool     tdmaUplinkVaqtimi();

// ================================================================
//  YORDAMCHI: millis() overflow-safe
// ================================================================
inline bool taymerOtdimi(unsigned long t0, unsigned long dt) {
  return (millis() - t0) >= dt;
}

// ================================================================
//  LCD YORDAMCHI
// ================================================================
void lcdIkkiRaqam(uint8_t n) {
  lcd.print((char)('0' + n / 10));
  lcd.print((char)('0' + n % 10));
}

void lcdX10(int16_t val) {
  if (val < 0) { lcd.print('-'); val = -val; }
  lcd.print(val / 10);
  lcd.print('.');
  lcd.print(val % 10);
}

// ================================================================
//  NON-BLOCKING XABAR
// ================================================================
void nonBlockXabar(const char* xabar, uint16_t ms) {
  lcd.setCursor(0, 1);
  lcd.print("                ");
  lcd.setCursor(0, 1);
  lcd.print(xabar);
  nonBlockStart = millis();
  nonBlockMs    = ms;
  nonBlockAktiv = true;
}

void nonBlockTekshir() {
  if (!nonBlockAktiv) return;
  if (!taymerOtdimi(nonBlockStart, nonBlockMs)) return;
  nonBlockAktiv = false;
  lcd.setCursor(0, 1);
  lcd.print("                ");
  inputLen = 0;
  inputText[0] = '\0';
  joriyRejimKiritish = ' ';
  ekranniYangilash();
}

// ================================================================
//  PREFERENCES (NVS)
// ================================================================
void prefsYozHead(uint8_t val) {
  if (val != eeprom_head_cache) { prefs.putUChar("head", val); eeprom_head_cache = val; }
}
void prefsYozCount(uint8_t val) {
  if (val != eeprom_count_cache) { prefs.putUChar("count", val); eeprom_count_cache = val; }
}
void prefsYozuvSaqla(uint8_t idx, uint8_t h, uint8_t m, uint8_t kun, uint8_t oy, uint8_t doB) {
  char kalit[4]; kalit[0]='r'; kalit[1]='0'+(idx/10); kalit[2]='0'+(idx%10); kalit[3]='\0';
  uint8_t buf[5] = {h, m, kun, oy, doB};
  prefs.putBytes(kalit, buf, 5);
}
void prefsYozuvOqish(uint8_t idx, uint8_t &h, uint8_t &m, uint8_t &kun, uint8_t &oy, uint8_t &doB) {
  char kalit[4]; kalit[0]='r'; kalit[1]='0'+(idx/10); kalit[2]='0'+(idx%10); kalit[3]='\0';
  uint8_t buf[5] = {0,0,0,0,0};
  prefs.getBytes(kalit, buf, 5);
  h=buf[0]; m=buf[1]; kun=buf[2]; oy=buf[3]; doB=buf[4];
}

void vaqtJadvaliniSaqla() {
  prefs.putUChar("vj_son", vaqtOraliqSoni);
  for (uint8_t i = 0; i < MAX_VAQT_ORALIQ; i++) {
    char kalit[4]; kalit[0]='v'; kalit[1]='j'; kalit[2]='0'+i; kalit[3]='\0';
    uint8_t buf[5] = { vaqtJadvali[i].boshH, vaqtJadvali[i].boshM,
                       vaqtJadvali[i].oxirH, vaqtJadvali[i].oxirM,
                       vaqtJadvali[i].faol ? 1u : 0u };
    prefs.putBytes(kalit, buf, 5);
  }
}
void vaqtJadvaliniYukla() {
  vaqtOraliqSoni = prefs.getUChar("vj_son", 0);
  if (vaqtOraliqSoni > MAX_VAQT_ORALIQ) vaqtOraliqSoni = 0;
  for (uint8_t i = 0; i < MAX_VAQT_ORALIQ; i++) {
    char kalit[4]; kalit[0]='v'; kalit[1]='j'; kalit[2]='0'+i; kalit[3]='\0';
    uint8_t buf[5] = {0,0,0,0,0};
    prefs.getBytes(kalit, buf, 5);
    vaqtJadvali[i].boshH=buf[0]; vaqtJadvali[i].boshM=buf[1];
    vaqtJadvali[i].oxirH=buf[2]; vaqtJadvali[i].oxirM=buf[3];
    vaqtJadvali[i].faol=(buf[4]==1);
  }
}

uint16_t yozuvKalitHisopla(uint8_t oy, uint8_t kun, uint8_t soat) {
  return (uint16_t)((uint16_t)(oy * 31u + kun) * 24u + soat);
}
uint8_t oyningKunlari(uint8_t oy, uint16_t yil) {
  bool kabisa = ((yil % 4 == 0 && yil % 100 != 0) || (yil % 400 == 0));
  switch (oy) {
    case 1: case 3: case 5: case 7: case 8: case 10: case 12: return 31;
    case 4: case 6: case 9: case 11: return 30;
    case 2: return kabisa ? 29 : 28;
    default: return 0;
  }
}

// ================================================================
//  SOZLAMALARNI STANDARTGA QAYTARISH (zavod reseti)
//  v13: 'tel' va GSM/alarm runtime holatlari olib tashlandi, NVS ver=0xC0
// ================================================================
void standartgaQaytarish() {
  prefs.clear();

  prefs.putUInt("devid", deviceNumId);   // v15: ID zavod resetida saqlanadi
  prefs.putUChar("head",   0);
  prefs.putUChar("count",  0);
  prefs.putShort("minDo",  50);
  prefs.putShort("farqDo", 20);
  prefs.putUChar("rejim",  (uint8_t)REJIM_KISLOROD);
  prefs.putShort("kritikDo", 0);
  prefs.putUChar("ver", 0xC0);

  eeprom_head_cache  = 0;
  eeprom_count_cache = 0;
  minDo_x10    = 50;
  farqDo_x10   = 20;
  kritikDo_x10 = 0;
  aeratsiyaRejimi = REJIM_KISLOROD;

  vaqtOraliqSoni = 0;
  for (uint8_t i = 0; i < MAX_VAQT_ORALIQ; i++) vaqtJadvali[i] = {0,0,0,0,false};
  vaqtJadvaliniSaqla();

  oxirgiYozuvKaliti  = 0xFFFF;
  boshlangichRejimda = true;
  boshlangichBosh    = millis();
  tsikilRejim        = TSIKL_ISHLASH;
  qaysiSensorNavbati = 1;
  alarmFaol          = false;
  prefs.putBool("qolrele", false);   // FIX #2: NVS tozalash
  qolReleYoq         = false;

  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Standartga      ");
  lcd.setCursor(0, 1); lcd.print("qaytarildi!     ");
  esp_task_wdt_reset(); delay(1500); esp_task_wdt_reset();
  lcd.clear(); esp_task_wdt_reset();
}

// ================================================================
//  NVS BOSHLASH — v13: ver 0xC0. Eski 0xB0 (SIM) dan migratsiya:
//  sozlamalar saqlanadi, 'tel' tashlab yuboriladi.
// ================================================================
void prefsTekshir() {
  prefs.begin("aqua", false);
  uint8_t ver = prefs.getUChar("ver", 0xFF);

  if (ver == 0xC0) {
    eeprom_head_cache  = prefs.getUChar("head",  0);
    eeprom_count_cache = prefs.getUChar("count", 0);
    if (eeprom_head_cache  >= MAX_RECORDS) eeprom_head_cache  = 0;
    if (eeprom_count_cache >  MAX_RECORDS) eeprom_count_cache = 0;
    minDo_x10       = prefs.getShort("minDo",  50);
    farqDo_x10      = prefs.getShort("farqDo", 20);
    kritikDo_x10    = prefs.getShort("kritikDo", 0);
    aeratsiyaRejimi = prefs.getUChar("rejim", 0);
    qolReleYoq      = prefs.getBool("qolrele", false);   // FIX #2: NVS dan yuklash
    if (aeratsiyaRejimi != REJIM_KISLOROD && aeratsiyaRejimi != REJIM_VAQT)
      aeratsiyaRejimi = REJIM_KISLOROD;
    vaqtJadvaliniYukla();
    // Fix B: GATEWAY_ID NVS'dan yuklanadi (kalit: "gwid")
    { uint32_t gw = prefs.getUInt("gwid", 0x00000001UL);
      if (gw == 0 || gw == BROADCAST_ID) gw = 0x00000001UL;
      GATEWAY_ID = gw; }
    return;
  }

  // Migratsiya yoki yangi qurilma
  bool eski_b0 = (ver == 0xB0);   // SIM versiyasi — sozlamalarni saqlaymiz
  bool eski_af = (ver == 0xAF);
  if (eski_b0 || eski_af) {
    eeprom_head_cache  = prefs.getUChar("head",  0);
    eeprom_count_cache = prefs.getUChar("count", 0);
    if (eeprom_head_cache  >= MAX_RECORDS) eeprom_head_cache  = 0;
    if (eeprom_count_cache >  MAX_RECORDS) eeprom_count_cache = 0;
    minDo_x10       = prefs.getShort("minDo",  50);
    farqDo_x10      = prefs.getShort("farqDo", 20);
    kritikDo_x10    = prefs.getShort("kritikDo", 0);
    aeratsiyaRejimi = prefs.getUChar("rejim", 0);
    qolReleYoq      = prefs.getBool("qolrele", false);   // FIX #2: migratsiyada ham yuklash
    if (aeratsiyaRejimi != REJIM_KISLOROD && aeratsiyaRejimi != REJIM_VAQT)
      aeratsiyaRejimi = REJIM_KISLOROD;
    vaqtJadvaliniYukla();
    if (prefs.isKey("tel")) prefs.remove("tel");   // SIM raqami endi kerak emas
    // Fix B: migratsiya — "gwid" yo'q bo'lsa standart 0x00000001 ishlatiladi
    { uint32_t gw = prefs.getUInt("gwid", 0x00000001UL);
      if (gw == 0 || gw == BROADCAST_ID) gw = 0x00000001UL;
      GATEWAY_ID = gw; }
  } else {
    // Butunlay yangi/notanish versiya
    prefs.clear();
    prefs.putUChar("head",   0);
    prefs.putUChar("count",  0);
    prefs.putShort("minDo",  50);
    prefs.putShort("farqDo", 20);
    prefs.putShort("kritikDo", 0);
    prefs.putUChar("rejim",  0);
    prefs.putUChar("vj_son", 0);
    eeprom_head_cache = 0; eeprom_count_cache = 0;
    minDo_x10 = 50; farqDo_x10 = 20; kritikDo_x10 = 0;
    vaqtOraliqSoni = 0;
    for (uint8_t i = 0; i < MAX_VAQT_ORALIQ; i++) vaqtJadvali[i] = {0,0,0,0,false};
    // Fix B: yangi qurilmada standart gateway ID
    GATEWAY_ID = 0x00000001UL;
  }
  prefs.putUChar("ver", 0xC0);
}

// ================================================================
//  DATCHIK BOSHLANISH TEKSHIRUVI
// ================================================================
void datchikBoshlanishTekshir() {
  lcd.setCursor(0, 0); lcd.print("Datchiklar...   ");
  uint8_t xato = 0;
  for (uint8_t i = 0; i < 3; i++) {
    esp_task_wdt_reset();
    node.begin(1, modbusSerial);
    if (node.readHoldingRegisters(0x0000, 4) != node.ku8MBSuccess) xato++;
    delay(150); esp_task_wdt_reset();
  }
  if (xato >= 3) { doAktivmi = false; doXato = true; }

  xato = 0;
  for (uint8_t i = 0; i < 3; i++) {
    esp_task_wdt_reset();
    node.begin(2, modbusSerial);
    if (node.readHoldingRegisters(0x0000, 2) != node.ku8MBSuccess) xato++;
    delay(150); esp_task_wdt_reset();
  }
  if (xato >= 3) { phAktivmi = false; phXato = true; }
  node.begin(1, modbusSerial);
}

// ================================================================
//  TSIKL HOLATI
// ================================================================
uint8_t daqiqadanTsikilAniqla(uint8_t daqiqa) {
  if (daqiqa < 20) return TSIKL_UXLASH;
  if (daqiqa < 30) return TSIKL_ISHLASH;
  if (daqiqa < 50) return TSIKL_UXLASH;
  return TSIKL_ISHLASH;
}

bool sensorOqishKerakmi() {
  if (aeratsiyaRejimi != REJIM_KISLOROD) return false;
  if (boshlangichRejimda) return true;
  return (tsikilRejim == TSIKL_ISHLASH);
}

// ================================================================
//  TSIKL VA XOTIRA YANGILASH (5 soniyada bir)
//  v13: soatlik SMS chaqiruvi olib tashlandi (faqat xotiraga yozish qoldi)
// ================================================================
void tsikilniYangilash() {
  if (aeratsiyaRejimi != REJIM_KISLOROD) return;
  if (!taymerOtdimi(lastTsikilTekshir, TSIKL_TEKSHIR_MS)) return;
  lastTsikilTekshir = millis();

  esp_task_wdt_reset();
  DateTime now       = rtc.now();
  uint8_t  joriyDaq  = now.minute();
  uint8_t  joriySoat = now.hour();
  uint8_t  joriyKun  = now.day();
  uint8_t  joriyOy   = now.month();
  esp_task_wdt_reset();

  if (boshlangichRejimda) {
    if (taymerOtdimi(boshlangichBosh, BOSHLANGICH_MUDDAT_MS)) {
      boshlangichRejimda = false;
      tsikilRejim = daqiqadanTsikilAniqla(joriyDaq);
      lcd.clear();
      lcd.setCursor(0, 0); lcd.print("Tsikl rejimi    ");
      if (tsikilRejim == TSIKL_ISHLASH) { lcd.setCursor(0, 1); lcd.print("Sensor ishlaydi "); }
      else                              { lcd.setCursor(0, 1); lcd.print("Sensor uxlaydi  "); }
      esp_task_wdt_reset(); delay(1200); esp_task_wdt_reset();
      lcd.clear(); esp_task_wdt_reset();
    } else {
      tsikilRejim = TSIKL_ISHLASH;
    }
  }

  if (!boshlangichRejimda) {
    uint8_t yangiHolat = daqiqadanTsikilAniqla(joriyDaq);
    if (yangiHolat != tsikilRejim) {
      tsikilRejim        = yangiHolat;
      qaysiSensorNavbati = 1;
      lcd.clear();
      if (tsikilRejim == TSIKL_ISHLASH) {
        lcd.setCursor(0, 0); lcd.print("Sensor yondi    ");
        lcd.setCursor(0, 1);
        if (joriyDaq >= 50) lcd.print("Soat oxiri :58da");
        else                lcd.print("Daqiqa 20-30    ");
      } else {
        uint8_t qolDaq = (joriyDaq < 20) ? (20 - joriyDaq) : (50 - joriyDaq);
        lcd.setCursor(0, 0); lcd.print("Sensor uxlaydi  ");
        lcd.setCursor(0, 1); lcd.print("Qoldi: ~"); lcd.print(qolDaq); lcd.print(" daq  ");
      }
      esp_task_wdt_reset(); delay(1200); esp_task_wdt_reset();
      lcd.clear(); esp_task_wdt_reset();
    }
  }

  bool sensorFaolMi = boshlangichRejimda || (tsikilRejim == TSIKL_ISHLASH);
  if (sensorFaolMi && (joriyDaq == 58 || joriyDaq == 59)) {
    uint16_t joriyKalit = yozuvKalitHisopla(joriyOy, joriyKun, joriySoat);
    if (joriyKalit != oxirgiYozuvKaliti) {
      xotiragaYozish(now);
      oxirgiYozuvKaliti = joriyKalit;
    }
  }
}

bool vaqtRejimiReleHolati() {
  if (vaqtOraliqSoni == 0) return false;
  DateTime now = rtc.now();
  uint16_t joriyDaq = (uint16_t)now.hour() * 60u + now.minute();
  for (uint8_t i = 0; i < MAX_VAQT_ORALIQ; i++) {
    if (!vaqtJadvali[i].faol) continue;
    uint16_t boshDaq = (uint16_t)vaqtJadvali[i].boshH * 60u + vaqtJadvali[i].boshM;
    uint16_t oxirDaq = (uint16_t)vaqtJadvali[i].oxirH * 60u + vaqtJadvali[i].oxirM;
    if (boshDaq < oxirDaq) { if (joriyDaq >= boshDaq && joriyDaq < oxirDaq) return true; }
    else if (boshDaq > oxirDaq) { if (joriyDaq >= boshDaq || joriyDaq < oxirDaq) return true; }
  }
  return false;
}

// ================================================================
//  EKRAN YANGILASH
// ================================================================
void ekranniYangilash() {
  if (joriyRejimKiritish != ' ') return;
  if (!boshlangichRejimda && aeratsiyaRejimi == REJIM_KISLOROD && tsikilRejim == TSIKL_UXLASH) return;

  lcd.setCursor(0, 0);
  if (aeratsiyaRejimi == REJIM_KISLOROD) {
    if (!doXato && doAktivmi) {
      lcd.print("DO:"); lcdX10(do_x10);
      lcd.print(" T:"); lcdX10(t_x10);
      lcd.print((char)223); lcd.print('C');
    } else {
      lcd.print("DO:?    T:?     ");
    }
  } else {
    lcd.print("VAQT ");
    lcd.print(releHolati ? "ON  " : "OFF ");
    lcd.print('['); lcd.print(vaqtOraliqSoni); lcd.print("/5]  ");
  }

  lcd.setCursor(0, 1);
  if (aeratsiyaRejimi == REJIM_KISLOROD) {
    if (!phXato && phAktivmi) { lcd.print("Ph:"); lcdX10(ph_x10); lcd.print(' '); }
    else                      { lcd.print("Ph:?   "); }
  } else {
    lcd.print("               ");
  }
}

void showClock() {
  if (joriyRejimKiritish != ' ') return;
  if (!boshlangichRejimda && aeratsiyaRejimi == REJIM_KISLOROD && tsikilRejim == TSIKL_UXLASH) return;
  lcd.setCursor(9, 1);
  // BUG-S1 FIX: Vaqt noto'g'ri bo'lsa "RTC!" ko'rsatamiz
  if (rtcVaqtYoq) { lcd.print("RTC! "); return; }
  DateTime now = rtc.now();
  lcdIkkiRaqam(now.hour()); lcd.print(':'); lcdIkkiRaqam(now.minute());
}

void uxlashEkrani() {
  if (aeratsiyaRejimi != REJIM_KISLOROD) return;
  if (boshlangichRejimda) return;
  if (tsikilRejim != TSIKL_UXLASH) return;
  if (!taymerOtdimi(lastUxlashEkranVaqti, 5000UL)) return;
  lastUxlashEkranVaqti = millis();

  esp_task_wdt_reset();
  DateTime now = rtc.now();
  uint8_t joriyDaq = now.minute();
  esp_task_wdt_reset();

  uint8_t keyingiOyna, qolganDaq;
  if (joriyDaq < 20) { keyingiOyna = 20; qolganDaq = 20 - joriyDaq; }
  else               { keyingiOyna = 50; qolganDaq = 50 - joriyDaq; }

  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Sensor uxlaydi  ");
  lcd.setCursor(0, 1); lcd.print(":"); lcdIkkiRaqam(keyingiOyna);
  lcd.print("da yonadi ~"); lcd.print(qolganDaq); lcd.print("d ");
}

// ================================================================
//  RELE BOSHQARUVI (avtonom — LoRa'dan mustaqil)
// ================================================================
void boshqarishRele() {
  // Fix 12: manual rejim timeout tekshiruvi
  if (qolReleYoq && qolReleTimeoutMin > 0) {
    if (taymerOtdimi(qolReleYoqVaqti, (unsigned long)qolReleTimeoutMin * 60000UL)) {
      qolReleYoq = false;
      qolReleTimeoutMin = 0;
      prefs.putBool("qolrele", false);
    }
  }

  bool yangiHolat = releHolati;
  if (aeratsiyaRejimi == REJIM_KISLOROD) {
    if (doXato || !doAktivmi)                    yangiHolat = true;   // xatoda xavfsiz: yoq
    else if (do_x10 < minDo_x10)                 yangiHolat = true;
    else if (do_x10 >= (minDo_x10 + farqDo_x10)) yangiHolat = false;
  } else {
    yangiHolat = vaqtRejimiReleHolati();
  }
  if (qolReleYoq) yangiHolat = true;   // LoRa buyrug'i: faqat YONIQ qiladi

  if (yangiHolat != releHolati && taymerOtdimi(releOzgarishVaqti, RELE_DEBOUNCE_MS)) {
    releHolati = yangiHolat;
    releOzgarishVaqti = millis();
    digitalWrite(RELE_PIN, releHolati ? HIGH : LOW);
  }
}

// ================================================================
//  SENSOR O'QISH (navbatma-navbat DO va pH)
//  v13: alarmFaol shu yerda yangilanadi (telemetriya/LCD uchun)
// ================================================================
void readSensorDataSmart() {
  if (qaysiSensorNavbati == 1) {
    qaysiSensorNavbati = 2;
    if (doAktivmi) {
      node.begin(1, modbusSerial);
      if (node.readHoldingRegisters(0x0000, 4) == node.ku8MBSuccess) {
        do_x10 = (int16_t)(node.getResponseBuffer(0) / 10);
        t_x10  = (int16_t)(node.getResponseBuffer(2) / 10);
        doXato = false;
      } else {
        doXato = true; doAktivmi = false; lastDoCheckTime = millis();
      }
    } else {
      doXato = true;
    }
    // Alarm bayrog'ini yangilash
    alarmFaol = (kritikDo_x10 > 0 && !doXato && doAktivmi && do_x10 < kritikDo_x10);
  } else {
    qaysiSensorNavbati = 1;
    if (phAktivmi) {
      node.begin(2, modbusSerial);
      if (node.readHoldingRegisters(0x0000, 2) == node.ku8MBSuccess) {
        ph_x10 = (int16_t)(node.getResponseBuffer(0) / 10);
        phXato = false;
      } else {
        phXato = true; phAktivmi = false; lastPhCheckTime = millis();
      }
    } else {
      phXato = true;
    }
  }
}

// ================================================================
//  XOTIRAGA YOZISH (DO tarixi ring buffer)
// ================================================================
void xotiragaYozish(const DateTime& now) {
  if (doXato || !doAktivmi) return;
  if (rtcVaqtYoq) return;  // BUG-S1 FIX: Vaqt noto'g'ri bo'lganda tarix yozmaymiz
  uint8_t head  = eeprom_head_cache;
  uint8_t count = eeprom_count_cache;
  if (head  >= MAX_RECORDS) head  = 0;
  if (count >  MAX_RECORDS) count = 0;
  int16_t clamped = (do_x10 < 0) ? 0 : ((do_x10 > 255) ? 255 : do_x10);
  uint8_t doB = (uint8_t)clamped;
  prefsYozuvSaqla(head, now.hour(), now.minute(), now.day(), now.month(), doB);
  head = (head + 1) % MAX_RECORDS;
  if (count < MAX_RECORDS) count++;
  prefsYozHead(head);
  prefsYozCount(count);
}

// ================================================================
//  DO TARIXI KO'RSATISH (E)
// ================================================================
void doTarixiKorsat() {
  uint8_t head  = eeprom_head_cache;
  uint8_t count = eeprom_count_cache;
  lcd.clear();
  if (count == 0) {
    lcd.setCursor(0, 0); lcd.print("Tarix bo'sh!    ");
    esp_task_wdt_reset(); delay(1500); esp_task_wdt_reset();
    lcd.clear(); return;
  }
  lcd.setCursor(0, 0); lcd.print("--- DO TARIX ---");
  lcd.setCursor(0, 1); lcd.print("Jami: "); lcd.print(count); lcd.print(" yozuv  ");
  esp_task_wdt_reset(); delay(1500); esp_task_wdt_reset();

  uint8_t boshIndeks = (count == MAX_RECORDS) ? head : 0;
  char qator1[17] = "";
  for (uint8_t i = 0; i < count; i++) {
    esp_task_wdt_reset();
    uint8_t idx = (boshIndeks + i) % MAX_RECORDS;
    uint8_t h, m, kun, oy, doB;
    prefsYozuvOqish(idx, h, m, kun, oy, doB);
    uint8_t doB_tam = doB / 10, doB_kas = doB % 10;
    char joriy[17];
    joriy[0]='0'+oy/10; joriy[1]='0'+oy%10; joriy[2]='/';
    joriy[3]='0'+kun/10; joriy[4]='0'+kun%10; joriy[5]=' ';
    joriy[6]='0'+h/10; joriy[7]='0'+h%10; joriy[8]=':';
    joriy[9]='0'+m/10; joriy[10]='0'+m%10; joriy[11]=' ';
    joriy[12]=(doB_tam>=10)?('0'+doB_tam/10):' ';
    joriy[13]='0'+(doB_tam%10); joriy[14]='.'; joriy[15]='0'+doB_kas; joriy[16]='\0';
    lcd.clear();
    lcd.setCursor(0, 0); if (qator1[0] != '\0') lcd.print(qator1);
    lcd.setCursor(0, 1); lcd.print(joriy);
    esp_task_wdt_reset(); delay(2000); esp_task_wdt_reset(); delay(500); esp_task_wdt_reset();
    memcpy(qator1, joriy, 17);
  }
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Tarix tugadi.   ");
  esp_task_wdt_reset(); delay(1500); esp_task_wdt_reset();
  lcd.clear(); esp_task_wdt_reset();
}

// ================================================================
//  VAQT ORALIQLARINI KO'RSATISH (E, vaqt rejimida)
// ================================================================
void vaqtJadvaliniKorsat() {
  lcd.clear();
  if (vaqtOraliqSoni == 0) {
    lcd.setCursor(0, 0); lcd.print("Jadval bo'sh!   ");
    lcd.setCursor(0, 1); lcd.print("R-kiriting      ");
    esp_task_wdt_reset(); delay(1500); esp_task_wdt_reset(); delay(500); esp_task_wdt_reset();
    lcd.clear(); return;
  }
  lcd.setCursor(0, 0); lcd.print("-- VAQT JADVAL--");
  lcd.setCursor(0, 1); lcd.print("Jami: "); lcd.print(vaqtOraliqSoni); lcd.print(" ta     ");
  esp_task_wdt_reset(); delay(1500); esp_task_wdt_reset();

  uint8_t ko = 0;
  for (uint8_t i = 0; i < MAX_VAQT_ORALIQ; i++) {
    if (!vaqtJadvali[i].faol) continue;
    esp_task_wdt_reset(); ko++;
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(ko); lcd.print(": ");
    lcdIkkiRaqam(vaqtJadvali[i].boshH); lcd.print(':');
    lcdIkkiRaqam(vaqtJadvali[i].boshM); lcd.print('-');
    lcdIkkiRaqam(vaqtJadvali[i].oxirH); lcd.print(':');
    lcdIkkiRaqam(vaqtJadvali[i].oxirM); lcd.print("    ");
    lcd.setCursor(0, 1);
    lcd.print(vaqtRejimiReleHolati() ? "Hozir: AKTIV    " : "Hozir: -        ");
    esp_task_wdt_reset(); delay(2000); esp_task_wdt_reset(); delay(500); esp_task_wdt_reset();
  }
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Jadval tugadi.  ");
  esp_task_wdt_reset(); delay(1500); esp_task_wdt_reset();
  lcd.clear(); esp_task_wdt_reset();
}

// ================================================================
//  L TUGMASI — REJIM TANLASH
// ================================================================
void lTugmasiBosildi() {
  if (lTugmaHolati == 0 || taymerOtdimi(lTugmaVaqti, L_TIMEOUT)) {
    lTugmaHolati = 1; lTugmaVaqti = millis(); joriyRejimKiritish = 'L';
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("1-Kislorod rejim");
    lcd.setCursor(0, 1); lcd.print("T-tasdiqlash    ");
  } else if (lTugmaHolati == 1) {
    lTugmaHolati = 2; lTugmaVaqti = millis();
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("2-Vaqt rejimi   ");
    lcd.setCursor(0, 1); lcd.print("T-tasdiqlash    ");
  } else {
    lTugmaHolati = 0; joriyRejimKiritish = ' ';
    lcd.clear(); ekranniYangilash();
  }
}

// ================================================================
//  KLAVIATURA BOSHQARUV
//  v13: telefon raqami ('P') va WiFi portali ('W','1') olib tashlandi.
//       Kislorod rejimida bo'sh [R] -> LoRa holati ekrani.
// ================================================================
void klaviaturaBoshqar(char key) {

  if (key == 'L') { lTugmasiBosildi(); return; }

  if (joriyRejimKiritish == 'L') {
    if (key == 'T') {
      if (lTugmaHolati == 1) {
        aeratsiyaRejimi = REJIM_KISLOROD;
        prefs.putUChar("rejim", REJIM_KISLOROD);
        boshlangichRejimda = true; boshlangichBosh = millis();
        tsikilRejim = TSIKL_ISHLASH; oxirgiYozuvKaliti = 0xFFFF; qaysiSensorNavbati = 1;
        joriyRejimKiritish = ' '; lTugmaHolati = 0;
        forceUplink = true;   // Fix N1: rejim o'zgardi — ilova darhol bilsin
        lcd.clear();
        lcd.setCursor(0, 0); lcd.print("Kislorod rejim  ");
        lcd.setCursor(0, 1); lcd.print("1s boshlang'ich ");
        esp_task_wdt_reset(); delay(1500); esp_task_wdt_reset();
        lcd.clear(); ekranniYangilash();
      } else if (lTugmaHolati == 2) {
        aeratsiyaRejimi = REJIM_VAQT;
        prefs.putUChar("rejim", REJIM_VAQT);
        joriyRejimKiritish = ' '; lTugmaHolati = 0;
        forceUplink = true;   // Fix N1
        lcd.clear();
        lcd.setCursor(0, 0); lcd.print("Vaqt rejimi     ");
        lcd.setCursor(0, 1); lcd.print("tanlandi!       ");
        esp_task_wdt_reset(); delay(1500); esp_task_wdt_reset();
        lcd.clear(); ekranniYangilash();
      }
    } else if (key == 'R') {
      lTugmaHolati = 0; joriyRejimKiritish = ' ';
      lcd.clear(); ekranniYangilash();
    }
    return;
  }

  if (key == 'F') {
    if (doAktivmi) runKislorodKalibrlash();
    else           nonBlockXabar("DO datchik yo'q ", 1500);
    return;
  }

  if (key == 'E') {
    if (aeratsiyaRejimi == REJIM_KISLOROD) doTarixiKorsat();
    else                                    vaqtJadvaliniKorsat();
    return;
  }

  if (key == 'D') {
    if (aeratsiyaRejimi == REJIM_VAQT) {
      if (vaqtOraliqSoni == 0) {
        nonBlockXabar("Jadval bo'sh!   ", 1500);
      } else {
        for (int8_t i = MAX_VAQT_ORALIQ - 1; i >= 0; i--) {
          if (vaqtJadvali[i].faol) { vaqtJadvali[i].faol = false; vaqtOraliqSoni--; break; }
        }
        vaqtJadvaliniSaqla();
        nonBlockXabar("O'chirildi!     ", 1500);
      }
    }
    return;
  }

  if (key == 'T') {
    // Bo'sh holatda T -> uzun bosish (test telemetriya) loop'da aniqlanadi.
    if (joriyRejimKiritish == ' ' && inputLen == 0) {
      tBosildi = true; tBoshVaqti = millis();
    } else {
      saqlashTugmasi();
    }
    return;
  }

  if (key == 'R') {
    if (joriyRejimKiritish != ' ') {
      inputLen = 0; inputText[0] = '\0'; joriyRejimKiritish = ' ';
      lcd.setCursor(0, 1); lcd.print("                ");
      lcd.clear(); ekranniYangilash();
    } else if (aeratsiyaRejimi == REJIM_VAQT) {
      if (vaqtOraliqSoni >= MAX_VAQT_ORALIQ) { nonBlockXabar("Max 5 ta! D-och ", 2000); return; }
      joriyRejimKiritish = 'V';
      inputLen = 0; inputText[0] = '\0';
      lcd.clear();
      lcd.setCursor(0, 0); lcd.print("Vaqt: SSDDBBOO  ");
      lcd.setCursor(0, 1); lcd.print("                ");
      lcd.setCursor(0, 1);
    } else {
      // KISLOROD rejimi, bo'sh -> LoRa holati ekrani (diagnostika)
      loraInfoKorsat();
    }
    return;
  }

  // '#' : bir marta = Min DO, ikki marta = Kritik DO
  if (key == '#') {
    if (joriyRejimKiritish == '#' && inputLen == 0) {
      joriyRejimKiritish = 'K';
      lcd.setCursor(0, 1); lcd.print("                ");
      lcd.setCursor(0, 1); lcd.print("Kritik DO(mg/L):");
    } else {
      joriyRejimKiritish = '#';
      inputLen = 0; inputText[0] = '\0';
      lcd.setCursor(0, 1); lcd.print("                ");
      lcd.setCursor(0, 1); lcd.print("Min DO(mg/L):   ");
    }
    return;
  }

  if (key == 'B' || key == '*' || key == 'U') {
    joriyRejimKiritish = key;
    inputLen = 0; inputText[0] = '\0';
    lcd.setCursor(0, 1); lcd.print("                ");
    lcd.setCursor(0, 1);
    if      (key == 'B') lcd.print("T kiriting(C):  ");
    else if (key == '*') lcd.print("Farq(mg/L):     ");
    else if (key == 'U') {
      lcd.setCursor(0, 0); lcd.print("Vaqt: OOKKSSDD  ");
      lcd.setCursor(0, 1); lcd.print("OO-oy, KK-kun...");
      esp_task_wdt_reset(); delay(1200); esp_task_wdt_reset();
      lcd.setCursor(0, 0); lcd.print("Vaqt: OOKKSSDD  ");
      lcd.setCursor(0, 1); lcd.print("                ");
      lcd.setCursor(0, 1);
    }
    return;
  }

  // Bo'sh holatda '0' -> ZAVOD RESET kiritish ("000" + T)
  if (key == '0' && joriyRejimKiritish == ' ') {
    joriyRejimKiritish = 'Z';
    inputLen = 0; inputText[inputLen++] = '0'; inputText[inputLen] = '\0';
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("ZAVOD RESET?    ");
    lcd.setCursor(0, 1); lcd.print("T=tasdiq "); lcd.print(inputText);
    return;
  }

  if (key >= '0' && key <= '9' && joriyRejimKiritish != ' ') {
    if (joriyRejimKiritish == 'Z' && key != '0') return;

    uint8_t maxLen;
    if      (joriyRejimKiritish == 'Z') maxLen = 3;
    else                                maxLen = 8;

    if (inputLen < maxLen) { inputText[inputLen++] = key; inputText[inputLen] = '\0'; }
    lcd.setCursor(0, 1); lcd.print("                "); lcd.setCursor(0, 1);

    if (joriyRejimKiritish == 'V') {
      for (uint8_t i = 0; i < inputLen; i++) {
        if (i == 2) lcd.print(':'); else if (i == 4) lcd.print('-'); else if (i == 6) lcd.print(':');
        lcd.print(inputText[i]);
      }
    } else if (joriyRejimKiritish == 'U') {
      for (uint8_t i = 0; i < inputLen; i++) {
        if (i == 2) lcd.print('/'); else if (i == 4) lcd.print(' '); else if (i == 6) lcd.print(':');
        lcd.print(inputText[i]);
      }
    } else if (joriyRejimKiritish == 'Z') {
      lcd.print("T=tasdiq "); lcd.print(inputText);
    } else {
      if      (joriyRejimKiritish == 'B') lcd.print("T:");
      else if (joriyRejimKiritish == '#') lcd.print("MinDO:");
      else if (joriyRejimKiritish == 'K') lcd.print("Krit:");
      else if (joriyRejimKiritish == '*') lcd.print("Farq:");
      lcd.print(inputText);
    }
  }
}

// ================================================================
//  SAQLASH TUGMASI (T)
//  v13: telefon ('P') va WiFi ('W') saqlash bloklari olib tashlandi.
// ================================================================
void saqlashTugmasi() {
  if (inputLen == 0) { nonBlockXabar("Qiymat yo'q!   ", 1500); return; }

  // 000T -> zavod reseti
  if (inputLen == 3 && inputText[0]=='0' && inputText[1]=='0' && inputText[2]=='0') {
    inputLen = 0; inputText[0] = '\0'; joriyRejimKiritish = ' ';
    standartgaQaytarish(); ekranniYangilash(); return;
  }
  if (joriyRejimKiritish == 'Z') {
    inputLen = 0; inputText[0] = '\0'; joriyRejimKiritish = ' ';
    nonBlockXabar("Reset bekor     ", 1500); return;
  }

  int val = atoi(inputText);

  // VAQT ORALIG'I (V)
  if (joriyRejimKiritish == 'V') {
    if (inputLen != 8) { nonBlockXabar("8 raqam: SSDDBBOO", 2000); return; }
    uint8_t bH=(inputText[0]-'0')*10+(inputText[1]-'0');
    uint8_t bM=(inputText[2]-'0')*10+(inputText[3]-'0');
    uint8_t oH=(inputText[4]-'0')*10+(inputText[5]-'0');
    uint8_t oM=(inputText[6]-'0')*10+(inputText[7]-'0');
    if (bH>=24||bM>=60||oH>=24||oM>=60) { nonBlockXabar("Vaqt noto'g'ri! ", 2000); return; }
    if (bH==oH && bM==oM) { nonBlockXabar("Bosh=Oxir xato! ", 2000); return; }
    bool saqlandi = false;
    for (uint8_t i = 0; i < MAX_VAQT_ORALIQ; i++) {
      if (!vaqtJadvali[i].faol) { vaqtJadvali[i]={bH,bM,oH,oM,true}; vaqtOraliqSoni++; saqlandi=true; break; }
    }
    if (!saqlandi) { nonBlockXabar("Max 5 ta! D-och ", 2000); return; }
    vaqtJadvaliniSaqla();
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("Saqlandi:       ");
    lcd.setCursor(0, 1);
    lcdIkkiRaqam(bH); lcd.print(':'); lcdIkkiRaqam(bM); lcd.print('-');
    lcdIkkiRaqam(oH); lcd.print(':'); lcdIkkiRaqam(oM); lcd.print("      ");
    esp_task_wdt_reset(); delay(1500); esp_task_wdt_reset(); delay(500); esp_task_wdt_reset();
    lcd.clear();
    inputLen = 0; inputText[0] = '\0'; joriyRejimKiritish = ' ';
    ekranniYangilash(); return;
  }

  // RTC SOZLASH (U) — OOKKSSDD
  if (joriyRejimKiritish == 'U') {
    if (inputLen != 8) { nonBlockXabar("8 raqam: OOKKSSDD", 2000); return; }
    uint8_t oy=(inputText[0]-'0')*10+(inputText[1]-'0');
    uint8_t kun=(inputText[2]-'0')*10+(inputText[3]-'0');
    uint8_t soat=(inputText[4]-'0')*10+(inputText[5]-'0');
    uint8_t daq=(inputText[6]-'0')*10+(inputText[7]-'0');
    if (oy<1||oy>12) { nonBlockXabar("Oy 01-12 bo'lsin", 2000); return; }
    DateTime now = rtc.now(); uint16_t yil = now.year();
    uint8_t maxKun = oyningKunlari(oy, yil);
    if (maxKun==0||kun<1||kun>maxKun) { nonBlockXabar("Kun xato!       ", 2000); return; }
    if (soat>=24||daq>=60) { nonBlockXabar("Soat/daqiqa xato", 2000); return; }
    rtc.adjust(DateTime(yil, oy, kun, soat, daq, 0));
    oxirgiYozuvKaliti = 0xFFFF;
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("Vaqt saqlandi:  ");
    lcd.setCursor(0, 1);
    lcdIkkiRaqam(oy); lcd.print('/'); lcdIkkiRaqam(kun); lcd.print(' ');
    lcdIkkiRaqam(soat); lcd.print(':'); lcdIkkiRaqam(daq); lcd.print("   ");
    esp_task_wdt_reset(); delay(1500); esp_task_wdt_reset();
    lcd.clear();
    inputLen = 0; inputText[0] = '\0'; joriyRejimKiritish = ' ';
    ekranniYangilash(); return;
  }

  // HARORAT KALIBRLASH (B)
  if (joriyRejimKiritish == 'B') {
    if (val<0||val>50) nonBlockXabar("0-50 oralig'i! ", 2500);
    else { kiritilganHarorat = (int8_t)val; runHaroratKalibrlash(); }
    return;
  }

  // MIN DO (#)
  if (joriyRejimKiritish == '#') {
    if (val<1||val>20) { nonBlockXabar("1-20 mg/L !    ", 2000); return; }
    minDo_x10 = (int16_t)(val*10); prefs.putShort("minDo", minDo_x10);
    forceUplink = true;   // Fix N1: ilova darhol yangilansin
    nonBlockXabar("Min DO saqlandi", 1500); return;
  }

  // FARQ (*)
  if (joriyRejimKiritish == '*') {
    if (val<1||val>10) { nonBlockXabar("1-10 mg/L !    ", 2000); return; }
    farqDo_x10 = (int16_t)(val*10); prefs.putShort("farqDo", farqDo_x10);
    forceUplink = true;   // Fix N1
    nonBlockXabar("Farq saqlandi  ", 1500); return;
  }

  // KRITIK DO (## -> K)
  if (joriyRejimKiritish == 'K') {
    if (val<1||val>20) { nonBlockXabar("1-20 mg/L !    ", 2000); return; }
    kritikDo_x10 = (int16_t)(val*10); prefs.putShort("kritikDo", kritikDo_x10);
    alarmFaol = false;
    forceUplink = true;   // Fix N1
    if (kritikDo_x10 >= minDo_x10) nonBlockXabar("Ogoh:kritik>=min", 2500);
    else                           nonBlockXabar("Kritik DO saqlan", 1500);
    return;
  }
}

// ================================================================
//  DO KALIBRLASH
// ================================================================
void runKislorodKalibrlash() {
  isCalibrating = true;
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("DO KALIBR...    ");
  esp_task_wdt_reset(); delay(500); esp_task_wdt_reset();
  node.begin(1, modbusSerial);
  uint8_t result = node.writeSingleRegister(0x1004, 0);
  lcd.clear();
  lcd.setCursor(0, 0);
  if (result == node.ku8MBSuccess) lcd.print("DO OK           ");
  else { lcd.print("Xato: 0x"); lcd.print(result, HEX); }
  esp_task_wdt_reset(); delay(2000); esp_task_wdt_reset(); delay(500); esp_task_wdt_reset();
  lcd.clear();
  inputLen = 0; inputText[0] = '\0'; joriyRejimKiritish = ' ';
  isCalibrating = false;
}

// ================================================================
//  HARORAT KALIBRLASH
// ================================================================
void runHaroratKalibrlash() {
  isCalibrating = true;
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("T KALIBR...     ");
  lcd.setCursor(0, 1); lcd.print(kiritilganHarorat); lcd.print(" C");
  esp_task_wdt_reset(); delay(800); esp_task_wdt_reset();
  node.begin(1, modbusSerial);
  uint8_t result = node.writeSingleRegister(0x1010, (uint16_t)((uint8_t)kiritilganHarorat * 10));
  lcd.clear();
  lcd.setCursor(0, 0);
  if (result == node.ku8MBSuccess) lcd.print("T OK            ");
  else { lcd.print("Xato: 0x"); lcd.print(result, HEX); }
  esp_task_wdt_reset(); delay(2000); esp_task_wdt_reset();
  lcd.clear();
  inputLen = 0; inputText[0] = '\0'; kiritilganHarorat = -1; joriyRejimKiritish = ' ';
  isCalibrating = false;
}

// ================================================================
//  QURILMA ID — v15: BIRINCHI YOQILISHDA tasodifiy 32-bit ID yaratib
//  NVS'ga ABADIY yozadi. Keyingi har yoqilishda o'sha o'qiladi.
//  -> Har plata o'z noyob ID'siga ega, 100% avtomatik, takrorlanmaydi.
//  MUHIM: prefs.begin(...) ALLAQACHON ochilgan bo'lishi kerak
//         (setup'da prefsTekshir() dan KEYIN chaqiriladi).
// ================================================================
void deviceIdYarat() {
  uint32_t id = prefs.getUInt("devid", 0);   // saqlangan ID bormi?

  if (id == 0) {
    // Yo'q -> yangi noyob ID yaratamiz (apparat RNG + MAC aralashmasi)
    uint64_t mac = ESP.getEfuseMac();
    do {
      id = esp_random() ^ (uint32_t)(mac >> 24) ^ (uint32_t)(mac);
    } while (id == 0 || id == GATEWAY_ID || id == BROADCAST_ID);  // band qiymatlar
    prefs.putUInt("devid", id);              // ABADIY saqlash
  }

  deviceNumId = id;
  snprintf(deviceId, sizeof(deviceId), "AQ%08X", (unsigned)id);   // 8 hex raqam
}

// ================================================================
//  ============   LoRa MODULI (SX1278 / Ra-02)   ============
//  Yarim-dupleks: odatda RX (tinglash), telemetriya yuborilganda
//  qisqa vaqt TX. CAD (listen-before-talk) + ACK + qayta yuborish.
// ================================================================

// DIO0 uzilishi: RxDone/TxDone -> bayroq qo'yadi (ISR ichida SPI YO'Q!)
IRAM_ATTR void loraISR() { loraFlag = true; }

// CRC16-CCITT (0x1021, init 0xFFFF)
uint16_t loraCrc16(const uint8_t* d, uint16_t n) {
  uint16_t crc = 0xFFFF;
  for (uint16_t i = 0; i < n; i++) {
    crc ^= (uint16_t)d[i] << 8;
    for (uint8_t b = 0; b < 8; b++)
      crc = (crc & 0x8000) ? (uint16_t)((crc << 1) ^ 0x1021) : (uint16_t)(crc << 1);
  }
  return crc;
}

// LoRa belgisi uchun maxsus LCD glyph (antenna to'lqini)
void loraGlyphYarat() {
  uint8_t g[8] = {0b00100,0b01010,0b10001,0b00100,0b01010,0b00000,0b00100,0b00000};
  lcd.createChar(6, g);
}

// ----------------------------------------------------------------
//  RADIO BOSHLASH — muvaffaqiyatsiz bo'lsa loraOk=false (FATAL EMAS:
//  node aeratorni baribir boshqaraveradi).
// ----------------------------------------------------------------
void loraBoshlash() {
  // Fix C: SPI shinasi faqat birinchi marta ishga tushiriladi.
  // Har 30s qayta init chaqiruvida loraSPI.begin() takrorlanmaydi.
  static bool spiInit = false;
  if (!spiInit) {
    loraSPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);
    spiInit = true;
  }
  esp_task_wdt_reset();

  int st = radio.begin(LORA_FREQ, LORA_BW, LORA_SF, LORA_CR,
                       LORA_SYNCWORD, LORA_POWER, LORA_PREAMBLE);
  if (st != RADIOLIB_ERR_NONE) {
    loraOk = false;
    lastReinit = millis();
    return;
  }
  radio.setCRC(true);                       // apparat CRC (bizning CRC16 ustiga)
  radio.setPacketReceivedAction(loraISR);   // RxDone -> loraISR
  radio.startReceive();
  loraFlag  = false;
  loraState = LORA_RX;
  loraOk    = true;
  lastReinit = millis();
}

// ----------------------------------------------------------------
//  KADRNI SARLAVHA BILAN TO'LDIRISH (umumiy)
//  return: payloaddan keyingi offset (CRC shu yerga yoziladi)
// ----------------------------------------------------------------
static uint16_t loraSarlavha(uint8_t* b, uint8_t type, uint8_t flags,
                             uint8_t seq, uint32_t dst) {
  b[0] = LORA_MAGIC; b[1] = LORA_VER; b[2] = type; b[3] = flags; b[4] = seq;
  b[5]=(uint8_t)(deviceNumId); b[6]=(uint8_t)(deviceNumId>>8);
  b[7]=(uint8_t)(deviceNumId>>16); b[8]=(uint8_t)(deviceNumId>>24);
  b[9]=(uint8_t)(dst); b[10]=(uint8_t)(dst>>8);
  b[11]=(uint8_t)(dst>>16); b[12]=(uint8_t)(dst>>24);
  return 13;
}

static void loraCrcYoz(uint8_t* b, uint16_t pos) {
  uint16_t c = loraCrc16(b, pos);
  b[pos] = (uint8_t)(c); b[pos+1] = (uint8_t)(c >> 8);
}

// ----------------------------------------------------------------
//  TELEMETRIYA KADRINI TAYYORLASH -> uzunlikni qaytaradi
//  Kadr: Header(13) + payload(25) + CRC(2) = 40 bayt  // BUG-S4 FIX: 42->40
// ----------------------------------------------------------------
uint16_t loraTelemKadrTayyorla(uint8_t* b) {
  uint16_t p = loraSarlavha(b, FT_TELE, FLAG_WANTACK, txSeq, GATEWAY_ID);

  uint8_t status = 0;
  if (doXato)             status |= ST_DOXATO;
  if (phXato)             status |= ST_PHXATO;
  if (alarmFaol)          status |= ST_ALARM;
  if (boshlangichRejimda) status |= ST_BOSHLAN;
  if (qolReleYoq)         status |= ST_QOLRELE;
  // Fix 9: kritikDo noto'g'ri sozlangan (kritik >= min)
  if (kritikDo_x10 > 0 && kritikDo_x10 >= minDo_x10) status |= ST_KRITIK_XATO;

  uint16_t uptimeMin = (uint16_t)(millis() / 60000UL);

  b[p++] = (uint8_t)(do_x10);  b[p++] = (uint8_t)(do_x10 >> 8);
  b[p++] = (uint8_t)(ph_x10);  b[p++] = (uint8_t)(ph_x10 >> 8);
  b[p++] = (uint8_t)(t_x10);   b[p++] = (uint8_t)(t_x10 >> 8);
  b[p++] = releHolati ? 1 : 0;
  b[p++] = aeratsiyaRejimi;
  b[p++] = status;
  b[p++] = (uint8_t)(uptimeMin); b[p++] = (uint8_t)(uptimeMin >> 8);
  // FIX #1: qurilmadagi haqiqiy sozlamalar ilovaga uzatiladi
  b[p++] = (uint8_t)(minDo_x10);    b[p++] = (uint8_t)(minDo_x10 >> 8);
  b[p++] = (uint8_t)(farqDo_x10);   b[p++] = (uint8_t)(farqDo_x10 >> 8);
  b[p++] = (uint8_t)(kritikDo_x10); b[p++] = (uint8_t)(kritikDo_x10 >> 8);

  // Fix 10: RTC Unix timestamp (ilova vaqtni tekshiradi)
  esp_task_wdt_reset();
  DateTime nowRtc = rtc.now();
  uint32_t rtcTs  = (uint32_t)nowRtc.unixtime();
  b[p++] = (uint8_t)(rtcTs);       b[p++] = (uint8_t)(rtcTs >> 8);
  b[p++] = (uint8_t)(rtcTs >> 16); b[p++] = (uint8_t)(rtcTs >> 24);

  // Fix 7: ma'lumot eskirganlik (necha daqiqa oldin o'lchangan)
  uint8_t dataAge = (uint8_t)min((unsigned long)255,
                                  (millis() - lastMeasureTime) / 60000UL);
  b[p++] = dataAge;

  // Fix 6: vaqt jadvali yozuvlari soni (ilova ko'radi)
  b[p++] = vaqtOraliqSoni;

  // Fix 12: manual rejimning qolgan vaqti (daqiqada, 0=cheksiz yoki avtomatik)
  uint16_t manRemain = 0;
  if (qolReleYoq && qolReleTimeoutMin > 0) {
    unsigned long elapsed = millis() - qolReleYoqVaqti;
    unsigned long totalMs = (unsigned long)qolReleTimeoutMin * 60000UL;
    if (elapsed < totalMs)
      manRemain = (uint16_t)((totalMs - elapsed) / 60000UL + 1);
  }
  b[p++] = (uint8_t)(manRemain); b[p++] = (uint8_t)(manRemain >> 8);

  loraCrcYoz(b, p);
  return p + 2;
}

// ----------------------------------------------------------------
//  CAD (listen-before-talk) + TX. So'ng RX'ga qaytadi.
//  Kanal band bo'lsa backoff bilan urinadi; oxirida baribir yuboradi
//  (ma'lumotni butunlay yo'qotmaslik uchun — soatlik tarix NVS'da bor).
// ----------------------------------------------------------------
bool loraKadrYubor(uint8_t* buf, uint16_t len) {
  if (!loraOk) return false;
  esp_task_wdt_reset();

  for (uint8_t i = 0; i < CAD_TRIES; i++) {
    int cad = radio.scanChannel();
    if (cad == RADIOLIB_CHANNEL_FREE) break;
    uint16_t bo = CAD_BACKOFF_MIN + (esp_random() % CAD_BACKOFF_SPAN);
    delay(bo);
    esp_task_wdt_reset();
  }

  loraFlag = false;
  int st = radio.transmit(buf, len);   // bloklovchi (~100-200ms, WDT 10s)
  esp_task_wdt_reset();

  radio.startReceive();                // darhol tinglashga qaytamiz (ACK/buyruq)
  loraFlag = false;
  return (st == RADIOLIB_ERR_NONE);
}

// ----------------------------------------------------------------
//  UPLINK BOSHLASH — joriy telemetriyani yuboradi, ACK kutadi
// ----------------------------------------------------------------
void loraUplinkBoshla() {
  if (!loraOk) return;
  if (loraState == LORA_WAIT_ACK) return;   // avvalgisi tugamaguncha kutamiz

  txSeq++;
  txTries = 1;
  uint16_t len = loraTelemKadrTayyorla(loraTxBuf);
  loraKadrYubor(loraTxBuf, len);
  loraState   = LORA_WAIT_ACK;
  ackDeadline = millis() + ACK_TIMEOUT_MS;
}

// ----------------------------------------------------------------
//  UPLINK YANGILASH — ACK timeout/qayta yuborish
// ----------------------------------------------------------------
void loraUplinkYangilash() {
  if (!loraOk) return;
  if (loraState != LORA_WAIT_ACK) return;
  if ((long)(millis() - ackDeadline) < 0) return;   // hali ACK muddati tugamadi

  if (txTries < MAX_TX_TRIES) {
    txTries++;
    uint16_t len = loraTelemKadrTayyorla(loraTxBuf);   // o'sha seq bilan qayta
    loraKadrYubor(loraTxBuf, len);
    ackDeadline = millis() + ACK_TIMEOUT_MS;
  } else {
    // ACK kelmadi — voz kechamiz (link lost'ni LCD ko'rsatadi)
    loraState = LORA_RX;
    linkOk = false;
  }
}

// ----------------------------------------------------------------
//  ACK / CMDACK yuborish (qisqa, ACK so'ramaydi)
// ----------------------------------------------------------------
void loraAckYubor(uint8_t ackSeq, uint32_t dst) {
  uint8_t b[20];
  uint16_t p = loraSarlavha(b, FT_ACK, 0, ackSeq, dst);
  b[p++] = ackSeq;
  loraCrcYoz(b, p);
  loraKadrYubor(b, p + 2);
}
void loraCmdAckYubor(uint8_t cmd, uint8_t ok, uint32_t dst) {
  uint8_t b[20];
  uint16_t p = loraSarlavha(b, FT_CMDACK, 0, txSeq, dst);
  b[p++] = cmd; b[p++] = ok;
  loraCrcYoz(b, p);
  loraKadrYubor(b, p + 2);
}

// ----------------------------------------------------------------
//  BUYRUQNI QO'LLASH (shlyuzdan kelgan)
//  Fix 6: int32_t val — CMD_TIME uchun katta Unix timestamp
// ----------------------------------------------------------------
void loraBuyruqQolla(uint8_t cmd, int32_t val) {
  char nx[17];   // Fix N2: LCD xabari uchun bufer (16 belgi + '\0')
  switch (cmd) {
    case CMD_AER_ON:
      qolReleYoq = true;
      qolReleYoqVaqti = millis();
      // Fix 12: val > 0 bo'lsa timeout (daqiqada), 0 = cheksiz
      qolReleTimeoutMin = (uint16_t)(val > 0 && val <= 1440 ? val : 0);
      prefs.putBool("qolrele", true);    // FIX #2: tok uzilsa ham saqlanadi
      forceUplink = true;                            // Fix N2
      nonBlockXabar("Ilova: Aer YOQ  ", 2500);       // Fix N2
      break;
    case CMD_AER_AUTO:
      qolReleYoq = false;
      qolReleTimeoutMin = 0;
      prefs.putBool("qolrele", false);   // FIX #2: avtomatik rejimga qaytish saqlanadi
      forceUplink = true;                            // Fix N2
      nonBlockXabar("Ilova: Aer AVTO ", 2500);       // Fix N2
      break;
    case CMD_MINDO:
      if (val >= 1 && val <= 20) {
        minDo_x10 = (int16_t)(val*10); prefs.putShort("minDo", minDo_x10);
        forceUplink = true;                          // Fix N2
        snprintf(nx, sizeof(nx), "Ilova:MinDO=%-3ld", (long)val);
        nonBlockXabar(nx, 2500);                     // Fix N2
      }
      break;
    case CMD_FARQ:
      if (val >= 1 && val <= 10) {
        farqDo_x10 = (int16_t)(val*10); prefs.putShort("farqDo", farqDo_x10);
        forceUplink = true;                          // Fix N2
        snprintf(nx, sizeof(nx), "Ilova:Farq=%-4ld", (long)val);
        nonBlockXabar(nx, 2500);                     // Fix N2
      }
      break;
    case CMD_KRITIK:
      if (val >= 1 && val <= 20) {
        kritikDo_x10 = (int16_t)(val*10); prefs.putShort("kritikDo", kritikDo_x10); alarmFaol = false;
        forceUplink = true;                          // Fix N2
        snprintf(nx, sizeof(nx), "Ilova:Kritik=%-2ld", (long)val);
        nonBlockXabar(nx, 2500);                     // Fix N2
      }
      break;
    case CMD_MODE:
      if (val == REJIM_KISLOROD || val == REJIM_VAQT) {
        aeratsiyaRejimi = (uint8_t)val; prefs.putUChar("rejim", aeratsiyaRejimi);
        if (aeratsiyaRejimi == REJIM_KISLOROD) {
          boshlangichRejimda = true; boshlangichBosh = millis();
          tsikilRejim = TSIKL_ISHLASH; qaysiSensorNavbati = 1;
        }
        // Fix D: rejim o'zgarganda qo'lda yoqilgan aerator o'chiriladi.
        // Avval: CMD_AER_ON bilan yoqilgan aerator rejim o'zgartirilsa ham ishlab qolardi.
        if (qolReleYoq) {
          qolReleYoq        = false;
          qolReleTimeoutMin = 0;
          prefs.putBool("qolrele", false);
        }
        forceUplink = true;                          // Fix N2
        nonBlockXabar(val == REJIM_KISLOROD ?        // Fix N2
                      "Ilova:Kislorod R" : "Ilova:Vaqt rejim", 2500);
      }
      break;
    case CMD_STATUS:
      forceUplink = true;   // darhol telemetriya yuborishni so'raydi
      break;
    case CMD_TIME:
      // Fix 6: Gateway NTP dan olingan Unix timestampni yuboradi
      // RTClib seconds since 2000-01-01; Unix = seconds since 1970-01-01
      // Offset: 946684800 soniya
      if (val > 1700000000L) {
        uint32_t rtcSec = (uint32_t)((uint32_t)val - 946684800UL);
        rtc.adjust(DateTime(rtcSec));
        oxirgiYozuvKaliti = 0xFFFF;   // vaqt o'zgardi — tarix kalitini yangilash
        // BUG-S1 FIX: NTP sinxronizatsiya muvaffaqiyatli — bayrog'ni o'chirish
        if (rtcVaqtYoq) {
          rtcVaqtYoq = false;
          Serial.println("[RTC] NTP sinxronizatsiya bajarildi — rtcVaqtYoq = false");
        }
      }
      break;
    case CMD_HIST:
      // Fix 13: NVS tarixini ilovaga yuborish (async)
      histSendIdx    = 0;
      histSendTotal  = eeprom_count_cache;
      histSendBosh   = (eeprom_count_cache == MAX_RECORDS) ? eeprom_head_cache : 0;
      histSendActive = (histSendTotal > 0);
      break;
    // === OTA buyruqlari (Gateway orqali firmware yangilash) ===
    case CMD_OTA_BEGIN:
      nodeOtaHandleBegin((const uint8_t*)&val, 8);
      break;
    case CMD_OTA_END:
      nodeOtaHandleEnd((const uint8_t*)&val, 4);
      break;
    default: break;
  }
}

// ----------------------------------------------------------------
//  QABULNI TEKSHIRISH — kelgan kadrni o'qiydi, ajratadi, dispatch qiladi
// ----------------------------------------------------------------
void loraQabulTekshir() {
  if (!loraOk) return;
  if (!loraFlag) return;
  loraFlag = false;

  uint8_t  buf[64];
  size_t   len = radio.getPacketLength();
  if (len == 0 || len > sizeof(buf)) { radio.startReceive(); return; }

  int st = radio.readData(buf, len);
  // RSSI/SNR diagnostikasi
  lastRssi = (int16_t)radio.getRSSI();
  lastSnr  = radio.getSNR();
  radio.startReceive();
  loraFlag = false;
  if (st != RADIOLIB_ERR_NONE) return;
  if (len < 15) return;

  // Sarlavha tekshiruvi
  if (buf[0] != LORA_MAGIC || buf[1] != LORA_VER) return;

  // CRC tekshiruvi (oxirgi 2 bayt)
  uint16_t crcPos = len - 2;
  uint16_t crcHisob = loraCrc16(buf, crcPos);
  uint16_t crcKelgan = (uint16_t)buf[crcPos] | ((uint16_t)buf[crcPos+1] << 8);
  if (crcHisob != crcKelgan) return;

  uint8_t  type  = buf[2];
  uint8_t  seq   = buf[4];
  uint32_t dst   = (uint32_t)buf[9] | ((uint32_t)buf[10]<<8) |
                   ((uint32_t)buf[11]<<16) | ((uint32_t)buf[12]<<24);
  uint32_t src   = (uint32_t)buf[5] | ((uint32_t)buf[6]<<8) |
                   ((uint32_t)buf[7]<<16) | ((uint32_t)buf[8]<<24);

  // Bizga (yoki broadcast'ga) tegishlimi?
  if (dst != deviceNumId && dst != BROADCAST_ID) return;

  if (type == FT_ACK) {
    if (len < 16) return;
    uint8_t ackSeq = buf[13];
    if (loraState == LORA_WAIT_ACK && ackSeq == txSeq) {
      loraState   = LORA_RX;
      linkOk      = true;
      lastAckVaqti = millis();
    }
  } else if (type == FT_CMD) {
    // Fix 6: 4-byte val (int32_t) — CMD_TIME uchun katta qiymat
    if (len < 20) return;
    uint8_t cmd = buf[13];
    int32_t val = (int32_t)((uint32_t)buf[14] | ((uint32_t)buf[15] << 8) |
                             ((uint32_t)buf[16] << 16) | ((uint32_t)buf[17] << 24));
    loraBuyruqQolla(cmd, val);
    loraCmdAckYubor(cmd, 1, src);   // bajarildi ACK'i
    linkOk = true; lastAckVaqti = millis();
  }
}

// ----------------------------------------------------------------
//  Fix 13: TARIX PAKETI YUBORISH (FT_HIST) — bitta NVS yozuvi
// ----------------------------------------------------------------
void loraHistKadrYubor(uint8_t idx, uint8_t total,
                        uint8_t oy, uint8_t kun,
                        uint8_t soat, uint8_t daqiqa, uint8_t doB) {
  uint8_t b[28];
  uint16_t p = loraSarlavha(b, FT_HIST, 0, idx, GATEWAY_ID);
  b[p++] = idx;
  b[p++] = total;
  b[p++] = oy;
  b[p++] = kun;
  b[p++] = soat;
  b[p++] = daqiqa;
  b[p++] = doB;   // do_x10 (<=255, 8 bitga sig'adi)
  b[p++] = 0;     // do_x10 high byte (doB<=255 bo'lgani uchun doim 0)
  loraCrcYoz(b, p);
  loraKadrYubor(b, p + 2);
}

// ----------------------------------------------------------------
//  TDMA — DS3231 soatiga ko'ra: shu node'ning slot oynasimi?
//  Davriga bir marta true qaytaradi.
// ----------------------------------------------------------------
bool tdmaUplinkVaqtimi() {
  uint32_t period, pos;
  if (rtcVaqtYoq) {
    // BUG-S1 FIX: RTC noto'g'ri — millis() asosida TDMA (slot saqlanadi, vaqtsiz)
    unsigned long tMs = millis();
    period = (uint32_t)(tMs / ((unsigned long)TELEM_PERIOD_S * 1000UL));
    pos    = (uint32_t)((tMs % ((unsigned long)TELEM_PERIOD_S * 1000UL)) / 1000UL);
  } else {
    DateTime now  = rtc.now();
    uint32_t epoch = now.unixtime();
    period = epoch / TELEM_PERIOD_S;
    pos    = epoch % TELEM_PERIOD_S;
  }
  uint32_t mySlot   = deviceNumId % MAX_SLOTS;
  uint32_t slotBosh = mySlot * SLOT_WIDTH_S;

  if (period == lastSentPeriod) return false;
  if (pos >= slotBosh && pos < slotBosh + SLOT_WIDTH_S) {
    lastSentPeriod = period;
    return true;
  }
  return false;
}

// ----------------------------------------------------------------
//  LoRa HOLATI — LCD ko'rsatkichi (14-15 katak, 2-qator)
//    14: antenna glyph (LoRa OK bo'lsa), 15: sifat 0-3 yoki 'x'/'-'
// ----------------------------------------------------------------
void loRaStatusLCDga() {
  if (joriyRejimKiritish != ' ') return;
  if (!boshlangichRejimda && aeratsiyaRejimi == REJIM_KISLOROD && tsikilRejim == TSIKL_UXLASH) return;

  lcd.setCursor(14, 1);
  if (!loraOk) { lcd.print("--"); return; }

  lcd.write((uint8_t)6);   // antenna glyph

  if (loraState == LORA_WAIT_ACK) { lcd.print('^'); return; }   // yuborilmoqda/ACK kutilmoqda

  bool lost = linkOk && taymerOtdimi(lastAckVaqti, LINK_LOST_MS);
  if (!linkOk || lost) { lcd.print('x'); return; }

  // Oxirgi qabul RSSI -> sifat 0..3
  char q;
  if      (lastRssi > -90)  q = '3';
  else if (lastRssi > -105) q = '2';
  else if (lastRssi > -118) q = '1';
  else                      q = '0';
  lcd.print(q);
}

// ----------------------------------------------------------------
//  LoRa HOLATI EKRANI (kislorod rejimida [R]) — dala diagnostikasi
// ----------------------------------------------------------------
void loraInfoKorsat() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("ID:"); lcd.print(deviceId);
  lcd.print('/'); lcd.print((unsigned)(deviceNumId % MAX_SLOTS));
  lcd.setCursor(0, 1);
  if (!loraOk) { lcd.print("LoRa: NOSOZ!    "); }
  else {
    lcd.print(LORA_FREQ, 0); lcd.print("M ");
    if (linkOk && !taymerOtdimi(lastAckVaqti, LINK_LOST_MS)) {
      lcd.print("R"); lcd.print(lastRssi); lcd.print("    ");
    } else {
      lcd.print("ACK yo'q     ");
    }
  }
  // v14: ekran 5 soniya turadi (WDT 10s, shu sabab 2s bo'laklarda reset bilan)
  esp_task_wdt_reset(); delay(2000);
  esp_task_wdt_reset(); delay(2000);
  esp_task_wdt_reset(); delay(1000);
  esp_task_wdt_reset();
  lcd.clear(); ekranniYangilash();
}

// ================================================================
//  SETUP
// ================================================================
void setup() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_task_wdt_config_t wdt_config = { .timeout_ms = 10000, .idle_core_mask = 0, .trigger_panic = true };
  esp_task_wdt_reconfigure(&wdt_config);
#else
  esp_task_wdt_init(10, true);
#endif
  esp_task_wdt_add(NULL);

  Serial.begin(115200);

  pinMode(RS485_DE, OUTPUT); digitalWrite(RS485_DE, LOW);
  pinMode(RELE_PIN, OUTPUT); digitalWrite(RELE_PIN, LOW);

  modbusSerial.begin(9600, SERIAL_8N1, MODBUS_RX, MODBUS_TX);
  node.preTransmission(preTransmission);
  node.postTransmission(postTransmission);
  node.begin(1, modbusSerial);

  Wire.begin(21, 22);
  Wire.setClock(100000);
  Wire.setTimeOut(50);
  lcd.init();
  lcd.backlight();
  loraGlyphYarat();           // LoRa antenna glyph (CGRAM 6)
  esp_task_wdt_reset();

  // RTC
  bool rtcOk = false;
  for (uint8_t i = 0; i < 5; i++) {
    esp_task_wdt_reset();
    if (rtc.begin()) { rtcOk = true; break; }
    delay(200); esp_task_wdt_reset();
  }
  if (!rtcOk) {
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("RTC topilmadi!  ");
    lcd.setCursor(0, 1); lcd.print("5s qayta yoqilad");
    // BUG-S9 FIX: while(1) o'rniga ESP.restart() (BUG-S9)
    for (uint8_t c = 0; c < 5; c++) { esp_task_wdt_reset(); delay(1000); }
    ESP.restart();
  }
  // BUG-S1 FIX: RTC lostPower() — to'liq sanoat yechimi.
  // DS3231 batareya yo'q / birinchi yoqilish / batareya almashtirilgan holatda
  // rtc.lostPower() true qaytaradi. Vaqt noto'g'ri (2000-01-01).
  if (rtc.lostPower()) {
    rtcVaqtYoq = true;
    rtc.adjust(DateTime(2025, 1, 1, 0, 0, 0));  // Minimal to'g'ri sana
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("RTC bat. yo'q!  ");
    lcd.setCursor(0, 1); lcd.print("CMD_TIME kutilyap");
    Serial.println("[RTC] lostPower! 2025-01-01 qo'yildi. NTP CMD_TIME kutilmoqda.");
    esp_task_wdt_reset(); delay(2000); esp_task_wdt_reset();
  }
  esp_task_wdt_reset();

  prefsTekshir();
  esp_task_wdt_reset();

  deviceIdYarat();            // v15: NVS ochilgach — noyob ID o'qish/yaratish
  esp_task_wdt_reset();

  loraBoshlash();             // SX1278 ishga tushirish (nosoz bo'lsa node baribir ishlaydi)
  esp_task_wdt_reset();

  lcd.clear();
  datchikBoshlanishTekshir();
  esp_task_wdt_reset();

  unsigned long t = millis();
  boshlangichRejimda   = true;
  boshlangichBosh      = t;
  tsikilRejim          = TSIKL_ISHLASH;
  oxirgiYozuvKaliti    = 0xFFFF;
  qaysiSensorNavbati   = 1;
  lastMeasureTime      = t;
  lastEkranVaqti       = t;
  lastDoCheckTime      = t;
  lastPhCheckTime      = t;
  releOzgarishVaqti    = t;
  lastUxlashEkranVaqti = t;
  lastTsikilTekshir    = 0;
  // FIX #2: qolReleYoq = false; // BU SATR OLIB TASHLANDI — prefsTekshir() da NVS dan yuklanadi

  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("ID: "); lcd.print(deviceId);
  lcd.setCursor(0, 1);
  lcd.print(loraOk ? "LoRa: HA        " : "LoRa: NOSOZ!    ");
  esp_task_wdt_reset(); delay(2000); esp_task_wdt_reset();

  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("BOSHLANGICH: 1s ");
  lcd.setCursor(0, 1); lcd.print("Doim ishlaydi   ");
  esp_task_wdt_reset(); delay(1500); esp_task_wdt_reset(); delay(500); esp_task_wdt_reset();
  lcd.clear(); esp_task_wdt_reset();

  // OTA: rollback tekshiruvi
  otaNodeSetup();
}

// ================================================================
//  LOOP
// ================================================================
void loop() {
  esp_task_wdt_reset();
  nonBlockTekshir();

  tsikilniYangilash();

  char key = keypad.getKey();
  if (key && !nonBlockAktiv) klaviaturaBoshqar(key);

  // ---- LoRa: qabul (ACK/buyruq) + uplink ACK/qayta yuborish ----
  loraQabulTekshir();
  loraUplinkYangilash();

  // ---- TELEMETRIYA: TDMA slot oynasida (yoki majburiy) ----
  if (loraOk && loraState == LORA_RX) {
    if (forceUplink) {
      forceUplink = false;
      loraUplinkBoshla();
    } else if (tdmaUplinkVaqtimi()) {
      loraUplinkBoshla();
    }
  }

  // ---- LoRa nosoz bo'lsa, davriy qayta urinish ----
  if (!loraOk && taymerOtdimi(lastReinit, LORA_REINIT_MS)) {
    loraBoshlash();
  }

  // ---- Fix 13: NVS tarix yuborish (async — har iteratsiyada 1 paket) ----
  if (histSendActive && loraOk && loraState == LORA_RX && !forceUplink) {
    if (histSendIdx < histSendTotal) {
      esp_task_wdt_reset();
      uint8_t nv_idx = (histSendBosh + histSendIdx) % MAX_RECORDS;
      uint8_t hH, hM, hKun, hOy, hDoB;
      prefsYozuvOqish(nv_idx, hH, hM, hKun, hOy, hDoB);
      loraHistKadrYubor(histSendIdx, histSendTotal, hOy, hKun, hH, hM, hDoB);
      histSendIdx++;
      esp_task_wdt_reset();
    } else {
      histSendActive = false;
    }
  }

  // ---- Uzun T (bo'sh holatda 3s) -> darhol TEST telemetriya ----
  if (tBosildi) {
    if (keypad.isPressed('T')) {
      if (taymerOtdimi(tBoshVaqti, T_UZUN_MS)) {
        tBosildi = false;
        if (!loraOk) {
          nonBlockXabar("LoRa nosoz!     ", 2000);
        } else {
          forceUplink = true;
          nonBlockXabar("TEST yuborilmoqda", 2000);
        }
      }
    } else {
      tBosildi = false;
    }
  }

  // ---- Sensor qayta urinish (5 daq) ----
  if (!doAktivmi && taymerOtdimi(lastDoCheckTime, SENSOR_RETRY_MS)) {
    lastDoCheckTime = millis(); doAktivmi = true; doXato = false;
  }
  if (!phAktivmi && taymerOtdimi(lastPhCheckTime, SENSOR_RETRY_MS)) {
    lastPhCheckTime = millis(); phAktivmi = true; phXato = false;
  }

  if (!isCalibrating && joriyRejimKiritish == ' ' && !nonBlockAktiv) {
    // Sensor o'qish
    if (taymerOtdimi(lastMeasureTime, SENSOR_INTERVAL_MS)) {
      lastMeasureTime = millis();
      if (sensorOqishKerakmi() || aeratsiyaRejimi == REJIM_VAQT) {
        readSensorDataSmart();
      }
    }
    // Ekran + rele
    if (taymerOtdimi(lastEkranVaqti, EKRAN_INTERVAL_MS)) {
      lastEkranVaqti = millis();
      ekranniYangilash();
      showClock();
      loRaStatusLCDga();      // LoRa link ko'rsatkichi (14-15 katak)
      boshqarishRele();
    }
    // Uxlash ekrani
    uxlashEkrani();
  }

  // OTA: paket timeout tekshiruvi
  otaNodeCheck();
}
