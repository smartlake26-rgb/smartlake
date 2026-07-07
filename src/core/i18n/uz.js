// ============================================================
//  core/i18n/uz.js — O'zbekcha matnlar (asosiy til)
// ============================================================

export const uz = {
  app: { name: 'SmartLake', tagline: "Baliq ko'llari monitoringi", loading: 'Yuklanmoqda...' },

  common: {
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

  settings: {
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
    lakeNotFound: "Ko'l topilmadi",
    notOwner: "Sizga tegishli emas",
    deviceAssigned: "Qurilma allaqachon ko'lga biriktirilgan",
    lakeArchived: "Ko'l arxivlangan",
    notAssignedHere: "Qurilma bu ko'lga biriktirilmagan",
  },

  device: {
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
    area: "Maydon (m\u00b2)",
    depth: "O'rtacha chuqurlik (m)",
    volume: "Suv hajmi (m\u00b3)",
    species: "Baliq turlari (vergul bilan)",
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
};

export default uz;
