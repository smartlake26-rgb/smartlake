# Smart Lake — Fermer ilovasi (Firebase versiyasi)

Baliq ko'llari uchun real-time monitoring tizimi.

```
[LoRa Sensor NODE] --433MHz--> [Gateway ESP32] --WiFi--> [Firebase] --> [Web ilova (Vercel)]
                                       <----------- buyruqlar (aeratsiya) -----------
```

Ko'rsatadigan ma'lumot: kislorod (DO), pH, harorat, LoRa signal sifati, yem
hisoblagichi, biomassa, ob-havo. Web ilova jonli ma'lumotni Firebase'dan o'qiydi;
qurilma hali ulanmagan ko'llar uchun **demo (namuna)** rejimida ishlaydi.

> Ekran pastida kichik belgi turadi: 🟢 **Firebase** = ulandi, ⚪ **Demo** = namuna.
> Har bir ko'l alohida: agar shu ko'lning qurilmasi (AQxxxxxx) so'nggi 15 daqiqada
> ma'lumot yuborgan bo'lsa — REAL qiymat, aks holda — simulyatsiya ko'rsatiladi.

---

## Fayllar

| Fayl | Vazifasi |
|---|---|
| `index.html` | Web ilova (fermer paneli) — Vercel'ga joylanadi |
| `firebase-config.js` | Firebase ulanish kalitlari — **siz to'ldirasiz** |
| `database.rules.json` | Firebase xavfsizlik qoidalari |
| `vercel.json`, `.gitignore` | Vercel/GitHub yordamchi fayllari |
| `firmware/aqua_gateway_firebase.ino` | Gateway (ESP32) kodi — qurilmaga flesh qilinadi |

---

## 1-qadam — Firebase loyihasini yaratish

1. https://console.firebase.google.com → **Add project** → nom: `smart-lake` → yarating
   (Google Analytics'ni o'chirib qo'ysangiz ham bo'ladi).
2. Chap menyu **Build → Realtime Database** → **Create Database**:
   - Joylashuv: yaqinini tanlang (masalan, *europe-west1*).
   - **Start in locked mode** → Enable.
   - Ochilgan sahifa tepasidagi havolani nusxa oling — bu sizning
     **databaseURL** (`https://smart-lake-XXXX-default-rtdb.firebaseio.com`).
3. Chap menyu **Build → Authentication** → **Get started**:
   - **Sign-in method** bo'limida ikkitasini **Enable** qiling:
     - **Anonymous** (web ilova o'qishi uchun)
     - **Email/Password** (gateway yozishi uchun)
   - **Users** bo'limiga o'ting → **Add user**:
     - Email: `device@smartlake.local` (xohlagan email)
     - Parol: kuchli parol o'ylab toping (gateway'ga shu kerak bo'ladi).
     - Bu gateway'ning Firebase'ga kirish "qurilma akkaunti".

---

## 2-qadam — Web ilova kalitlarini olish (firebase-config.js)

1. Firebase Console → ⚙️ (**Project settings**) → pastda **Your apps** →
   **Web (</>)** belgisini bosing → ilovaga nom bering → **Register app**.
2. Chiqqan `firebaseConfig` qiymatlarini ko'chiring.
3. Shu papkadagi **`firebase-config.js`** faylini oching va `XXXX` joylarini
   o'zingizning qiymatlaringiz bilan to'liq almashtiring (`databaseURL` ni ham).

---

## 3-qadam — Xavfsizlik qoidalarini o'rnatish

1. Firebase Console → **Realtime Database** → yuqorida **Rules** tab.
2. Shu papkadagi **`database.rules.json`** ichidagi matnni to'liq nusxalab,
   o'sha oynaga joylang → **Publish**.

> Bu qoidalar: faqat tizimga kirgan (auth) foydalanuvchilar o'qiy/yoza oladi.
> Anonim web foydalanuvchilar va gateway akkaunti shu shartga to'g'ri keladi.
> Keyinchalik yanada qattiqlashtirmoqchi bo'lsangiz — yozishni faqat qurilma
> UID'siga cheklash mumkin (aytib bering, ko'rsataman).

