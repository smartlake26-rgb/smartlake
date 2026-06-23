// ================================================================
//  AQUA MONITOR v12.0 - ESP32 DevKit USB-C + SIM800L
//  Baliq ko'llari uchun universal avtomatik aeratsiya tizimi
//  + GSM (SMS/qo'ng'iroq) + INTERNET (WiFi BIRINCHI, SIM/GPRS ZAXIRA)
//
//  [v12.0] WiFi QO'SHILDI (v11.0 ustiga) — UNIVERSAL ULANISH:
//    - Telemetriya endi AVVAL WiFi orqali yuboriladi (ESP32 HTTPClient,
//      tez va AT'siz). WiFi ulanmagan/uzilgan bo'lsa -> avtomatik SIM800L
//      (GPRS) ga o'tadi. Ikkalasi ham yo'q bo'lsa o'tkazib yuboradi
//      (soatlik tarix baribir NVS'da). JSON formati o'zgarmaydi.
//    - WiFi SOZLASH: bo'sh ekranda [111T] -> WiFiManager portali ochiladi.
//      Qurilma vaqtincha "AquaMonitor-WiFi" nuqtasi bo'ladi; fermer
//      telefonidan ulanib, o'z WiFi'sini tanlab parol kiritadi -> saqlanadi
//      va keyin avtomatik ulanaveradi. Portal NON-BLOCKING (3 daq timeout):
//      sozlash davomida ham rele/sensor/alarm ishlab turaveradi.
//    - WiFi 2.4 GHz; pinlarga tegmaydi (ichki radio). SIM bilan birga ishlaydi.
//
//  [v11.0] Internet (GPRS->ThingsBoard HTTP) + ikki tomonlama SMS + chip-ID:
//    - QURILMA ID: ESP32 chip ID dan (masalan "AQ7F8A2C"), o'zgarmas.
//    - Telemetriya JSON: {id, do, ph, t, aer}.
//    - Kiruvchi SMS buyruqlari: AERATOR ON/AUTO, MINDO/FARQ/KRITIK <n>, HOLAT.
//
//  UMUMIY KODLAR (bo'sh ekranda):
//    [000T] -> Zavod reseti (NVS to'liq tozalanadi)
//    [111T] -> WiFi sozlash portali
//
//  [v10.x] GSM (SIM800L) — SMS/qo'ng'iroq, 000T, barqarorlik:
//    - SIM800L modul UART1 (GPIO 18 TX, 35 RX, 23 RST) orqali
//    - To'liq NON-BLOCKING AT holat mashinasi (loop'ni bloklamaydi,
//      WDT/sensor/relay/keypad ishiga umuman halaqit qilmaydi)
//    - Kritik DO (## ikki marta bosilganda) — qo'ng'iroq chegarasi
//    - Telefon raqami (R tugmasi, KISLOROD rejimida) — 9 raqam → +998
//    - ALARM: DO < kritik bo'lsa → avval SMS, keyin qo'ng'iroq.
//      Ko'tarmasa har 10 daqiqada qayta, soatiga maksimum 3 marta.
//      Fermer ko'tarsa (javob bersa) → o'sha epizodda to'xtaydi.
//      DO kritik+0.5 ga tiklansa → "normaga qaytdi" SMS va alarm o'chadi.
//    - Soatlik holat SMS'i (har soat :58 da, KISLOROD rejimida)
//    - DO sensor o'lsa → "sensor nosoz" SMS (bir marta)
//    - 1-soatlik boshlang'ich rejimda ham alarm to'liq ishlaydi
//    - LCD da signal ko'rsatkichi (CSQ): soat 2 katak chapga,
//      14-15 katakda antenna + 0-4 panjara (eski telefondagidek)
//    - Uzun T (bo'sh holatda 3s ushlab tursa) → test SMS + test qo'ng'iroq
//
//  [v9.1] Tuzatilgan xatolar (v9.0 dan):
//    - BUG #1 KRITIK: tsikilniYangilash() ichidagi if/else bloklari
//      {} qavslar bilan to'g'rilandi (logik xato - noto'g'ri ishlaydi edi)
//    - BUG #2 KRITIK: WDT initsializatsiyasi esp_task_wdt_reconfigure()
//      o'rniga Arduino core 2.x/3.x bilan mos keluvchi usulga o'tkazildi
//    - BUG #3: Sensor qayta urinishda doXato/phXato false qilinmagan edi,
//      endi sensor tikilganda xato bayroqlari ham tozalanadi
//    - BUG #4: doTarixiKorsat() ichida delay(2000)+delay(500) orasida
//      esp_task_wdt_reset() qo'shildi (WDT trip xavfi bor edi)
//    - BUG #5: vaqtJadvaliniKorsat() ichida delay lararo WDT reset qo'shildi
//    - BUG #6: lTugmasiBosildi() - LCD clear() chaqirilmasdan ustiga yozilardi,
//      endi to'liq tozalanadi
//    - BUG #7: sensorOqishKerakmi() - REJIM_VAQT da ham loop() ichida
//      readSensorDataSmart() chaqiriladi (pH uchun), ammo DO sensor
//      VAQT rejimida o'qilmaydi - bu to'g'ri holat
//    - YAXSHILANISH: sensor retry oralig'i 1 soat o'rniga 5 daqiqaga
//      qisqartirildi (ishlab chiqarishda real sensor ulanib-uzilishi uchun)
//
//  BOSHQARUV REJIMLARI:
//    [L]    → Rejim tanlash (L bir marta: Kislorod, L ikki marta: Vaqt)
//
//  KISLOROD REJIMI:
//    [#]    → Min DO kiriting (mg/L, butun son, masalan 5)
//    [*]    → Farq kiriting  (mg/L, butun son, masalan 2)
//             Mantiq: DO < min → rele ON; DO >= min+farq → rele OFF
//    [T]    → Saqlash
//    [E]    → DO tarixi ko'rsatish
//
//  VAQT REJIMI:
//    [R]    → Yangi vaqt oralig'i kiritish (format: SSDDBBOO)
//             Misol: 18402200 → 18:40 dan 22:00 gacha
//    [T]    → Saqlash (5 tagacha oralig' saqlanadi)
//    [E]    → Saqlangan barcha vaqt oralig'larini ko'rsatish
//    [D]    → Oxirgi kiritilgan oralig'ni o'chirish
//
//  UMUMIY:
//    [000T] → Barcha ma'lumotlarni tozalab standartga qaytarish.
//             Istalgan paytda (menyuga kirmasdan) bo'sh ekranda 0 0 0
//             bosib, so'ng T bosiladi. NVS to'liq tozalanadi: DO tarixi,
//             telefon raqami, vaqt jadvali, min/farq/kritik DO — hammasi.
//    [F]    → DO sensori kalibrlash
//    [B]    → Harorat kalibrlash
//    [U]    → RTC soatni sozlash (format: OOKKSSDD)
//             Misol: 06150930 → 15-iyun 09:30
//    [R]    → Kiritishni bekor qilish (vaqt rejimidan tashqarida)
//
//  GSM / SIM800L BOSHQARUV (KISLOROD rejimida):
//    [#]    → 1 marta: Min DO (aerator yonish chegarasi)
//    [##]   → 2 marta tez: Kritik DO (qo'ng'iroq chegarasi)
//    [R]    → Telefon raqami kiritish (9 raqam, +998 avtomatik qo'shiladi)
//             Misol: 972014669 → +998972014669
//    [T]    → (bo'sh holatda 3 soniya ushlab tursa) TEST SMS + qo'ng'iroq
//
//  XOTIRAGA YOZISH:
//    Har soat 58-59 daqiqada, sensor faol bo'lganda
//    Kalit: (oy*31+kun)*24+soat — oydan-oyga adashmasligi kafolatlangan
//    Maksimal yozuvlar: 48 ta (2 kun, ring buffer)
//
//  TSIKL MANTIG'I (boshlang'ich 1 soat tugagach):
//    [ 0-19] daqiqa  → SENSOR UXLAYDI  (20 daqiqa)
//    [20-29] daqiqa  → SENSOR ISHLAYDI (10 daqiqa)
//    [30-49] daqiqa  → SENSOR UXLAYDI  (20 daqiqa)
//    [50-59] daqiqa  → SENSOR ISHLAYDI (10 daqiqa)
//
//  PIN TAQISH (ESP32 DevKit USB-C 38-pin):
//    KEYPAD ROW : GPIO 12,14,27,26,25
//    KEYPAD COL : GPIO 33,32,13,19
//    LCD  SDA   : GPIO 21
//    LCD  SCL   : GPIO 22
//    RTC  SDA   : GPIO 21  (LCD bilan umumiy I2C)
//    RTC  SCL   : GPIO 22
//    RS485 RX   : GPIO 16
//    RS485 TX   : GPIO 17
//    RS485 DE/RE: GPIO 4
//    RELE       : GPIO 5
//    SIM800L TX : GPIO 18  (ESP32 -> SIM RXD, rezistor bo'luvchi orqali)
//    SIM800L RX : GPIO 35  (SIM TXD -> ESP32, faqat-kirish pin)
//    SIM800L RST: GPIO 23  (modul osilib qolsa qayta tiklash)
//    SIM800L VCC: 5V manba -> 1N4007 diod (~4.3V) -> SIM VCC
//                 (1000uF kondensator VCC-GND ga yaqin joylashtiriladi)
// ================================================================

#include <Wire.h>
#include <Keypad.h>
#include <LiquidCrystal_I2C.h>
#include <ModbusMaster.h>
#include <RTClib.h>
#include <Preferences.h>
#include <esp_task_wdt.h>
#include <ctype.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>   // Firebase HTTPS uchun
#include <WiFiManager.h>   // tzapu/WiFiManager (Library Manager'dan o'rnating)

// ================================================================
//  PINLAR
// ================================================================
static const uint8_t RELE_PIN = 5;
static const uint8_t RS485_DE = 4;
#define MODBUS_RX 16
#define MODBUS_TX 17

// SIM800L (UART1)
#define SIM_TX_PIN 18    // ESP32 TX -> SIM RXD (bo'luvchi orqali)
#define SIM_RX_PIN 35    // ESP32 RX <- SIM TXD (faqat-kirish)
#define SIM_RST_PIN 23   // SIM RST (manfiy impuls bilan reset)

// ================================================================
//  INTERNET SOZLAMALARI (WiFi -> Firebase RTDB, SIM zaxira)
//  -------------------------------------------------------------
//  Telemetriya AVVAL WiFi orqali Firebase Realtime Database'ga
//  HTTPS PUT bilan yuboriladi (tez va ishonchli). WiFi yo'q bo'lsa
//  va FB_SIM_RELAY sozlangan bo'lsa, SIM800L (GPRS->HTTP relay)
//  orqali zaxira yo'l ishlatiladi.
//
//  FB_HOST bo'sh bo'lsa -> internet butunlay o'chiq, qurilma faqat
//  lokal + SMS rejimida ishlaydi (xavfsiz standart). O'rnatishda
//  to'g'ri APN va Firebase RTDB host/kalitini kiriting.
// ================================================================
static const char*         GPRS_APN     = "internet";  // operator APN (o'zgartiring)

// --- FIREBASE Realtime Database (HTTPS REST) ---
// FB_HOST: RTDB host, SXEMASIZ ("https://" YOZMANG). Misol:
//   "smartlake-1234-default-rtdb.firebaseio.com"  yoki regional:
//   "smartlake-1234-default-rtdb.europe-west1.firebasedatabase.app"
// FB_HOST bo'sh bo'lsa -> internet butunlay o'chiq (faqat lokal + SMS).
static const char*         FB_HOST      = "";           // RTDB host (sxemasiz)
static const char*         FB_AUTH      = "";           // RTDB maxfiy kaliti yoki bo'sh (qoidalar ochiq bo'lsa)
// SIM800L Firebase HTTPS'ni ishonchli qo'llab-quvvatlamaydi. SIM orqali ham
// yubormoqchi bo'lsangiz, oddiy HTTP->Firebase relay manzilini kiriting
// (masalan Cloud Function). Bo'sh bo'lsa SIM telemetriyasi o'chiq.
static const char*         FB_SIM_RELAY = "";           // "http://relay.example.com/telemetry"
static const unsigned long TELEMETRY_MS = 300000UL;     // 5 daqiqada bir marta yuborish

// ================================================================
//  AERATSIYA REJIMI — #define bilan
// ================================================================
#define REJIM_KISLOROD  0
#define REJIM_VAQT      1

// ================================================================
//  TSIKL HOLATI — #define bilan
//  RTC daqiqasiga ko'ra aniqlanadi:
//    [ 0-19] → TSIKL_UXLASH
//    [20-29] → TSIKL_ISHLASH
//    [30-49] → TSIKL_UXLASH
//    [50-59] → TSIKL_ISHLASH  (soat oxiri — xotiraga yozish oynasi)
// ================================================================
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
HardwareSerial    simSerial(1);   // SIM800L uchun alohida apparat UART

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
byte rowPins[ROWS] = {12, 14, 27, 26, 25};
byte colPins[COLS] = {33, 32, 13, 19};
Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

// ================================================================
//  GLOBAL O'ZGARUVCHILAR
// ================================================================

// Aeratsiya rejimi
static uint8_t aeratsiyaRejimi = REJIM_KISLOROD;

// Joriy tsikl holati (RTC asosida yangilanadi)
static uint8_t tsikilRejim = TSIKL_ISHLASH;

// Boshlang'ich 1 soat rejimi
static const unsigned long BOSHLANGICH_MUDDAT_MS = 3600000UL;
static bool          boshlangichRejimda = true;
static unsigned long boshlangichBosh    = 0;

// Xotira yozuv kaliti — 0xFFFF = hali yozilmagan
static uint16_t oxirgiYozuvKaliti = 0xFFFF;

