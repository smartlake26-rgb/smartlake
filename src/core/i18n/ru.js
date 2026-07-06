// ============================================================
//  core/i18n/ru.js — Русские тексты (дополнительный язык)
//  Ключи зеркалируют uz.js. Отсутствующие ключи -> fallback на uz.
// ============================================================

export const ru = {
  app: {
    name: 'SmartLake',
    tagline: 'Мониторинг рыбных прудов',
    loading: 'Загрузка...',
  },

  common: {
    save: 'Сохранить',
    cancel: 'Отмена',
    logout: 'Выход',
    email: 'Email',
    password: 'Пароль',
    welcome: 'Добро пожаловать',
  },

  auth: {
    loginTitle: 'Вход в систему',
    registerTitle: 'Регистрация',
    loginBtn: 'Войти',
    registerBtn: 'Зарегистрироваться',
    toRegister: 'Нет аккаунта? Зарегистрируйтесь',
    toLogin: 'Есть аккаунт? Войдите',
    signingIn: 'Вход...',
    creating: 'Создание...',
    loggedInAs: 'Вы вошли: {email}',
  },

  error: {
    generic: 'Произошла ошибка. Попробуйте снова.',
    config: 'Ошибка в настройках приложения.',
    auth: 'Ошибка входа.',
    data: 'Ошибка при работе с данными.',
    emailRequired: 'Введите email',
    emailInvalid: 'Неверный формат email',
    passwordRequired: 'Введите пароль',
    passwordShort: 'Пароль минимум 6 символов',
    emailInUse: 'Этот email уже зарегистрирован',
    userNotFound: 'Пользователь не найден',
    wrongPassword: 'Неверный email или пароль',
    tooManyRequests: 'Слишком много попыток — попробуйте позже',
    network: 'Нет интернет-соединения',
  },
};

export default ru;
