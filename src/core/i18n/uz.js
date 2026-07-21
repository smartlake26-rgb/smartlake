// ============================================================
//  core/i18n/uz.js — O'zbekcha matnlar (asosiy til)
// ============================================================

export const uz = {
  app: { name: 'SmartLake', tagline: "Baliq ko'llari monitoringi", loading: 'Yuklanmoqda...' },

  common: { search: "Qidirish...", noData: "Ma'lumot yo'q", approve: "Tasdiqlash", reject: "Rad etish",
    save: 'Saqlash', saved: 'Saqlandi', cancel: 'Bekor qilish', back: 'Orqaga',
    logout: 'Chiqish', email: 'Email', password: 'Parol', welcome: 'Xush kelibsiz',
  },

  auth: {
    loginTitle: 'Tizimga kirish', registerTitle: "Ro'yxatdan o'tish", forgotTitle: 'Parolni tiklash',
    loginBtn: 'Kirish', registerBtn: "Ro'yxatdan o'tish", sendReset: 'Havola yuborish',
    toRegister: "Hisobingiz yo'qmi? Ro'yxatdan o'ting", toLogin: 'Kirish sahifasiga qaytish',
    forgotLink: 'Parolni unutdingizmi?',
    signingIn: 'Kirilmoqda...', creating: 'Yaratilmoqda...', sending: 'Yuborilmoqda...',
    resetSent: 'Parolni tiklash havolasi emailingizga yuborildi',
    loggedInAs: 'Kirdingiz: {email}',
  },

  profile: {
    title: 'Profil', firstName: 'Ism', lastName: 'Familiya',
    region: 'Viloyat', selectRegion: 'Viloyatni tanlang', district: 'Tuman',
    phone: 'Telefon',
  },

  settings: { role: "Rol",
    title: 'Sozlamalar', language: 'Til', password: 'Parol',
    changePassword: "Parolni o'zgartirish (email orqali)",
    emailUnverified: 'Email tasdiqlanmagan', resendVerification: 'Tasdiq emailini qayta yuborish',
    verificationSent: 'Tasdiq emaili yuborildi',
  },

  home: {
    profile: 'Profil', settings: 'Sozlamalar',
    verifyBanner: 'Emailingiz tasdiqlanmagan. Iltimos pochtangizni tekshiring.',
    suspended: 'Hisobingiz vaqtincha to\'xtatilgan. Administrator bilan bog\'laning.',
    noAdminAccess: 'Bu hisobda admin huquqi yo\'q',
  },

  role: { farmer: 'Fermer', operator: 'Operator', region: 'Region menejeri', super: 'Super admin' },

  error: {
    generic: "Xatolik yuz berdi. Qaytadan urinib ko'ring.",
    config: 'Ilova sozlamalarida xatolik.', auth: 'Kirishda xatolik.',
    data: "Ma'lumot bilan ishlashda xatolik.",
    emailRequired: 'Email kiriting', emailInvalid: "Email formati noto'g'ri",
    passwordRequired: 'Parol kiriting', passwordShort: 'Parol kamida 6 belgi bo\'lsin',
    firstNameRequired: 'Ismni kiriting', lastNameRequired: 'Familiyani kiriting',
    regionRequired: 'Viloyatni tanlang', regionInvalid: "Viloyat noto'g'ri",
    phoneInvalid: "Telefon raqami noto'g'ri",
    emailInUse: "Bu email allaqachon ro'yxatdan o'tgan", userNotFound: 'Bunday foydalanuvchi topilmadi',
    wrongPassword: "Email yoki parol noto'g'ri", tooManyRequests: "Juda ko'p urinish — birozdan keyin urinib ko'ring",
    network: "Internet aloqasi yo'q",
    state: "Holat xatosi",
    stateTransition: "Bu holat o'zgarishi ruxsat etilmagan",
    deviceIdInvalid: "Device ID formati noto'g'ri (AQ + 8 belgi)",
    deviceNotFound: "Qurilma topilmadi",
    requestNotFound: "So'rov topilmadi",
    alreadyClaimed: "Qurilma allaqachon biriktirilgan",
    claimFields: "Device ID va Activation Key kiriting",
    claimDenied: "Noto'g'ri kalit yoki qurilma band",
    lakeNameRequired: "Ko'l nomi majburiy",
    areaPositive: "Maydon 0 dan katta bo'lishi kerak",
    depthPositive: "Chuqurlik 0 dan katta bo'lishi kerak",
    coordinatesInvalid: "Koordinatalar noto'g'ri (WGS84)",
    bothCoordinatesRequired: "Kenglik (lat) va uzunlik (lng) ikkalasini ham kiritishingiz shart (yoki bo'sh qoldiring)",
    lakeNotFound: "Ko'l topilmadi",
    notOwner: "Sizga tegishli emas",
    deviceAssigned: "Qurilma allaqachon ko'lga biriktirilgan",
    lakeArchived: "Ko'l arxivlangan",
    notAssignedHere: "Qurilma bu ko'lga biriktirilmagan",
  },

  device: { lifecycle: "Hayot sikli",
    claimTitle: "Qurilma qo'shish",
    deviceId: 'Qurilma ID',
    activationKey: 'Faollashtirish kaliti',
    lakeName: "Ko'l nomi",
    submitClaim: "So'rov yuborish",
    claimSent: "So'rov yuborildi — admin tasdig'i kutilmoqda",
    pendingTitle: "Kutilayotgan so'rovlar",
    approve: 'Tasdiqlash',
    reject: 'Rad etish',
    approved: 'Tasdiqlandi',
    rejected: 'Rad etildi',
    noPending: "Kutilayotgan so'rov yo'q",
    from: 'Fermer',
  },

  lake: {
    myLakes: "Mening ko'llarim",
    create: "Ko'l qo'shish",
    edit: "Ko'lni tahrirlash",
    detail: "Ko'l ma'lumoti",
    empty: "Hali ko'l yo'q. Yangi ko'l qo'shing.",
    name: "Ko'l nomi",
    description: 'Tavsif',
    district: 'Tuman',
    lat: 'Kenglik (lat)',
    lng: 'Uzunlik (lng)',
    area: "Maydoni (gektar)",
    depth: "O'rtacha chuqurlik (metr)",
    volume: "Suv hajmi (m\u00b3)",
    species: "Baliq turlari (vergul bilan)",
    coordsAutoParsed: "Koordinatalar avtomatik aniqlandi!",
    devices: 'qurilma',
    attachedDevices: 'Biriktirilgan qurilmalar',
    noDevices: "Biriktirilgan qurilma yo'q",
    selectDevice: 'Qurilmani tanlang',
    assign: 'Biriktirish',
    unassign: 'Ajratish',
    assigned: 'Biriktirildi',
    unassigned: 'Ajratildi',
    archive: 'Arxivlash',
    archived: 'Arxivlandi',
    activate: 'Faollashtirish',
    deactivate: 'Deaktivatsiya',
    status_active: 'Faol',
    status_inactive: 'Nofaol',
    status_archived: 'Arxivlangan',
  },

  tm: { status: "Holat",
    dashboard: 'Monitoring',
    deviceDetail: 'Qurilma tafsilotlari',
    empty: "Hali ko'l yoki qurilma yo'q",
    online: 'onlayn',
    offline: 'oflayn',
    avgDo: "O'rtacha DO",
    avgTemp: "O'rtacha harorat",
    avgPh: "O'rtacha pH",
    health: 'Salomatlik',
    lastUpdate: 'Oxirgi yangilanish',
    alarm: 'Ogohlantirish',
    justNow: 'hozir',
    minAgo: 'daq oldin',
    hourAgo: 'soat oldin',
    sensors: 'Sensorlar',
    do: 'Erigan kislorod (DO)',
    temp: 'Harorat',
    ph: 'pH',
    battery: 'Batareya',
    rssi: 'Signal (RSSI)',
    telemetryAge: 'Telemetriya yoshi',
    deviceInfo: "Qurilma ma'lumoti",
    firmware: 'Proshivka',
    gateway: 'Gateway',
    region: 'Hudud',
    lake: "Ko'l",
    owner: 'Egasi',
    you: 'Siz',
    history: 'Tahlillar va Grafik',
    historyHint: "Vaqt oralig'ini tanlang:",
    points: "o'lchov",
    range_1h: "Soat",
    range_24h: "24 soat",
    range_7d: "Hafta",
    range_30d: "Oy",
    range_365d: "Yil",
    do_oxy: "Erigan kislorod (DO)",
    temp_water: "Harorat",
    ph_water: "pH ko'rsatkich",
    offlineBanner: "Internet uzilgan — oxirgi saqlangan ma'lumot ko'rsatilmoqda",
    status_healthy: 'Sog\'lom',
    status_good: 'Yaxshi',
    status_warning: 'Ogohlantirish',
    status_critical: 'Kritik',
    status_offline: 'Oflayn',
    status_unknown: "Noma'lum",
  },
};


