// ============================================================
//  design-system/components/input.js — SMARTLAKE DS 3.0 · FORMA
//  ------------------------------------------------------------
//  Turlar: text | number | search | dropdown | date | time |
//          password (ko'rish tugmasi bilan)
//  Holatlar: normal | error | success | disabled (+ yordam matni)
//  API: slField({...}) -> Node & { input, setError(msg),
//       setSuccess(msg?), clearState(), value }
//  Mavjud shared/dom.js `el` yordamchisi QAYTA ISHLATILADI.
//  Hech qanday validatsiya MANTIG'I yo'q — validatorlar features/
//  qatlamida qoladi; bu faqat prezentatsiya.
// ============================================================

import { el } from '../../shared/dom.js';
import { slIcon, ICONS } from './icons.js';

let fieldSeq = 0;

/** Xom input elementi (klasslar bilan). */
export function slInput(props = {}) {
  return el('input', { class: 'sl-input', ...props });
}

/** Xom select elementi. options: [{value,label}] */
export function slSelect(options = [], selected) {
  const s = el('select', { class: 'sl-select' });
  options.forEach((o) => {
    const opt = el('option', { value: o.value, text: o.label });
    if (o.value === selected) opt.selected = true;
    s.appendChild(opt);
  });
  return s;
}

/**
 * To'liq forma maydoni: label + input + yordam matni + holatlar.
 *
 * @param {object} p
 * @param {'text'|'email'|'tel'|'number'|'search'|'dropdown'|'date'|'time'|'password'} [p.type='text']
 * @param {string}  p.label
 * @param {string} [p.help]           — doimiy yordam matni
 * @param {string} [p.placeholder]
 * @param {string|number} [p.value]
 * @param {boolean} [p.disabled]
 * @param {Array}  [p.options]        — type='dropdown' uchun [{value,label}]
 * @param {string} [p.selected]       — dropdown boshlang'ich qiymati
 * @param {object} [p.attrs]          — qo'shimcha atributlar (min, max, step,
 *                                      autocomplete, inputmode ...)
 * @param {Function} [p.onInput]
 * @param {Function} [p.onChange]
 * @returns {HTMLElement & {input:HTMLElement, value:any,
 *   setError(msg:string):void, setSuccess(msg?:string):void, clearState():void}}
 */
export function slField({
  type = 'text', label, help = '', placeholder, value, disabled = false,
  options = [], selected, attrs = {}, onInput, onChange,
} = {}) {
  const id = `sl-f${++fieldSeq}`;
  const helpId = `${id}-help`;

  // --- input elementi (tur bo'yicha) ---
  let input;
  if (type === 'dropdown') {
    input = slSelect(options, selected);
  } else {
    input = slInput({
      type: type === 'search' ? 'search' : type,
      placeholder: placeholder || null,
      inputmode: type === 'number' ? 'decimal' : null,
      ...attrs,
    });
    if (value != null) input.value = String(value);
  }
  input.id = id;
  if (disabled) input.disabled = true;
  if (onInput) input.addEventListener('input', onInput);
  if (onChange) input.addEventListener('change', onChange);

  // --- ichki ikon / tugma bilan o'ram kerakmi? ---
  let inputBlock = input;
  if (type === 'search') {
    inputBlock = el('div', { class: 'sl-input-wrap lead' }, [
      el('span', { class: 'in-ic', html: slIcon(ICONS.action.search, 18) }),
      input,
    ]);
  } else if (type === 'password') {
    const toggle = el('button', {
      class: 'in-btn', type: 'button',
      'aria-label': 'Parolni ko\u2018rsatish/yashirish',
      html: slIcon(ICONS.misc.eye, 18),
    });
    toggle.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.innerHTML = slIcon(show ? ICONS.misc.eyeOff : ICONS.misc.eye, 18);
      input.focus();
    });
    inputBlock = el('div', { class: 'sl-input-wrap' }, [input, toggle]);
  } else if (type === 'date' || type === 'time') {
    inputBlock = el('div', { class: 'sl-input-wrap' }, [
      input,
      el('span', { class: 'in-ic', html: slIcon(type === 'date' ? ICONS.misc.calendar : ICONS.misc.clock, 18) }),
    ]);
  }

  const helpEl = el('div', { class: 'sl-help', id: helpId, text: help });
  const wrap = el('div', { class: 'sl-field' }, [
    el('label', { for: id, text: label }),
    inputBlock,
    helpEl,
  ]);
  if (help || true) input.setAttribute('aria-describedby', helpId);

  // --- holat API'si ---
  wrap.input = input;
  Object.defineProperty(wrap, 'value', {
    get: () => input.value,
    set: (v) => { input.value = v == null ? '' : String(v); },
  });
  wrap.setError = (msg) => {
    wrap.classList.remove('success'); wrap.classList.add('error');
    input.setAttribute('aria-invalid', 'true');
    helpEl.textContent = msg || '';
  };
  wrap.setSuccess = (msg) => {
    wrap.classList.remove('error'); wrap.classList.add('success');
    input.removeAttribute('aria-invalid');
    if (msg != null) helpEl.textContent = msg;
  };
  wrap.clearState = () => {
    wrap.classList.remove('error', 'success');
    input.removeAttribute('aria-invalid');
    helpEl.textContent = help;
  };
  return wrap;
}

export default { slField, slInput, slSelect };
