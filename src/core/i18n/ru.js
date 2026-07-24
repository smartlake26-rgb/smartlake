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
Object.assign(ru.settings, { pushOn: 'Уведомления включены', pushOff: 'Уведомления (выключены)', darkMode: 'Тёмная тема', about: 'О приложении', logoutConfirm: 'Вы действительно хотите выйти?' });
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

// --- DASH-V3: Mission Control dashboard + новая навигация ---
Object.assign(ru.nav, { ai: 'AI', reports: 'Отчёт', menu: 'Меню' });
ru.dash = {
  morning: 'Доброе утро', day: 'Здравствуйте', evening: 'Добрый вечер',
  systemHealth: 'Здоровье системы',
  gradeA: 'Отлично', gradeB: 'Хорошо', gradeC: 'Внимание', gradeD: 'Критично',
  healthDetail: 'Здоровье по озёрам',
  onlineLakes: 'Онлайн', offlineLakes: 'Офлайн',
  lastContact: 'Последняя связь', signal: 'Сигнал',
  signal_good: 'Хороший', signal_fair: 'Средний', signal_poor: 'Слабый', signal_unknown: '—',
  noOnline: 'Нет озёр онлайн', allOnline: 'Все озёра онлайн',
  alerts: 'Оповещения', noAlerts: 'Оповещений нет', allCalm: 'Всё спокойно',
  unresolved: 'Не решено', openAlertsPage: 'Показать все',
  aiTitle: 'Рекомендация AI', aiOpen: 'Подробнее',
  aiPlaceholder: 'AI-консультант ждёт накопления данных. Рекомендации появятся здесь после подключения устройств.',
  lakesTitle: 'Озёра', allLakes: 'Все',
  feedToday: 'Корм на сегодня', feedCost: 'Примерная стоимость',
  feedPlaceholder: 'Для расчёта корма укажите данные о рыбе в настройках озера. В будущем будет связано с AI.',
  energy: 'Электроэнергия', energyToday: 'Сегодня', energyWeek: 'Неделя', energyMonth: 'Месяц',
  energyCost: 'Примерный расход', energyHint: 'Рассчитывается по времени работы аэратора. Мощность/тариф — в настройках озера.',
  energyLoad: 'Рассчитать', energyLoading: 'Расчёт...',
  weather: 'Погода', weatherTomorrow: 'Завтра',
  weatherPlaceholder: 'Погода появится после указания расположения озера.',
  updated: 'Обновлено',
};
ru.menu = {
  title: 'Меню',
  profile: 'Профиль', profileSub: 'Личные данные',
  devices: 'Устройства', devicesDesc: 'Состояние датчиков и подключение',
  settings: 'Настройки', settingsDesc: 'Тема, язык и выход',
  alerts: 'Уведомления', alertsDesc: 'История оповещений',
  theme: 'Тёмный режим', themeDesc: 'Переключить оформление',
};
// --- LAKES-V3: страница озёр (премиум мониторинг) ---
ru.lakespg = {
  total: 'Всего', online: 'Онлайн', offline: 'Офлайн', alerts: 'Оповещения',
  searchPh: 'Поиск по названию озера...',
  sortBy: 'Сортировка', sort_name: 'Название', sort_health: 'Здоровье',
  sort_online: 'Онлайн-статус', sort_updated: 'Обновление',
  noResults: 'Озёра по запросу не найдены',
  slowLoad: 'Загрузка занимает больше времени, чем обычно',
  loadErrorDesc: 'Проверьте интернет-соединение и повторите попытку',
  retry: 'Повторить',
  offlineNet: 'Нет интернет-соединения — показаны последние данные из кэша',
  updated: 'Обновлено',
};

