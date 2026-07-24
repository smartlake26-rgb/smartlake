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
Object.assign(uz.settings, { pushOn: 'Bildirishnomalar yoqilgan', pushOff: 'Bildirishnomalar (o\'chirilgan)', darkMode: 'Tungi rejim', about: 'Ilova haqida', logoutConfirm: 'Rostdan ham chiqmoqchimisiz?' });
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

// --- DASH-V3: Mission Control dashboard + yangi navigatsiya ---
Object.assign(uz.nav, { ai: 'AI', reports: 'Hisobot', menu: 'Menyu' });
uz.dash = {
  morning: 'Xayrli tong', day: 'Assalomu alaykum', evening: 'Xayrli kech',
  systemHealth: 'Tizim salomatligi',
  gradeA: "A'lo", gradeB: 'Yaxshi', gradeC: 'Ogohlantirish', gradeD: 'Kritik',
  healthDetail: "Ko'llar bo'yicha salomatlik",
  onlineLakes: 'Onlayn', offlineLakes: 'Oflayn',
  lastContact: 'Oxirgi aloqa', signal: 'Signal',
  signal_good: 'Yaxshi', signal_fair: "O'rtacha", signal_poor: 'Zaif', signal_unknown: '—',
  noOnline: "Onlayn ko'l yo'q", allOnline: "Barcha ko'llar onlayn",
  alerts: 'Ogohlantirishlar', noAlerts: "Ogohlantirish yo'q", allCalm: 'Hammasi tinch',
  unresolved: 'Hal qilinmagan', openAlertsPage: "Barchasini ko'rish",
  aiTitle: 'AI tavsiyasi', aiOpen: 'Batafsil',
  aiPlaceholder: "AI maslahatchi ma'lumot to'planishini kutmoqda. Qurilmalar ulangach tavsiyalar shu yerda chiqadi.",
  lakesTitle: "Ko'llar", allLakes: 'Hammasi',
  feedToday: 'Bugungi yem', feedCost: 'Taxminiy qiymat',
  feedPlaceholder: "Yem rejasi uchun ko'l sozlamalarida baliq ma'lumotini kiriting. Kelajakda AI tavsiyasi bilan bog'lanadi.",
  energy: 'Elektr energiyasi', energyToday: 'Bugun', energyWeek: 'Hafta', energyMonth: 'Oy',
  energyCost: 'Taxminiy xarajat', energyHint: "Aerator ish vaqtidan hisoblanadi. Quvvat/tarif — ko'l sozlamalarida.",
  energyLoad: 'Hisoblash', energyLoading: 'Hisoblanmoqda...',
  weather: 'Ob-havo', weatherTomorrow: 'Ertaga',
  weatherPlaceholder: "Ob-havo ko'l joylashuvi kiritilgach ko'rinadi.",
  updated: 'Yangilandi',
};
uz.menu = {
  title: 'Menyu',
  profile: 'Profil', profileSub: "Shaxsiy ma'lumotlar",
  devices: 'Qurilmalar', devicesDesc: 'Datchiklar holati va ulash',
  settings: 'Sozlamalar', settingsDesc: "Tema, til va chiqish",
  alerts: 'Bildirishnomalar', alertsDesc: 'Ogohlantirishlar tarixi',
  theme: "Tungi rejim", themeDesc: "Ko'rinishni almashtirish",
};
// --- LAKES-V3: Ko'llar sahifasi (premium monitoring) ---
uz.lakespg = {
  total: 'Jami', online: 'Onlayn', offline: 'Oflayn', alerts: 'Ogohlantirish',
  searchPh: "Ko'l nomi bo'yicha qidirish...",
  sortBy: 'Saralash', sort_name: 'Nomi', sort_health: 'Salomatlik',
  sort_online: 'Onlayn holati', sort_updated: 'Yangilanish',
  noResults: 'Qidiruv bo\'yicha ko\'l topilmadi',
  slowLoad: "Yuklash odatdagidan uzoq davom etmoqda",
  loadErrorDesc: "Internet aloqasini tekshirib, qayta urinib ko'ring",
  retry: "Qayta urinish",
  offlineNet: "Internet aloqasi yo'q — keshdagi oxirgi ma'lumot ko'rsatilmoqda",
  updated: 'Yangilandi',
};