// --- Sprint-5.5 MD3 qo'shimchalari ---
uz.nav = { home: 'Asosiy', lakes: "Ko'llar", devices: 'Qurilmalar', alerts: 'Ogohlantirishlar', profile: 'Profil' };
uz.alerts = { none: 'Ogohlantirish yo\'q', allGood: 'Barcha qurilmalar sog\'lom' };
Object.assign(uz.home, { hi: 'Salom', lakes: "Ko'llar", devices: 'Qurilmalar', online: 'Onlayn', alerts: 'Ogohlantirish', emptyHint: "Boshlash uchun ko'l qo'shing yoki qurilma ulang", contactAdmin: 'Administrator bilan bog\'laning' });
Object.assign(uz.common, { edit: 'Tahrirlash' });
Object.assign(uz.settings, { darkMode: 'Tungi rejim', about: 'Ilova haqida', logoutConfirm: 'Rostdan ham chiqmoqchimisiz?' });
Object.assign(uz.lake, { archiveConfirm: "Ko'l arxivlanadi va ro'yxatdan yashiriladi. Davom etilsinmi?", lakeName: "Ko'l nomi (ixtiyoriy)", restore: "Arxivdan chiqarish", restored: "Arxivdan chiqarildi", restoreConfirm: "Ushbu ko'lni arxivdan chiqarib, faol holatga qaytarishni xohlaysizmi?", archivedLakes: "Arxivlangan ko'llar", emptyArchived: "Arxivlangan ko'llar yo'q" });
Object.assign(uz.device, { unassigned: 'Biriktirilmagan', empty: "Hali qurilma yo'q", emptyHint: "Qurilma qo'shish uchun faollashtirish kodidan foydalaning", claimHint: "Qurilma ID va faollashtirish kalitini qadoqdan toping" });