// --- LAKEDET-V4: страница озера (центр управления) ---
ru.lakedet = {
  tab_now: 'Текущее состояние', tab_history: 'История', tab_ai: 'AI совет', tab_settings: 'Настройки',
  health: 'Здоровье озера',
  aiReady: 'Оценка готова к расчёту AI',
  norm: 'Норма', trendStable: 'стабильно',
  min: 'Мин', avg: 'Среднее', max: 'Макс',
  detailChart: 'последние 24 часа', do24: 'Кислород — последние 24 часа',
  rangeStats: 'Статистика за период',
  battery: 'Батарея',
  aerator: 'Управление аэратором', working: 'Работает', stopped: 'Остановлен',
  forceOn: 'Принудительно ВКЛ', forceOff: 'Принудительно ВЫКЛ',
  offNote: 'Принудительное ВЫКЛ отсутствует в прошивке устройства — кнопка AUTO возвращает устройство в автоматический режим (так спроектировано ради безопасности).',
  mode: 'Режим', manual: 'Ручной (принудительный)', autoDo: 'AUTO — по кислороду', autoTime: 'AUTO — по расписанию',
  lastCmd: 'Последняя команда', lastOn: 'Последнее включение',
  runToday: 'Сегодня работал', runWeek: 'За неделю',
  kwhToday: 'Электроэнергия сегодня', kwhMonth: 'За месяц',
  energyNeedKw: 'кВт не указан (Настройки → Аэраторы)',
  feed: 'Рекомендация по корму', feedMealOnce: 'Время кормления и разовая порция',
  biomass: 'Биомасса', rate: 'Дневная норма', feedTotal: 'Всего корма сегодня', feedCost: 'Примерная стоимость',
  feedAiNote: 'Расчёт: количество рыбы × средний вес × температура воды × таблица корма. В будущем уточняется AI.',
  feedEmpty: 'Для плана кормления укажите данные о рыбе.',
  toSettings: 'Перейти в настройки',
  conn: 'Состояние связи',
  weatherRegion: 'Погода региона', weatherToday: 'Сегодня', weatherTomorrow: 'Завтра',
  loadingWeather: 'Загрузка погоды...',
};

// --- HIST-V3: История и отчёт (аналитический центр) ---
ru.hist = {
  title: 'История и отчёт',
  f_today: 'Сегодня', f_yesterday: 'Вчера', f_7d: '7 дней', f_30d: '30 дней', f_year: 'Год', f_custom: 'Дата',
  from: 'С', to: 'По', show: 'Показать', pickDate: 'Выберите дату',
  sum_do: 'Средний DO', sum_temp: 'Средняя темп.', sum_ph: 'Средний pH', sum_tds: 'Средний TDS',
  sum_runtime: 'Наработка аэратора', sum_energy: 'Расход электроэнергии', sum_feed: 'Количество корма',
  rows: 'Строк',
  colDate: 'Дата', colTime: 'Время', colStatus: 'Статус', colOnline: 'Замеры',
  st_normal: 'Норма', st_warn: 'Внимание', st_crit: 'Критично',
  searchPh: 'Дата, значение или статус...', statusFilter: 'Статус',
  tableTitle: 'История сенсоров',
  chartsTitle: 'Графики',
  chart_energyDaily: 'Электроэнергия — кВтч в день', chart_feedDaily: 'Корм — кг в день',
  detailChart: 'Подробный график',
  energyTitle: 'Электроэнергия', kw: 'Мощность (кВт)', tariff: 'Тариф (сум/кВтч)',
  runTime: 'Наработка аэратора', consumption: 'Расход', cost: 'Примерная стоимость',
  perAerator: 'По аэраторам', aerN: 'Аэратор', needAer: 'Данные аэраторов вводятся в Настройках',
  e_today: 'Сегодня', e_week: 'Неделя', e_month: 'Месяц', e_total: 'Итого за период',
  widen: 'Расширьте период для этого значения',
  energyNote: 'Наработка восстанавливается по состоянию реле в телеметрии; расчёт за выбранный период.',
  feedTitle: 'Статистика корма',
  fd_today: 'Сегодня', fd_week: 'За неделю', fd_month: 'За месяц', fd_year: 'За год', fd_total: 'Итого за период',
  meals: 'Время кормления', mealType: 'Тип корма',
  feedNote: 'Ставка зависит от средней темп. периода; итог — дневной план × дни (оценка).',
  needFish: 'Укажите данные о рыбе и корме в Настройках — расчёт включится автоматически.',
  exportTitle: 'Скачать отчёт',
  exportHint: 'Выбранный период: история сенсоров + электроэнергия + корм',
  noExport: 'Нет данных для экспорта',
  empty: 'Нет данных за период',
  emptyDesc: 'Архив копится с момента работы приложения',
  loadError: 'Не удалось загрузить данные',
  retry: 'Повторить',
  pullRefresh: 'Потяните для обновления',
  refreshed: 'Обновлено',
  sheetHistory: 'История', sheetEnergy: 'Электро', sheetFeed: 'Корм',
  param: 'Показатель', value: 'Значение',
};