// --- LAKEDET-V4: Ko'l sahifasi (boshqaruv markazi) ---
uz.lakedet = {
  tab_now: 'Joriy holat', tab_history: 'Tarix', tab_ai: 'AI tavsiya', tab_settings: 'Sozlamalar',
  health: "Ko'l salomatligi",
  aiReady: 'Baho AI hisobiga tayyor arxitekturada',
  norm: "Me'yor", trendStable: 'barqaror',
  min: 'Min', avg: "O'rtacha", max: 'Maks',
  detailChart: 'oxirgi 24 soat', do24: 'Kislorod — oxirgi 24 soat',
  rangeStats: 'Tanlangan davr statistikasi',
  battery: 'Batareya',
  aerator: 'Aerator boshqaruvi', working: 'Ishlayapti', stopped: "To'xtagan",
  forceOn: 'Majburiy YOQISH', forceOff: "Majburiy O'CHIRISH",
  offNote: "Majburiy O'CHIRISH qurilma firmware'sida yo'q — AUTO tugmasi qurilmani avtomatik rejimga qaytaradi (xavfsizlik uchun shunday loyihalangan).",
  mode: 'Rejim', manual: "Qo'lda (majburiy)", autoDo: 'AUTO — kislorod bo\'yicha', autoTime: 'AUTO — vaqt jadvali',
  lastCmd: 'Oxirgi buyruq', lastOn: 'Oxirgi yoqilgan',
  runToday: 'Bugun ishladi', runWeek: 'Haftada ishladi',
  kwhToday: 'Bugungi elektr', kwhMonth: 'Oylik elektr',
  energyNeedKw: "kW kiritilmagan (Sozlamalar → Aeratorlar)",
  feed: 'Yem tavsiyasi', feedMealOnce: 'Ovqatlanish vaqtlari va bir martalik miqdor',
  biomass: 'Biomassa', rate: 'Kunlik stavka', feedTotal: 'Bugungi jami yem', feedCost: 'Taxminiy narxi',
  feedAiNote: "Hisob: baliq soni × o'rtacha vazn × suv harorati × yem jadvali. Kelajakda AI aniqlashtiradi.",
  feedEmpty: "Yem rejasi uchun baliq ma'lumotlarini kiriting.",
  toSettings: 'Sozlamalarga o\'tish',
  conn: 'Aloqa holati',
  weatherRegion: 'Hudud ob-havosi', weatherToday: 'Bugun', weatherTomorrow: 'Ertaga',
  loadingWeather: "Ob-havo yuklanmoqda...",
};

// --- HIST-V3: Tarix va Hisobot (analitika markazi) ---
uz.hist = {
  title: 'Tarix va Hisobot',
  f_today: 'Bugun', f_yesterday: 'Kecha', f_7d: '7 kun', f_30d: '30 kun', f_year: 'Yil', f_custom: 'Sana',
  from: 'Dan', to: 'Gacha', show: "Ko'rsatish", pickDate: 'Sanani tanlang',
  sum_do: "O'rtacha DO", sum_temp: "O'rtacha harorat", sum_ph: "O'rtacha pH", sum_tds: "O'rtacha TDS",
  sum_runtime: 'Aerator ish vaqti', sum_energy: 'Elektr sarfi', sum_feed: 'Yem miqdori',
  rows: 'Qatorlar',
  colDate: 'Sana', colTime: 'Vaqt', colStatus: 'Holati', colOnline: "O'lchovlar",
  st_normal: 'Normal', st_warn: 'Ogoh', st_crit: 'Kritik',
  searchPh: 'Sana, qiymat yoki holat...', statusFilter: 'Holat',
  tableTitle: 'Sensorlar tarixi',
  chartsTitle: 'Grafiklar',
  chart_energyDaily: 'Elektr — kunlik kWh', chart_feedDaily: 'Yem — kunlik kg',
  detailChart: 'Batafsil grafik',
  energyTitle: 'Elektr energiyasi', kw: 'Quvvat (kW)', tariff: "Tarif (so'm/kWh)",
  runTime: 'Aerator ishlagan vaqt', consumption: 'Elektr sarfi', cost: 'Taxminiy narx',
  perAerator: 'Aeratorlar bo\'yicha', aerN: 'Aerator', needAer: "Aerator ma'lumotlari Sozlamalarda kiritiladi",
  e_today: 'Bugun', e_week: 'Hafta', e_month: 'Oy', e_total: 'Davr jami',
  widen: "Bu qiymat uchun davrni kengaytiring",
  energyNote: "Ish vaqti telemetriyadagi rele holatidan taxminan tiklanadi; hisob tanlangan davr bo'yicha.",
  feedTitle: 'Yem statistikasi',
  fd_today: 'Bugun', fd_week: 'Haftalik', fd_month: 'Oylik', fd_year: 'Yillik', fd_total: 'Davr jami',
  meals: 'Ovqatlanish vaqtlari', mealType: 'Yem turi',
  feedNote: "Stavka davr o'rtacha haroratiga bog'liq; jami — kunlik reja × kunlar (taxminiy).",
  needFish: "Sozlamalar tabida baliq va yem ma'lumotlarini kiriting — hisob avtomatik yoqiladi.",
  exportTitle: 'Hisobotni yuklab olish',
  exportHint: "Tanlangan davr: sensor tarixi + elektr + yem statistikasi",
  noExport: "Eksport uchun ma'lumot yo'q",
  empty: "Bu davr uchun ma'lumot yo'q",
  emptyDesc: "Arxiv ilova ishlagan paytdan boshlab yig'iladi",
  loadError: "Ma'lumotni yuklab bo'lmadi",
  retry: 'Qayta urinish',
  pullRefresh: 'Yangilash uchun torting',
  refreshed: 'Yangilandi',
  sheetHistory: 'Tarix', sheetEnergy: 'Elektr', sheetFeed: 'Yem',
  param: "Ko'rsatkich", value: 'Qiymat',
};

