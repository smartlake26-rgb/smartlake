/* ============================================================
   SMART LAKE — CLOUD SYNC (localStorage <-> Firebase RTDB)
   ------------------------------------------------------------
   Maqsad: mavjud ilovani BUZMASDAN bulutga ulash.
   - Ilova ichidagi dbGet/dbSet o'zgartirilmaydi (lokal sinxron).
   - Bu fayl dbSet'ni "o'rab", har bir o'zgarishni Firebase'ga yozadi.
   - Boshqa qurilmada o'zgarish bo'lsa, lokal nusxa yangilanadi va
     sahifa qayta yuklanadi (forma to'ldirilmayotgan bo'lsa).
   - Firebase sozlanmagan bo'lsa -> jim turadi, ilova lokal ishlaydi.

   Har bir sahifa o'zidan oldin quyidagilarni belgilashi kerak:
     window.SL_PREFIX     -> localStorage prefiksi ('sla_' yoki 'sl_')
     window.SL_CLOUD_BASE -> RTDB yo'li ('smartlake/admin' yoki '.../fermer')
   ============================================================ */
(function () {
  "use strict";

  var cfg = window.FIREBASE_CONFIG;
  var BASE = window.SL_CLOUD_BASE;
  var PREFIX = window.SL_PREFIX;

  function notConfigured() {
    return !cfg || !cfg.databaseURL ||
           String(cfg.apiKey || "").indexOf("PASTE") === 0 ||
           String(cfg.databaseURL || "").indexOf("PASTE") !== -1;
  }

  if (notConfigured()) {
    console.info("[SmartLake] Firebase sozlanmagan — LOKAL rejim (localStorage). " +
                 "Bulutga ulash uchun firebase-config.js to'ldiring.");
    return;
  }
  if (typeof firebase === "undefined" || !firebase.database) {
    console.warn("[SmartLake] Firebase SDK yuklanmadi — LOKAL rejim.");
    return;
  }
  if (!BASE || !PREFIX) {
    console.warn("[SmartLake] SL_CLOUD_BASE yoki SL_PREFIX belgilanmagan — LOKAL rejim.");
    return;
  }

  try { firebase.initializeApp(cfg); }
  catch (e) { /* allaqachon init bo'lgan bo'lishi mumkin */ }

  var db = firebase.database();
  var dataRef = db.ref(BASE + "/data");
  var revRef  = db.ref(BASE + "/_rev");

  var applyingRemote = false;          // remote -> lokal yozish davom etmoqda
  var lastAppliedRev = +(sessionStorage.getItem("sl_rev") || 0);

  // --- Lokaldagi barcha PREFIX kalitlarini o'qish ---
  function readLocalAll() {
    var out = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) {
        var bare = k.slice(PREFIX.length);
        try { out[bare] = JSON.parse(localStorage.getItem(k)); }
        catch (e) { out[bare] = localStorage.getItem(k); }
      }
    }
    return out;
  }

  // --- Foydalanuvchi formada yozayotgan bo'lsa, reload qilmaymiz ---
  function userIsTyping() {
    var el = document.activeElement;
    return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  }

  // --- dbSet'ni o'rab, har yozuvni bulutga jo'natish ---
  function wrapDbSet() {
    var orig = window.dbSet;
    if (typeof orig !== "function" || orig.__slWrapped) return;
    window.dbSet = function (k, v) {
      orig(k, v);                       // 1) lokal (sinxron, ilova kutgandek)
      if (applyingRemote) return;       // remote'dan kelgan o'zgarishni qaytib yubormaymiz
      try {
        dataRef.child(k).set(v === undefined ? null : v);
        revRef.set(firebase.database.ServerValue.TIMESTAMP);
      } catch (e) { console.warn("[SmartLake] bulutga yozishda xato:", e); }
    };
    window.dbSet.__slWrapped = true;
  }

  // --- Bulutdagi data'ni lokalga ko'chirish, kerak bo'lsa reload ---
  function applySnapshot(snap) {
    var val = snap.val() || {};
    var data = val.data || {};
    var rev  = +(val._rev || 0);

    // Birinchi marta: bulut bo'sh bo'lsa, lokaldagilarni yuklab qo'yamiz (seed)
    if (Object.keys(data).length === 0) {
      var local = readLocalAll();
      if (Object.keys(local).length) {
        applyingRemote = true;
        try {
          dataRef.set(local);
          revRef.set(firebase.database.ServerValue.TIMESTAMP);
        } catch (e) {}
        applyingRemote = false;
      }
      return;
    }

    var changed = false;
    applyingRemote = true;
    Object.keys(data).forEach(function (k) {
      var s = JSON.stringify(data[k]);
      if (localStorage.getItem(PREFIX + k) !== s) {
        try { localStorage.setItem(PREFIX + k, s); changed = true; } catch (e) {}
      }
    });
    applyingRemote = false;

    if (rev > lastAppliedRev && changed && !userIsTyping()) {
      lastAppliedRev = rev;
      sessionStorage.setItem("sl_rev", String(rev));
      location.reload();                // eng sodda va ishonchli qayta render
    } else {
      lastAppliedRev = Math.max(lastAppliedRev, rev);
    }
  }

  window.addEventListener("load", function () {
    wrapDbSet();
    db.ref(BASE).on("value", applySnapshot, function (err) {
      console.warn("[SmartLake] RTDB tinglashda xato:", err && err.message);
    });
    console.info("[SmartLake] Bulutga ulandi:", BASE);
  });

  /* ----------------------------------------------------------
     QURILMA TELEMETRIYASI (ESP32 -> Firebase) uchun yordamchi.
     Fizik qurilmani ko'l kartasiga bog'lash uchun ishlatiladi.
     Misol:
        SmartLakeDevices.subscribe('AQ7F8A2C', function(t){
          console.log(t.do, t.ph, t.t, t.aer);
        });
     ---------------------------------------------------------- */
  window.SmartLakeDevices = {
    subscribe: function (deviceId, cb) {
      if (!deviceId || typeof cb !== "function") return function () {};
      var ref = db.ref("smartlake/devices/" + deviceId + "/telemetry");
      var handler = function (snap) { cb(snap.val() || null); };
      ref.on("value", handler);
      return function () { ref.off("value", handler); };
    },
    list: function (cb) {
      db.ref("smartlake/devices").once("value", function (snap) {
        cb(snap.val() || {});
      });
    }
  };
})();
