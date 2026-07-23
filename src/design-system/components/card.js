// ============================================================
//  design-system/components/card.js — SMARTLAKE DS 3.0 · KARTALAR
//  ------------------------------------------------------------
//  Asos: slCard. Ixtisoslashgan fabrikalar (FAQAT prezentatsiya,
//  hech qanday ma'lumot olish/business logic yo'q — hammasi props
//  orqali keladi):
//    slStatCard · slLakeCard · slSensorCard · slAlertCard ·
//    slAiCard · slChartCard · slActionCard · slWeatherCard ·
//    slSummaryCard · slEnergyCard · slFeedCard · slHistoryCard
//  Yordamchi: slListItem · slEmptyState · slKvRow
//
//  Accessibility: bosiladigan kartalar avtomatik role="button" +
//  tabindex="0" + Enter/Space oladi (klaviatura bilan ochiladi).
// ============================================================

import { el } from '../../shared/dom.js';
import { slIcon, ICONS } from './icons.js';
import { slStatusBadge, slBadge } from './badge.js';

/* Bosiladigan elementga klaviatura qo'llab-quvvatlashini beradi. */
function makeInteractive(node, onClick, ariaLabel) {
  node.classList.add('interactive');
  node.setAttribute('role', 'button');
  node.setAttribute('tabindex', '0');
  if (ariaLabel) node.setAttribute('aria-label', ariaLabel);
  node.addEventListener('click', onClick);
  node.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); }
  });
  return node;
}

/**
 * Asos karta.
 * @param {(Node|null)[]|Node} children
 * @param {{elevated?:boolean, inset?:boolean, premium?:boolean, critical?:boolean,
 *          onClick?:Function, ariaLabel?:string, cls?:string}} [opts]
 */
export function slCard(children, opts = {}) {
  const cls = ['sl-card',
    opts.elevated ? 'elevated' : '', opts.inset ? 'inset' : '',
    opts.premium ? 'premium' : '', opts.critical ? 'critical' : '',
    opts.cls || ''].filter(Boolean).join(' ');
  const c = el('div', { class: cls },
    (Array.isArray(children) ? children : [children]).filter(Boolean));
  if (opts.onClick) makeInteractive(c, opts.onClick, opts.ariaLabel);
  return c;
}

/** Karta sarlavha bloki (title + o'ng tarafda ixtiyoriy element). */
export function slCardHead(title, trailing = null, sub = null) {
  return el('div', {}, [
    el('div', { class: 'sl-card-head' }, [
      el('div', { class: 'sl-card-title', text: title }),
      trailing,
    ].filter(Boolean)),
    sub ? el('div', { class: 'sl-card-sub', style: 'margin-top:-8px;margin-bottom:12px', text: sub }) : null,
  ].filter(Boolean));
}

/* ------------------------------------------------------------
   1 · STAT CARD — raqam + yorliq (+ ikon, + bosish)
   ------------------------------------------------------------ */
export function slStatCard({ icon: ic, value, label, color = 'var(--sl-primary)', onClick, ariaLabel }) {
  const c = el('div', { class: 'sl-stat' }, [
    ic ? el('div', { class: 'st-ic',
      style: `background:color-mix(in srgb, ${color} 16%, transparent);color:${color}`,
      html: slIcon(ic, 20) }) : null,
    el('div', { class: 'st-val', text: value == null ? '—' : String(value) }),
    el('div', { class: 'st-lab', text: label }),
  ].filter(Boolean));
  if (onClick) makeInteractive(c, onClick, ariaLabel || label);
  return c;
}

/* ------------------------------------------------------------
   2 · SENSOR CARD — bitta o'lchov (bento katakcha)
   colorVar: '--sl-chart-do' kabi TOKEN nomi (hex emas!)
   ------------------------------------------------------------ */