Object.assign(uz.nav, { dashboard: 'Boshqaruv paneli', monitoring: 'Monitoring', users: 'Foydalanuvchilar', approvals: "Ko'l tasdig'i", audit: 'Audit jurnali', settings: 'Sozlamalar' });
Object.assign(uz.common, { search: 'Qidirish...', noData: "Ma'lumot yo'q", approve: 'Tasdiqlash', reject: 'Rad etish' });
Object.assign(uz.device, { lifecycle: 'Hayot sikli' });
Object.assign(uz.tm, { status: 'Holat' });
Object.assign(uz.settings, { role: 'Rol' });
uz.user = Object.assign(uz.user || {}, { active: 'Faol', suspended: 'Bloklangan' });
uz.approval = Object.assign(uz.approval || {}, { approved: 'Tasdiqlandi', rejected: 'Rad etildi', empty: "Kutilayotgan so'rov yo'q" });
uz.audit = Object.assign(uz.audit || {}, { time: 'Vaqt', action: 'Amal', actor: 'Bajaruvchi', target: 'Obyekt', empty: "Audit yozuvi yo'q (Sprint-7'da to'ldiriladi)" });

Object.assign(uz.nav, { commands: 'Buyruqlar' });
uz.cmd = Object.assign(uz.cmd || {}, {
  control: 'Boshqaruv', recent: 'Oxirgi buyruqlar', none: "Hali buyruq yo'q", noneAdmin: "Buyruq yo'q",
  sent: 'Buyruq yuborildi', command: 'Buyruq', completed: 'Yakunlandi', result: 'Natija', unknown: "Noma'lum",
  aeratorOn: 'Aerator YOQ', aeratorOff: "Aerator O'CH", autoOn: 'Avto YOQ', autoOff: "Avto O'CH",
  feedStart: 'Yem BOSHLA', feedStop: "Yem TO'XTAT", restart: 'Qayta ishga tushirish',
  syncTime: 'Vaqtni sinxronlash', reqStatus: 'Holat so\'rash', reqConfig: 'Konfiguratsiya so\'rash',
});
uz.cmdGroup = Object.assign(uz.cmdGroup || {}, { aerator: 'Aerator', auto: 'Avto rejim', feed: 'Yem motori', system: 'Tizim' });
uz.cmdStatus = Object.assign(uz.cmdStatus || {}, { pending: 'Kutilmoqda', sent: 'Yuborildi', executed: 'Bajarildi', failed: 'Xato', expired: 'Muddati o\'tdi' });
Object.assign(uz.error, { badTransition: "Noto'g'ri status o'tishi", badCommandType: "Noto'g'ri buyruq turi", badPayload: "Noto'g'ri payload", notOwner: 'Bu qurilma sizga tegishli emas' });