// Sensor o'zgaruvchilari (×10 format)
static int16_t do_x10 = 0;
static int16_t ph_x10 = 0;
static int16_t t_x10  = 0;

static bool    doXato             = false;
static bool    phXato             = false;
static bool    doAktivmi          = true;
static bool    phAktivmi          = true;
static uint8_t qaysiSensorNavbati = 1;

// Taymerlar
static unsigned long lastDoCheckTime      = 0;
static unsigned long lastPhCheckTime      = 0;
static unsigned long lastMeasureTime      = 0;
static unsigned long lastEkranVaqti       = 0;
static unsigned long lastUxlashEkranVaqti = 0;
static unsigned long lastTsikilTekshir    = 0;

// Kislorod rejimi sozlamalari
static int16_t minDo_x10  = 50;   // standart: 5.0 mg/L
static int16_t farqDo_x10 = 20;   // standart: 2.0 mg/L

// Vaqt rejimi sozlamalari
static const uint8_t MAX_VAQT_ORALIQ = 5;

struct VaqtOraliq {
  uint8_t boshH;
  uint8_t boshM;
  uint8_t oxirH;
  uint8_t oxirM;
  bool    faol;
};

static VaqtOraliq vaqtJadvali[MAX_VAQT_ORALIQ];
static uint8_t    vaqtOraliqSoni = 0;

// Rele
static bool          releHolati        = false;
static unsigned long releOzgarishVaqti = 0;

// Xotira (ring buffer)
static const uint8_t MAX_RECORDS      = 48;
static uint8_t       eeprom_head_cache  = 0;
static uint8_t       eeprom_count_cache = 0;

// Kiritish holati
static char    inputText[10]      = "";   // 9 raqamli telefon + null uchun
static uint8_t inputLen           = 0;
static char    joriyRejimKiritish = ' ';
static bool    isCalibrating      = false;
static int8_t  kiritilganHarorat  = -1;

static uint8_t       lTugmaHolati = 0;
static unsigned long lTugmaVaqti  = 0;

static unsigned long nonBlockStart = 0;
static uint16_t      nonBlockMs    = 0;
static bool          nonBlockAktiv = false;

// ================================================================
//  GSM / SIM800L O'ZGARUVCHILARI
// ================================================================

// Kritik DO (qo'ng'iroq chegarasi), ×10 format. 0 = o'rnatilmagan
static int16_t kritikDo_x10 = 0;

// Re-arm chegarasi: DO kritik+0.5 ga chiqsa alarm o'chadi (miltillashga qarshi)
static const int16_t ALARM_REARM_OFFSET_X10 = 5;   // 0.5 mg/L

// Telefon raqami: "+998" + 9 raqam = 13 belgi + null
static char telRaqam[16] = "";   // bo'sh = raqam yo'q

// --- SIM holat mashinasi ---
#define SIM_KUT        0   // yoqilgandan keyin modul tayyor bo'lishini kutish
#define SIM_INIT       1   // AT, ATE0, CMGF=1, CLIP=1
#define SIM_TARMOQ     2   // CREG tekshirish (ro'yxatdan o'tish)
#define SIM_TAYYOR     3   // bo'sh, ishga tayyor
#define SIM_SMS_CMGS   4   // AT+CMGS="..." -> ">" kutiladi
#define SIM_SMS_TANA   5   // matn + Ctrl-Z -> +CMGS/OK kutiladi
#define SIM_QONG_TER   6   // ATD... -> OK kutiladi
#define SIM_QONG_KUZAT 7   // CLCC bilan javob/tugashni kuzatish
#define SIM_QONG_UZISH 8   // ATH yuborish
#define SIM_NET_BEARER 9   // GPRS bearer + HTTP sozlash (SAPBR/HTTPINIT/HTTPPARA)
#define SIM_HTTP_TELEM 10  // HTTP telemetriya: DOWNLOAD -> data -> HTTPACTION

static uint8_t       simHolat        = SIM_KUT;
static unsigned long simHolatVaqti   = 0;     // joriy holatga kirgan vaqt
static unsigned long simBoshVaqti    = 0;     // yoqilgan vaqt (KUT uchun)
static bool          simTayyormi     = false; // tarmoqqa ulangan
static uint8_t       simInitBosqich  = 0;     // INIT ichki bosqichi
static uint8_t       simUrinish      = 0;     // qayta urinishlar (init/tarmoq)

// SIM javob buferi
static char    simBuf[160];
static uint16_t simBufLen = 0;

// CSQ (signal) — 0..31, 99=noma'lum; LCD ko'rsatkichi uchun
static uint8_t  simSignal     = 99;
static unsigned long simCsqVaqti = 0;

// --- SMS navbati (ring buffer) ---
#define SMS_MAX_UZUN  120
#define SMS_NAVBAT    4
static char    smsNavbat[SMS_NAVBAT][SMS_MAX_UZUN];
static uint8_t smsBosh = 0;
static uint8_t smsSon  = 0;

// --- Qo'ng'iroq so'rovi ---
static bool          qongPending     = false;  // qo'ng'iroq qilish kerak
static bool          qongTest        = false;  // joriy qo'ng'iroq TEST uchunmi
static unsigned long qongKuzatBosh   = 0;      // jiringlash boshlanishi
static bool          qongJavobBerildi = false; // CLCC: javob aniqlandi

// --- Alarm epizodi mantig'i ---
static bool          alarmFaol       = false;  // DO kritikdan past (faol epizod)
static bool          alarmTasdiq     = false;  // fermer javob berdi (epizodda)
static uint8_t       alarmQongSoni   = 0;      // shu soatdagi qo'ng'iroqlar (max 3)
static uint8_t       alarmQongSoat   = 0xFF;   // hisob qaysi soatga tegishli
static unsigned long alarmOxirgiQong = 0;      // oxirgi qo'ng'iroq vaqti
static const uint8_t ALARM_MAX_QONG_SOAT = 3;
static const unsigned long ALARM_QONG_ORALIQ_MS = 600000UL;  // 10 daqiqa

// --- Sensor nosozligi xabari ---
static bool          sensorNosozXabar = false; // "sensor nosoz" SMS yuborilganmi

// --- Soatlik SMS ---
static uint16_t      oxirgiSmsKaliti = 0xFFFF; // soatlik SMS takror yubormaslik

// --- Uzun T (test) aniqlash ---
static bool          tBosildi   = false;
static unsigned long tBoshVaqti = 0;
static const unsigned long T_UZUN_MS = 3000UL;

// ================================================================
//  QURILMA ID + INTERNET (GPRS/HTTP) O'ZGARUVCHILARI
// ================================================================
// Qurilma ID — ESP32 chip ID dan olinadi, o'zgarmas (masalan "AQ7F8A2C")
static char          deviceId[16] = "";

// Internet holati
static bool          internetYoqilgan = false;   // FB_HOST bo'sh bo'lmasa true
static unsigned long lastTelemetriya  = 0;        // oxirgi yuborish vaqti
static uint8_t       httpBosqich      = 0;        // burst ichki bosqichi
static char          telemetriyaBuf[128] = "";    // yuboriladigan JSON

// Qo'lda (SMS bilan) aeratorni majburan yoqish bayrog'i
static bool          qolReleYoq = false;

// --- WiFi (WiFiManager) holati ---
WiFiManager          wm;
static bool          wifiPortalAktiv = false;   // sozlash portali ochiqmi
static unsigned long wifiPortalBosh  = 0;        // portal ochilgan vaqt
static bool          simTelemSora    = false;    // SIM orqali telemetriya so'rovi (loop -> SIM)

// ================================================================
//  KONSTANTALAR
// ================================================================
static const unsigned long SOAT_INTERVALI     = 3600000UL;
// [v9.1]: Sensor retry 5 daqiqaga qisqartirildi (ishlab chiqarishda tez tiklanish)
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
void prefsYozuvSaqla(uint8_t idx, uint8_t h, uint8_t m,
                     uint8_t kun, uint8_t oy, uint8_t doB);
void prefsYozuvOqish(uint8_t idx, uint8_t &h, uint8_t &m,
                     uint8_t &kun, uint8_t &oy, uint8_t &doB);
void vaqtJadvaliniSaqla();
void vaqtJadvaliniYukla();
void datchikBoshlanishTekshir();
bool vaqtRejimiReleHolati();
void nonBlockTekshir();
uint8_t daqiqadanTsikilAniqla(uint8_t daqiqa);
uint16_t yozuvKalitHisopla(uint8_t oy, uint8_t kun, uint8_t soat);
uint8_t oyningKunlari(uint8_t oy, uint16_t yil);

// --- GSM / SIM800L ---
void simBoshlash();
void simYangilash();              // loop'da chaqiriladi, non-blocking
void simResetModul();
void simBuferGa();                // UART dan o'qib simBuf ga yig'ish
bool simJavobBor(const char* token);
void simYuborln(const char* s);
bool smsNavbatgaQosh(const char* matn);
void qongiroqSorov(bool test);
void alarmniTekshir();            // DO ni kritik bilan solishtirish
void alarmQaytaQong();            // 10 daq qayta qo'ng'iroq (soatiga max 3)
void sensorNosozTekshir();        // DO sensor o'lsa SMS
void soatlikSmsTekshir(const DateTime& now);
void signalniLCDgaChiz();
void simSignalCharlarYarat();
void telRaqamKiritishOch();

// --- Qurilma ID / Internet (GPRS+HTTP) / SMS buyruq ---
void deviceIdYarat();
void telemetriyaTayyorla();
void smsBuyruqniQolla(const char* matn);
bool wifiBilanYubor();
void wifiPortalBoshla();

// ================================================================
//  YORDAMCHI: millis() overflow-safe taqqoslash
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
  if (val != eeprom_head_cache) {
    prefs.putUChar("head", val);
    eeprom_head_cache = val;
  }
}

void prefsYozCount(uint8_t val) {
  if (val != eeprom_count_cache) {
    prefs.putUChar("count", val);
    eeprom_count_cache = val;
  }
}

void prefsYozuvSaqla(uint8_t idx, uint8_t h, uint8_t m,
                     uint8_t kun, uint8_t oy, uint8_t doB) {
  char kalit[4];
  kalit[0] = 'r';
  kalit[1] = '0' + (idx / 10);
  kalit[2] = '0' + (idx % 10);
  kalit[3] = '\0';
  uint8_t buf[5] = {h, m, kun, oy, doB};
  prefs.putBytes(kalit, buf, 5);
}

void prefsYozuvOqish(uint8_t idx, uint8_t &h, uint8_t &m,
                     uint8_t &kun, uint8_t &oy, uint8_t &doB) {
  char kalit[4];
  kalit[0] = 'r';
  kalit[1] = '0' + (idx / 10);
  kalit[2] = '0' + (idx % 10);
  kalit[3] = '\0';
  uint8_t buf[5] = {0, 0, 0, 0, 0};
  prefs.getBytes(kalit, buf, 5);
  h = buf[0]; m = buf[1]; kun = buf[2]; oy = buf[3]; doB = buf[4];
}

// ================================================================
//  VAQT JADVALINI NVS GA SAQLASH / YUKLASH
// ================================================================
void vaqtJadvaliniSaqla() {
  prefs.putUChar("vj_son", vaqtOraliqSoni);
  for (uint8_t i = 0; i < MAX_VAQT_ORALIQ; i++) {
    char kalit[4];
    kalit[0] = 'v'; kalit[1] = 'j';
    kalit[2] = '0' + i; kalit[3] = '\0';
    uint8_t buf[5] = {
      vaqtJadvali[i].boshH,
      vaqtJadvali[i].boshM,
      vaqtJadvali[i].oxirH,
      vaqtJadvali[i].oxirM,
      vaqtJadvali[i].faol ? 1u : 0u
    };
    prefs.putBytes(kalit, buf, 5);
  }
}

void vaqtJadvaliniYukla() {
  vaqtOraliqSoni = prefs.getUChar("vj_son", 0);
  if (vaqtOraliqSoni > MAX_VAQT_ORALIQ) vaqtOraliqSoni = 0;
  for (uint8_t i = 0; i < MAX_VAQT_ORALIQ; i++) {
    char kalit[4];
    kalit[0] = 'v'; kalit[1] = 'j';
    kalit[2] = '0' + i; kalit[3] = '\0';
    uint8_t buf[5] = {0, 0, 0, 0, 0};
    prefs.getBytes(kalit, buf, 5);
    vaqtJadvali[i].boshH = buf[0];
    vaqtJadvali[i].boshM = buf[1];
    vaqtJadvali[i].oxirH = buf[2];
    vaqtJadvali[i].oxirM = buf[3];
    vaqtJadvali[i].faol  = (buf[4] == 1);
  }
}

// ================================================================
//  YOZUV KALITINI HISOBLASH
//  Kalit = (oy * 31 + kun) * 24 + soat
// ================================================================
uint16_t yozuvKalitHisopla(uint8_t oy, uint8_t kun, uint8_t soat) {
  return (uint16_t)((uint16_t)(oy * 31u + kun) * 24u + soat);
}

// ================================================================
//  OY VALIDATSIYASI
// ================================================================
uint8_t oyningKunlari(uint8_t oy, uint16_t yil) {
  bool kabisa = ((yil % 4 == 0 && yil % 100 != 0) || (yil % 400 == 0));
  switch (oy) {
    case 1: case 3: case 5: case 7:
    case 8: case 10: case 12: return 31;
    case 4: case 6: case 9:  case 11: return 30;
    case 2: return kabisa ? 29 : 28;
    default: return 0;
  }
}