export function slSensorCard({ icon: ic, label, value, unit = '', colorVar = '--sl-primary',
  critical = false, live = false }) {
  return el('div', {
    class: `sl-sensor${critical ? ' critical' : ''}`,
    style: `--_c:var(${colorVar})`,
  }, [
    el('div', { class: 'sn-lab' }, [
      ic ? el('span', { class: 'sl-ic', style: 'display:inline-flex', html: slIcon(ic, 14) }) : null,
      el('span', { text: label }),
    ].filter(Boolean)),
    el('div', { class: 'sn-val' }, [
      el('span', { class: 'sl-num', text: value == null ? '—' : String(value) }),
      unit ? el('span', { class: 'sn-unit', text: unit }) : null,
    ].filter(Boolean)),
    live ? el('span', { class: 'sn-live', 'aria-hidden': 'true' }) : null,
  ].filter(Boolean));
}

/* ------------------------------------------------------------
   3 · LAKE CARD — ko'l umumiy holati
   props: { name, status, statusLabel, meta, cells:[sensorCardProps],
            extra:[Node], onClick }
   ------------------------------------------------------------ */
export function slLakeCard({ name, status = 'unknown', statusLabel = '', meta = '',
  cells = [], extra = [], onClick, ariaLabel }) {
  return slCard([
    el('div', { class: 'sl-row-between' }, [
      el('div', { class: 'sl-title', text: name }),
      slStatusBadge(status, statusLabel),
    ]),
    meta ? el('div', { class: 'sl-body-sm sl-text-secondary', style: 'margin-top:4px', text: meta }) : null,
    cells.length ? el('div', { class: 'sl-grid-2', style: 'margin-top:12px' },
      cells.map((p) => slSensorCard(p))) : null,
    ...extra.filter(Boolean),
  ], { elevated: true, onClick, ariaLabel: ariaLabel || name });
}

/* ------------------------------------------------------------
   4 · ALERT CARD — ogohlantirish
   severity: 'info' | 'warning' | 'critical'
   ------------------------------------------------------------ */
export function slAlertCard({ severity = 'warning', title, desc, time, onClick, ariaLabel }) {
  const colorVar = severity === 'critical' ? '--sl-critical'
    : severity === 'info' ? '--sl-info' : '--sl-warning';
  const ic = severity === 'info' ? ICONS.alert.info : ICONS.alert.warning;
  return slCard([
    el('div', { class: 'sl-alert-card', style: `--_c:var(${colorVar})` }, [
      el('div', { class: 'al-ic', html: slIcon(ic, 18) }),
      el('div', { class: 'sl-grow' }, [
        el('div', { class: 'sl-subtitle', text: title }),
        desc ? el('div', { class: 'sl-body-sm sl-text-secondary', style: 'margin-top:2px', text: desc }) : null,
      ].filter(Boolean)),
      time ? el('div', { class: 'sl-caption', style: 'flex:none;text-align:right', text: time }) : null,
    ].filter(Boolean)),
  ], { onClick, ariaLabel: ariaLabel || title });
}

/* ------------------------------------------------------------
   5 · AI CARD — AI maslahatchi (iris urg'usi)
   props: { tag, title, body, badges:[{type,label}], footer:Node }
   ------------------------------------------------------------ */
export function slAiCard({ tag = 'AI', title, body, badges = [], footer = null, onClick, ariaLabel }) {
  return slCard([
    el('div', { class: 'ai-tag' }, [
      el('span', { style: 'display:inline-flex', html: slIcon(ICONS.ai.advisor, 14) }),
      el('span', { text: tag }),
    ]),
    title ? el('div', { class: 'sl-title', style: 'margin-top:6px', text: title }) : null,
    body ? el('div', { class: 'sl-body sl-text-secondary', style: 'margin-top:4px', text: body }) : null,
    badges.length ? el('div', { class: 'sl-row', style: 'margin-top:12px;flex-wrap:wrap' },
      badges.map((b) => slBadge(b))) : null,
    footer,
  ].filter(Boolean), { cls: 'sl-ai-card', onClick, ariaLabel: ariaLabel || title || tag });
}

