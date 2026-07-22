// ============================================================
//  features/telemetry/views/historyTab.js — TARIX tabi (B-bosqich)
//  Filtrlar (Bugun/Hafta/Oy/Yil/Sana) + jadval + XLSX/CSV/PDF
//  eksport + elektr hisobi (kW/tarif kiritiladi) + yem bo'limi joyi.
//  Ma'lumot: telemetryArchive (Firestore) ∪ qurilmaning 24h buferi.
//  Eksport kutubxonalari (xlsx, jspdf) faqat bosilganda yuklanadi
//  (dynamic import) — asosiy bundle sekinlashmaydi.
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { icon } from '../../../shared/icons.js';
import { toast } from '../../../shared/toast.js';
import { mdCard, mdButton, input } from '../../../shared/ui/index.js';
import { historyService } from '../services/historyService.js';
import {
  fetchArchive, aggregateSamples, aeratorRuntimeMs, loadLakeMeta, saveLakeMeta,
} from '../services/archiveService.js';

const DAY = 24 * 3600e3;

function fmtDate(ts) { const d = new Date(ts); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`; }
function fmtTime(ts) { const d = new Date(ts); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getHours())}:${p(d.getMinutes())}`; }
function fmtDur(ms, isUz) {
  const m = Math.round(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} ${isUz ? 'soat' : 'ч'} ${m % 60} ${isUz ? 'daq' : 'мин'}` : `${m} ${isUz ? 'daq' : 'мин'}`;
}
function nfmt(v, d = 1) { return v == null ? '—' : Number(v).toFixed(d); }

/**
 * Tarix tabini quradi. Bir marta yaratiladi, o'z holatini o'zi boshqaradi.
 * @param {{lakeId:string, uid:string, isUz:boolean, getDevs:()=>Array, getTh:()=>object}} p
 */
export function buildHistoryTab({ lakeId, uid, isUz, getDevs, getTh }) {
  // ---------- holat ----------
  let filter = 'bugun';
  let customFrom = null, customTo = null;
  let samples = [];   // xom sample'lar (elektr hisobi uchun)
  let rows = [];      // agregatsiyalangan jadval qatorlari
  let loading = false;
  let meta = null;    // lakeMeta (kW, tarif)

  const FILTERS = [
    ['bugun', isUz ? 'Bugun' : 'Сегодня'],
    ['hafta', isUz ? 'Hafta' : 'Неделя'],
    ['oy', isUz ? 'Oy' : 'Месяц'],
    ['yil', isUz ? 'Yil' : 'Год'],
    ['sana', isUz ? 'Sana' : 'Дата'],
  ];

  function rangeFor(f) {
    const now = Date.now();
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    if (f === 'bugun') return [startToday.getTime(), now];
    if (f === 'hafta') return [now - 7 * DAY, now];
    if (f === 'oy') return [now - 30 * DAY, now];
    if (f === 'yil') return [now - 365 * DAY, now];
    return [customFrom || startToday.getTime(), (customTo || now) + DAY - 1];
  }
  function bucketFor(spanMs) {
    if (spanMs <= DAY) return 30 * 60e3;         // 30 daq
    if (spanMs <= 7 * DAY) return 3 * 3600e3;    // 3 soat
    if (spanMs <= 31 * DAY) return 12 * 3600e3;  // 12 soat
    return DAY;                                   // 1 kun
  }

  // ---------- elementlar ----------
  const filterBtns = new Map();
  const customRow = el('div', { style: 'display:none;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap' });
  const fromIn = input({ type: 'date' }); const toIn = input({ type: 'date' });
  customRow.style.display = 'none';
  customRow.append(
    el('span', { class: 't-caption', text: isUz ? 'Dan:' : 'С:' }), fromIn,
    el('span', { class: 't-caption', text: isUz ? 'Gacha:' : 'По:' }), toIn,
    mdButton({ label: isUz ? "Ko'rsatish" : 'Показать', variant: 'tonal', onClick: () => {
      customFrom = fromIn.value ? new Date(fromIn.value + 'T00:00:00').getTime() : null;
      customTo = toIn.value ? new Date(toIn.value + 'T00:00:00').getTime() : null;
      if (!customFrom) { toast(isUz ? 'Sanani tanlang' : 'Выберите дату', 'err'); return; }
      loadData();
    } }),
  );

  const tableBox = el('div', { style: 'margin-top:10px;overflow-x:auto' });
  const summaryBox = el('div', { style: 'margin-top:8px' });
  const energyBox = el('div', {});
  const feedBox = el('div', {});

  const filterRow = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, FILTERS.map(([id, label]) => {
    const b = el('button', { class: 'md-tab' + (id === filter ? ' active' : ''), style: 'flex:none;padding:7px 13px;font-size:12px', text: label });
    b.addEventListener('click', () => {
      filter = id;
      filterBtns.forEach((x, xid) => x.classList.toggle('active', xid === filter));
      customRow.style.display = id === 'sana' ? 'flex' : 'none';
      if (id !== 'sana') loadData();
    });
    filterBtns.set(id, b);
    return b;
  }));

  // ---------- ma'lumot yuklash ----------
  async function loadData() {
    if (loading) return;
    loading = true;
    mount(tableBox, el('div', { class: 'sk sk-card', style: 'height:120px' }));
    try {
      const devs = getDevs();
      const ids = devs.map((d) => d.id);
      const [fromTs, toTs] = rangeFor(filter);

      // Arxiv + (davr bugunni qamrasa) qurilmaning 24h buferi
      const arch = await fetchArchive(uid, ids, fromTs, toTs).catch((e) => {
        toast((isUz ? 'Arxiv indeksi kerak: ' : 'Нужен индекс: ') + (e && e.message || ''), 'err');
        return [];
      });
      let rtdb = [];
      if (toTs >= Date.now() - DAY && ids.length) {
        const pts = await historyService.getHistory(ids[0], '24h').catch(() => []);
        rtdb = pts.filter((x) => x.ts >= fromTs && x.ts <= toTs);
      }
      // Birlashtirish: 5-daqiqalik katak bo'yicha dedupe (arxiv ustuvor)
      const seen = new Set(arch.map((x) => Math.floor(x.ts / 300e3)));
      samples = arch.concat(rtdb.filter((x) => !seen.has(Math.floor(x.ts / 300e3))))
        .sort((a, b) => a.ts - b.ts);

      rows = aggregateSamples(samples, bucketFor(toTs - fromTs));
      renderTable();
      renderSummary(fromTs, toTs);
      renderEnergy(fromTs, toTs);
    } finally { loading = false; }
  }

  // ---------- jadval ----------
  function statusOf(doAvg) {
    const th = getTh();
    if (doAvg == null) return ['—', 'var(--md-neutral)'];
    if (doAvg < th.do.crit) return [isUz ? 'Kritik' : 'Критично', 'var(--md-critical)'];
    if (doAvg < th.do.warn) return [isUz ? 'Ogoh' : 'Внимание', 'var(--md-warning)'];
    return [isUz ? 'Normal' : 'Норма', 'var(--md-success)'];
  }
  function renderTable() {
    if (!rows.length) {
      mount(tableBox, el('div', { class: 't-body-sm muted', style: 'text-align:center;padding:20px 0',
        text: isUz ? "Bu davr uchun ma'lumot yo'q (arxiv ilova ishlagan paytdan yig'iladi)" : 'Нет данных за период (архив копится с момента работы приложения)' }));
      return;
    }
    const shown = rows.slice(-300).reverse();
    const thCell = (txt) => el('th', { style: 'text-align:left;padding:7px 9px;font-size:11px;color:var(--md-on-surface-variant);font-weight:700;letter-spacing:.03em;text-transform:uppercase;border-bottom:1.5px solid var(--md-outline-variant);white-space:nowrap', text: txt });
    const td = (txt, extra = '') => el('td', { style: 'padding:7px 9px;font-size:12.5px;border-bottom:1px solid var(--md-outline-variant);font-variant-numeric:tabular-nums;white-space:nowrap;' + extra, text: txt });
    const table = el('table', { style: 'width:100%;border-collapse:collapse;background:var(--md-surface-container-lowest);border-radius:var(--shape-md);overflow:hidden;border:1px solid var(--md-outline-variant)' }, [
      el('thead', {}, [el('tr', {}, [
        thCell(isUz ? 'Sana' : 'Дата'), thCell(isUz ? 'Vaqt' : 'Время'),
        thCell('DO'), thCell(isUz ? 'Harorat' : 'Темп.'), thCell('pH'), thCell(isUz ? 'Holat' : 'Статус'),
      ])]),
      el('tbody', {}, shown.map((r) => {
        const [stTxt, stCol] = statusOf(r.do);
        return el('tr', {}, [
          td(fmtDate(r.ts)), td(fmtTime(r.ts)),
          td(nfmt(r.do), 'color:var(--chart-do);font-weight:700'),
          td(nfmt(r.t), 'color:var(--chart-temp)'),
          td(nfmt(r.ph, 2), 'color:var(--chart-ph)'),
          td(stTxt, `color:${stCol};font-weight:700`),
        ]);
      })),
    ]);
    mount(tableBox, table);
  }
  function renderSummary(fromTs, toTs) {
    const dos = rows.map((r) => r.do).filter((v) => v != null);
    if (!dos.length) { mount(summaryBox); return; }
    const chip = (lab, v, col) => el('div', { style: 'flex:1;text-align:center;padding:7px;border-radius:var(--shape-sm);background:var(--md-surface-container-low)' }, [
      el('div', { class: 't-caption', text: lab }),
      el('div', { style: `font-weight:800;font-size:15px;color:${col};font-variant-numeric:tabular-nums`, text: v }),
    ]);
    mount(summaryBox, el('div', { style: 'display:flex;gap:8px' }, [
      chip(isUz ? 'Qatorlar' : 'Строк', String(rows.length), 'var(--md-on-surface)'),
      chip('DO min', nfmt(Math.min(...dos)), 'var(--md-critical)'),
      chip(isUz ? "DO o'rta" : 'DO сред.', nfmt(dos.reduce((a, b) => a + b, 0) / dos.length), 'var(--chart-do)'),
      chip('DO max', nfmt(Math.max(...dos)), 'var(--md-success)'),
    ]));
  }

  // ---------- eksport ----------
  function exportRows() {
    return rows.map((r) => {
      const [stTxt] = statusOf(r.do);
      return { [isUz ? 'Sana' : 'Дата']: fmtDate(r.ts), [isUz ? 'Vaqt' : 'Время']: fmtTime(r.ts),
        'DO (mg/L)': r.do != null ? +r.do.toFixed(2) : '', [isUz ? 'Harorat (°C)' : 'Темп. (°C)']: r.t != null ? +r.t.toFixed(1) : '',
        pH: r.ph != null ? +r.ph.toFixed(2) : '', [isUz ? 'Holat' : 'Статус']: stTxt };
    });
  }
  function dl(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function exportCSV() {
    const data = exportRows();
    if (!data.length) return toast(isUz ? "Eksport uchun ma'lumot yo'q" : 'Нет данных', 'err');
    const head = Object.keys(data[0]);
    const csv = [head.join(';'), ...data.map((r) => head.map((h) => r[h]).join(';'))].join('\n');
    dl(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), `smartlake-tarix-${filter}.csv`);
  }
  async function exportXLSX() {
    const data = exportRows();
    if (!data.length) return toast(isUz ? "Eksport uchun ma'lumot yo'q" : 'Нет данных', 'err');
    try {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Tarix');
      XLSX.writeFile(wb, `smartlake-tarix-${filter}.xlsx`);
    } catch (e) { toast('XLSX: ' + (e && e.message), 'err'); }
  }
  async function exportPDF() {
    const data = exportRows();
    if (!data.length) return toast(isUz ? "Eksport uchun ma'lumot yo'q" : 'Нет данных', 'err');
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const docPdf = new jsPDF();
      docPdf.setFontSize(13);
      docPdf.text(`SmartLake — ${isUz ? 'Tarix' : 'История'} (${filter})`, 14, 14);
      autoTable(docPdf, {
        head: [Object.keys(data[0])],
        body: data.map((r) => Object.values(r)),
        startY: 20, styles: { fontSize: 8 },
        headStyles: { fillColor: [14, 124, 107] },
      });
      docPdf.save(`smartlake-tarix-${filter}.pdf`);
    } catch (e) { toast('PDF: ' + (e && e.message), 'err'); }
  }

  // ---------- elektr hisobi ----------
  const kwIn = input({ type: 'number', min: '0', step: '0.1', placeholder: '1.5', style: 'max-width:90px;text-align:center' });
  const tarifIn = input({ type: 'number', min: '0', step: '1', placeholder: '1000', style: 'max-width:110px;text-align:center' });
  function renderEnergy(fromTs, toTs) {
    const runMs = aeratorRuntimeMs(samples.filter((x) => 'aer' in x));
    const kw = parseFloat(kwIn.value) || (meta && meta.energy && meta.energy.kw) || 0;
    const tarif = parseFloat(tarifIn.value) || (meta && meta.energy && meta.energy.tariff) || 0;
    const kwh = kw ? (runMs / 3600e3) * kw : null;
    const cost = kwh != null && tarif ? Math.round(kwh * tarif) : null;
    const row = (lab, val, col = 'var(--md-on-surface)') => el('div', { class: 'row-between', style: 'padding:6px 0;border-bottom:1px solid var(--md-outline-variant);font-size:12.5px' }, [
      el('span', { class: 'muted', text: lab }),
      el('span', { style: `font-weight:800;font-variant-numeric:tabular-nums;color:${col}`, text: val }),
    ]);
    mount(energyBox,
      row(isUz ? 'Aerator ishlagan vaqti' : 'Наработка аэратора', samples.some((x) => 'aer' in x) ? fmtDur(runMs, isUz) : '—'),
      row(isUz ? 'Elektr sarfi' : 'Расход', kwh != null ? `${kwh.toFixed(2)} kWh` : '—', 'var(--chart-temp)'),
      row(isUz ? 'Taxminiy narx' : 'Стоимость', cost != null ? `${cost.toLocaleString()} ${isUz ? "so'm" : 'сум'}` : '—', 'var(--md-primary)'),
    );
  }
  const saveEnergyBtn = mdButton({ label: isUz ? 'Saqlash' : 'Сохранить', variant: 'tonal', onClick: async () => {
    const kw = parseFloat(kwIn.value) || 0, tariff = parseFloat(tarifIn.value) || 0;
    try {
      await saveLakeMeta(lakeId, uid, { energy: { kw, tariff } });
      meta = { ...(meta || {}), energy: { kw, tariff } };
      toast(isUz ? 'Saqlandi' : 'Сохранено', 'ok');
      const [f, t2] = rangeFor(filter); renderEnergy(f, t2);
    } catch (e) { toast((e && e.message) || 'Xato', 'err'); }
  } });

  const energyCard = mdCard([
    el('div', { class: 't-title-sm', style: 'display:flex;align-items:center;gap:6px;margin-bottom:8px' }, [
      el('span', { html: icon('power', 16), style: 'color:var(--chart-temp);display:inline-flex' }),
      el('span', { text: isUz ? 'Elektr energiyasi hisobi' : 'Учёт электроэнергии' }),
    ]),
    el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px' }, [
      el('span', { class: 't-caption', text: isUz ? 'Quvvat (kW):' : 'Мощность (кВт):' }), kwIn,
      el('span', { class: 't-caption', text: isUz ? "Tarif (so'm/kWh):" : 'Тариф (сум/кВтч):' }), tarifIn,
      saveEnergyBtn,
    ]),
    energyBox,
    el('div', { class: 't-caption', style: 'margin-top:6px', text: isUz
      ? "Ish vaqti telemetriyadagi rele holatidan taxminan tiklanadi; hisob tanlangan davr bo'yicha."
      : 'Наработка восстанавливается по состоянию реле в телеметрии; расчёт за выбранный период.' }),
  ]);

  // ---------- yem bo'limi (C-bosqichga tayyor karkas) ----------
  const feedCard = mdCard([
    el('div', { class: 't-title-sm', style: 'display:flex;align-items:center;gap:6px;margin-bottom:8px' }, [
      el('span', { html: icon('droplet', 16), style: 'color:var(--md-tertiary);display:inline-flex' }),
      el('span', { text: isUz ? 'Yem hisobi' : 'Учёт корма' }),
    ]),
    el('div', {}, [
      ...[[isUz ? 'Bugungi yem' : 'Корм сегодня'], [isUz ? 'Haftalik' : 'За неделю'], [isUz ? 'Oylik' : 'За месяц'], [isUz ? 'Jami yem' : 'Всего корма'], [isUz ? 'Jami xarajat' : 'Всего затрат']]
        .map(([lab]) => el('div', { class: 'row-between', style: 'padding:6px 0;border-bottom:1px solid var(--md-outline-variant);font-size:12.5px' }, [
          el('span', { class: 'muted', text: lab }),
          el('span', { style: 'font-weight:800', text: '—' }),
        ])),
    ]),
    el('div', { class: 't-caption', style: 'margin-top:6px', text: isUz
      ? "Hisob Sozlamalar (C-bosqich)da baliq soni, vazni va yem narxi kiritilgach avtomatik yoqiladi."
      : 'Расчёт включится после ввода данных о рыбе и корме в Настройках (этап C).' }),
  ]);

  // ---------- yig'ish ----------
  const node = el('div', { class: 'stack' }, [
    mdCard([
      el('div', { class: 't-title-sm', style: 'display:flex;align-items:center;gap:6px;margin-bottom:8px' }, [
        el('span', { html: icon('chip', 16), style: 'color:var(--md-primary);display:inline-flex' }),
        el('span', { text: isUz ? "Tarix ma'lumotlari" : 'Данные истории' }),
      ]),
      filterRow, customRow, summaryBox, tableBox,
      el('div', { style: 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap' }, [
        mdButton({ label: 'Excel (.xlsx)', variant: 'tonal', onClick: exportXLSX }),
        mdButton({ label: 'CSV', variant: 'outlined', onClick: exportCSV }),
        mdButton({ label: 'PDF', variant: 'outlined', onClick: exportPDF }),
      ]),
    ]),
    energyCard,
    feedCard,
  ]);

  // Meta yuklash + birinchi ma'lumot
  loadLakeMeta(lakeId).then((m) => {
    meta = m;
    if (m && m.energy) { if (m.energy.kw) kwIn.value = m.energy.kw; if (m.energy.tariff) tarifIn.value = m.energy.tariff; }
    const [f, t2] = rangeFor(filter); renderEnergy(f, t2);
  });
  loadData();

  return node;
}

export default buildHistoryTab;