// ================================================================
//  SOZLAMALARNI STANDARTGA QAYTARISH
// ================================================================
void standartgaQaytarish() {
  // ----------------------------------------------------------
  //  TO'LIQ ZAVOD RESETI:
  //  Butun NVS tozalanadi (DO tarixi, telefon raqami, vaqt jadvali,
  //  barcha sozlamalar), so'ng standart qiymatlar qayta yoziladi va
  //  butun runtime holat (GSM/alarm/SMS navbati) nolga qaytariladi.
  // ----------------------------------------------------------
  prefs.clear();                       // <-- hamma kalitlar o'chadi

  // --- Standart qiymatlarni qayta yozish ---
  prefs.putUChar("head",   0);
  prefs.putUChar("count",  0);
  prefs.putShort("minDo",  50);
  prefs.putShort("farqDo", 20);
  prefs.putUChar("rejim",  (uint8_t)REJIM_KISLOROD);
  prefs.putShort("kritikDo", 0);
  prefs.putString("tel", "");
  prefs.putUChar("ver", 0xB0);

  // --- RAM nusxalarini standartga ---
  eeprom_head_cache  = 0;
  eeprom_count_cache = 0;
  minDo_x10    = 50;
  farqDo_x10   = 20;
  kritikDo_x10 = 0;
  telRaqam[0]  = '\0';
  aeratsiyaRejimi = REJIM_KISLOROD;

  vaqtOraliqSoni = 0;
  for (uint8_t i = 0; i < MAX_VAQT_ORALIQ; i++) {
    vaqtJadvali[i] = {0, 0, 0, 0, false};
  }
  vaqtJadvaliniSaqla();                // vj_son=0 va vj0..vj4 ni nol holatda yozadi

  // --- Tsikl / boshlang'ich holat ---
  oxirgiYozuvKaliti  = 0xFFFF;
  oxirgiSmsKaliti    = 0xFFFF;
  boshlangichRejimda = true;
  boshlangichBosh    = millis();
  tsikilRejim        = TSIKL_ISHLASH;
  qaysiSensorNavbati = 1;

  // --- GSM / alarm runtime holatini tozalash (raqam o'chgach SMS/qo'ng'iroq chiqmasin) ---
  smsBosh = 0; smsSon = 0;
  qongPending = false; qongTest = false;
  alarmFaol = false; alarmTasdiq = false;
  alarmQongSoni = 0; alarmQongSoat = 0xFF;
  alarmOxirgiQong = millis();
  sensorNosozXabar = false;
  qolReleYoq = false;

  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Standartga      ");
  lcd.setCursor(0, 1); lcd.print("qaytarildi!     ");
  esp_task_wdt_reset();
  delay(1500);
  esp_task_wdt_reset();
  lcd.clear();
  esp_task_wdt_reset();
}

// ================================================================
//  NVS BOSHLASH
// ================================================================
void prefsTekshir() {
  prefs.begin("aqua", false);
  uint8_t ver = prefs.getUChar("ver", 0xFF);

  // v10.0 — NVS versiyasi 0xB0 (GSM qo'shildi)
  if (ver != 0xB0) {
    // Eski 0xAF sozlamalarini saqlab qolib, faqat yangi kalitlarni qo'shamiz
    bool eski_af = (ver == 0xAF);

    if (!eski_af) {
      // Butunlay yangi yoki notanish versiya: hammasini tozalash
      prefs.clear();
      prefs.putUChar("head",   0);
      prefs.putUChar("count",  0);
      prefs.putShort("minDo",  50);
      prefs.putShort("farqDo", 20);
      prefs.putUChar("rejim",  0);
      prefs.putUChar("vj_son", 0);
      eeprom_head_cache  = 0;
      eeprom_count_cache = 0;
      vaqtOraliqSoni     = 0;
      for (uint8_t i = 0; i < MAX_VAQT_ORALIQ; i++) {
        vaqtJadvali[i] = {0, 0, 0, 0, false};
      }
    } else {
      // 0xAF -> 0xB0 migratsiya: mavjud sozlamalar saqlanadi
      eeprom_head_cache  = prefs.getUChar("head",  0);
      eeprom_count_cache = prefs.getUChar("count", 0);
      if (eeprom_head_cache  >= MAX_RECORDS) eeprom_head_cache  = 0;
      if (eeprom_count_cache >  MAX_RECORDS) eeprom_count_cache = 0;
      minDo_x10       = prefs.getShort("minDo",  50);
      farqDo_x10      = prefs.getShort("farqDo", 20);
      aeratsiyaRejimi = prefs.getUChar("rejim", 0);
      if (aeratsiyaRejimi != REJIM_KISLOROD &&
          aeratsiyaRejimi != REJIM_VAQT)
        aeratsiyaRejimi = REJIM_KISLOROD;
      vaqtJadvaliniYukla();
    }

    // Yangi GSM kalitlari (standart qiymatlar)
    prefs.putShort("kritikDo", 0);
    prefs.putString("tel", "");
    kritikDo_x10 = 0;
    telRaqam[0]  = '\0';

    prefs.putUChar("ver", 0xB0);
  } else {
    eeprom_head_cache  = prefs.getUChar("head",  0);
    eeprom_count_cache = prefs.getUChar("count", 0);
    if (eeprom_head_cache  >= MAX_RECORDS) eeprom_head_cache  = 0;
    if (eeprom_count_cache >  MAX_RECORDS) eeprom_count_cache = 0;
    minDo_x10       = prefs.getShort("minDo",  50);
    farqDo_x10      = prefs.getShort("farqDo", 20);
    aeratsiyaRejimi = prefs.getUChar("rejim", 0);
    if (aeratsiyaRejimi != REJIM_KISLOROD &&
        aeratsiyaRejimi != REJIM_VAQT)
      aeratsiyaRejimi = REJIM_KISLOROD;
    vaqtJadvaliniYukla();

    // GSM sozlamalari
    kritikDo_x10 = prefs.getShort("kritikDo", 0);
    telRaqam[0] = '\0';
    prefs.getString("tel", telRaqam, sizeof(telRaqam));   // heap-siz (String'siz)
  }
}

// ================================================================
//  DATCHIK BOSHLANISH TEKSHIRUVI
// ================================================================
void datchikBoshlanishTekshir() {
  lcd.setCursor(0, 0);
  lcd.print("Datchiklar...   ");

  uint8_t xato = 0;
  for (uint8_t i = 0; i < 3; i++) {
    esp_task_wdt_reset();
    node.begin(1, modbusSerial);
    if (node.readHoldingRegisters(0x0000, 4) != node.ku8MBSuccess) xato++;
    delay(150);
    esp_task_wdt_reset();
  }
  if (xato >= 3) { doAktivmi = false; doXato = true; }

  xato = 0;
  for (uint8_t i = 0; i < 3; i++) {
    esp_task_wdt_reset();
    node.begin(2, modbusSerial);
    if (node.readHoldingRegisters(0x0000, 2) != node.ku8MBSuccess) xato++;
    delay(150);
    esp_task_wdt_reset();
  }
  if (xato >= 3) { phAktivmi = false; phXato = true; }

  node.begin(1, modbusSerial);
}

// ================================================================
//  TSIKL HOLATI — RTC daqiqasiga ko'ra aniqlanadi
//  Qaytish qiymati: TSIKL_ISHLASH yoki TSIKL_UXLASH
// ================================================================
uint8_t daqiqadanTsikilAniqla(uint8_t daqiqa) {
  if (daqiqa < 20) return TSIKL_UXLASH;
  if (daqiqa < 30) return TSIKL_ISHLASH;
  if (daqiqa < 50) return TSIKL_UXLASH;
  return TSIKL_ISHLASH;  // 50-59: soat oxiri
}

// ================================================================
//  SENSOR O'QISH KERAKMI?
// ================================================================
bool sensorOqishKerakmi() {
  if (aeratsiyaRejimi != REJIM_KISLOROD) return false;
  if (boshlangichRejimda) return true;       // 1 soat davomida doim o'qiydi
  return (tsikilRejim == TSIKL_ISHLASH);     // tsikl ISHLASH da o'qiydi
}

// ================================================================
//  [v9.1] TSIKL VA XOTIRA YANGILASH (5 soniyada bir marta)
//
//  BUG #1 TUZATILDI: if/else bloklari {} bilan to'g'rilandi.
//  Avvalgi kodda:
//    if (tsikilRejim == TSIKL_ISHLASH)
//      lcd.setCursor(0, 1);           ← faqat bu if ga kirgan
//      lcd.print("Sensor ishlaydi "); ← bu HAR DOIM bajarilgan!
//    else
//      lcd.setCursor(0, 1);           ← bu else ga kirgan
//      lcd.print("Sensor uxlaydi  "); ← bu HAR DOIM bajarilgan!
// ================================================================
void tsikilniYangilash() {
  if (aeratsiyaRejimi != REJIM_KISLOROD) return;
  if (!taymerOtdimi(lastTsikilTekshir, TSIKL_TEKSHIR_MS)) return;
  lastTsikilTekshir = millis();

  esp_task_wdt_reset();
  DateTime now        = rtc.now();
  uint8_t  joriyDaq   = now.minute();
  uint8_t  joriySoat  = now.hour();
  uint8_t  joriyKun   = now.day();
  uint8_t  joriyOy    = now.month();
  esp_task_wdt_reset();

  // ----------------------------------------------------------
  //  1. Boshlang'ich 1 soat rejimi tekshiruvi
  // ----------------------------------------------------------
  if (boshlangichRejimda) {
    if (taymerOtdimi(boshlangichBosh, BOSHLANGICH_MUDDAT_MS)) {
      boshlangichRejimda = false;
      tsikilRejim = daqiqadanTsikilAniqla(joriyDaq);

      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Tsikl rejimi    ");
      // [BUG #1 TUZATILDI]: Har bir if/else {} bilan o'ralgan
      if (tsikilRejim == TSIKL_ISHLASH) {
        lcd.setCursor(0, 1);
        lcd.print("Sensor ishlaydi ");
      } else {
        lcd.setCursor(0, 1);
        lcd.print("Sensor uxlaydi  ");
      }
      esp_task_wdt_reset();
      delay(1200);
      esp_task_wdt_reset();
      lcd.clear();
      esp_task_wdt_reset();
    } else {
      // Boshlang'ich davrda tsikl = ISHLASH (doim sensor faol)
      tsikilRejim = TSIKL_ISHLASH;
    }
  }

  // ----------------------------------------------------------
  //  2. Oddiy tsikl: RTC daqiqasiga ko'ra holat yangilash
  // ----------------------------------------------------------
  if (!boshlangichRejimda) {
    uint8_t yangiHolat = daqiqadanTsikilAniqla(joriyDaq);

    if (yangiHolat != tsikilRejim) {
      tsikilRejim        = yangiHolat;
      qaysiSensorNavbati = 1;

      lcd.clear();
      if (tsikilRejim == TSIKL_ISHLASH) {
        lcd.setCursor(0, 0);
        lcd.print("Sensor yondi    ");
        lcd.setCursor(0, 1);
        if (joriyDaq >= 50) {
          lcd.print("Soat oxiri :58da");
        } else {
          lcd.print("Daqiqa 20-30    ");
        }
      } else {
        // [BUG #1 TUZATILDI]: qolDaq hisoblash to'g'ri qavslangan
        uint8_t qolDaq = (joriyDaq < 20) ? (20 - joriyDaq) : (50 - joriyDaq);
        lcd.setCursor(0, 0);
        lcd.print("Sensor uxlaydi  ");
        lcd.setCursor(0, 1);
        lcd.print("Qoldi: ~");
        lcd.print(qolDaq);
        lcd.print(" daq  ");
      }
      esp_task_wdt_reset();
      delay(1200);
      esp_task_wdt_reset();
      lcd.clear();
      esp_task_wdt_reset();
    }
  }

  // ----------------------------------------------------------
  //  3. Xotiraga yozish: har soat 58-59 daqiqada
  //     Sensor faol bo'lishi shart (tsikl ISHLASH yoki boshlang'ich davr)
  // ----------------------------------------------------------
  bool sensorFaolMi = boshlangichRejimda || (tsikilRejim == TSIKL_ISHLASH);

  if (sensorFaolMi && (joriyDaq == 58 || joriyDaq == 59)) {
    uint16_t joriyKalit = yozuvKalitHisopla(joriyOy, joriyKun, joriySoat);
    if (joriyKalit != oxirgiYozuvKaliti) {
      xotiragaYozish(now);
      oxirgiYozuvKaliti = joriyKalit;
      soatlikSmsTekshir(now);   // soatlik holat SMS (KISLOROD, raqam bor bo'lsa)
    }
  }
}

// ================================================================
//  VAQT REJIMI — RELE BOSHQARUVI
// ================================================================
bool vaqtRejimiReleHolati() {
  if (vaqtOraliqSoni == 0) return false;

  DateTime now = rtc.now();
  uint16_t joriyDaq = (uint16_t)now.hour() * 60u + now.minute();

  for (uint8_t i = 0; i < MAX_VAQT_ORALIQ; i++) {
    if (!vaqtJadvali[i].faol) continue;
    uint16_t boshDaq = (uint16_t)vaqtJadvali[i].boshH * 60u + vaqtJadvali[i].boshM;
    uint16_t oxirDaq = (uint16_t)vaqtJadvali[i].oxirH * 60u + vaqtJadvali[i].oxirM;

    if (boshDaq < oxirDaq) {
      if (joriyDaq >= boshDaq && joriyDaq < oxirDaq) return true;
    } else if (boshDaq > oxirDaq) {
      // Gechayu-kunduz kesib o'tuvchi oraliq (masalan 22:00-06:00)
      if (joriyDaq >= boshDaq || joriyDaq < oxirDaq) return true;
    }
  }
  return false;
}

