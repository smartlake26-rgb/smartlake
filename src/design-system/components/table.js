// ============================================================
//  design-system/components/table.js — SMARTLAKE DS 3.0 · JADVAL
//  ------------------------------------------------------------
//  Xususiyatlar: responsive (gorizontal scroll) · sortable ·
//  qidiruv + filtrlar · pagination · sticky header · export-ready
//  (getVisibleRows/getAllRows — XLSX/CSV/PDF eksport qatlamiga
//  tayyor ma'lumot beradi; eksport kutubxonalari BU YERGA import
//  qilinmaydi — dynamic import chaqiruvchi tomonda qoladi).
//
//  columns: [{ key, label, sortable?, numeric?,
//              value?(row) -> saralash/qidiruv qiymati,
//              render?(row) -> Node|string (ko'rinish) }]
// ============================================================

import { el, mount } from '../../shared/dom.js';
import { slField } from './input.js';

/**
 * @param {object} p
 * @param {Array}  p.columns
 * @param {Array}  p.rows
 * @param {number} [p.pageSize=12]
 * @param {boolean}[p.searchable=true]
 * @param {Array}  [p.filters]  — [{key,label,options:[{value,label}], test?(row,val)}]
 * @param {boolean}[p.sticky=true]
 * @param {Function}[p.onRowClick]
 * @param {string} [p.emptyText='—']
 * @param {object} [p.labels]   — i18n: {search, prev, next, of}
 * @returns {HTMLElement & {update(rows):void, getVisibleRows():Array,
 *   getAllRows():Array, getColumns():Array}}
 */
