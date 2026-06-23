# 🐟 Smart Lake — Baliq ko'llari monitoringi

ESP32 qurilmasi → **Firebase** (markaziy baza) → **Vercel** (sayt) ko'rinishidagi
to'liq tizim. Kod **GitHub**'da turadi.

Tizim 3 qismdan iborat:

| Qism | Fayl | Vazifasi |
|------|------|----------|
| Qurilma dasturi | `firmware/aqua_monitor_esp32.ino` | Sensorlarni o'qiydi, aeratorni boshqaradi, telemetriyani Firebase'ga yuboradi |
| Fermer paneli | `public/fermer.html` | Ko'llarni kuzatish (kislorod, harorat, pH, tarix) |
| Admin paneli | `public/admin.html` | Qurilma/fermer/viloyatlarni boshqarish |

> **Muhim:** Firebase kalitlari kiritilmaguncha saytlar **lokal rejimda** (faqat shu
> brauzerda, `localStorage`) ishlayveradi — hech narsa buzilmaydi. Firebase'ni
> ulagandan keyin ma'lumotlar barcha qurilmalar orasida real vaqtda bo'lishiladi.

---

## 📂 Loyiha tuzilishi

```
smartlake/
├── public/                     ← Vercel shu papkani sayt qiladi
│   ├── index.html              ← kirish sahifasi (admin/fermer havolalari)
│   ├── admin.html              ← admin paneli
│   ├── fermer.html             ← fermer paneli
│   ├── firebase-config.js      ← BU YERGA Firebase kalitlaringizni yozasiz
│   └── cloud-sync.js           ← localStorage ↔ Firebase sinxronizatsiyasi
├── firmware/
│   └── aqua_monitor_esp32.ino  ← ESP32 dasturi
├── database.rules.json         ← Firebase xavfsizlik qoidalari
├── firebase.json               ← Firebase CLI sozlamasi
├── vercel.json                 ← Vercel sozlamasi
├── package.json
└── README.md                   ← shu fayl
```

---

## 1️⃣ Firebase — markaziy bazani tayyorlash

### 1.1. Loyiha yaratish
1. https://console.firebase.google.com/ ga kiring.
2. **Add project** → loyiha nomi (masalan `smartlake`) → **Continue**.
3. Google Analytics'ni **o'chirib** qo'ysangiz ham bo'ladi → **Create project**.

### 1.2. Realtime Database yoqish
1. Chap menyuda **Build → Realtime Database** → **Create Database**.
2. Hudud (location) tanlang (masalan *Belgium / europe-west1*).
3. **Start in test mode** ni tanlang → **Enable**.
4. Hosil bo'lgan URL'ni eslab qoling, masalan:
   `https://smartlake-1234-default-rtdb.europe-west1.firebasedatabase.app`