// ================================================================
//  EKRAN YANGILASH
// ================================================================
void ekranniYangilash() {
  if (wifiPortalAktiv) return;
  if (joriyRejimKiritish != ' ') return;
  // Uxlash rejimida uxlash ekrani ishlaydi
  if (!boshlangichRejimda &&
      aeratsiyaRejimi == REJIM_KISLOROD &&
      tsikilRejim == TSIKL_UXLASH) return;

  lcd.setCursor(0, 0);
  if (aeratsiyaRejimi == REJIM_KISLOROD) {
    if (!doXato && doAktivmi) {
      lcd.print("DO:");  lcdX10(do_x10);
      lcd.print(" T:");  lcdX10(t_x10);
      lcd.print((char)223); lcd.print('C');
    } else {
      lcd.print("DO:?    T:?     ");
    }
  } else {
    lcd.print("VAQT ");
    lcd.print(releHolati ? "ON  " : "OFF ");
    lcd.print('[');
    lcd.print(vaqtOraliqSoni);
    lcd.print("/5]  ");
  }

  lcd.setCursor(0, 1);
  if (aeratsiyaRejimi == REJIM_KISLOROD) {
    if (!phXato && phAktivmi) {
      lcd.print("Ph:"); lcdX10(ph_x10);
      lcd.print(' ');
    } else {
      lcd.print("Ph:?   ");
    }
  } else {
    lcd.print("               ");
  }
}

// ================================================================
//  SOAT (2-qator o'ng)
// ================================================================
void showClock() {
  if (wifiPortalAktiv) return;
  if (joriyRejimKiritish != ' ') return;
  if (!boshlangichRejimda &&
      aeratsiyaRejimi == REJIM_KISLOROD &&
      tsikilRejim == TSIKL_UXLASH) return;
  DateTime now = rtc.now();
  lcd.setCursor(9, 1);          // 11->9: 14-15 katak antenna uchun bo'shaydi
  lcdIkkiRaqam(now.hour());
  lcd.print(':');
  lcdIkkiRaqam(now.minute());
}

// ================================================================
//  UXLASH EKRANI — keyingi o'qish oynasini ko'rsatadi
// ================================================================
void uxlashEkrani() {
  if (wifiPortalAktiv) return;
  if (aeratsiyaRejimi != REJIM_KISLOROD) return;
  if (boshlangichRejimda) return;
  if (tsikilRejim != TSIKL_UXLASH) return;
  if (!taymerOtdimi(lastUxlashEkranVaqti, 5000UL)) return;
  lastUxlashEkranVaqti = millis();

  esp_task_wdt_reset();
  DateTime now      = rtc.now();
  uint8_t  joriyDaq = now.minute();
  esp_task_wdt_reset();

  uint8_t keyingiOyna;
  uint8_t qolganDaq;
  if (joriyDaq < 20) {
    keyingiOyna = 20;
    qolganDaq   = 20 - joriyDaq;
  } else {
    keyingiOyna = 50;
    qolganDaq   = 50 - joriyDaq;
  }

  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Sensor uxlaydi  ");
  lcd.setCursor(0, 1); lcd.print(":");
  lcdIkkiRaqam(keyingiOyna);
  lcd.print("da yonadi ~");
  lcd.print(qolganDaq);
  lcd.print("d ");
}

// ================================================================
//  RELE BOSHQARUVI
// ================================================================
void boshqarishRele() {
  bool yangiHolat = releHolati;

  if (aeratsiyaRejimi == REJIM_KISLOROD) {
    if (doXato || !doAktivmi) {
      yangiHolat = true;   // xatoda rele yoqiladi (xavfsiz holat)
    } else if (do_x10 < minDo_x10) {
      yangiHolat = true;
    } else if (do_x10 >= (minDo_x10 + farqDo_x10)) {
      yangiHolat = false;
    }
  } else {
    yangiHolat = vaqtRejimiReleHolati();
  }

  // SMS bilan qo'lda majburan yoqish (xavfsiz: faqat YONIQ qiladi, o'chirmaydi)
  if (qolReleYoq) yangiHolat = true;

  if (yangiHolat != releHolati &&
      taymerOtdimi(releOzgarishVaqti, RELE_DEBOUNCE_MS)) {
    releHolati        = yangiHolat;
    releOzgarishVaqti = millis();
    digitalWrite(RELE_PIN, releHolati ? HIGH : LOW);
  }
}

