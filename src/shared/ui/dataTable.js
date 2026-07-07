// ============================================================
//  shared/ui/dataTable.js — Admin jadvali (sort/qidiruv/pagination)
//  columns: [{key,label,render?(row),value?(row),sortable?}]
// ============================================================

import { el, mount } from '../dom.js';
import { t } from '../../core/i18n/index.js';

export function pill(text, kind = 'neutral') {
  const map = {
    healthy: 'var(--md-success)', good: 'var(--md-success)', warning: 'var(--md-warning)',
    critical: 'var(--md-critical)', offline: 'var(--md-neutral)', unknown: 'var(--md-neutral)',
    active: 'var(--md-success)', suspended: 'var(--md-critical)', pending: 'var(--md-warning)',
    neutral: 'var(--md-neutral)', primary: 'var(--md-primary)',
  };
  const c = map[kind] || map.neutral;
  return el('span', { class: 'pill', style: `background:color-mix(in srgb, ${c} 16%, transparent);color:${c}`, text });
}

export function dataTable({ columns, rows, pageSize = 12, searchable = true, filters = [], onRowClick, emptyText }) {
  let query = '';
  let sortKey = null;
  let sortDir = 1;
  let page = 1;
  const filterVals = {};

  const searchInput = el('input', { class: 'admin-search', placeholder: t('common.search') || 'Qidirish...', style: 'width:220px' });
  searchInput.addEventListener('input', () => { query = searchInput.value.toLowerCase().trim(); page = 1; renderBody(); });

  const filterEls = filters.map((f) => {
    const sel = el('select', {}, [el('option', { value: '', text: f.label }), ...f.options.map((o) => el('option', { value: o.value, text: o.label }))]);
    sel.addEventListener('change', () => { filterVals[f.key] = sel.value; page = 1; renderBody(); });
    return sel;
  });

  const toolbar = el('div', { class: 'dt-toolbar' }, [...(searchable ? [searchInput] : []), ...filterEls]);
  const tbody = el('tbody');
  const thead = el('thead', {}, [el('tr', {}, columns.map((c) => {
    const th = el('th', { class: c.sortable === false ? '' : 'sortable', text: c.label });
    if (c.sortable !== false) th.addEventListener('click', () => {
      if (sortKey === c.key) sortDir *= -1; else { sortKey = c.key; sortDir = 1; }
      renderBody();
    });
    return th;
  }))]);
  const table = el('table', { class: 'dt' }, [thead, tbody]);
  const pager = el('div', { class: 'dt-pager' });

  function cellVal(c, row) { return c.value ? c.value(row) : row[c.key]; }
  function rowText(row) { return columns.map((c) => cellVal(c, row)).filter((v) => v != null).join(' ').toLowerCase(); }

  function process() {
    let out = rows.slice();
    if (query) out = out.filter((r) => rowText(r).includes(query));
    filters.forEach((f) => { if (filterVals[f.key]) out = out.filter((r) => String(f.value ? f.value(r) : r[f.key]) === filterVals[f.key]); });
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      out.sort((a, b) => {
        const va = cellVal(col, a); const vb = cellVal(col, b);
        if (va == null) return 1; if (vb == null) return -1;
        return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))) * sortDir;
      });
    }
    return out;
  }

  function renderBody() {
    const all = process();
    const pages = Math.max(1, Math.ceil(all.length / pageSize));
    if (page > pages) page = pages;
    const slice = all.slice((page - 1) * pageSize, page * pageSize);
    if (!slice.length) {
      mount(tbody, el('tr', {}, [el('td', { class: 'dt-empty', colspan: String(columns.length), text: emptyText || t('common.noData') || 'Ma\'lumot yo\'q' })]));
    } else {
      mount(tbody, ...slice.map((row) => {
        const tr = el('tr', { style: onRowClick ? 'cursor:pointer' : '' }, columns.map((c) => {
          const content = c.render ? c.render(row) : el('span', { text: cellVal(c, row) == null ? '—' : String(cellVal(c, row)) });
          return el('td', {}, [content]);
        }));
        if (onRowClick) tr.addEventListener('click', () => onRowClick(row));
        return tr;
      }));
    }
    // pager
    const prev = el('button', { text: '‹', disabled: page <= 1 });
    const next = el('button', { text: '›', disabled: page >= pages });
    prev.addEventListener('click', () => { if (page > 1) { page -= 1; renderBody(); } });
    next.addEventListener('click', () => { if (page < pages) { page += 1; renderBody(); } });
    mount(pager, el('span', { text: `${all.length} · ${page}/${pages}` }), prev, next);
  }

  renderBody();
  return el('div', { class: 'panel' }, [toolbar, el('div', { style: 'overflow-x:auto' }, [table]), pager]);
}

export default dataTable;
