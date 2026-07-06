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
  },
};

export default uz;