// --- DASH-V4 + ANN-V1: soddalashtirilgan dashboard va E'lonlar ---
Object.assign(uz.nav, { announcements: "E'lonlar" });
Object.assign(uz.dash, {
  activeDevices: 'Aktiv qurilmalar',
  onlineDevices: 'Onlayn', offlineDevices: 'Oflayn',
  todayFeed: 'Bugungi yem', feedNoData: "Yem: Sozlamalarda baliq kiriting",
  recentAlerts: "So'nggi ogohlantirishlar",
});
uz.ann = {
  title: "E'lonlar", subtitle: 'SmartLake jamoasidan xabarlar',
  type_news: 'Yangilik', type_video: 'Video dars', type_warning: 'Muhim',
  type_maintenance: 'Texnik xizmat', type_tip: 'Tavsiya',
  open: 'Ochish',
  empty: "Hozircha e'lonlar yo'q",
  emptyDesc: "SuperAdmin yuborgan yangiliklar, video darslar va tavsiyalar shu yerda chiqadi",
  onDash: "E'lonlar",
  seeAll: "Barchasini ko'rish",
};

// --- LAKES-V4: soddalashtirilgan katalog ---
Object.assign(uz.lakespg, {
  flt_healthy: "Sog'lom", flt_normal: 'Normal', flt_problem: 'Muammoli',
  feedPending: 'Hozircha hisoblanmagan',
});

// --- LAKEDET-V5: Lake Control Center + katalogli sozlamalar ---
Object.assign(uz.lakedet, {
  do48: 'Kislorod — oxirgi 48 soat',
  deviceOf: 'Qurilma',
  signalQ: 'Aloqa sifati',
  sensorAbsent: 'Sensor mavjud emas',
  sensorDisabled: "Sensor o'chirilgan",
  sensorCalib: 'Kalibrovka talab qilinadi',
});
uz.lset = {
  passport: "Ko'l pasporti",
  area: 'Suv maydoni (ga)', avgDepth: "O'rtacha chuqurlik (m)", maxDepth: 'Maks chuqurlik (m)',
  fishTitle: 'Baliq turlari (maks {n} ta)',
  fishN: 'Baliq', type: 'Turi', pickType: 'Katalogdan tanlang',
  count: 'Soni (dona)', startW: 'Boshl. vazni (g)', avgW: 'Joriy vazni (g)',
  stockedAt: 'Tashlangan sana',
  dead: "O'lgan (dona)", deadBtn: "O'lim kiritish", deadDone: '{n} ta ayirildi — Saqlashni unutmang',
  enterNum: 'Sonni kiriting',
  addFish: "+ Baliq qo'shish", noFish: 'Hali baliq kiritilmagan',
  biomass: 'Umumiy biomassa',
  estW: 'Taxminiy joriy vazn (yem koeffitsiyenti bo\'yicha)', apply: "Qo'llash",
  noGrowth: "Bu tur yem bilan o'smaydi — avtomatik vazn hisobi qo'llanmaydi",
  estHint: "Hisob uchun boshlang'ich vazn va tashlangan sana kerak",
  feedTitle: 'Yem', feedType: 'Yem turi (katalogdan)', price: "Narxi (so'm/kg)",
  fromCatalog: 'Protein {p}% · FCR {f} — katalogdan',
  aerTitle: 'Aeratorlar', aerCount: 'Soni', aerKw: 'Bittasining quvvati (kW)',
  aerTariff: "Elektr narxi (so'm/kWh)",
  tariffTitle: "Elektr narxi",
  tariffNote: "Bu qiymat Hisobot bo'limida elektr xarajatini hisoblash uchun ishlatiladi. Faqat shu yerda o'zgartiriladi.",
  aerNote: "Saqlanganda Hisobotdagi umumiy quvvat (soni × kW) avtomatik yangilanadi.",
  fishSaved: "Baliq ma'lumotlari saqlandi",
  metaNote: "Bu ma'lumotlar faqat Firebase'da saqlanadi — qurilmaga yuborilmaydi. Yem va elektr hisoblari shu yerdan oziqlanadi.",
  legacy: '(eski yozuv)',
};

