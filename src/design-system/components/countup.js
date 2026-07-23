// ============================================================
//  design-system/components/countup.js — RAQAM SANASH ANIMATSIYASI
//  ------------------------------------------------------------
//  Dashboard "Mission Control" uchun: qiymat o'zgarganda raqam
//  eski qiymatdan yangisiga silliq "sanaydi". tabular-nums bilan
//  birga ishlatilganda karta titramaydi.
//  prefers-reduced-motion -> darhol yakuniy qiymat (animatsiyasiz).
//  Reusable: istalgan ekranda istalgan raqam elementi uchun.
// ============================================================

const reduced = () => typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Element matnini `to` qiymatigacha sanab boradi.
 * Element ustida oxirgi qiymat saqlanadi — keyingi chaqiruv o'sha
 * yerdan davom etadi (to'liq qayta sanamaydi).
 *
 * @param {HTMLElement} node
 * @param {number|null} to        — yakuniy qiymat (null -> '—')
 * @param {object} [opts]
 * @param {number} [opts.duration=480]  — ms (DS --sl-motion-slower)
 * @param {number} [opts.decimals=0]
 * @param {string} [opts.suffix='']     — masalan '%'
 */
export function slCountUp(node, to, { duration = 480, decimals = 0, suffix = '' } = {}) {
  if (to == null || !Number.isFinite(Number(to))) {
    node.textContent = '—' + suffix;
    node.__slCount = null;
    return;
  }
  const target = Number(to);
  const from = typeof node.__slCount === 'number' ? node.__slCount : target;
  node.__slCount = target;

  if (reduced() || from === target || duration <= 0) {
    node.textContent = target.toFixed(decimals) + suffix;
    return;
  }
  if (node.__slCountRaf) cancelAnimationFrame(node.__slCountRaf);
  const t0 = performance.now();
  const ease = (x) => 1 - Math.pow(1 - x, 3);   // easeOutCubic (DS --sl-ease-out ruhida)
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / duration);
    const v = from + (target - from) * ease(p);
    node.textContent = v.toFixed(decimals) + suffix;
    if (p < 1) node.__slCountRaf = requestAnimationFrame(tick);
    else node.__slCountRaf = null;
  };
  node.__slCountRaf = requestAnimationFrame(tick);
}

export default { slCountUp };