// --- DASH-V4 + ANN-V1: упрощённый дашборд и Объявления ---
Object.assign(ru.nav, { announcements: 'Объявления' });
Object.assign(ru.dash, {
  activeDevices: 'Активные устройства',
  onlineDevices: 'Онлайн', offlineDevices: 'Офлайн',
  todayFeed: 'Корм на сегодня', feedNoData: 'Корм: укажите рыбу в Настройках',
  recentAlerts: 'Последние оповещения',
});
ru.ann = {
  title: 'Объявления', subtitle: 'Сообщения от команды SmartLake',
  type_news: 'Новость', type_video: 'Видеоурок', type_warning: 'Важно',
  type_maintenance: 'Тех. работы', type_tip: 'Совет',
  open: 'Открыть',
  empty: 'Объявлений пока нет',
  emptyDesc: 'Новости, видеоуроки и советы от SuperAdmin появятся здесь',
  onDash: 'Объявления',
  seeAll: 'Показать все',
};

// --- LAKES-V4: упрощённый каталог ---
Object.assign(ru.lakespg, {
  flt_healthy: 'Здоровые', flt_normal: 'Норма', flt_problem: 'Проблемные',
  feedPending: 'Пока не рассчитано',
});

// --- LAKEDET-V5: Lake Control Center + настройки с каталогом ---
Object.assign(ru.lakedet, {
  do48: 'Кислород — последние 48 часов',
  deviceOf: 'Устройство',
  signalQ: 'Качество связи',
  sensorAbsent: 'Датчик отсутствует',
  sensorDisabled: 'Датчик отключён',
  sensorCalib: 'Требуется калибровка',
});
ru.lset = {
  passport: 'Паспорт озера',
  area: 'Площадь (га)', avgDepth: 'Средняя глубина (м)', maxDepth: 'Макс. глубина (м)',
  fishTitle: 'Виды рыбы (макс {n})',
  fishN: 'Рыба', type: 'Вид', pickType: 'Выберите из каталога',
  count: 'Кол-во (шт)', startW: 'Нач. вес (г)', avgW: 'Тек. вес (г)',
  stockedAt: 'Дата зарыбления',
  dead: 'Падёж (шт)', deadBtn: 'Внести падёж', deadDone: 'Вычтено {n} — не забудьте Сохранить',
  enterNum: 'Введите число',
  addFish: '+ Добавить рыбу', noFish: 'Рыба ещё не добавлена',
  biomass: 'Общая биомасса',
  estW: 'Оценка текущего веса (по кормовому коэффициенту)', apply: 'Применить',
  noGrowth: 'Этот вид не растёт на корме — авторасчёт веса не применяется',
  estHint: 'Для расчёта нужны начальный вес и дата зарыбления',
  feedTitle: 'Корм', feedType: 'Тип корма (из каталога)', price: 'Цена (сум/кг)',
  fromCatalog: 'Протеин {p}% · FCR {f} — из каталога',
  aerTitle: 'Аэраторы', aerCount: 'Кол-во', aerKw: 'Мощность одного (кВт)',
  aerTariff: 'Цена эл-ва (сум/кВтч)',
  tariffTitle: 'Цена электроэнергии',
  tariffNote: 'Это значение используется в Отчёте для расчёта расхода. Изменяется только здесь.',
  aerNote: 'При сохранении общая мощность в Отчёте (кол-во × кВт) обновится автоматически.',
  fishSaved: 'Данные рыбы сохранены',
  metaNote: 'Эти данные хранятся только в Firebase — на устройство не отправляются. Расчёты корма и электроэнергии питаются отсюда.',
  legacy: '(старая запись)',
};

