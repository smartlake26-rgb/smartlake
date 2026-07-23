// ============================================================
//  shared/ui/components.js — MD3 komponent fabrikalari
//  Har biri DOM Node qaytaradi (framework yo'q). Faqat presentation.
// ============================================================

import { el } from '../dom.js';
import { icon } from '../icons.js';
// DS 3.0 icon registri — asosiy registrning superset'i (sparkles, menu,
// trendUp kabi yangi nomlar uchun); mavjud nomlar avvalgidek ishlaydi.
import { slIcon } from '../../design-system/components/icons.js';

/* --- Buttons --- */
export function mdButton({ label, variant = 'filled', icon: ic, onClick, disabled = false, full = false, type = 'button' }) {
  const b = el('button', {
    class: `md-btn ${variant}${full ? ' full' : ''}`, type,
    html: (ic ? icon(ic, 18) : '') + `<span>${label}</span>`,
  });
  if (onClick) b.addEventListener('click', onClick);
  if (disabled) b.disabled = true;
  return b;
}

export function mdIconButton({ icon: ic, onClick, label }) {
  const b = el('button', { class: 'md-iconbtn', html: icon(ic, 22), title: label || '', 'aria-label': label || ic });
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

export function mdFab({ label, icon: ic = 'plus', onClick }) {
  const b = el('button', { class: 'md-fab', html: icon(ic, 22) + (label ? `<span>${label}</span>` : '') });
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

/* --- Card --- */
export function mdCard(children, { elevated = false, onClick, cls = '' } = {}) {
  const c = el('div', { class: `md-card${elevated ? ' elev' : ''}${onClick ? ' tap' : ''} ${cls}` },
    Array.isArray(children) ? children : [children]);
  if (onClick) c.addEventListener('click', onClick);
  return c;
}

/* --- Status chip --- */
export function statusChip(status, label) {
  return el('span', { class: `md-chip st-${status}` }, [
    el('span', { class: 'chip-dot', style: 'background:currentColor' }),
    el('span', { text: label }),
  ]);
}

/* --- Top App Bar --- */
export function appBar({ title, subtitle, leading, actions = [] }) {
  const kids = [];
  if (leading) kids.push(leading);
  kids.push(el('div', { class: 'grow' }, [
    el('div', { class: 'ab-title', text: title }),
    ...(subtitle ? [el('div', { class: 'ab-sub', text: subtitle })] : []),
  ]));
  actions.forEach((a) => kids.push(a));
  return el('div', { class: 'md-appbar' }, kids);
}

/* --- Bottom Navigation --- */
export function bottomNav({ items, active, onSelect }) {
  return el('nav', { class: 'md-bottomnav' }, items.map((it) => {
    const item = el('button', { class: `md-navitem${it.id === active ? ' active' : ''}` }, [
      el('span', { class: 'ni-ic', html: slIcon(it.icon, 22) + (it.dot ? '<span class="ni-dot"></span>' : '') }),
      el('span', { class: 'ni-label', text: it.label }),
    ]);
    item.addEventListener('click', () => onSelect && onSelect(it.id));
    return item;
  }));
}

/* --- Stat card --- */
export function statCard({ icon: ic, value, label, color = 'var(--md-primary)' }) {
  return el('div', { class: 'md-stat' }, [
    el('div', { class: 's-ic', style: `background:color-mix(in srgb, ${color} 16%, transparent);color:${color}`, html: icon(ic, 20) }),
    el('div', { class: 's-val', text: value == null ? '—' : String(value) }),
    el('div', { class: 's-lab', text: label }),
  ]);
}

/* --- Sensor card --- */
export function sensorCard({ label, value, unit = '', status = 'unknown', isLive = false }) {
  const color = { healthy: 'var(--md-success)', good: 'var(--md-success)', warning: 'var(--md-warning)', critical: 'var(--md-critical)' }[status] || 'var(--md-on-surface)';
  const children = [
    el('div', { class: 'sc-lab', text: label }),
    el('div', { class: 'sc-val', style: `color:${color}`, html: `${value == null ? '—' : value}<span class="sc-unit"> ${unit}</span>` }),
  ];
  if (isLive) {
    children.push(el('span', { class: 'sensor-live-dot' }));
  }
  return el('div', { class: 'sensor-card' }, children);
}

/* --- Field --- */
export function field(labelText, input) {
  return el('div', { class: 'md-field' }, [el('label', { text: labelText }), input]);
}
export function input(props = {}) { return el('input', { class: 'md-input', ...props }); }
export function select(options, selected) {
  const s = el('select', { class: 'md-select' });
  options.forEach((o) => {
    const opt = el('option', { value: o.value, text: o.label });
    if (o.value === selected) opt.selected = true;
    s.appendChild(opt);
  });
  return s;
}

/* --- List item --- */
export function listItem({ leading, title, subtitle, trailing, onClick }) {
  const kids = [];
  if (leading) kids.push(el('div', { class: 'li-lead', html: typeof leading === 'string' ? icon(leading, 20) : '' }, typeof leading === 'string' ? [] : [leading]));
  kids.push(el('div', { class: 'grow' }, [
    el('div', { class: 't-title-sm', text: title }),
    ...(subtitle ? [el('div', { class: 't-body-sm muted', text: subtitle })] : []),
  ]));
  if (trailing) kids.push(trailing);
  else if (onClick) kids.push(el('span', { style: 'color:var(--md-outline)', html: icon('chevronRight', 20) }));
  const row = el('div', { class: `md-listitem${onClick ? ' tap' : ''}` }, kids);
  if (onClick) row.addEventListener('click', onClick);
  return row;
}

/* --- Skeleton --- */
export function skeletonCards(n = 3) {
  return el('div', {}, Array.from({ length: n }, () => el('div', { class: 'sk sk-card' })));
}
export function skeletonLines(n = 3) {
  return el('div', {}, Array.from({ length: n }, (_, i) => el('div', { class: 'sk sk-line', style: `width:${[70, 90, 50][i % 3]}%` })));
}

/* --- Empty / Error --- */
export function emptyState({ icon: ic = 'droplet', title, desc, action }) {
  return el('div', { class: 'md-state' }, [
    el('div', { class: 'st-ic', html: icon(ic, 44) }),
    el('div', { class: 'st-title', text: title }),
    ...(desc ? [el('div', { class: 'st-desc', text: desc })] : []),
    ...(action ? [el('div', { style: 'margin-top:16px;display:flex;justify-content:center' }, [action])] : []),
  ]);
}
export function errorState({ title, desc, onRetry, retryLabel = 'Qayta urinish' }) {
  const kids = [
    el('div', { class: 'st-ic', style: 'color:var(--md-error)', html: icon('info', 44) }),
    el('div', { class: 'st-title', text: title }),
    ...(desc ? [el('div', { class: 'st-desc', text: desc })] : []),
  ];
  if (onRetry) kids.push(el('div', { style: 'margin-top:16px;display:flex;justify-content:center' }, [mdButton({ label: retryLabel, variant: 'tonal', onClick: onRetry })]));
  return el('div', { class: 'md-state' }, kids);
}

/* --- Loader --- */
export function loader(size = 28) {
  return el('div', { class: 'spin', style: `width:${size}px;height:${size}px;border:3px solid var(--md-outline-variant);border-top-color:var(--md-primary);border-radius:50%` });
}

/* --- Banner --- */
export function banner(type, text) {
  return el('div', { class: `md-banner ${type}`, html: icon(type === 'warn' ? 'info' : 'bell', 18) + `<span>${text}</span>` });
}

/* --- Dialog (modal) --- */
export function openDialog({ title, body, actions = [] }) {
  const scrim = el('div', { class: 'md-scrim' });
  const close = () => scrim.remove();
  const actionRow = el('div', { class: 'row', style: 'justify-content:flex-end;gap:8px;margin-top:20px' },
    actions.map((a) => mdButton({ label: a.label, variant: a.variant || 'text', onClick: () => { close(); a.onClick && a.onClick(); } })));
  const dialog = el('div', { class: 'md-dialog', role: 'dialog', 'aria-modal': 'true' }, [
    el('div', { class: 't-title', style: 'margin-bottom:8px', text: title }),
    ...(body ? [el('div', { class: 't-body muted' }, typeof body === 'string' ? [el('span', { text: body })] : [body])] : []),
    actionRow,
  ]);
  scrim.appendChild(dialog);
  scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });
  document.body.appendChild(scrim);
  return { close };
}

export default {
  mdButton, mdIconButton, mdFab, mdCard, statusChip, appBar, bottomNav,
  statCard, sensorCard, field, input, select, listItem, skeletonCards, skeletonLines,
  emptyState, errorState, loader, banner, openDialog,
};