// --- GW-BRIDGE: firmware'dagi haqiqiy buyruqlar + kislorod chegaralari ---
Object.assign(uz.cmd, {
  aeratorOn: 'Aerator YOQ (qo\'lda)', aeratorOff: 'AVTO rejimga qaytarish',
  modeDo: 'Kislorod rejimi', modeTime: 'Vaqt jadvali rejimi',
  setMindo: 'Minimal DO (mg/L)', setFarq: 'Yetarli farq (mg/L)', setKritik: 'Kritik DO (mg/L)',
  send: 'Yuborish',
  deviceNow: 'Qurilmada hozir: {v} mg/L',
  thresholdsHint: "Qiymatlar qurilma xotirasiga yoziladi. Qurilma klaviaturasidan o'zgartirilsa, shu yerda avtomatik yangilanadi.",
  rangeErr: 'Qiymat {min} dan {max} gacha butun son bo\'lishi kerak',
  ackOk: 'Qurilma tasdiqladi ✓ ({ts})', ackFail: 'Qurilma buyruqni RAD ETDI ({ts})',
  waitAck: "⏳ Yuborildi — qurilma javobi kutilmoqda...",
  ackedMid: "Qurilma qabul qildi — saqlanishi tekshirilmoqda...",
  savedOk: "✓ O'zgarish qurilmada SAQLANDI",
  ackRejected: "✗ Qurilma o'zgarishni RAD ETDI",
  ackTimeout: "⚠ Qurilma javob bermadi — aloqani tekshiring (LCD'dagi antenna belgisi)",
});
uz.cmdGroup = Object.assign(uz.cmdGroup, { mode: 'Ishlash rejimi', thresholds: 'Kislorod chegaralari (qurilma)' });
Object.assign(uz.error, { cmdUnsupported: "Bu buyruq qurilma tomonidan qo'llab-quvvatlanmaydi yoki qiymat noto'g'ri" });

export default uz;