// --- SENSOR-STATE: статус датчиков (AI + UI) ---
ru.sensor = {
  absent:       'Датчик отсутствует',
  disconnected: 'Нет связи',
  disabled:     'Датчик отключён',
  faulty:       'Датчик неисправен',
  calibration:  'Требуется калибровка',
  noDoAdvice:   'Данные датчика кислорода (DO) недоступны — рекомендации по кислороду не сформированы.',
  noTempAdvice: 'Данные датчика температуры недоступны — зависящие от температуры советы не выданы.',
  noPhAdvice:   'Датчик pH не установлен — анализ pH не выполнен.',
  noDataAdvice: 'Надёжные данные от датчиков отсутствуют. Проверьте подключение устройства.',
  partialAdvice:'Некоторые датчики не работают — совет основан только на доступных данных.',
};

ru.reports = {
  title: 'Отчёт',
  pickLake: 'Выберите озеро',
  empty: 'Сначала добавьте озеро',
  hint: 'Замеры за период, корм и электроэнергия, экспорт XLSX/CSV/PDF',
};

// --- LAKEDET-V4: центр управления озером ---
ru.lakedet = {
  tab_now: 'Текущее', tab_history: 'История', tab_ai: 'AI совет', tab_settings: 'Настройки',
  health: 'Здоровье озера', aiReady: 'В будущем рассчитает AI',
  norm: 'Норма', trendStable: 'стабильно',
  detailChart: 'График за 24 часа', min: 'Минимум', avg: 'Среднее', max: 'Максимум',
  do24: 'Кислород — 24 часа',
  aerator: 'Управление аэратором', working: 'РАБОТАЕТ', stopped: 'ОСТАНОВЛЕН',
  forceOn: 'Принуд. ВКЛ', forceOff: 'Принуд. ВЫКЛ',
  offNote: 'Принудительного ВЫКЛ в устройстве нет — в AUTO устройство отключает само при достатке кислорода (защита рыбы).',
  mode: 'Режим', manual: 'РУЧНОЙ', autoDo: 'АВТО (кислород)', autoTime: 'АВТО (время)',
  lastCmd: 'Последняя команда', lastOn: 'Последнее включение',
  runToday: 'Наработка сегодня', runWeek: 'Наработка за неделю',
  kwhToday: 'Эл-во сегодня', kwhMonth: 'Эл-во за месяц',
  energyNeedKw: 'кВт/тариф — Настройки > Аэраторы',
  feed: 'Рекомендация корма', feedMealOnce: 'За один раз', feedTotal: 'Всего сегодня',
  feedCost: 'Примерная цена', biomass: 'Биомасса', rate: 'Ставка',
  feedAiNote: 'Расчёт: кол-во рыбы × вес × температура × тип корма. В будущем уточнит AI.',
  feedEmpty: 'Для расчёта укажите в Настройках вид, количество и вес рыбы.',
  toSettings: 'К настройкам',
  conn: 'Состояние связи', battery: 'Батарея',
  weatherToday: 'Сегодня', weatherTomorrow: 'Завтра (прогноз)', weatherRegion: 'Погода региона',
  loadingWeather: 'Загрузка погоды...',
  rangeStats: 'Статистика за период',
};

// --- HIST-V4 + REP-V1: чистая история данных и модуль отчёта ---
Object.assign(ru.hist, {
  zoomIn: 'Приблизить', zoomOut: 'Отдалить', resetZoom: 'Сбросить',
  panPrev: 'Предыдущий отрезок', panNext: 'Следующий отрезок',
  exportFull: 'В экспорт попадают ВСЕ записи выбранного периода — данные не усекаются',
});
Object.assign(ru.reports, {
  hint: 'Электроэнергия, статистика корма и финансовый итог. История сенсоров: страница озера → История',
});
ru.rep = {
  finance: 'Финансовый итог',
  finTotal: 'Итого расходов (период)',
  scope: 'Электро · Корм · Финансы',
};

export default ru;