---

## 4-qadam — Gateway'ni Firebase'ga moslash (ESP32)

1. **Arduino IDE** → *Tools → Manage Libraries* dan o'rnating:
   - **Firebase Arduino Client Library for ESP8266 and ESP32** (muallif: *mobizt*)
   - **RadioLib** (jgromes), **ArduinoJson** (bblanchon), **WiFiManager** (tzapu),
     **LiquidCrystal_I2C** (ixtiyoriy)
2. `firmware/aqua_gateway_firebase.ino` ni oching → ESP32 board tanlang → **Upload**.
3. Birinchi yoqilganda qurilma `AquaGW-XXXXXX` WiFi tarmog'ini ochadi
   (LCD'da nom va parol ko'rinadi). Telefondan ulanib, ochilgan oynada to'ldiring:
   - **WiFi** nomi va paroli
   - **Firebase API key** (config'dagi `apiKey`)
   - **Database URL** (config'dagi `databaseURL`)
   - **Qurilma email** va **Qurilma parol** (1-qadamda yaratgan akkaunt)
   - **Save** → qurilma qayta ulanadi.
4. LCD'da `W:OK FB:OK L:OK` ko'rinsa — gateway Firebase'ga ma'lumot yozmoqda.

> Qayta sozlash kerak bo'lsa: BOOT tugmasini bosib reset qiling, yoki
> qurilmani 3 marta ketma-ket yoqib-o'chiring — sozlash oynasi qaytadi.

---

## 5-qadam — Web ilovani GitHub + Vercel'ga joylash

1. https://github.com → **New repository** → nom `smart-lake` → **Create**.
2. **uploading an existing file** → shu papkadagi **barcha fayllarni** tashlang
   (`index.html`, `firebase-config.js` — to'ldirilgan holda, `vercel.json`,
   `database.rules.json`, `.gitignore`, `README.md`) → **Commit changes**.
   > `firmware/` papkasini ham yuklasangiz bo'ladi (Vercel uni e'tiborsiz qoldiradi).
3. https://vercel.com → **Continue with GitHub** → **Add New → Project** →
   `smart-lake` ni **Import**.
4. Sozlamalarni o'zgartirmang (Framework: *Other*, Build/Output: bo'sh) → **Deploy**.
5. 10–30 soniyada `https://smart-lake-xxxx.vercel.app` havolasi tayyor.

---

## Qanday tekshiriladi (oxirigacha ishlayaptimi?)

1. Gateway yoqilgan, LCD'da `FB:OK`. Sensor NODE ma'lumot yuboryapti.
2. Firebase Console → Realtime Database → `nodes/AQxxxxxx/latest` ostida
   `do, ph, t, ts ...` paydo bo'lishi kerak.
3. Web ilovada o'sha **AQxxxxxx** ID bilan ko'l qo'shing (sizdagi qurilma ID bilan
   bir xil bo'lsin). Ekran pastida 🟢 **Firebase** yonadi va shu ko'l REAL
   qiymatni ko'rsatadi.
4. Aeratsiyani "Majburan yoqish" qilsangiz — `/commands` ga buyruq tushadi,
   gateway uni o'qib LoRa orqali NODE'ga yuboradi va o'chiradi.

---

## Halol eslatma

Men kodni to'g'ri va to'liq yozdim, lekin sizning **fizik LoRa qurilmangizni
shu yerda sinab ko'ra olmadim**. Shuning uchun:
- Web ilova + Firebase qismi (config to'g'ri bo'lsa) ishlashi kafolatlangan.
- Gateway↔Firebase qismini **siz qurilmada flesh qilib sinab ko'rishingiz** kerak.
  Serial Monitor (115200) `[FB] ... yozildi` chiqarsa — hammasi joyida.
- Agar biror joyda xatolik chiqsa (masalan `[FB] latest xato: ...`), Serial'dagi
  matnni menga yuboring — aniq tuzatib beraman.

LoRa NODE kodi (`aqua_node_lora_v13.ino`) **o'zgartirilmaydi** — u faqat
gateway bilan radio orqali gaplashadi, Firebase'ni bilishi shart emas.
