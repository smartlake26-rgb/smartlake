/* ============================================================
   SMART LAKE — FIREBASE SOZLAMALARI
   ------------------------------------------------------------
   Bu yerga Firebase Console'dan olgan o'z loyihangiz kalitlarini
   joylashtiring. Olish yo'li (README.md da batafsil):
     Firebase Console -> Project Settings -> "Your apps" ->
     Web app (</>) -> "SDK setup and configuration" -> Config

   ESLATMA: bu kalitlar maxfiy EMAS — ular brauzerda ochiq turadi.
   Haqiqiy himoya "database.rules.json" qoidalari orqali beriladi.

   Agar kalitlar to'ldirilmasa, ilova faqat LOKAL rejimda
   (localStorage) ishlayveradi — hech narsa buzilmaydi.
   ============================================================ */
window.FIREBASE_CONFIG = {
  apiKey:            "PASTE_API_KEY",
  authDomain:        "PASTE_PROJECT.firebaseapp.com",
  databaseURL:       "https://PASTE_PROJECT-default-rtdb.firebaseio.com",
  projectId:         "PASTE_PROJECT",
  storageBucket:     "PASTE_PROJECT.appspot.com",
  messagingSenderId: "PASTE_SENDER_ID",
  appId:             "PASTE_APP_ID"
};
