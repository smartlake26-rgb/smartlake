# SmartLake Design System v2

Qamrov: faqat frontend prezentatsiya qatlami. Firmware, protokollar, Firebase sinxronlash — tegilmagan.
Fayllar: `src/shared/ui/tokens.css` (tokenlar) va `src/shared/ui/ui.css` (komponentlar).
Moslik kafolati: v1 dagi barcha CSS o'zgaruvchi va klass nomlari saqlangan (superset) — mavjud ekranlar kod o'zgarishisiz yangi ko'rinishga o'tadi.

## 1 · Tahlil xulosasi (joriy UI)

Kuchli tomonlar: MD3 token poydevori bor, light/dark ishlaydi, 480px mobil shell, teal brend izchil.
Muammolar: (1) forma fokusi border-width bilan — bosilganda kontent 1px "sakraydi"; (2) sensor raqamlari oddiy shriftda — yangilanishda kenglik o'ynaydi; (3) soyalar neytral-qora — brend bilan bog'lanmagan; (4) fokus halqasi yo'q — klaviatura/accessibility kamchiligi; (5) `base.css`da parallel eski palitra (#007090) — auth ekranlari boshqa tilda gaplashadi; (6) grafik ranglari inline hex — dark rejimda moslashmaydi; (7) status ranglari (warning #E28413) och fonda AA kontrastdan pastroq; (8) reduced-motion hurmat qilinmaydi.

## 2 · Dizayn qarorlari (nega shunday)

**Rang — "suv chuqurligi" ramp'i.** Brend teal `#0E7C6B` o'zgarmagan (rebrending emas), atrofida 13 pog'onali tonal narvon (`--lake-05…99`) qurildi — endi har bir sirt/soya/hover shu narvondan olinadi, palitra "sochilib" ketmaydi. Matn `#071A16` gacha quyuqlashtirildi — qurilma **ochiq havoda, quyoshda** ishlatiladi, kontrast bu yerda estetika emas, funksiya. Status ranglari AA ga kalibrlandi (warning `#B36A00`).

**Tipografiya — raqam birinchi.** Webfont ataylab yo'q: ferma sharoitida sekin internet, PWA birinchi ochilishda ham shrift "sakramasligi" kerak. Tizimning imzosi shrift tanlovida emas, **raqam muomalasida**: barcha sensor qiymatlari `tabular-nums` (`.t-num-lg/.t-num-md`) — DO 7.6→10.2 ga o'zgarganda raqam eni o'zgarmaydi, kartalar "titramaydi". Shkala: display 34 / headline 26 / title 18 / body 15 / label 12 (uppercase) / num-lg 34.

**Spacing.** 4px grid, v1 qiymatlari aynan saqlangan, `--sp-0…10` gacha kengaytirildi. Uch semantik token: `--page-pad` (ekran cheti), `--card-pad` (18px), `--section-gap` — bo'shliqlar endi bitta joydan boshqariladi.

**Elevation — teal soyalar.** 6 pog'ona (`--elev-0…5`), hammasi `rgba(10,59,51,…)` — soya ham brendning bir qismi, "suvga chuqurroq botish" hissi. Yangi `--focus-ring` — butun tizimda yagona fokus halqasi.

**Tugmalar.** 5 variant saqlangan + 3 o'lcham (`.sm` 36 / standart 44 / `.lg` 52) + `.is-loading` (ichki spinner, matn yashirinadi) + `:focus-visible` halqa + bosishda `scale(.97)`. Gradient `--btn-grad` tokenga ko'chirildi — dark rejimda avtomatik pasaytirilgan versiya.

**Kartalar.** `--shape-card: 20px` yagona manba. Variantlar: asos (oq, elev-1) / `.elev` / `.tap` (hover −2px, elev-3) / yangi `.inset` (ichki panel, soyasiz). Fon `container-lowest` (toza oq) — kontent bilan fon orasidagi iyerarxiya kuchaydi.

**Formalar.** Asosiy tuzatish: fokus endi **box-shadow halqa** — border-width o'zgarmaydi, layout-shift yo'q. Qo'shildi: hover holati, placeholder rangi, `.md-field.invalid` (label+border+help qizil), `.md-help` yordam matni, disabled.

**Grafiklar.** `--chart-*` token bloki: DO=teal, pH=binafsha `#7C5CBF`, harorat=apelsin `#E07B39` (uchtasi bir grafikda adashmaydi, dark'da och versiyalar), grid/axis/threshold(shtrix)/gauge-track. `.chart-line.do` kabi klasslar tayyor — 2-bosqichda SVG'lardagi inline hex'lar shularга o'tkaziladi.

**Sifat polи.** `:focus-visible` global, `prefers-reduced-motion` to'liq, `::selection` brendda, ≥768px da shell yumshoq ramkaga o'tiradi (desktop'da telefon-preview hissi), z-index shkala tokenlashtirildi.

## 3 · O'rnatish

Ikkala faylni almashtiring — boshqa hech narsa o'zgarmaydi:
```
src/shared/ui/tokens.css
src/shared/ui/ui.css
```

## 4 · Keyingi bosqichlar (navbat bilan, har biri alohida tasdiq bilan)

1. **Ekran: Bosh sahifa (bento)** — yangi tokenlarda qayta terish, `.t-num` qo'llash
2. **Ekran: Qurilma sahifasi** — sensor kartalari, grafiklarni `.chart-*` ga o'tkazish, gauge yangilash
3. **Auth ekranlari** — `base.css` eski palitrasini tizimga birlashtirish
4. **Admin dashboard** — sidebar/jadvallar yangi tokenlarda
5. **Mikro-animatsiyalar** — sahifa o'tishlari, qiymat o'zgarish "tick" effekti