export function slTable({
  columns = [], rows = [], pageSize = 12, searchable = true, filters = [],
  sticky = true, onRowClick, emptyText = '—',
  labels = {},
} = {}) {
  const L = { search: 'Qidirish\u2026', prev: '\u2039', next: '\u203A', of: '/', ...labels };

  let data = rows.slice();
  let query = '';
  let sortKey = null;
  let sortDir = 1;
  let page = 1;
  const filterVals = {};

  const cellValue = (row, c) => (c.value ? c.value(row) : row[c.key]);

  // ---------- toolbar ----------
  const toolbarKids = [];
  if (searchable) {
    const search = slField({ type: 'search', label: '', placeholder: L.search,
      onInput: (e) => { query = e.target.value.toLowerCase().trim(); page = 1; renderBody(); } });
    search.querySelector('label').remove();   // toolbar'da label ko'rinmaydi
    search.querySelector('.sl-help').remove();
    search.input.setAttribute('aria-label', L.search);
    toolbarKids.push(search);
  }
  filters.forEach((f) => {
    const fld = slField({ type: 'dropdown', label: '',
      options: [{ value: '', label: f.label }, ...f.options],
      onChange: (e) => { filterVals[f.key] = e.target.value; page = 1; renderBody(); } });
    fld.querySelector('label').remove();
    fld.querySelector('.sl-help').remove();
    fld.input.setAttribute('aria-label', f.label);
    toolbarKids.push(fld);
  });
  const countEl = el('span', { class: 'tb-count' });
  toolbarKids.push(countEl);
  const toolbar = (searchable || filters.length)
    ? el('div', { class: 'sl-table-toolbar' }, toolbarKids)
    : null;

  // ---------- head ----------
  const thead = el('thead', {}, [el('tr', {}, columns.map((c) => {
    const sortable = c.sortable !== false;
    const th = el('th', { class: sortable ? 'sortable' : '', scope: 'col' }, [
      el('span', { text: c.label }),
      el('span', { class: 'sort-ic', 'aria-hidden': 'true', text: '' }),
    ]);
    if (sortable) {
      th.tabIndex = 0;
      th.setAttribute('role', 'button');
      const toggle = () => {
        if (sortKey === c.key) sortDir = -sortDir;
        else { sortKey = c.key; sortDir = 1; }
        renderBody();
      };
      th.addEventListener('click', toggle);
      th.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    }
    th.__col = c;
    return th;
  }))]);

  const tbody = el('tbody');
  const table = el('table', { class: 'sl-table' }, [thead, tbody]);
  const scroll = el('div', { class: 'sl-table-scroll' }, [table]);

  // ---------- pager ----------
  const prevBtn = el('button', { type: 'button', text: L.prev, 'aria-label': 'Oldingi sahifa' });
  const nextBtn = el('button', { type: 'button', text: L.next, 'aria-label': 'Keyingi sahifa' });
  const pgInfo = el('span', { class: 'pg-info' });
  prevBtn.addEventListener('click', () => { page = Math.max(1, page - 1); renderBody(); });
  nextBtn.addEventListener('click', () => { page += 1; renderBody(); });
  const pager = el('div', { class: 'sl-pager' }, [pgInfo, prevBtn, nextBtn]);

  // ---------- hisoblash ----------
  function visibleAll() {
    let out = data;
    if (query) {
      out = out.filter((r) => columns.some((c) => {
        const v = cellValue(r, c);
        return v != null && String(v).toLowerCase().includes(query);
      }));
    }
    filters.forEach((f) => {
      const val = filterVals[f.key];
      if (!val) return;
      out = out.filter((r) => (f.test ? f.test(r, val) : String(r[f.key]) === val));
    });
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      out = out.slice().sort((a, b) => {
        const av = cellValue(a, col); const bv = cellValue(b, col);
        if (av == null) return 1; if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sortDir;
        return String(av).localeCompare(String(bv), undefined, { numeric: true }) * sortDir;
      });
    }
    return out;
  }

  function renderBody() {
    const all = visibleAll();
    const pages = Math.max(1, Math.ceil(all.length / pageSize));
    if (page > pages) page = pages;
    const slice = all.slice((page - 1) * pageSize, page * pageSize);

    // sort ko'rsatkichlari
    thead.querySelectorAll('th').forEach((th) => {
      const ic = th.querySelector('.sort-ic');
      if (!ic || !th.__col) return;
      ic.textContent = th.__col.key === sortKey ? (sortDir === 1 ? '\u25B4' : '\u25BE') : '';
      th.setAttribute('aria-sort', th.__col.key === sortKey
        ? (sortDir === 1 ? 'ascending' : 'descending') : 'none');
    });

    if (!slice.length) {
      mount(tbody, el('tr', {}, [el('td', { colspan: String(columns.length) }, [
        el('div', { class: 'sl-table-empty', text: emptyText }),
      ])]));
    } else {
      mount(tbody, ...slice.map((row) => {
        const tr = el('tr', { class: onRowClick ? 'clickable' : '' },
          columns.map((c) => {
            const td = el('td', { class: c.numeric ? 'num' : '' });
            const rendered = c.render ? c.render(row) : cellValue(row, c);
            if (rendered instanceof Node) td.appendChild(rendered);
            else td.textContent = rendered == null ? '—' : String(rendered);
            return td;
          }));
        if (onRowClick) {
          tr.tabIndex = 0;
          tr.addEventListener('click', () => onRowClick(row));
          tr.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') onRowClick(row);
          });
        }
        return tr;
      }));
    }

    countEl.textContent = String(all.length);
    pgInfo.textContent = `${page} ${L.of} ${pages}`;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= pages;
    pager.style.display = pages > 1 ? '' : 'none';
  }

  const panel = el('div', { class: `sl-table-panel${sticky ? ' sticky' : ''}` },
    [toolbar, scroll, pager].filter(Boolean));

  // ---------- ochiq API ----------
  panel.update = (newRows) => { data = newRows.slice(); page = 1; renderBody(); };
  panel.getVisibleRows = () => visibleAll();        // eksport: filtrlangan+saralangan
  panel.getAllRows = () => data.slice();            // eksport: to'liq
  panel.getColumns = () => columns.map((c) => ({ key: c.key, label: c.label }));

  renderBody();
  return panel;
}

export default { slTable };
