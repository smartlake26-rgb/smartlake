// ============================================================
//  design-system/components/button.js — SMARTLAKE DS 3.0 · TUGMA
//  ------------------------------------------------------------
//  Variantlar: primary | secondary | outlined | text | danger |
//              success | warning
//  O'lchamlar: sm | md | lg      Holat: disabled, loading
//  slButton().setLoading(true/false) — yuklanish boshqaruvi.
//  Mavjud shared/dom.js `el` yordamchisi QAYTA ISHLATILADI.
// ============================================================

import { el } from '../../shared/dom.js';
import { slIcon } from './icons.js';

/**
 * Tugma fabrikasi.
 * @param {object} p
 * @param {string} p.label
 * @param {'primary'|'secondary'|'outlined'|'text'|'danger'|'success'|'warning'} [p.variant='primary']
 * @param {'sm'|'md'|'lg'} [p.size='md']
 * @param {string} [p.icon]        — chap ikon nomi
 * @param {string} [p.trailing]    — o'ng ikon nomi
 * @param {boolean} [p.full=false]
 * @param {boolean} [p.disabled=false]
 * @param {Function} [p.onClick]
 * @param {'button'|'submit'} [p.type='button']
 * @param {string} [p.ariaLabel]
 * @returns {HTMLButtonElement & {setLoading(v:boolean):void}}
 */
export function slButton({
  label, variant = 'primary', size = 'md', icon: ic, trailing,
  full = false, disabled = false, onClick, type = 'button', ariaLabel,
} = {}) {
  const cls = ['sl-btn', variant, size !== 'md' ? size : '', full ? 'full' : '']
    .filter(Boolean).join(' ');
  const iconPx = size === 'sm' ? 16 : 18;
  const b = el('button', {
    class: cls, type, 'aria-label': ariaLabel || null,
    html: (ic ? slIcon(ic, iconPx) : '')
      + `<span>${label ?? ''}</span>`
      + (trailing ? slIcon(trailing, iconPx) : ''),
  });
  if (onClick) b.addEventListener('click', onClick);
  if (disabled) b.disabled = true;
  b.setLoading = (v) => { b.classList.toggle('is-loading', !!v); b.disabled = !!v || disabled; };
  return b;
}

/**
 * Dumaloq ikon tugma.
 * @param {{icon:string, onClick?:Function, label:string, tonal?:boolean, size?:number}} p
 *   `label` MAJBURIY — aria-label sifatida ishlatiladi (accessibility).
 */
export function slIconButton({ icon: ic, onClick, label, tonal = false, size = 22 }) {
  const b = el('button', {
    class: `sl-iconbtn${tonal ? ' tonal' : ''}`, type: 'button',
    html: slIcon(ic, size), title: label || '', 'aria-label': label || ic,
  });
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

/**
 * Suzuvchi tugma (FAB).
 * @param {{icon?:string, label?:string, onClick?:Function, ariaLabel?:string}} p
 */
export function slFab({ icon: ic = 'plus', label, onClick, ariaLabel }) {
  const b = el('button', {
    class: 'sl-fab', type: 'button', 'aria-label': ariaLabel || label || ic,
    html: slIcon(ic, 22) + (label ? `<span>${label}</span>` : ''),
  });
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

export default { slButton, slIconButton, slFab };