// ================================================================
//  SENSOR O'QISH (navbatma-navbat: DO va pH)
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
        sensorNosozXabar = false;   // sensor tiklandi -> keyingi nosozlikda SMS qayta yuboriladi
      } else {
        doXato          = true;
        doAktivmi       = false;
        lastDoCheckTime = millis();
      }
    } else {
      doXato = true;
    }
  } else {
    qaysiSensorNavbati = 1;
    if (phAktivmi) {
      node.begin(2, modbusSerial);
      if (node.readHoldingRegisters(0x0000, 2) == node.ku8MBSuccess) {
        ph_x10 = (int16_t)(node.getResponseBuffer(0) / 10);
        phXato = false;
      } else {
        phXato          = true;
        phAktivmi       = false;
        lastPhCheckTime = millis();
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

  uint8_t head  = eeprom_head_cache;
  uint8_t count = eeprom_count_cache;
  if (head  >= MAX_RECORDS) head  = 0;
  if (count >  MAX_RECORDS) count = 0;

  int16_t clamped = (do_x10 < 0) ? 0 : ((do_x10 > 255) ? 255 : do_x10);
  uint8_t doB = (uint8_t)clamped;

  prefsYozuvSaqla(head, now.hour(), now.minute(),
                  now.day(), now.month(), doB);

  head = (head + 1) % MAX_RECORDS;
  if (count < MAX_RECORDS) count++;

  prefsYozHead(head);
  prefsYozCount(count);
}

// ================================================================
//  DO TARIXI KO'RSATISH (E tugmasi)
//  [BUG #4 TUZATILDI]: delay(2000)+delay(500) orasiga WDT reset qo'shildi
// ================================================================
void doTarixiKorsat() {
  uint8_t head  = eeprom_head_cache;
  uint8_t count = eeprom_count_cache;

  lcd.clear();
  if (count == 0) {
    lcd.setCursor(0, 0); lcd.print("Tarix bo'sh!    ");
    esp_task_wdt_reset();
    delay(1500);
    esp_task_wdt_reset();
    lcd.clear();
    return;
  }

  lcd.setCursor(0, 0); lcd.print("--- DO TARIX ---");
  lcd.setCursor(0, 1); lcd.print("Jami: ");
  lcd.print(count); lcd.print(" yozuv  ");
  esp_task_wdt_reset();
  delay(1500);
  esp_task_wdt_reset();

  uint8_t boshIndeks = (count == MAX_RECORDS) ? head : 0;
  char    qator1[17] = "";

  for (uint8_t i = 0; i < count; i++) {
    esp_task_wdt_reset();
    uint8_t idx = (boshIndeks + i) % MAX_RECORDS;
    uint8_t h, m, kun, oy, doB;
    prefsYozuvOqish(idx, h, m, kun, oy, doB);

    uint8_t doB_tam = doB / 10;
    uint8_t doB_kas = doB % 10;

    // Format: "OY/KUN HH:MM D.D"
    char joriy[17];
    joriy[0]  = '0' + oy  / 10;  joriy[1]  = '0' + oy  % 10;
    joriy[2]  = '/';
    joriy[3]  = '0' + kun / 10;  joriy[4]  = '0' + kun % 10;
    joriy[5]  = ' ';
    joriy[6]  = '0' + h   / 10;  joriy[7]  = '0' + h   % 10;
    joriy[8]  = ':';
    joriy[9]  = '0' + m   / 10;  joriy[10] = '0' + m   % 10;
    joriy[11] = ' ';
    joriy[12] = (doB_tam >= 10) ? ('0' + doB_tam / 10) : ' ';
    joriy[13] = '0' + (doB_tam % 10);
    joriy[14] = '.';
    joriy[15] = '0' + doB_kas;
    joriy[16] = '\0';

    lcd.clear();
    lcd.setCursor(0, 0);
    if (qator1[0] != '\0') lcd.print(qator1);
    lcd.setCursor(0, 1);
    lcd.print(joriy);
    esp_task_wdt_reset();
    delay(2000);
    esp_task_wdt_reset();   // [BUG #4 TUZATILDI]: Bu reset qo'shildi
    delay(500);
    esp_task_wdt_reset();
    memcpy(qator1, joriy, 17);
  }

  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Tarix tugadi.   ");
  esp_task_wdt_reset();
  delay(1500);
  esp_task_wdt_reset();
  lcd.clear();
  esp_task_wdt_reset();
}

// ================================================================
//  VAQT ORALIQLARINI KO'RSATISH
//  [BUG #5 TUZATILDI]: delay lararo WDT reset qo'shildi
// ================================================================
void vaqtJadvaliniKorsat() {
  lcd.clear();
  if (vaqtOraliqSoni == 0) {
    lcd.setCursor(0, 0); lcd.print("Jadval bo'sh!   ");
    lcd.setCursor(0, 1); lcd.print("R-kiriting      ");
    esp_task_wdt_reset();
    delay(1500);
    esp_task_wdt_reset();
    delay(500);
    esp_task_wdt_reset();
    lcd.clear();
    return;
  }

  lcd.setCursor(0, 0); lcd.print("-- VAQT JADVAL--");
  lcd.setCursor(0, 1); lcd.print("Jami: ");
  lcd.print(vaqtOraliqSoni); lcd.print(" ta     ");
  esp_task_wdt_reset();
  delay(1500);
  esp_task_wdt_reset();

  uint8_t ko = 0;
  for (uint8_t i = 0; i < MAX_VAQT_ORALIQ; i++) {
    if (!vaqtJadvali[i].faol) continue;
    esp_task_wdt_reset();
    ko++;
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(ko); lcd.print(": ");
    lcdIkkiRaqam(vaqtJadvali[i].boshH); lcd.print(':');
    lcdIkkiRaqam(vaqtJadvali[i].boshM); lcd.print('-');
    lcdIkkiRaqam(vaqtJadvali[i].oxirH); lcd.print(':');
    lcdIkkiRaqam(vaqtJadvali[i].oxirM);
    lcd.print("    ");
    lcd.setCursor(0, 1);
    lcd.print(vaqtRejimiReleHolati() ? "Hozir: AKTIV    " : "Hozir: -        ");
    esp_task_wdt_reset();
    delay(2000);
    esp_task_wdt_reset();   // [BUG #5 TUZATILDI]: Bu reset qo'shildi
    delay(500);
    esp_task_wdt_reset();
  }

  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Jadval tugadi.  ");
  esp_task_wdt_reset();
  delay(1500);
  esp_task_wdt_reset();
  lcd.clear();
  esp_task_wdt_reset();
}

// ================================================================
//  L TUGMASI — REJIM TANLASH
//  [BUG #6 TUZATILDI]: lcd.clear() bilan ekran tozalanadi
// ================================================================
void lTugmasiBosildi() {
  if (lTugmaHolati == 0 || taymerOtdimi(lTugmaVaqti, L_TIMEOUT)) {
    lTugmaHolati       = 1;
    lTugmaVaqti        = millis();
    joriyRejimKiritish = 'L';
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("1-Kislorod rejim");
    lcd.setCursor(0, 1); lcd.print("T-tasdiqlash    ");
  } else if (lTugmaHolati == 1) {
    lTugmaHolati = 2;
    lTugmaVaqti  = millis();
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("2-Vaqt rejimi   ");
    lcd.setCursor(0, 1); lcd.print("T-tasdiqlash    ");
  } else {
    lTugmaHolati       = 0;
    joriyRejimKiritish = ' ';
    lcd.clear();
    ekranniYangilash();
  }
}

// ================================================================
//  KLAVIATURA BOSHQARUV
// ================================================================
void klaviaturaBoshqar(char key) {

  if (key == 'L') { lTugmasiBosildi(); return; }

  if (joriyRejimKiritish == 'L') {
    if (key == 'T') {
      if (lTugmaHolati == 1) {
        aeratsiyaRejimi = REJIM_KISLOROD;
        prefs.putUChar("rejim", REJIM_KISLOROD);
        boshlangichRejimda = true;
        boshlangichBosh    = millis();
        tsikilRejim        = TSIKL_ISHLASH;
        oxirgiYozuvKaliti  = 0xFFFF;
        qaysiSensorNavbati = 1;
        joriyRejimKiritish = ' ';
        lTugmaHolati       = 0;
        lcd.clear();
        lcd.setCursor(0, 0); lcd.print("Kislorod rejim  ");
        lcd.setCursor(0, 1); lcd.print("1s boshlang'ich ");
        esp_task_wdt_reset();
        delay(1500);
        esp_task_wdt_reset();
        lcd.clear();
        ekranniYangilash();
      } else if (lTugmaHolati == 2) {
        aeratsiyaRejimi    = REJIM_VAQT;
        prefs.putUChar("rejim", REJIM_VAQT);
        joriyRejimKiritish = ' ';
        lTugmaHolati       = 0;
        lcd.clear();
        lcd.setCursor(0, 0); lcd.print("Vaqt rejimi     ");
        lcd.setCursor(0, 1); lcd.print("tanlandi!       ");
        esp_task_wdt_reset();
        delay(1500);
        esp_task_wdt_reset();
        lcd.clear();
        ekranniYangilash();
      }
    } else if (key == 'R') {
      lTugmaHolati       = 0;
      joriyRejimKiritish = ' ';
      lcd.clear();
      ekranniYangilash();
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
          if (vaqtJadvali[i].faol) {
            vaqtJadvali[i].faol = false;
            vaqtOraliqSoni--;
            break;
          }
        }
        vaqtJadvaliniSaqla();
        nonBlockXabar("O'chirildi!     ", 1500);
      }
    }
    return;
  }

  if (key == 'T') {
    // Bo'sh holatda T -> uzun bosish (test) loop'da aniqlanadi.
    // Kiritish faol bo'lsa -> oddiy saqlash (darhol, o'zgarmagan).
    if (joriyRejimKiritish == ' ' && inputLen == 0) {
      tBosildi   = true;
      tBoshVaqti = millis();
    } else {
      saqlashTugmasi();
    }
    return;
  }

  if (key == 'R') {
    if (joriyRejimKiritish != ' ') {
      // faol kiritishni bekor qilish
      inputLen = 0; inputText[0] = '\0';
      joriyRejimKiritish = ' ';
      lcd.setCursor(0, 1); lcd.print("                ");
      lcd.clear();
      ekranniYangilash();
    } else if (aeratsiyaRejimi == REJIM_VAQT) {
      // VAQT rejimi, bo'sh -> vaqt oralig'i kiritish
      if (vaqtOraliqSoni >= MAX_VAQT_ORALIQ) {
        nonBlockXabar("Max 5 ta! D-och ", 2000);
        return;
      }
      joriyRejimKiritish = 'V';
      inputLen = 0; inputText[0] = '\0';
      lcd.clear();
      lcd.setCursor(0, 0); lcd.print("Vaqt: SSDDBBOO  ");
      lcd.setCursor(0, 1); lcd.print("                ");
      lcd.setCursor(0, 1);
    } else {
      // KISLOROD rejimi, bo'sh -> telefon raqami kiritish
      telRaqamKiritishOch();
    }
    return;
  }

  // '#' alohida boshqariladi (bir marta = Min DO, ikki marta = Kritik DO)
  if (key == '#') {
    if (joriyRejimKiritish == '#' && inputLen == 0) {
      // ikkinchi marta '#' (raqam yozilmasdan) -> Kritik DO
      joriyRejimKiritish = 'K';
      lcd.setCursor(0, 1); lcd.print("                ");
      lcd.setCursor(0, 1); lcd.print("Kritik DO(mg/L):");
    } else {
      // birinchi '#' -> Min DO
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
      esp_task_wdt_reset();
      delay(1200);
      esp_task_wdt_reset();
      lcd.setCursor(0, 0); lcd.print("Vaqt: OOKKSSDD  ");
      lcd.setCursor(0, 1); lcd.print("                ");
      lcd.setCursor(0, 1);
    }
    return;
  }

  // Bo'sh (idle) holatda '0' bosilsa -> ZAVOD RESET kiritish rejimi.
  // Shu tufayli "000" + T istalgan paytda (hech qaysi menyuga kirmasdan)
  // ishlaydi va qurilmani to'liq standartga qaytaradi.
  if (key == '0' && joriyRejimKiritish == ' ') {
    joriyRejimKiritish = 'Z';
    inputLen = 0;
    inputText[inputLen++] = '0';
    inputText[inputLen]   = '\0';
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("ZAVOD RESET?    ");
    lcd.setCursor(0, 1); lcd.print("T=tasdiq ");
    lcd.print(inputText);
    return;
  }

  // Bo'sh holatda '1' bosilsa -> WiFi sozlash portali (111 + T).
  if (key == '1' && joriyRejimKiritish == ' ') {
    joriyRejimKiritish = 'W';
    inputLen = 0;
    inputText[inputLen++] = '1';
    inputText[inputLen]   = '\0';
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("WiFi sozlash?   ");
    lcd.setCursor(0, 1); lcd.print("T=tasdiq ");
    lcd.print(inputText);
    return;
  }

  if (key >= '0' && key <= '9' && joriyRejimKiritish != ' ') {
    // ZAVOD RESET rejimida faqat '0' qabul qilinadi
    if (joriyRejimKiritish == 'Z' && key != '0') return;
    // WiFi rejimida faqat '1' qabul qilinadi
    if (joriyRejimKiritish == 'W' && key != '1') return;

    uint8_t maxLen;
    if      (joriyRejimKiritish == 'P') maxLen = 9;
    else if (joriyRejimKiritish == 'Z') maxLen = 3;
    else if (joriyRejimKiritish == 'W') maxLen = 3;
    else                                maxLen = 8;

    if (inputLen < maxLen) {
      inputText[inputLen++] = key;
      inputText[inputLen]   = '\0';
    }
    lcd.setCursor(0, 1);
    lcd.print("                ");
    lcd.setCursor(0, 1);

    if (joriyRejimKiritish == 'V') {
      for (uint8_t i = 0; i < inputLen; i++) {
        if (i == 2) lcd.print(':');
        else if (i == 4) lcd.print('-');
        else if (i == 6) lcd.print(':');
        lcd.print(inputText[i]);
      }
    } else if (joriyRejimKiritish == 'U') {
      for (uint8_t i = 0; i < inputLen; i++) {
        if (i == 2) lcd.print('/');
        else if (i == 4) lcd.print(' ');
        else if (i == 6) lcd.print(':');
        lcd.print(inputText[i]);
      }
    } else if (joriyRejimKiritish == 'P') {
      lcd.print("+998"); lcd.print(inputText);
    } else if (joriyRejimKiritish == 'Z') {
      lcd.print("T=tasdiq "); lcd.print(inputText);
    } else if (joriyRejimKiritish == 'W') {
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
// ================================================================
void saqlashTugmasi() {
  if (inputLen == 0) {
    nonBlockXabar("Qiymat yo'q!   ", 1500); return;
  }

  // 000T → standartga qaytarish (to'liq zavod reseti)
  if (inputLen == 3 &&
      inputText[0] == '0' && inputText[1] == '0' && inputText[2] == '0') {
    inputLen = 0; inputText[0] = '\0';
    joriyRejimKiritish = ' ';
    standartgaQaytarish();
    ekranniYangilash();
    return;
  }

  // ZAVOD RESET rejimida "000" dan boshqa narsa kiritilsa -> bekor qilamiz
  if (joriyRejimKiritish == 'Z') {
    inputLen = 0; inputText[0] = '\0';
    joriyRejimKiritish = ' ';
    nonBlockXabar("Reset bekor     ", 1500);
    return;
  }

  // 111T → WiFi sozlash portalini ochish (faqat WiFi rejimida)
  if (joriyRejimKiritish == 'W' && inputLen == 3 &&
      inputText[0] == '1' && inputText[1] == '1' && inputText[2] == '1') {
    inputLen = 0; inputText[0] = '\0';
    joriyRejimKiritish = ' ';
    wifiPortalBoshla();
    return;
  }
  // WiFi rejimida "111" dan boshqa narsa -> bekor
  if (joriyRejimKiritish == 'W') {
    inputLen = 0; inputText[0] = '\0';
    joriyRejimKiritish = ' ';
    nonBlockXabar("WiFi bekor      ", 1500);
    return;
  }

  int val = atoi(inputText);

  // ----------------------------------------------------------
  //  VAQT ORALIG'I (V rejimi)
  // ----------------------------------------------------------
  if (joriyRejimKiritish == 'V') {
    if (inputLen != 8) {
      nonBlockXabar("8 raqam: SSDDBBOO", 2000); return;
    }
    uint8_t bH = (inputText[0]-'0')*10 + (inputText[1]-'0');
    uint8_t bM = (inputText[2]-'0')*10 + (inputText[3]-'0');
    uint8_t oH = (inputText[4]-'0')*10 + (inputText[5]-'0');
    uint8_t oM = (inputText[6]-'0')*10 + (inputText[7]-'0');

    if (bH >= 24 || bM >= 60 || oH >= 24 || oM >= 60) {
      nonBlockXabar("Vaqt noto'g'ri! ", 2000); return;
    }
    if (bH == oH && bM == oM) {
      nonBlockXabar("Bosh=Oxir xato! ", 2000); return;
    }

    bool saqlandi = false;
    for (uint8_t i = 0; i < MAX_VAQT_ORALIQ; i++) {
      if (!vaqtJadvali[i].faol) {
        vaqtJadvali[i] = {bH, bM, oH, oM, true};
        vaqtOraliqSoni++;
        saqlandi = true;
        break;
      }
    }

    if (!saqlandi) {
      nonBlockXabar("Max 5 ta! D-och ", 2000); return;
    }

    vaqtJadvaliniSaqla();
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("Saqlandi:       ");
    lcd.setCursor(0, 1);
    lcdIkkiRaqam(bH); lcd.print(':'); lcdIkkiRaqam(bM);
    lcd.print('-');
    lcdIkkiRaqam(oH); lcd.print(':'); lcdIkkiRaqam(oM);
    lcd.print("      ");
    esp_task_wdt_reset();
    delay(1500);
    esp_task_wdt_reset();
    delay(500);
    esp_task_wdt_reset();
    lcd.clear();
    inputLen = 0; inputText[0] = '\0';
    joriyRejimKiritish = ' ';
    ekranniYangilash();
    return;
  }

  // ----------------------------------------------------------
  //  RTC SOZLASH (U rejimi) — OOKKSSDD format
  // ----------------------------------------------------------
  if (joriyRejimKiritish == 'U') {
    if (inputLen != 8) {
      nonBlockXabar("8 raqam: OOKKSSDD", 2000); return;
    }
    uint8_t oy   = (inputText[0]-'0')*10 + (inputText[1]-'0');
    uint8_t kun  = (inputText[2]-'0')*10 + (inputText[3]-'0');
    uint8_t soat = (inputText[4]-'0')*10 + (inputText[5]-'0');
    uint8_t daq  = (inputText[6]-'0')*10 + (inputText[7]-'0');

    if (oy < 1 || oy > 12) {
      nonBlockXabar("Oy 01-12 bo'lsin", 2000); return;
    }

    DateTime now = rtc.now();
    uint16_t yil = now.year();
    uint8_t maxKun = oyningKunlari(oy, yil);
    if (maxKun == 0 || kun < 1 || kun > maxKun) {
      nonBlockXabar("Kun xato!       ", 2000); return;
    }
    if (soat >= 24 || daq >= 60) {
      nonBlockXabar("Soat/daqiqa xato", 2000); return;
    }

    rtc.adjust(DateTime(yil, oy, kun, soat, daq, 0));
    oxirgiYozuvKaliti = 0xFFFF;   // RTC o'zgandi → kalit reset

    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("Vaqt saqlandi:  ");
    lcd.setCursor(0, 1);
    lcdIkkiRaqam(oy); lcd.print('/');
    lcdIkkiRaqam(kun); lcd.print(' ');
    lcdIkkiRaqam(soat); lcd.print(':');
    lcdIkkiRaqam(daq);
    lcd.print("   ");
    esp_task_wdt_reset();
    delay(1500);
    esp_task_wdt_reset();
    lcd.clear();
    inputLen = 0; inputText[0] = '\0';
    joriyRejimKiritish = ' ';
    ekranniYangilash();
    return;
  }

  // ----------------------------------------------------------
  //  HARORAT KALIBRLASH (B rejimi)
  // ----------------------------------------------------------
  if (joriyRejimKiritish == 'B') {
    if (val < 0 || val > 50) {
      nonBlockXabar("0-50 oralig'i! ", 2500);
    } else {
      kiritilganHarorat = (int8_t)val;
      runHaroratKalibrlash();
    }
    return;
  }

  // ----------------------------------------------------------
  //  MIN DO SOZLASH (#)
  // ----------------------------------------------------------
  if (joriyRejimKiritish == '#') {
    if (val < 1 || val > 20) {
      nonBlockXabar("1-20 mg/L !    ", 2000); return;
    }
    minDo_x10 = (int16_t)(val * 10);
    prefs.putShort("minDo", minDo_x10);
    nonBlockXabar("Min DO saqlandi", 1500);
    return;
  }

  // ----------------------------------------------------------
  //  FARQ SOZLASH (*)
  // ----------------------------------------------------------
  if (joriyRejimKiritish == '*') {
    if (val < 1 || val > 10) {
      nonBlockXabar("1-10 mg/L !    ", 2000); return;
    }
    farqDo_x10 = (int16_t)(val * 10);
    prefs.putShort("farqDo", farqDo_x10);
    nonBlockXabar("Farq saqlandi  ", 1500);
    return;
  }

  // ----------------------------------------------------------
  //  KRITIK DO SOZLASH (## -> K) — qo'ng'iroq chegarasi
  // ----------------------------------------------------------
  if (joriyRejimKiritish == 'K') {
    if (val < 1 || val > 20) {
      nonBlockXabar("1-20 mg/L !    ", 2000); return;
    }
    kritikDo_x10 = (int16_t)(val * 10);
    prefs.putShort("kritikDo", kritikDo_x10);
    // alarm holatini yangidan baholash uchun epizodni reset qilamiz
    alarmFaol = false; alarmTasdiq = false;
    if (kritikDo_x10 >= minDo_x10)
      nonBlockXabar("Ogoh:kritik>=min", 2500);
    else
      nonBlockXabar("Kritik DO saqlan", 1500);
    return;
  }

  // ----------------------------------------------------------
  //  TELEFON RAQAMI (R -> P) — 9 raqam, +998 avtomatik
  // ----------------------------------------------------------
  if (joriyRejimKiritish == 'P') {
    if (inputLen != 9) {
      nonBlockXabar("9 ta raqam kerak", 2000); return;
    }
    snprintf(telRaqam, sizeof(telRaqam), "+998%s", inputText);
    prefs.putString("tel", telRaqam);
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("Tel saqlandi:   ");
    lcd.setCursor(0, 1); lcd.print(telRaqam);
    esp_task_wdt_reset();
    delay(1500);
    esp_task_wdt_reset();
    lcd.clear();
    inputLen = 0; inputText[0] = '\0';
    joriyRejimKiritish = ' ';
    ekranniYangilash();
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
  esp_task_wdt_reset();
  delay(500);
  esp_task_wdt_reset();

  node.begin(1, modbusSerial);
  uint8_t result = node.writeSingleRegister(0x1004, 0);

  lcd.clear();
  lcd.setCursor(0, 0);
  if (result == node.ku8MBSuccess) lcd.print("DO OK           ");
  else { lcd.print("Xato: 0x"); lcd.print(result, HEX); }
  esp_task_wdt_reset();
  delay(2000);
  esp_task_wdt_reset();
  delay(500);
  esp_task_wdt_reset();

  lcd.clear();
  inputLen = 0; inputText[0] = '\0';
  joriyRejimKiritish = ' ';
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
  esp_task_wdt_reset();
  delay(800);
  esp_task_wdt_reset();

  node.begin(1, modbusSerial);
  uint8_t result = node.writeSingleRegister(
    0x1010, (uint16_t)((uint8_t)kiritilganHarorat * 10));

  lcd.clear();
  lcd.setCursor(0, 0);
  if (result == node.ku8MBSuccess) lcd.print("T OK            ");
  else { lcd.print("Xato: 0x"); lcd.print(result, HEX); }
  esp_task_wdt_reset();
  delay(2000);
  esp_task_wdt_reset();

  lcd.clear();
  inputLen = 0; inputText[0] = '\0';
  kiritilganHarorat  = -1;
  joriyRejimKiritish = ' ';
  isCalibrating = false;
}

// ================================================================
//  ============   GSM / SIM800L   ============
//  To'liq NON-BLOCKING. Hech bir funksiya loop'ni bloklamaydi.
//  AT buyruqlari yuboriladi, javob keyingi loop'larda o'qiladi.
//
//  ESLATMA: SIM800L modulingiz 115200 baud da bo'lsa, quyidagi
//  simSerial.begin dagi 9600 ni 115200 ga o'zgartiring (yoki bir marta
//  AT+IPR=9600 yuborib modulni 9600 ga qotiring).
// ================================================================

// UART dan kelgan baytlarni simBuf ga yig'ish (overflow-safe)
void simBuferGa() {
  while (simSerial.available()) {
    char c = (char)simSerial.read();
    if (c == '\0') continue;
    if (simBufLen < sizeof(simBuf) - 1) {
      simBuf[simBufLen++] = c;
      simBuf[simBufLen]   = '\0';
    } else {
      // bufer to'ldi — oldingi yarmini tashlab, joy bo'shatamiz
      uint16_t yarim = (sizeof(simBuf) - 1) / 2;
      memmove(simBuf, simBuf + yarim, simBufLen - yarim + 1);
      simBufLen -= yarim;
      simBuf[simBufLen++] = c;
      simBuf[simBufLen]   = '\0';
    }
  }
}

inline void simBuferTozala() { simBufLen = 0; simBuf[0] = '\0'; }

bool simJavobBor(const char* token) { return (strstr(simBuf, token) != NULL); }

void simYuborln(const char* s) { simSerial.print(s); simSerial.write('\r'); }

// SMS navbatiga matn qo'shish
bool smsNavbatgaQosh(const char* matn) {
  if (telRaqam[0] == '\0') return false;
  if (smsSon >= SMS_NAVBAT) return false;        // navbat to'la
  uint8_t idx = (smsBosh + smsSon) % SMS_NAVBAT;
  strncpy(smsNavbat[idx], matn, SMS_MAX_UZUN - 1);
  smsNavbat[idx][SMS_MAX_UZUN - 1] = '\0';
  smsSon++;
  return true;
}

// Qo'ng'iroq so'rovi (alarm yoki test)
void qongiroqSorov(bool test) {
  if (telRaqam[0] == '\0') return;
  qongPending = true;
  qongTest    = test;
}

// SIM modulni RST orqali qayta tiklash (kamdan-kam, modul osilsa)
void simResetModul() {
  digitalWrite(SIM_RST_PIN, LOW);
  esp_task_wdt_reset();
  delay(120);                 // qisqa impuls (kamyob hodisa, WDT xavfsiz)
  esp_task_wdt_reset();
  digitalWrite(SIM_RST_PIN, HIGH);
  simBuferTozala();
  simHolat       = SIM_KUT;
  simBoshVaqti   = millis();
  simHolatVaqti  = millis();
  simTayyormi    = false;
  simInitBosqich = 0;
  simUrinish     = 0;
  simSignal      = 99;
}

void simBoshlash() {
  pinMode(SIM_RST_PIN, OUTPUT);
  digitalWrite(SIM_RST_PIN, HIGH);     // RST faol emas
  simSerial.begin(9600, SERIAL_8N1, SIM_RX_PIN, SIM_TX_PIN);
  simBuferTozala();
  simHolat       = SIM_KUT;
  simBoshVaqti   = millis();
  simHolatVaqti  = millis();
  simTayyormi    = false;
  simInitBosqich = 0;
  simUrinish     = 0;
  simSignal      = 99;
}

// ================================================================
//  SIM HOLAT MASHINASI — har loop'da chaqiriladi
// ================================================================
void simYangilash() {
  simBuferGa();
  unsigned long hozir = millis();

  switch (simHolat) {

    // -------- Modul ishga tushishini kutish --------
    case SIM_KUT:
      if (taymerOtdimi(simBoshVaqti, 4000UL)) {
        simBuferTozala();
        simYuborln("AT");
        simInitBosqich = 0;
        simUrinish     = 0;
        simHolat       = SIM_INIT;
        simHolatVaqti  = hozir;
      }
      break;

    // -------- Boshlang'ich sozlash --------
    case SIM_INIT:
      if (simJavobBor("OK")) {
        simInitBosqich++;
        simBuferTozala();
        switch (simInitBosqich) {
          case 1: simYuborln("ATE0");          break;  // echo o'chirish
          case 2: simYuborln("AT+CMGF=1");     break;  // SMS text rejimi
          case 3: simYuborln("AT+CSCS=\"GSM\"");break; // belgilar to'plami
          case 4: simYuborln("AT+CLIP=1");     break;  // qo'ng'iroq holati
          case 5: simYuborln("AT+CNMI=2,2,0,0,0"); break; // kiruvchi SMS -> darhol UART
          default:
            simBuferTozala();
            simYuborln("AT+CREG?");
            simUrinish    = 0;
            simHolat      = SIM_TARMOQ;
            break;
        }
        simHolatVaqti = hozir;
      } else if (taymerOtdimi(simHolatVaqti, 3000UL)) {
        simUrinish++;
        if (simUrinish >= 5) { simResetModul(); break; }
        simBuferTozala();
        simYuborln("AT");
        simInitBosqich = 0;
        simHolatVaqti  = hozir;
      }
      break;

    // -------- Tarmoqqa ro'yxatdan o'tish --------
    case SIM_TARMOQ:
      // +CREG: 0,1 (uy) yoki 0,5 (roaming) = ulangan
      if (simJavobBor(",1") || simJavobBor(",5")) {
        simTayyormi   = true;
        simBuferTozala();
        simCsqVaqti   = 0;          // darhol signal so'rash
        simHolat      = SIM_TAYYOR;
        simHolatVaqti = hozir;
      } else if (taymerOtdimi(simHolatVaqti, 3000UL)) {
        simBuferTozala();
        simYuborln("AT+CREG?");
        simHolatVaqti = hozir;
        simUrinish++;
        if (simUrinish > 40) simResetModul();   // ~2 daqiqa ulanmasa reset
      }
      break;

    // -------- Bo'sh / ishga tayyor --------
    case SIM_TAYYOR: {
      // Kiruvchi qo'ng'iroq bo'lsa, uni rad etamiz (modulni band qilmasin)
      if (simJavobBor("RING")) { simYuborln("ATH"); simBuferTozala(); break; }

      // Kiruvchi SMS buyrug'i (+CMT push, CNMI=2,2). Faqat bo'sh holatda o'qiymiz.
      char* cmt = strstr(simBuf, "+CMT:");
      if (cmt) {
        char* nl = strchr(cmt, '\n');
        if (nl) {
          char tana[64]; uint8_t k = 0; nl++;
          while (*nl && *nl != '\r' && *nl != '\n' && k < sizeof(tana) - 1)
            tana[k++] = *nl++;
          tana[k] = '\0';
          if (k > 0) smsBuyruqniQolla(tana);
        }
        simBuferTozala();
        break;
      }

      // CSQ (signal) javobini tahlil qilish
      char* p = strstr(simBuf, "+CSQ:");
      if (p) {
        simSignal = (uint8_t)atoi(p + 5);
        simBuferTozala();
      }

      // 1) SMS navbati (SMS doim qo'ng'iroqdan oldin ketadi)
      if (smsSon > 0) {
        char buyruq[40];
        snprintf(buyruq, sizeof(buyruq), "AT+CMGS=\"%s\"", telRaqam);
        simBuferTozala();
        simYuborln(buyruq);
        simHolat      = SIM_SMS_CMGS;
        simHolatVaqti = hozir;
      }
      // 2) Qo'ng'iroq
      else if (qongPending) {
        qongPending = false;
        char buyruq[24];
        snprintf(buyruq, sizeof(buyruq), "ATD%s;", telRaqam);
        simBuferTozala();
        simYuborln(buyruq);
        qongJavobBerildi = false;
        simHolat      = SIM_QONG_TER;
        simHolatVaqti = hozir;
      }
      // 3) Internet telemetriya — SIM orqali (loop rejasi so'rasa: WiFi yo'q/uzilgan)
      else if (simTelemSora) {
        simTelemSora = false;
        httpBosqich = 0;
        simBuferTozala();
        simYuborln("AT+SAPBR=3,1,\"Contype\",\"GPRS\"");
        simHolat      = SIM_NET_BEARER;
        simHolatVaqti = hozir;
      }
      // 4) Bo'sh bo'lsa — signalni davriy yangilash
      else if (taymerOtdimi(simCsqVaqti, 10000UL)) {
        simCsqVaqti = hozir;
        simBuferTozala();
        simYuborln("AT+CSQ");
      }
      break;
    }

    // -------- GPRS bearer + HTTP sozlash (matnli AT, har bosqich OK kutadi) --------
    case SIM_NET_BEARER:
      if (simJavobBor("OK") || simJavobBor("ERROR")) {
        httpBosqich++;
        simBuferTozala();
        char b[176];
        switch (httpBosqich) {
          case 1:
            snprintf(b, sizeof(b), "AT+SAPBR=3,1,\"APN\",\"%s\"", GPRS_APN);
            simYuborln(b); break;
          case 2: simYuborln("AT+SAPBR=1,1");            break;  // bearer ochish (sekin)
          case 3: simYuborln("AT+HTTPINIT");             break;
          case 4: simYuborln("AT+HTTPPARA=\"CID\",1");   break;
          case 5:
            snprintf(b, sizeof(b),
              "AT+HTTPPARA=\"URL\",\"%s\"", FB_SIM_RELAY);
            simYuborln(b); break;
          case 6: simYuborln("AT+HTTPPARA=\"CONTENT\",\"application/json\""); break;
          case 7:
            snprintf(b, sizeof(b), "AT+HTTPDATA=%u,8000", (unsigned)strlen(telemetriyaBuf));
            simYuborln(b);
            simHolat = SIM_HTTP_TELEM;      // endi "DOWNLOAD" kutamiz
            break;
          default:
            simHolat = SIM_TAYYOR;          // kutilmagan holat — xavfsiz qaytish
            break;
        }
        simHolatVaqti = hozir;
      } else if (taymerOtdimi(simHolatVaqti, 15000UL)) {
        // bearer/HTTP sekin yoki nosoz — bekor qilib, TAYYOR ga qaytamiz (best-effort)
        simBuferTozala();
        simYuborln("AT+HTTPTERM");
        simHolat      = SIM_TAYYOR;
        simHolatVaqti = hozir;
      }
      break;

    // -------- HTTP telemetriya: DOWNLOAD -> JSON -> HTTPACTION -> TERM --------
    case SIM_HTTP_TELEM:
      if (httpBosqich == 7) {                       // "DOWNLOAD" kutamiz
        if (simJavobBor("DOWNLOAD")) {
          simSerial.print(telemetriyaBuf);          // JSON tanasini yuboramiz
          simBuferTozala();
          httpBosqich   = 8;
          simHolatVaqti = hozir;
        } else if (taymerOtdimi(simHolatVaqti, 8000UL)) {
          simBuferTozala(); simYuborln("AT+HTTPTERM");
          simHolat = SIM_TAYYOR; simHolatVaqti = hozir;
        }
      } else if (httpBosqich == 8) {                // data yozildi, OK -> HTTPACTION
        if (simJavobBor("OK")) {
          simBuferTozala();
          simYuborln("AT+HTTPACTION=1");
          httpBosqich   = 9;
          simHolatVaqti = hozir;
        } else if (taymerOtdimi(simHolatVaqti, 8000UL)) {
          simBuferTozala(); simYuborln("AT+HTTPTERM");
          simHolat = SIM_TAYYOR; simHolatVaqti = hozir;
        }
      } else {                                      // ACTION natijasi yoki timeout
        if (simJavobBor("+HTTPACTION:") || simJavobBor("ERROR")) {
          simBuferTozala();
          simYuborln("AT+HTTPTERM");
          simHolat      = SIM_TAYYOR;
          simHolatVaqti = hozir;
        } else if (taymerOtdimi(simHolatVaqti, 20000UL)) {
          simBuferTozala(); simYuborln("AT+HTTPTERM");
          simHolat = SIM_TAYYOR; simHolatVaqti = hozir;
        }
      }
      break;

    // -------- SMS: ">" promptini kutish --------
    case SIM_SMS_CMGS:
      if (simJavobBor(">")) {
        simSerial.print(smsNavbat[smsBosh]);
        simSerial.write(26);              // Ctrl-Z = yuborish
        simBuferTozala();
        simHolat      = SIM_SMS_TANA;
        simHolatVaqti = hozir;
      } else if (taymerOtdimi(simHolatVaqti, 5000UL)) {
        simSerial.write(27);              // ESC = bekor
        smsBosh = (smsBosh + 1) % SMS_NAVBAT;
        if (smsSon) smsSon--;
        simBuferTozala();
        simHolat      = SIM_TAYYOR;
        simHolatVaqti = hozir;
      }
      break;

    // -------- SMS: yuborilishini kutish --------
    case SIM_SMS_TANA:
      if (simJavobBor("+CMGS:") || simJavobBor("OK")) {
        smsBosh = (smsBosh + 1) % SMS_NAVBAT;
        if (smsSon) smsSon--;
        simBuferTozala();
        simHolat      = SIM_TAYYOR;
        simHolatVaqti = hozir;
      } else if (simJavobBor("ERROR") || taymerOtdimi(simHolatVaqti, 12000UL)) {
        smsBosh = (smsBosh + 1) % SMS_NAVBAT;     // bu SMS ni tashlab ketamiz
        if (smsSon) smsSon--;
        simBuferTozala();
        simHolat      = SIM_TAYYOR;
        simHolatVaqti = hozir;
      }
      break;

    // -------- Qo'ng'iroq: ATD javobini kutish --------
    case SIM_QONG_TER:
      if (simJavobBor("OK")) {
        simBuferTozala();
        qongKuzatBosh = hozir;
        simHolat      = SIM_QONG_KUZAT;
        simHolatVaqti = hozir;
      } else if (simJavobBor("ERROR") || simJavobBor("NO DIAL") ||
                 taymerOtdimi(simHolatVaqti, 5000UL)) {
        simBuferTozala();
        simHolat      = SIM_TAYYOR;
        simHolatVaqti = hozir;
      }
      break;

    // -------- Qo'ng'iroq: javob/tugashini kuzatish --------
    case SIM_QONG_KUZAT:
      // CLCC: "+CLCC: 1,0,0,..." -> stat=0 = JAVOB BERILDI
      if (strstr(simBuf, "+CLCC: 1,0,0")) {
        qongJavobBerildi = true;
        alarmTasdiq      = true;          // fermer javob berdi -> qayta qo'ng'iroq yo'q
        simYuborln("ATH");
        simBuferTozala();
        simHolat      = SIM_TAYYOR;
        simHolatVaqti = hozir;
      }
      // Qo'ng'iroq tugadi (javobsiz / band / rad)
      else if (simJavobBor("NO CARRIER") || simJavobBor("NO ANSWER") ||
               simJavobBor("BUSY")       || simJavobBor("NO DIALTONE")) {
        simBuferTozala();
        simHolat      = SIM_TAYYOR;
        simHolatVaqti = hozir;
      }
      // Davriy CLCC so'rovi (har ~1.5s)
      else if (taymerOtdimi(simHolatVaqti, 1500UL)) {
        simHolatVaqti = hozir;
        simBuferTozala();
        simYuborln("AT+CLCC");
      }
      // Jiringlash timeouti (~28s) -> uzamiz
      if (taymerOtdimi(qongKuzatBosh, 28000UL) && simHolat == SIM_QONG_KUZAT) {
        simYuborln("ATH");
        simBuferTozala();
        simHolat      = SIM_TAYYOR;
        simHolatVaqti = hozir;
      }
      break;

    default:
      simHolat = SIM_TAYYOR;
      break;
  }
}

// ================================================================
//  ALARM — DO ni kritik bilan solishtirish (sensor o'qilgach chaqiriladi)
//  Bu yerda faqat EPIZOD boshlash va tiklanish. Qayta qo'ng'iroqni
//  alarmQaytaQong() boshqaradi (10 daqiqalik, soatiga 3 marta).
// ================================================================
void alarmniTekshir() {
  if (kritikDo_x10 <= 0 || telRaqam[0] == '\0') return;
  if (doXato || !doAktivmi) return;     // DO yo'q bo'lsa solishtirmaymiz

  if (do_x10 < kritikDo_x10) {
    if (!alarmFaol) {
      // ----- YANGI ALARM EPIZODI -----
      DateTime now = rtc.now();
      alarmFaol   = true;
      alarmTasdiq = false;

      char msg[SMS_MAX_UZUN];
      snprintf(msg, sizeof(msg),
        "KRITIK! DO=%d.%d<%d.%d mg/L %02d:%02d Aerator:%s",
        do_x10 / 10, do_x10 % 10, kritikDo_x10 / 10, kritikDo_x10 % 10,
        now.hour(), now.minute(), releHolati ? "ON" : "OFF");
      smsNavbatgaQosh(msg);     // 1) avval SMS
      qongiroqSorov(false);     // 2) keyin qo'ng'iroq

      alarmQongSoat   = now.hour();
      alarmQongSoni   = 1;
      alarmOxirgiQong = millis();
    }
    // alarmFaol bo'lsa: qayta qo'ng'iroqni alarmQaytaQong() boshqaradi
  }
  else if (do_x10 >= kritikDo_x10 + ALARM_REARM_OFFSET_X10) {
    if (alarmFaol) {
      // ----- TIKLANDI -----
      DateTime now = rtc.now();
      alarmFaol   = false;
      alarmTasdiq = false;
      char msg[SMS_MAX_UZUN];
      snprintf(msg, sizeof(msg),
        "Normaga qaytdi. DO=%d.%d mg/L %02d:%02d",
        do_x10 / 10, do_x10 % 10, now.hour(), now.minute());
      smsNavbatgaQosh(msg);
    }
  }
}

// ================================================================
//  QAYTA QO'NG'IROQ — har loop'da, taymer bilan (o'lchov oynasiga bog'liq emas)
//  Har 10 daqiqada, soatiga maksimum 3 marta, fermer javob bermaguncha.
// ================================================================
void alarmQaytaQong() {
  if (!alarmFaol || alarmTasdiq) return;
  if (telRaqam[0] == '\0' || kritikDo_x10 <= 0) return;
  if (!taymerOtdimi(alarmOxirgiQong, ALARM_QONG_ORALIQ_MS)) return;

  uint8_t soat = rtc.now().hour();
  if (soat != alarmQongSoat) {        // soat almashdi -> hisob yangilanadi
    alarmQongSoat = soat;
    alarmQongSoni = 0;
  }
  alarmOxirgiQong = millis();         // keyingi 10 daqiqani qayta boshlash
  if (alarmQongSoni < ALARM_MAX_QONG_SOAT) {
    qongiroqSorov(false);
    alarmQongSoni++;
  }
}

// ================================================================
//  SENSOR NOSOZLIGI XABARI — DO sensor o'lsa bir marta SMS
// ================================================================
void sensorNosozTekshir() {
  if (aeratsiyaRejimi != REJIM_KISLOROD) return;
  if (telRaqam[0] == '\0') return;
  // !doAktivmi = tasdiqlangan nosozlik (retry paytida ham false bo'lib qolmaydi)
  if (!doAktivmi && !sensorNosozXabar) {
    DateTime now = rtc.now();
    char msg[SMS_MAX_UZUN];
    snprintf(msg, sizeof(msg),
      "DIQQAT! DO sensor nosoz %02d:%02d. Aerator avto-ON.",
      now.hour(), now.minute());
    smsNavbatgaQosh(msg);
    sensorNosozXabar = true;
  }
  // tiklanish bayrog'i readSensorDataSmart ichida (muvaffaqiyatli o'qishda) tozalanadi
}

// ================================================================
//  SOATLIK HOLAT SMS — xotiraga yozilgandan keyin chaqiriladi
// ================================================================
void soatlikSmsTekshir(const DateTime& now) {
  if (aeratsiyaRejimi != REJIM_KISLOROD) return;
  if (telRaqam[0] == '\0') return;
  if (doXato || !doAktivmi) return;
  uint16_t kalit = yozuvKalitHisopla(now.month(), now.day(), now.hour());
  if (kalit == oxirgiSmsKaliti) return;
  oxirgiSmsKaliti = kalit;

  char msg[SMS_MAX_UZUN];
  if (!phXato && phAktivmi) {
    snprintf(msg, sizeof(msg),
      "Aqua %02d/%02d %02d:%02d DO=%d.%d T=%d.%d pH=%d.%d Aer:%s",
      now.month(), now.day(), now.hour(), now.minute(),
      do_x10/10, do_x10%10, t_x10/10, t_x10%10, ph_x10/10, ph_x10%10,
      releHolati ? "ON" : "OFF");
  } else {
    snprintf(msg, sizeof(msg),
      "Aqua %02d/%02d %02d:%02d DO=%d.%d T=%d.%d Aer:%s",
      now.month(), now.day(), now.hour(), now.minute(),
      do_x10/10, do_x10%10, t_x10/10, t_x10%10,
      releHolati ? "ON" : "OFF");
  }
  smsNavbatgaQosh(msg);
}

// ================================================================
//  LCD SIGNAL KO'RSATKICHI (14-15 katak): antenna + 0..4 panjara
// ================================================================
void simSignalCharlarYarat() {
  uint8_t antenna[8] = {0b00100,0b01110,0b10101,0b00100,0b00100,0b00100,0b01110,0b00000};
  uint8_t s0[8] = {0,0,0,0,0,0,0,0b10101};                         // signal yo'q
  uint8_t s1[8] = {0,0,0,0,0,0,0b11111,0b11111};                   // 1
  uint8_t s2[8] = {0,0,0,0,0b11111,0b11111,0b11111,0b11111};       // 2
  uint8_t s3[8] = {0,0,0b11111,0b11111,0b11111,0b11111,0b11111,0b11111}; // 3
  uint8_t s4[8] = {0b11111,0b11111,0b11111,0b11111,0b11111,0b11111,0b11111,0b11111}; // 4
  lcd.createChar(0, antenna);
  lcd.createChar(1, s0);
  lcd.createChar(2, s1);
  lcd.createChar(3, s2);
  lcd.createChar(4, s3);
  lcd.createChar(5, s4);
}

void signalniLCDgaChiz() {
  if (wifiPortalAktiv) return;
  if (joriyRejimKiritish != ' ') return;
  if (!boshlangichRejimda && aeratsiyaRejimi == REJIM_KISLOROD &&
      tsikilRejim == TSIKL_UXLASH) return;

  uint8_t bar;
  if (!simTayyormi || simSignal == 99 || simSignal == 0) bar = 0;
  else if (simSignal <= 5)  bar = 1;
  else if (simSignal <= 10) bar = 2;
  else if (simSignal <= 15) bar = 3;
  else                      bar = 4;

  lcd.setCursor(14, 1);
  lcd.write((uint8_t)0);              // antenna
  lcd.write((uint8_t)(1 + bar));      // panjara (1=0bar ... 5=4bar)
}

// ================================================================
//  TELEFON RAQAMI KIRITISHNI OCHISH (R tugmasi, KISLOROD rejimi)
// ================================================================
void telRaqamKiritishOch() {
  joriyRejimKiritish = 'P';
  inputLen = 0; inputText[0] = '\0';
  lcd.clear();
  lcd.setCursor(0, 0);
  if (telRaqam[0] != '\0') lcd.print("Eski raqam:     ");
  else                     lcd.print("Tel(9 raqam):   ");
  lcd.setCursor(0, 1);
  if (telRaqam[0] != '\0') lcd.print(telRaqam);   // +998... (13 belgi, sig'adi)
  else                     lcd.print("+998_________   ");
  lcd.setCursor(0, 1);
}

// ================================================================
//  QURILMA ID — ESP32 chip ID dan (o'zgarmas, har chipda noyob)
//  Masalan: "AQ7F8A2C". Simkarta almashsa ham o'zgarmaydi.
// ================================================================
void deviceIdYarat() {
  uint64_t mac = ESP.getEfuseMac();
  uint32_t low = (uint32_t)(mac & 0xFFFFFFUL);   // oxirgi 24 bit
  snprintf(deviceId, sizeof(deviceId), "AQ%06X", (unsigned)low);
}

// ================================================================
//  TELEMETRIYA JSON — ThingsBoard uchun
// ================================================================
void telemetriyaTayyorla() {
  int rele = releHolati ? 1 : 0;
  if (!phXato && phAktivmi) {
    snprintf(telemetriyaBuf, sizeof(telemetriyaBuf),
      "{\"id\":\"%s\",\"do\":%d.%d,\"ph\":%d.%d,\"t\":%d.%d,\"aer\":%d}",
      deviceId, do_x10 / 10, do_x10 % 10, ph_x10 / 10, ph_x10 % 10,
      t_x10 / 10, t_x10 % 10, rele);
  } else {
    snprintf(telemetriyaBuf, sizeof(telemetriyaBuf),
      "{\"id\":\"%s\",\"do\":%d.%d,\"t\":%d.%d,\"aer\":%d}",
      deviceId, do_x10 / 10, do_x10 % 10, t_x10 / 10, t_x10 % 10, rele);
  }
}

// ================================================================
//  KIRUVCHI SMS BUYRUG'I — ikki tomonlama boshqaruv (lahzali, ishonchli)
//  Qabul qilinadigan buyruqlar (katta-kichik harf farqsiz):
//    AERATOR ON     -> aeratorni majburan yoqadi
//    AERATOR AUTO   -> avtomatik rejimga qaytaradi (OFF ham shu)
//    MINDO <n>      -> minimal DO (1..20 mg/L)
//    FARQ <n>       -> farq (1..10 mg/L)
//    KRITIK <n>     -> kritik DO / qo'ng'iroq chegarasi (1..20)
//    HOLAT          -> joriy holatni SMS bilan qaytaradi
//  Javoblar saqlangan fermer raqamiga (telRaqam) yuboriladi.
// ================================================================
void smsBuyruqniQolla(const char* matn) {
  char m[64];
  uint8_t i = 0;
  for (; matn[i] && i < sizeof(m) - 1; i++) m[i] = (char)toupper((unsigned char)matn[i]);
  m[i] = '\0';

  char* pos;
  if (strstr(m, "AERATOR ON")) {
    qolReleYoq = true;
    smsNavbatgaQosh("Aerator: QO'LDA YONIQ");
  } else if (strstr(m, "AERATOR AUTO") || strstr(m, "AERATOR OFF")) {
    qolReleYoq = false;
    smsNavbatgaQosh("Aerator: AVTO rejim");
  } else if ((pos = strstr(m, "MINDO")) != NULL) {
    int v = atoi(pos + 5);
    if (v >= 1 && v <= 20) {
      minDo_x10 = (int16_t)(v * 10);
      prefs.putShort("minDo", minDo_x10);
      smsNavbatgaQosh("Min DO o'rnatildi");
    }
  } else if ((pos = strstr(m, "FARQ")) != NULL) {
    int v = atoi(pos + 4);
    if (v >= 1 && v <= 10) {
      farqDo_x10 = (int16_t)(v * 10);
      prefs.putShort("farqDo", farqDo_x10);
      smsNavbatgaQosh("Farq o'rnatildi");
    }
  } else if ((pos = strstr(m, "KRITIK")) != NULL) {
    int v = atoi(pos + 6);
    if (v >= 1 && v <= 20) {
      kritikDo_x10 = (int16_t)(v * 10);
      prefs.putShort("kritikDo", kritikDo_x10);
      alarmFaol = false; alarmTasdiq = false;
      smsNavbatgaQosh("Kritik DO o'rnatildi");
    }
  } else if (strstr(m, "HOLAT")) {
    char r[SMS_MAX_UZUN];
    snprintf(r, sizeof(r), "%s DO=%d.%d pH=%d.%d T=%d.%d Aer:%s",
      deviceId, do_x10 / 10, do_x10 % 10, ph_x10 / 10, ph_x10 % 10,
      t_x10 / 10, t_x10 % 10, releHolati ? "ON" : "OFF");
    smsNavbatgaQosh(r);
  }
  // notanish buyruqqa javob bermaymiz
}

// ================================================================
//  WiFi ORQALI TELEMETRIYA (ESP32 HTTPClient — tez, AT'siz)
//  Qisqa timeout + WDT reset: loop'ni uzoq bloklamaydi.
// ================================================================
bool wifiBilanYubor() {
  if (WiFi.status() != WL_CONNECTED) return false;
  char url[224];
  if (FB_AUTH[0] != '\0')
    snprintf(url, sizeof(url),
      "https://%s/smartlake/devices/%s/telemetry.json?auth=%s", FB_HOST, deviceId, FB_AUTH);
  else
    snprintf(url, sizeof(url),
      "https://%s/smartlake/devices/%s/telemetry.json", FB_HOST, deviceId);

  WiFiClientSecure client;
  client.setInsecure();              // sertifikat tekshiruvisiz (telemetriya uchun yetarli)
  HTTPClient http;
  http.setConnectTimeout(5000);
  http.setTimeout(6000);
  esp_task_wdt_reset();
  if (!http.begin(client, url)) { esp_task_wdt_reset(); return false; }
  http.addHeader("Content-Type", "application/json");
  int code = http.PUT((uint8_t*)telemetriyaBuf, strlen(telemetriyaBuf));  // RTDB: PUT = ustiga yozish
  http.end();
  esp_task_wdt_reset();
  return (code == 200 || code == 201);
}

// ================================================================
//  WiFi SOZLASH PORTALI (111T) — non-blocking, sanoatga mos
//  Qurilma vaqtincha "AquaMonitor-WiFi" nuqtasi bo'ladi; fermer
//  telefonidan ulanib, o'z WiFi'sini tanlab parol kiritadi. Saqlanadi.
//  Portal davomida rele/sensor ishlab turaveradi (faqat LCD band bo'ladi).
// ================================================================
void wifiPortalBoshla() {
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("WiFi sozlash... ");
  lcd.setCursor(0, 1); lcd.print("Tel:AquaMonitor ");
  wm.setConfigPortalBlocking(false);     // MUHIM: loop'ni bloklamasin
  wm.setConfigPortalTimeout(180);        // 3 daqiqada o'zi yopiladi
  wm.startConfigPortal("AquaMonitor-WiFi");
  wifiPortalAktiv = true;
  wifiPortalBosh  = millis();
}

// ================================================================
//  SETUP
//  [BUG #2 TUZATILDI]: WDT initsializatsiyasi Arduino core 2.x/3.x
//  bilan mos keluvchi usulga o'tkazildi.
//  esp_task_wdt_reconfigure() faqat core 3.x da mavjud.
//  Ikkala versiyada ishlaydigan usul: avval deinit, keyin init.
// ================================================================
void setup() {
  // WDT: 10 soniya timeout — Arduino ESP32 core 2.x va 3.x bilan mos
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  // Core 3.x usuli
  esp_task_wdt_config_t wdt_config = {
    .timeout_ms     = 10000,
    .idle_core_mask = 0,
    .trigger_panic  = true
  };
  esp_task_wdt_reconfigure(&wdt_config);
#else
  // Core 2.x usuli
  esp_task_wdt_init(10, true);   // 10 soniya, panic = true
#endif
  esp_task_wdt_add(NULL);

  Serial.begin(115200);

  deviceIdYarat();                       // qurilma ID (chip ID dan, o'zgarmas)
  internetYoqilgan = (FB_HOST[0] != '\0');

  // WiFi: saqlangan parol bilan fonda ulanadi (kutmaymiz — non-blocking)
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin();                          // oldin saqlangan tarmoqqa avto-ulanish

  pinMode(RS485_DE,  OUTPUT); digitalWrite(RS485_DE,  LOW);
  pinMode(RELE_PIN,  OUTPUT); digitalWrite(RELE_PIN,  LOW);

  modbusSerial.begin(9600, SERIAL_8N1, MODBUS_RX, MODBUS_TX);
  node.preTransmission(preTransmission);
  node.postTransmission(postTransmission);
  node.begin(1, modbusSerial);

  Wire.begin(21, 22);
  Wire.setClock(100000);   // 100 kHz — uzun kabel/shovqinga chidamliroq
  Wire.setTimeOut(50);     // I2C osilib qolsa 50ms da chiqadi (WDT trip oldini oladi)
  lcd.init();
  lcd.backlight();
  simSignalCharlarYarat();         // antenna + signal panjara belgilarini yuklash
  esp_task_wdt_reset();

  // RTC: bir necha marta urinib ko'ramiz (boot paytidagi vaqtinchalik
  // I2C shovqini tufayli noto'g'ri "yo'q" deb hisoblamaslik uchun)
  bool rtcOk = false;
  for (uint8_t i = 0; i < 5; i++) {
    esp_task_wdt_reset();
    if (rtc.begin()) { rtcOk = true; break; }
    delay(200);
    esp_task_wdt_reset();
  }
  if (!rtcOk) {
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("RTC topilmadi!  ");
    lcd.setCursor(0, 1); lcd.print("Ulanishni tekshir");
    while (1) { esp_task_wdt_reset(); delay(1000); }
  }
  esp_task_wdt_reset();

  prefsTekshir();
  esp_task_wdt_reset();

  simBoshlash();                   // SIM800L UART/RST/holatlarini ishga tushirish
  esp_task_wdt_reset();

  lcd.clear();
  datchikBoshlanishTekshir();
  esp_task_wdt_reset();

  unsigned long t = millis();

  // Boshlang'ich 1 soat rejimi
  boshlangichRejimda    = true;
  boshlangichBosh       = t;
  tsikilRejim           = TSIKL_ISHLASH;
  oxirgiYozuvKaliti     = 0xFFFF;
  qaysiSensorNavbati    = 1;

  lastMeasureTime       = t;
  lastEkranVaqti        = t;
  lastDoCheckTime       = t;
  lastPhCheckTime       = t;
  releOzgarishVaqti     = t;
  lastUxlashEkranVaqti  = t;
  lastTsikilTekshir     = 0;  // darhol birinchi tekshiruv
  lastTelemetriya       = t;  // birinchi telemetriya TELEMETRY_MS dan keyin
  qolReleYoq            = false;

  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("ID: ");
  lcd.print(deviceId);
  lcd.setCursor(0, 1);
  lcd.print(internetYoqilgan ? "Internet: HA    " : "Internet: SMS   ");
  esp_task_wdt_reset();
  delay(2000);
  esp_task_wdt_reset();

  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("BOSHLANGICH: 1s ");
  lcd.setCursor(0, 1); lcd.print("Doim ishlaydi   ");
  esp_task_wdt_reset();
  delay(1500);
  esp_task_wdt_reset();
  delay(500);
  esp_task_wdt_reset();
  lcd.clear();
  esp_task_wdt_reset();
}

// ================================================================
//  LOOP
// ================================================================
void loop() {
  esp_task_wdt_reset();
  nonBlockTekshir();

  // Tsikl va xotira — RTC asosida 5 soniyada bir yangilanadi
  tsikilniYangilash();

  char key = keypad.getKey();
  if (key && !nonBlockAktiv && !wifiPortalAktiv) klaviaturaBoshqar(key);

  // ---- GSM: har loop'da, hech narsani bloklamasdan ----
  simYangilash();        // SIM holat mashinasi (SMS/qo'ng'iroq/signal)
  alarmQaytaQong();      // 10 daqiqalik qayta qo'ng'iroq (soatiga max 3)
  sensorNosozTekshir();  // DO sensor o'lsa bir marta SMS

  // ---- Telemetriya rejasi: WiFi BIRINCHI, SIM ZAXIRA ----
  // Har TELEMETRY_MS: WiFi ulangan bo'lsa WiFi orqali yuboradi; bo'lmasa
  // SIM800L (GPRS) orqali yuborishni so'raydi. Ikkalasi ham yo'q bo'lsa
  // o'tkazib yuboradi (soatlik tarix baribir NVS'da saqlanadi).
  if (internetYoqilgan && taymerOtdimi(lastTelemetriya, TELEMETRY_MS)) {
    lastTelemetriya = millis();
    telemetriyaTayyorla();
    bool yuborildi = false;
    if (WiFi.status() == WL_CONNECTED) yuborildi = wifiBilanYubor();
    if (!yuborildi && simTayyormi && FB_SIM_RELAY[0] != '\0') simTelemSora = true;
  }

  // ---- WiFi sozlash portali (111T orqali ochiladi) — non-blocking ----
  if (wifiPortalAktiv) {
    wm.process();
    if (WiFi.status() == WL_CONNECTED || taymerOtdimi(wifiPortalBosh, 185000UL)) {
      wm.stopConfigPortal();
      wifiPortalAktiv = false;
      nonBlockXabar(WiFi.status() == WL_CONNECTED ? "WiFi ulandi!    "
                                                  : "WiFi vaqt tugadi", 2000);
    }
  }

  // ---- Uzun T (bo'sh holatda 3s ushlab tursa) -> TEST SMS + qo'ng'iroq ----
  if (tBosildi) {
    if (keypad.isPressed('T')) {
      if (taymerOtdimi(tBoshVaqti, T_UZUN_MS)) {
        tBosildi = false;
        if (telRaqam[0] == '\0') {
          nonBlockXabar("Tel raqam yo'q! ", 2000);
        } else {
          DateTime now = rtc.now();
          char msg[SMS_MAX_UZUN];
          snprintf(msg, sizeof(msg),
            "TEST: Aqua Monitor ishlamoqda %02d:%02d", now.hour(), now.minute());
          smsNavbatgaQosh(msg);
          qongiroqSorov(true);
          nonBlockXabar("TEST yuborildi  ", 2000);
        }
      }
    } else {
      tBosildi = false;   // 3s dan oldin qo'yib yuborildi -> bekor
    }
  }

  // [BUG #3 TUZATILDI]: Sensor qayta urinishda xato bayroqlari ham tozalanadi
  // SENSOR_RETRY_MS = 5 daqiqa (avval 1 soat edi)
  if (!doAktivmi && taymerOtdimi(lastDoCheckTime, SENSOR_RETRY_MS)) {
    lastDoCheckTime = millis();
    doAktivmi = true;
    doXato    = false;  // [BUG #3]: Bu satr qo'shildi
  }
  if (!phAktivmi && taymerOtdimi(lastPhCheckTime, SENSOR_RETRY_MS)) {
    lastPhCheckTime = millis();
    phAktivmi = true;
    phXato    = false;  // [BUG #3]: Bu satr qo'shildi
  }

  if (!isCalibrating && joriyRejimKiritish == ' ' && !nonBlockAktiv) {

    // Sensor o'qish
    if (taymerOtdimi(lastMeasureTime, SENSOR_INTERVAL_MS)) {
      lastMeasureTime = millis();
      if (sensorOqishKerakmi() || aeratsiyaRejimi == REJIM_VAQT) {
        readSensorDataSmart();
        if (aeratsiyaRejimi == REJIM_KISLOROD) alarmniTekshir();
      }
    }

    // Ekran va rele yangilash
    if (taymerOtdimi(lastEkranVaqti, EKRAN_INTERVAL_MS)) {
      lastEkranVaqti = millis();
      ekranniYangilash();
      showClock();
      signalniLCDgaChiz();     // antenna + signal panjarasi (14-15 katak)
      boshqarishRele();
    }

    // Uxlash ekrani
    uxlashEkrani();
  }
}
