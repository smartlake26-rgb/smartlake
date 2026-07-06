# Smart Lake — APK yig'ish qo'llanmasi

Bu ilova endi **offline/APK uchun optimallashtirilgan**:

- ✅ Firebase SDK lokal (`vendor/` papkada) — internetsiz ishga tushadi
- ✅ Google Fonts CDN olib tashlandi — tizim shriftlari (offline)
- ✅ Safe-area (notch / status bar / home indicator) qo'llab-quvvatlanadi
- ✅ WebView moslik: text-size-adjust, tap-highlight, overscroll
- ✅ theme-color va status-bar meta teglari

Tashqi bog'liqliklar faqat: **Firebase** (real-time ma'lumot) va **Open-Meteo** (ob-havo).
Bularsiz ham ilova ochiladi — internet bo'lganda ma'lumot to'liq keladi.

---

## Eng oson yo'l: Capacitor (tavsiya)

Capacitor — hozirgi HTML/JS ni o'zgartirmasdan APK ga o'raydi.

```bash
# 1. Loyiha papkasida
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Smart Lake" uz.smartlake.app --web-dir=.

# 2. Android platformasini qo'shish
npx cap add android

# 3. Fayllarni sync qilish
npx cap sync

# 4. Android Studio'da ochish (APK/AAB build)
npx cap open android
```

Android Studio ochilgach: **Build > Build Bundle(s)/APK(s) > Build APK(s)**.

### Muhim: geolokatsiya ruxsati
`android/app/src/main/AndroidManifest.xml` ga qo'shing:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
```

`web-dir` sifatida `.` (joriy papka) ishlatilgani uchun `index.html` bosh sahifa bo'ladi.
Admin panel (`admin.html`) ham APK ichida bo'ladi — kerak bo'lsa alohida APK yoki bitta ilovada.

---

## Muqobil: Median.co / GoNative (kod yozmasdan)

1. Loyihani GitHub → Vercel'ga deploy qiling (URL oling).
2. https://median.co ga kiring, URL ni bering, APK yuklab oling.

**Kamchiligi:** bu WebView URL'ni ochadi, ya'ni internet **majburiy**.
Capacitor esa fayllarni APK ichiga joylaydi — offline ochiladi.

---

## Muqobil: PWA → TWA (Bubblewrap)

`manifest.json` va service worker kerak bo'ladi (hozircha yo'q).
Agar shu yo'lni tanlasangiz, ayting — PWA fayllarini tayyorlab beraman.

---

## Tavsiya

**Capacitor** — sizning holatingizga eng mos:
- Offline ochiladi (Firebase SDK va CSS ichkarida)
- Geolokatsiya, kamera (profil rasmi) native ishlaydi
- Play Market'ga qo'yish oson