/* ------------------------------------------------------------
   6 · CHART CARD — grafik uchun ramka (chart.js Node'ini oladi)
   ------------------------------------------------------------ */
export function slChartCard({ title, sub, chart, legend = null, actions = null }) {
  return slCard([
    el('div', { class: 'sl-card-head' }, [
      el('div', {}, [
        el('div', { class: 'sl-card-title', text: title }),
        sub ? el('div', { class: 'sl-card-sub', text: sub }) : null,
      ].filter(Boolean)),
      actions,
    ].filter(Boolean)),
    el('div', { class: 'sl-chart-frame' }, [chart]),
    legend ? el('div', { style: 'margin-top:12px' }, [legend]) : null,
  ].filter(Boolean));
}

/* ------------------------------------------------------------
   7 · ACTION CARD — harakatga chorlovchi qator-karta
   ------------------------------------------------------------ */
export function slActionCard({ icon: ic = 'plus', title, desc, onClick, ariaLabel }) {
  const c = slCard([
    el('div', { class: 'sl-action-card' }, [
      el('div', { class: 'ac-ic', html: slIcon(ic, 22) }),
      el('div', { class: 'sl-grow' }, [
        el('div', { class: 'sl-subtitle', text: title }),
        desc ? el('div', { class: 'sl-body-sm sl-text-secondary', text: desc }) : null,
      ].filter(Boolean)),
      el('span', { class: 'ac-chev', html: slIcon(ICONS.navigation.forward, 20) }),
    ]),
  ]);
  if (onClick) makeInteractive(c, onClick, ariaLabel || title);
  return c;
}

/* ------------------------------------------------------------
   8 · WEATHER CARD — ob-havo qatori
   ------------------------------------------------------------ */
export function slWeatherCard({ icon: ic = ICONS.misc.weather, text, next }) {
  return el('div', { class: 'sl-weather' }, [
    el('div', { class: 'wx-main' }, [
      el('span', { class: 'sl-ic', style: 'display:inline-flex', html: slIcon(ic, 16) }),
      el('span', { class: 'wx-txt', text }),
    ]),
    next ? el('span', { class: 'wx-next', text: next }) : null,
  ].filter(Boolean));
}

/* ------------------------------------------------------------
   Kalit-qiymat qatori (summary/energy/feed/history asosi)
   ------------------------------------------------------------ */
export function slKvRow({ icon: ic, key, value, valueColorVar }) {
  return el('div', { class: 'sl-kv-row' }, [
    el('div', { class: 'kv-key' }, [
      ic ? el('span', { style: 'display:inline-flex;opacity:.8', html: slIcon(ic, 15) }) : null,
      el('span', { text: key }),
    ].filter(Boolean)),
    el('span', { class: 'kv-val',
      style: valueColorVar ? `color:var(${valueColorVar})` : '', text: value ?? '—' }),
  ]);
}

/* ------------------------------------------------------------
   9 · SUMMARY CARD — davr xulosasi (kalit-qiymat ro'yxati)
   ------------------------------------------------------------ */
export function slSummaryCard({ title, rows = [], footer = null }) {
  return slCard([
    slCardHead(title),
    el('div', {}, rows.map((r) => slKvRow(r))),
    footer,
  ].filter(Boolean));
}

/* ------------------------------------------------------------
   10 · ENERGY CARD — elektr sarfi
   ------------------------------------------------------------ */
export function slEnergyCard({ title, hours, kwh, cost, rows = [] }) {
  return slCard([
    slCardHead(title, slBadge({ type: 'info', label: 'kWh', dot: false, icon: ICONS.sensor.energy })),
    el('div', { class: 'sl-grid-3', style: 'margin-bottom:8px' }, [
      slSensorCard({ label: 'Soat', value: hours, colorVar: '--sl-chart-energy', icon: ICONS.misc.clock }),
      slSensorCard({ label: 'kWh', value: kwh, colorVar: '--sl-chart-energy', icon: ICONS.sensor.energy }),
      slSensorCard({ label: 'Narx', value: cost, colorVar: '--sl-primary' }),
    ]),
    rows.length ? el('div', {}, rows.map((r) => slKvRow(r))) : null,
  ].filter(Boolean));
}