### 1.3. Web ilova kalitlarini olish
1. Chap menyuda ⚙️ **Project settings** → pastga tushib **Your apps** bo'limi.
2. **`</>`** (Web) belgisini bosing → ilovaga nom bering → **Register app**.
3. Ko'rsatilgan `firebaseConfig` qiymatlarini nusxalang. U shunga o'xshaydi:

   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "smartlake-1234.firebaseapp.com",
     databaseURL: "https://smartlake-1234-default-rtdb.europe-west1.firebasedatabase.app",
     projectId: "smartlake-1234",
     storageBucket: "smartlake-1234.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef"
   };
   ```

### 1.4. Kalitlarni saytga kiritish
`public/firebase-config.js` faylini oching va `PASTE_...` o'rinlariga yuqoridagi
qiymatlarni qo'ying. `databaseURL` to'g'ri yozilganiga ishonch hosil qiling.

> Bu kalitlar maxfiy emas — ular brauzerda ochiq turadi. Haqiqiy himoya
> `database.rules.json` qoidalari orqali beriladi (4-bo'lim).

---

## 2️⃣ GitHub — kodni yuklash

1. https://github.com/ → **New repository** → nom bering (masalan `smartlake`) →
   **Private** yoki **Public** tanlang → **Create repository**.
2. Kompyuteringizda loyiha papkasida terminal oching va quyidagilarni bajaring
   (`SIZNING-NOMINGIZ` ni o'z GitHub nomingizga almashtiring):

   ```bash
   git init
   git add .
   git commit -m "Smart Lake: dastlabki versiya"
   git branch -M main
   git remote add origin https://github.com/SIZNING-NOMINGIZ/smartlake.git
   git push -u origin main
   ```

> Git o'rnatilmagan bo'lsa: https://git-scm.com/downloads dan yuklang. Yoki
> GitHub saytida **Add file → Upload files** orqali papkani qo'lda ham yuklash
> mumkin.

---

## 3️⃣ Vercel — saytni internetga chiqarish

1. https://vercel.com/ ga **GitHub** akkaunti bilan kiring.
2. **Add New… → Project** → GitHub'dagi `smartlake` repozitoriyasini **Import**.
3. Sozlamalarni quyidagicha qoldiring:
   - **Framework Preset:** *Other*
   - **Root Directory:** `./` (o'zgartirmang)
   - **Output Directory:** `public` (`vercel.json`da allaqachon ko'rsatilgan)
   - Build buyrug'i **kerak emas** (sof statik sayt).
4. **Deploy** ni bosing. Bir necha soniyada sayt tayyor bo'ladi, masalan:
   `https://smartlake.vercel.app`

   - Fermer paneli: `https://smartlake.vercel.app/fermer`
   - Admin paneli:  `https://smartlake.vercel.app/admin`

> Bundan keyin GitHub'ga har `git push` qilganingizda Vercel saytni avtomatik
> yangilaydi.

---

## 4️⃣ Firebase xavfsizlik qoidalari (tavsiya etiladi)

Test rejimi 30 kundan keyin yopiladi. Doimiy ishlashi uchun qoidalarni
o'rnating. Eng oson yo'l — Firebase Console orqali:

1. **Realtime Database → Rules** bo'limiga o'ting.
2. `database.rules.json` fayl mazmunini nusxalab, o'sha yerga qo'ying → **Publish**.

Yoki Firebase CLI orqali (kompyuterda):
```bash
npm install -g firebase-tools
firebase login
firebase use --add        # loyihangizni tanlang
firebase deploy --only database
```

> ⚠️ Berilgan qoidalar **ochiq** (hamma o'qiy/yoza oladi) — tez ishga tushirish
> uchun. Jiddiy foydalanish uchun keyinchalik **Firebase Authentication** qo'shib,
> qoidalarni foydalanuvchiga bog'lash tavsiya etiladi (8-bo'lim).

---

## 5️⃣ ESP32 qurilmasini sozlash

`firmware/aqua_monitor_esp32.ino` faylini **Arduino IDE**'da oching.

### 5.1. Kerakli kutubxonalar (Library Manager)
`Wire`, `Keypad`, `LiquidCrystal_I2C`, `ModbusMaster`, `RTClib`,
`Preferences`, `WiFi`, `HTTPClient`, `WiFiManager` (tzapu/WiFiManager).

### 5.2. Firebase manzilini kiritish
Fayl boshidagi sozlamalar bo'limida (`INTERNET SOZLAMALARI`):

```cpp
static const char* FB_HOST = "smartlake-1234-default-rtdb.europe-west1.firebasedatabase.app";
//  ↑ RTDB host. "https://" YOZMANG, faqat host qismi.
static const char* FB_AUTH = "";   // qoidalar ochiq bo'lsa bo'sh qoldiring
```

> `FB_AUTH` — agar qoidalarni maxfiy kalit bilan himoyalasangiz kerak bo'ladi
> (RTDB **Database secret**: ⚙️ Project settings → Service accounts → Database
> secrets). Hozircha bo'sh qoldirsangiz ham ishlaydi.

### 5.3. WiFi ulash
Qurilma yuklangach, bo'sh ekranda **`1 1 1 T`** bosing — telefoningizdan
`AquaMonitor-WiFi` nuqtasiga ulanib, o'z WiFi'ingizni tanlab parol kiriting.
Saqlangach qurilma avtomatik ulanadi va har 5 daqiqada Firebase'ga telemetriya
yuboradi.

