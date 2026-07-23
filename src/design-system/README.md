# SmartLake Design System 3.0 — «Chuqurlik»

Baliq ko'llari monitoringi uchun premium, kengaytiriladigan dizayn tizimi.
Asos: Material Design 3 (token arxitekturasi, holat qatlamlari) + Apple HIG
(aniqlik, tabiiy harakat) — lekin nusxa emas: SmartLake'ning o'z imzosi bor.

## Imzo — nima uni o'ziga xos qiladi

1. **Chuqurlik metaforasi.** Interfeys suv qatlamlari kabi quriladi: fon —
   suv yuzasi, kartalar — sayoz qatlam, dialog — eng yuza. Soyalar qora emas,
   **teal-tusli** (`rgba(10,59,51,…)`) — element «suvga qancha botgani»ni
   bildiradi.
2. **Raqam — bosh qahramon.** Webfont ataylab yo'q (qishloq interneti, PWA
   offline start). Xarakter raqam muomalasida: barcha sensor qiymatlari
   `tabular-nums` (`.sl-num-*`) — DO 7.6→10.2 bo'lganda karta «titramaydi».
3. **Quyosh sharti.** Qurilma ochiq havoda ishlatiladi — matn `#071A16`gacha
   quyuq, status ranglari AA kontrastga kalibrlangan (warning `#B36A00`).
4. **AI — alohida ovoz.** AI maslahatchi suv palitrasidan ataylab ajralib
   turadigan **iris** (`--sl-ai`) rangida — foydalanuvchi bir qarashda
   «bu o'lchov emas, tavsiya» ekanini biladi.

## Papka strukturasi

```
src/design-system/
  index.css            ← CSS yagona kirish (tokenlar + stillar)
  index.js             ← JS yagona kirish (barcha fabrikalar)
  tokens/
    colors.css         ← semantik ranglar (light + dark)
    typography.css     ← shrift shkalasi + .sl-* utility'lar
    spacing.css        ← 4…96 shkala + layout yordamchilari
    radius.css         ← burchak tokenlari
    shadow.css         ← chuqurlik soyalari (level1..premium)
    motion.css         ← tezlik/easing/z-index + keyframe'lar
    charts.css         ← grafik ranglari + SVG klasslari + tooltip
  styles/
    base.css           ← .sl-app qobig'i, fokus halqasi, reduced-motion
    buttons.css        ← tugma variantlari/o'lchamlari/holatlari
    cards.css          ← karta oilasi + ro'yxat + bo'sh holat
    inputs.css         ← forma maydonlari + error/success
    tables.css         ← jadval + badge'lar
    feedback.css       ← skeleton/loader/toast/banner/dialog/tab
  components/
    icons.js           ← slIcon + ICON_SIZES + ICONS semantik xarita
    button.js          ← slButton / slIconButton / slFab
    badge.js           ← slBadge / slStatusBadge / slDotBadge
    card.js            ← slCard + 12 ixtisoslashgan karta
    input.js           ← slField (7 tur, holat API'si)
    table.js           ← slTable (sort/filter/pagination/eksport-ready)
    chart.js           ← yagona SVG grafik dvigateli
    index.js           ← komponentlar ochiq API'si
```

## Token qatlamlari

Komponentlar **faqat semantik qatlamni** ishlatadi (`--sl-primary`,
`--sl-card`, `--sl-text-secondary`…). Primitivlar (`--sl-lake-40`) faqat
token fayllari ichida. Komponent/ekran kodida **hex yozish taqiqlanadi**.

| Guruh | Tokenlar (qisqacha) |
|---|---|
| Rang | primary/secondary · background/surface/card/inset · border/divider · text-{primary,secondary,disabled} · success/warning/error/critical/healthy/info/online/offline/**ai** (+ *-soft fonlar) |
| Shrift | display/headline/title/subtitle/body/body-sm/label/caption — har biri size+weight+lh+ls; `sl-num-{lg,md,sm}` |
| Bo'shliq | `--sl-sp-1…12` = 4,8,12,16,20,24,32,40,48,64,80,96 + page-pad/card-pad/section-gap |
| Burchak | sm 8 · md 12 · lg 16 · xl 20 · xxl 28 · full + r-card/r-input/r-dialog |
| Soya | shadow-1/2/3 · floating · dialog · modal · **premium** (dark variantlari bilan) |
| Harakat | fast 120 / base 200 / slow 320 / slower 480 · ease/ease-out/ease-spring · stagger · z-shkala |
| Grafik | chart-{do,temp,ph,battery,rssi,energy,feed} + umumiy 1..5 · grid/axis/threshold/cursor · gauge-track · tooltip |

## Foydalanish namunasi (migratsiya bosqichida)

```js
import '../design-system/index.css';
import { slLakeCard, slButton, slLineChart, slChartLegend }
  from '../design-system/index.js';

const card = slLakeCard({
  name: lake.name,
  status: agg.status, statusLabel: t('tm.status_' + agg.status),
  meta: `${agg.deviceCount} qurilma`,
  cells: [
    { icon: 'waves', label: 'DO', value: agg.avgDo, unit: 'mg/L', colorVar: '--sl-chart-do' },
    { icon: 'thermometer', label: t('tm.temp'), value: agg.avgTemp, unit: '°C', colorVar: '--sl-chart-temp' },
  ],
  onClick: () => nav.push(...),   // avtomatik role=button + Enter/Space
});
```

## Qoidalar (enforcement)

1. Hex faqat `tokens/` ichida. Ekranlarda — faqat `var(--sl-*)`.
2. Spacing faqat `--sl-sp-*` dan. `padding: 9px` — taqiq.
3. Font-weight faqat 400/500/600/700/800.
4. Grafik ranglari faqat `sl-series-*` / `--sl-chart-*` orqali.
5. Yangi komponentdan oldin `components/index.js`ni tekshiring —
   dublikat yaratmang; yetmasa, mavjudini kengaytiring.
6. Bosiladigan elementlar `<div onClick>` emas — DS fabrikalari
   (klaviatura + aria avtomatik) yoki `<button>`.

## Nima QILINMAYDI

- Firmware/Gateway/Node/LoRa, Firebase realtime mexanizmi, sensor
  ma'lumot formati — bu DS'ning qamrovi emas va unga tegilmaydi.
- Business logic komponentlarga kirmaydi: fabrikalar faqat props oladi.

## Migratsiya tartibi (keyingi bosqichlar, har biri alohida tasdiq bilan)

1. Auth + Onboarding → `.sl-app` + DS forma/tugmalar
2. Bosh sahifa (Dashboard) → slStatCard/slLakeCard/slSensorCard/slAiCard
3. Ko'l sahifasi + Qurilma sahifasi → slChartCard + chart.js (3 nusxadagi
   grafik kodi bitta dvigatelga tushadi)
4. Tarix sahifasi → slTable (eksport-ready) + slSummaryCard/slEnergyCard/slFeedCard
5. AI sahifasi → slAiCard oilasi
6. Sozlamalar → slField/slListItem
7. Admin panel → slTable + tokenlar