/* ------------------------------------------------------------
   11 · FEED CARD — yem rejasi
   ------------------------------------------------------------ */
export function slFeedCard({ title, amount, unit = 'kg', rows = [], note }) {
  return slCard([
    slCardHead(title, slBadge({ type: 'success', label: unit, dot: false, icon: ICONS.sensor.feed })),
    el('div', { class: 'sl-num-lg', style: 'color:var(--sl-chart-feed)' }, [
      el('span', { text: amount == null ? '—' : String(amount) }),
      el('span', { class: 'sl-caption', style: 'margin-left:4px', text: unit }),
    ]),
    rows.length ? el('div', { style: 'margin-top:8px' }, rows.map((r) => slKvRow(r))) : null,
    note ? el('div', { class: 'sl-banner warn', style: 'margin-top:12px' }, [
      el('span', { style: 'display:inline-flex', html: slIcon(ICONS.alert.warning, 16) }),
      el('span', { text: note }),
    ]) : null,
  ].filter(Boolean));
}

/* ------------------------------------------------------------
   12 · HISTORY CARD — tarix yozuvi (sana + o'lchovlar qatori)
   ------------------------------------------------------------ */
export function slHistoryCard({ date, time, rows = [], onClick, ariaLabel }) {
  return slCard([
    el('div', { class: 'sl-row-between' }, [
      el('div', { class: 'sl-subtitle', text: date }),
      time ? el('div', { class: 'sl-caption sl-mono', text: time }) : null,
    ].filter(Boolean)),
    el('div', { style: 'margin-top:4px' }, rows.map((r) => slKvRow(r))),
  ], { onClick, ariaLabel: ariaLabel || date });
}

/* ------------------------------------------------------------
   Yordamchilar: ro'yxat elementi va bo'sh holat
   ------------------------------------------------------------ */
export function slListItem({ leading, title, subtitle, trailing, onClick, ariaLabel }) {
  const kids = [];
  if (leading) {
    kids.push(el('div', { class: 'li-lead',
      html: typeof leading === 'string' ? slIcon(leading, 20) : '' },
      typeof leading === 'string' ? [] : [leading]));
  }
  kids.push(el('div', { class: 'sl-grow' }, [
    el('div', { class: 'sl-subtitle', text: title }),
    subtitle ? el('div', { class: 'sl-body-sm sl-text-secondary', text: subtitle }) : null,
  ].filter(Boolean)));
  if (trailing) kids.push(trailing);
  else if (onClick) kids.push(el('span', {
    style: 'color:var(--sl-border-strong);display:inline-flex',
    html: slIcon(ICONS.navigation.forward, 20) }));
  const row = el('div', { class: 'sl-listitem' }, kids);
  if (onClick) makeInteractive(row, onClick, ariaLabel || title);
  return row;
}

export function slEmptyState({ icon: ic = 'droplet', title, desc, action }) {
  return el('div', { class: 'sl-state' }, [
    el('div', { class: 'st-ic', html: slIcon(ic, 44) }),
    el('div', { class: 'st-title', text: title }),
    desc ? el('div', { class: 'st-desc', text: desc }) : null,
    action ? el('div', { class: 'st-action' }, [action]) : null,
  ].filter(Boolean));
}

export default {
  slCard, slCardHead, slStatCard, slSensorCard, slLakeCard, slAlertCard,
  slAiCard, slChartCard, slActionCard, slWeatherCard, slSummaryCard,
  slEnergyCard, slFeedCard, slHistoryCard, slListItem, slEmptyState, slKvRow,
};
