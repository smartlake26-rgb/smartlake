// ============================================================
//  core/i18n/ru.js — Русские тексты
// ============================================================

export const ru = {
  app: { name: 'SmartLake', tagline: 'Мониторинг рыбных прудов', loading: 'Загрузка...' },

  common: { search: "Поиск...", noData: "Нет данных", approve: "Подтвердить", reject: "Отклонить",
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

  settings: { role: "Роль",
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
    lakeNameRequired: 'Название пруда обязательно',
    areaPositive: 'Площадь должна быть больше 0',
    depthPositive: 'Глубина должна быть больше 0',
    coordinatesInvalid: 'Неверные координаты (WGS84)',
    bothCoordinatesRequired: 'Широта (lat) и долгота (lng) должны быть заполнены вместе (или оставлены пустыми)',
    lakeNotFound: 'Пруд не найден',
    notOwner: 'Не принадлежит вам',
    deviceAssigned: 'Устройство уже привязано к пруду',
    lakeArchived: 'Пруд архивирован',
    notAssignedHere: 'Устройство не привязано к этому пруду',
  },

  device: { lifecycle: "Жизненный цикл",
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

  lake: {
    myLakes: 'Мои пруды',
    create: 'Добавить пруд',
    edit: 'Редактировать пруд',
    detail: 'Информация о пруде',
    empty: 'Прудов пока нет. Добавьте новый.',
    name: 'Название пруда',
    description: 'Описание',
    district: 'Район',
    lat: 'Широта (lat)',
    lng: 'Долгота (lng)',
    area: 'Площадь (га)',
    depth: 'Средняя глубина (метры)',
    volume: "Объём воды (m\u00b3)",
    species: 'Виды рыб (через запятую)',
    coordsAutoParsed: "Координаты автоматически распознаны!",
    devices: 'устройств',
    attachedDevices: 'Привязанные устройства',
    noDevices: 'Нет привязанных устройств',
    selectDevice: 'Выберите устройство',
    assign: 'Привязать',
    unassign: 'Отвязать',
    assigned: 'Привязано',
    unassigned: 'Отвязано',
    archive: 'Архивировать',
    archived: 'Архивировано',
    activate: 'Активировать',
    deactivate: 'Деактивировать',
    status_active: 'Активен',
    status_inactive: 'Неактивен',
    status_archived: 'Архивирован',
  },

  tm: { status: "Статус",
    dashboard: 'Мониторинг',
    deviceDetail: 'Детали устройства',
    empty: 'Пока нет прудов или устройств',
    online: 'онлайн',
    offline: 'офлайн',
    avgDo: 'Средний DO',
    avgTemp: 'Средняя темп.',
    avgPh: 'Средний pH',
    health: 'Здоровье',
    lastUpdate: 'Обновлено',
    alarm: 'Тревога',
    justNow: 'сейчас',
    minAgo: 'мин назад',
    hourAgo: 'ч назад',
    sensors: 'Датчики',
    do: 'Раств. кислород (DO)',
    temp: 'Температура',
    ph: 'pH',
    battery: 'Батарея',
    rssi: 'Сигнал (RSSI)',
    telemetryAge: 'Возраст телеметрии',
    deviceInfo: 'Информация об устройстве',
    firmware: 'Прошивка',
    gateway: 'Шлюз',
    region: 'Регион',
    lake: 'Пруд',
    owner: 'Владелец',
    you: 'Вы',
    history: 'Аналитика и График',
    historyHint: 'Выберите временной интервал:',
    points: 'измерений',
    range_1h: "Час",
    range_24h: "24 часа",
    range_7d: "Неделя",
    range_30d: "Месяц",
    range_365d: "Год",
    do_oxy: "Раств. кислород (DO)",
    temp_water: "Температура",
    ph_water: "Показатель pH",
    offlineBanner: 'Нет интернета — показаны последние сохранённые данные',
    status_healthy: 'Здоров',
    status_good: 'Хорошо',
    status_warning: 'Предупреждение',
    status_critical: 'Критично',
    status_offline: 'Офлайн',
    status_unknown: 'Неизвестно',
  },
};


// --- Sprint-5.5 MD3 ---
ru.nav = { home: 'Главная', lakes: 'Пруды', devices: 'Устройства', alerts: 'Уведомления', profile: 'Профиль' };
ru.alerts = { none: 'Нет уведомлений', allGood: 'Все устройства в норме' };
Object.assign(ru.home, { hi: 'Привет', lakes: 'Пруды', devices: 'Устройства', online: 'Онлайн', alerts: 'Тревоги', emptyHint: 'Добавьте пруд или устройство, чтобы начать', contactAdmin: 'Свяжитесь с администратором' });
Object.assign(ru.common, { edit: 'Изменить' });
Object.assign(ru.settings, { darkMode: 'Тёмная тема', about: 'О приложении', logoutConfirm: 'Вы действительно хотите выйти?' });
Object.assign(ru.lake, { archiveConfirm: 'Пруд будет архивирован и скрыт из списка. Продолжить?', lakeName: 'Название пруда (необязательно)', restore: 'Восстановить', restored: 'Восстановлен', restoreConfirm: 'Вы хотите восстановить этот пруд из архива?', archivedLakes: 'Архивированные пруды', emptyArchived: 'Архивированных прудов нет' });
Object.assign(ru.device, { unassigned: 'Не привязано', empty: 'Пока нет устройств', emptyHint: 'Используйте код активации для добавления', claimHint: 'ID и ключ активации указаны на упаковке' });

Object.assign(ru.nav, { dashboard: 'Панель', monitoring: 'Мониторинг', users: 'Пользователи', approvals: 'Подтверждение', audit: 'Журнал аудита', settings: 'Настройки' });
Object.assign(ru.common, { search: 'Поиск...', noData: 'Нет данных', approve: 'Подтвердить', reject: 'Отклонить' });
Object.assign(ru.device, { lifecycle: 'Жизненный цикл' });
Object.assign(ru.tm, { status: 'Статус' });
Object.assign(ru.settings, { role: 'Роль' });
ru.user = Object.assign(ru.user || {}, { active: 'Активен', suspended: 'Заблокирован' });
ru.approval = Object.assign(ru.approval || {}, { approved: 'Подтверждено', rejected: 'Отклонено', empty: 'Нет запросов' });
ru.audit = Object.assign(ru.audit || {}, { time: 'Время', action: 'Действие', actor: 'Исполнитель', target: 'Объект', empty: 'Нет записей аудита (Sprint-7)' });

// --- GW-BRIDGE: команды устройства + пороги кислорода ---
ru.cmd = Object.assign(ru.cmd || {}, {
  control: 'Управление', recent: 'Последние команды', none: 'Команд пока нет',
  sent: 'Команда отправлена', unknown: 'Неизвестно',
  aeratorOn: 'Аэратор ВКЛ (вручную)', aeratorOff: 'Вернуть в АВТО режим',
  modeDo: 'Режим по кислороду', modeTime: 'Режим по расписанию',
  syncTime: 'Синхронизировать время', reqStatus: 'Запросить статус',
  setMindo: 'Минимальный DO (мг/л)', setFarq: 'Достаточная разница (мг/л)', setKritik: 'Критический DO (мг/л)',
  send: 'Отправить',
  deviceNow: 'На устройстве сейчас: {v} мг/л',
  thresholdsHint: 'Значения записываются в память устройства. При изменении с клавиатуры устройства здесь обновится автоматически.',
  rangeErr: 'Значение должно быть целым числом от {min} до {max}',
  ackOk: 'Устройство подтвердило ✓ ({ts})', ackFail: 'Устройство ОТКЛОНИЛО команду ({ts})',
  waitAck: '⏳ Отправлено — ждём ответ устройства...',
  ackedMid: 'Устройство приняло — проверяем сохранение...',
  savedOk: '✓ Изменение СОХРАНЕНО на устройстве',
  ackRejected: '✗ Устройство ОТКЛОНИЛО изменение',
  ackTimeout: '⚠ Устройство не ответило — проверьте связь (значок антенны на LCD)',
});
ru.cmdGroup = Object.assign(ru.cmdGroup || {}, { aerator: 'Аэратор', mode: 'Режим работы', system: 'Система', thresholds: 'Пороги кислорода (устройство)' });
ru.cmdStatus = Object.assign(ru.cmdStatus || {}, { pending: 'Ожидает', sent: 'Отправлено', executed: 'Выполнено', failed: 'Ошибка', expired: 'Просрочено' });
Object.assign(ru.error, { cmdUnsupported: 'Команда не поддерживается устройством или значение неверно' });

export default ru;