// --- SENSOR-STATE: sensor holat matni (AI + UI) ---
uz.sensor = {
  absent:       'Sensor mavjud emas',
  disconnected: 'Aloqa uzilgan',
  disabled:     "Sensor o'chirilgan",
  faulty:       'Sensor nosoz',
  calibration:  'Kalibrovka talab qilinadi',
  // AI tushuntirish matni
  noDoAdvice:   "Kislorod (DO) sensori ma'lumoti mavjud emas — kislorod bo'yicha tavsiya shakllantirib bo'lmadi.",
  noTempAdvice: "Harorat sensori ma'lumoti mavjud emas — haroratga bog'liq tavsiyalar chiqarilmadi.",
  noPhAdvice:   "pH sensori o'rnatilmagan — pH tahlili bajarilmadi.",
  noDataAdvice: "Sensorlardan ishonchli ma'lumot kelmayapti. Qurilma ulanishini tekshiring.",
  partialAdvice:"Ba'zi sensorlar ishlamayapti — faqat mavjud ma'lumotlar asosida tavsiya berildi.",
};

uz.reports = {
  title: 'Hisobot',
  pickLake: "Ko'lni tanlang",
  empty: "Hisobot uchun avval ko'l qo'shing",
  hint: "Davr bo'yicha o'lchovlar, yem va elektr hisobi, XLSX/CSV/PDF eksport",
};

// --- LAKEDET-V4: ko'l boshqaruv markazi ---
uz.lakedet = {
  tab_now: 'Joriy holat', tab_history: 'Tarix', tab_ai: 'AI tavsiya', tab_settings: 'Sozlamalar',
  health: 'Ko\u02bbl salomatligi', aiReady: 'Kelajakda AI hisoblaydi',
  norm: "Me'yor", trendStable: 'barqaror',
  detailChart: '24 soatlik grafik', min: 'Eng past', avg: "O'rtacha", max: 'Eng yuqori',
  do24: 'Kislorod — 24 soat',
  aerator: 'Aerator boshqaruvi', working: 'ISHLAMOQDA', stopped: "TO'XTATILGAN",
  forceOn: 'Majburiy YOQISH', forceOff: "Majburiy O'CHIRISH",
  offNote: "Majburiy o'chirish qurilmada yo'q — AUTO rejimda kislorod yetarli bo'lsa qurilma o'zi o'chiradi (baliq himoyasi).",
  mode: 'Hozirgi rejim', manual: "QO'LDA", autoDo: 'AVTO (kislorod)', autoTime: 'AVTO (vaqt)',
  lastCmd: 'Oxirgi buyruq', lastOn: 'Oxirgi yoqilgan',
  runToday: 'Bugun ishlagan', runWeek: 'Hafta ishlagan',
  kwhToday: 'Bugungi elektr', kwhMonth: 'Oylik elektr',
  energyNeedKw: "kW/tarif — Sozlamalar > Aeratorlar",
  feed: 'Yem tavsiyasi', feedMealOnce: 'Bir martalik', feedTotal: 'Bugun jami',
  feedCost: 'Taxminiy narxi', biomass: 'Biomassa', rate: 'Stavka',
  feedAiNote: "Hisob: baliq soni × vazni × harorat × yem turi. Kelajakda AI aniqlashtiradi.",
  feedEmpty: "Aniq hisob uchun Sozlamalar tabida baliq turi, soni va vaznini kiriting.",
  toSettings: "Sozlamalarga o'tish",
  conn: 'Aloqa holati', battery: 'Batareya',
  weatherToday: 'Bugun', weatherTomorrow: 'Ertaga (bashorat)', weatherRegion: 'Hududiy ob-havo',
  loadingWeather: 'Ob-havo yuklanmoqda...',
  rangeStats: 'Tanlangan davr statistikasi',
};

// --- HIST-V4 + REP-V1: sof Data History va Hisobot moduli ---
Object.assign(uz.hist, {
  zoomIn: 'Yaqinlashtirish', zoomOut: 'Uzoqlashtirish', resetZoom: 'Toza ko\'rinish',
  panPrev: 'Oldingi oraliq', panNext: 'Keyingi oraliq',
  exportFull: "Eksportda tanlangan davrning BARCHA yozuvlari chiqadi — ma'lumot qisqartirilmaydi",
});
Object.assign(uz.reports, {
  hint: "Elektr energiyasi, yem statistikasi va moliyaviy xulosa. Sensor tarixi: Ko'l sahifasi → Tarix",
});
uz.rep = {
  finance: 'Moliyaviy xulosa',
  finTotal: 'Jami xarajat (davr)',
  scope: "Elektr · Yem · Moliya",
};

export default uz;
