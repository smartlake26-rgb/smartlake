// ============================================================
//  core/i18n/uz.js — O'zbekcha matnlar (asosiy til)
//  Sprint-1 doirasidagi kalitlar. Har feature migratsiyada
//  o'z bo'limini shu yerga qo'shadi.
// ============================================================

export const uz = {
  app: {
    name: 'SmartLake',
    tagline: "Baliq ko'llari monitoringi",
    loading: 'Yuklanmoqda...',
  },

  common: {
    save: 'Saqlash',
    cancel: 'Bekor qilish',
    logout: 'Chiqish',
    email: 'Email',
    password: 'Parol',
    welcome: 'Xush kelibsiz',
  },

  auth: {
    loginTitle: 'Tizimga kirish',
    registerTitle: "Ro'yxatdan o'tish",
    loginBtn: 'Kirish',
    registerBtn: "Ro'yxatdan o'tish",
    toRegister: "Hisobingiz yo'qmi? Ro'yxatdan o'ting",
    toLogin: 'Hisobingiz bormi? Kiring',
    signingIn: 'Kirilmoqda...',
    creating: 'Yaratilmoqda...',
    loggedInAs: 'Kirdingiz: {email}',
  },

  error: {
    generic: "Xatolik yuz berdi. Qaytadan urinib ko'ring.",
    config: 'Ilova sozlamalarida xatolik.',
    auth: 'Kirishda xatolik.',
    data: "Ma'lumot bilan ishlashda xatolik.",
    emailRequired: 'Email kiriting',
    emailInvalid: "Email formati noto'g'ri",
    passwordRequired: 'Parol kiriting',
    passwordShort: 'Parol kamida 6 belgi bo\'lsin',
    emailInUse: "Bu email allaqachon ro'yxatdan o'tgan",
    userNotFound: 'Bunday foydalanuvchi topilmadi',
    wrongPassword: "Email yoki parol noto'g'ri",
    tooManyRequests: "Juda ko'p urinish — birozdan keyin urinib ko'ring",
    network: "Internet aloqasi yo'q",
  },
};

export default uz;
