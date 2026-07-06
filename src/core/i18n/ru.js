// ============================================================
//  core/i18n/ru.js — Русские тексты
// ============================================================

export const ru = {
  app: { name: 'SmartLake', tagline: 'Мониторинг рыбных прудов', loading: 'Загрузка...' },

  common: {
    save: 'Сохранить', saved: 'Сохранено', cancel: 'Отмена', back: 'Назад',
    logout: 'Выход', email: 'Email', password: 'Пароль', welcome: 'Добро пожаловать',
  },

  auth: {
    loginTitle: 'Вход в систему', registerTitle: 'Регистрация', forgotTitle: 'Сброс пароля',
    loginBtn: 'Войти', registerBtn: 'Зарегистрироваться', sendReset: 'Отправить ссылку',
    toRegister: 'Нет аккаунта? Зарегистрируйтесь', toLogin: 'Вернуться ко входу',
    forgotLink: 'Забыли пароль?',
    signingIn: 'Вход...', creating: 'Создание...', sending: 'Отправка...',
    resetSent: 'Ссылка для сброса пароля отправлена на email',
    loggedInAs: 'Вы вошли: {email}',
  },

  profile: {
    title: 'Профиль', firstName: 'Имя', lastName: 'Фамилия',
    region: 'Область', selectRegion: 'Выберите область', district: 'Район',
    phone: 'Телефон',
  },

  settings: {
    title: 'Настройки', language: 'Язык', password: 'Пароль',
    changePassword: 'Сменить пароль (по email)',
    emailUnverified: 'Email не подтверждён', resendVerification: 'Отправить письмо повторно',
    verificationSent: 'Письмо с подтверждением отправлено',
  },

  home: {
    profile: 'Профиль', settings: 'Настройки',
    verifyBanner: 'Ваш email не подтверждён. Пожалуйста, проверьте почту.',
    suspended: 'Ваш аккаунт временно приостановлен. Свяжитесь с администратором.',
    noAdminAccess: 'У этого аккаунта нет прав администратора',
  },

  role: { farmer: 'Фермер', operator: 'Оператор', region: 'Региональный менеджер', super: 'Супер админ' },

  error: {
    generic: 'Произошла ошибка. Попробуйте снова.',
    config: 'Ошибка в настройках приложения.', auth: 'Ошибка входа.',
    data: 'Ошибка при работе с данными.',
    emailRequired: 'Введите email', emailInvalid: 'Неверный формат email',
    passwordRequired: 'Введите пароль', passwordShort: 'Пароль минимум 6 символов',
    firstNameRequired: 'Введите имя', lastNameRequired: 'Введите фамилию',
    regionRequired: 'Выберите область', regionInvalid: 'Неверная область',
    phoneInvalid: 'Неверный номер телефона',
    emailInUse: 'Этот email уже зарегистрирован', userNotFound: 'Пользователь не найден',
    wrongPassword: 'Неверный email или пароль', tooManyRequests: 'Слишком много попыток — попробуйте позже',
    network: 'Нет интернет-соединения',
    state: 'Ошибка состояния',
    stateTransition: 'Этот переход состояния запрещён',
    deviceIdInvalid: 'Неверный формат Device ID (AQ + 8 символов)',
    deviceNotFound: 'Устройство не найдено',
    requestNotFound: 'Запрос не найден',
    alreadyClaimed: 'Устройство уже привязано',
    claimFields: 'Введите Device ID и Activation Key',
    claimDenied: 'Неверный ключ или устройство занято',
  },

  device: {
    claimTitle: 'Добавить устройство',
    deviceId: 'ID устройства',
    activationKey: 'Ключ активации',
    lakeName: 'Название пруда',
    submitClaim: 'Отправить запрос',
    claimSent: 'Запрос отправлен — ожидается подтверждение администратора',
    pendingTitle: 'Ожидающие запросы',
    approve: 'Подтвердить',
    reject: 'Отклонить',
    approved: 'Подтверждено',
    rejected: 'Отклонено',
    noPending: 'Нет ожидающих запросов',
    from: 'Фермер',
  },
};

export default ru;