### 5.4. Telemetriya formati
Qurilma `smartlake/devices/<QURILMA_ID>/telemetry` yo'liga shu JSON'ni yozadi:

```json
{ "id": "AQ7F8A2C", "do": 6.2, "ph": 7.1, "t": 24.5, "aer": 1 }
```
`QURILMA_ID` — ESP32 chip ID'sidan avtomatik hosil bo'ladi (o'zgarmas).

> **Eslatma (SIM800L):** Firebase HTTPS talab qiladi; SIM800L HTTPS'ni ishonchli
> qo'llab-quvvatlamaydi. Shuning uchun WiFi — asosiy yo'l. SIM orqali ham
> yubormoqchi bo'lsangiz, `FB_SIM_RELAY` ga oddiy HTTP→Firebase relay (masalan
> Cloud Function) manzilini bering. Bo'sh bo'lsa SIM telemetriyasi o'chiq, ammo
> SMS/qo'ng'iroq signalizatsiyasi baribir ishlayveradi.

---

## 6️⃣ Sinab ko'rish (lokal)

Firebase'ni ulamasdan ham saytni kompyuterda ochib ko'rishingiz mumkin:

```bash
npx serve public
# yoki shunchaki public/index.html ni brauzerda oching
```

**Standart kirish (admin paneli, demo):**

| Login | Parol | Rol |
|-------|-------|-----|
| `superadmin` | `1234` | Bosh admin |
| `operator` | `1234` | Operator |
| `region` | `1234` | Viloyat menejeri |
| `support` | `1234` | Yordam xizmati |

> ⚠️ Ishga tushirishdan oldin bu parollarni albatta o'zgartiring.

---

## 7️⃣ Tizim qanday ishlaydi (qisqacha)

```
   ESP32  ──HTTPS PUT──▶  Firebase RTDB  ◀──real-time──  Fermer/Admin sayt (Vercel)
 (sensor,                  smartlake/                      (localStorage ↔ bulut)
  aerator)                  ├─ devices/<id>/telemetry
                            ├─ fermer/data/...
                            └─ admin/data/...
```

- Sayt avval lokal `localStorage`'dan o'qiydi (tez ochiladi), keyin Firebase bilan
  sinxronlanadi. Boshqa qurilmada o'zgarish bo'lsa, sahifa avtomatik yangilanadi.
- Qurilma telemetriyasi `smartlake/devices/<id>` ga tushadi.

### Fizik qurilmani ko'lga bog'lash (ixtiyoriy kengaytma)
`cloud-sync.js` ichidagi yordamchi orqali real qurilma ma'lumotini ko'l kartasiga
ulashingiz mumkin:

```js
SmartLakeDevices.subscribe('AQ7F8A2C', function (t) {
  // t.do, t.ph, t.t, t.aer — shu yerda ko'l kartasiga yozing
});
```

---

## 8️⃣ Keyingi qadamlar (xavfsizlik)

Jiddiy foydalanish uchun:
1. **Firebase Authentication** yoqing (Email/Parol).
2. `database.rules.json` ni `auth != null` shartiga moslang.
3. Saytdagi login'ni Firebase Auth bilan bog'lang.
4. Demo parollarni o'zgartiring.

---

## ❓ Tez-tez uchraydigan muammolar

| Muammo | Yechim |
|--------|--------|
| Sayt ochiladi, lekin ma'lumot bulutga bormayapti | `firebase-config.js` to'ldirilmagan yoki `databaseURL` xato. Brauzer konsolida (F12) `[SmartLake]` xabarlarini ko'ring |
| `Permission denied` | RTDB qoidalari yopiq — `database.rules.json` ni Publish qiling |
| ESP32 internetga chiqmayapti | `FB_HOST` "https://" siz yozilganini va WiFi ulanganini tekshiring |
| Vercel 404 beradi | Output Directory `public` ekanini tekshiring (`vercel.json`da bor) |
| SIM orqali telemetriya yo'q | Bu kutilgan holat — SIM800L Firebase HTTPS'ni qo'llamaydi, WiFi ishlating |

---

Savollar bo'lsa — kodga qo'shilgan o'zbekcha izohlar ham yordam beradi. Omad! 🚀
