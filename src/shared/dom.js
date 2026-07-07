// ============================================================
//  shared/dom.js — Xavfsiz DOM yordamchilari
//  Asl ilovadagi innerHTML string'lari o'rniga element yaratish
//  (matn textContent orqali kiritiladi -> XSS xavfi kamayadi).
// ============================================================

/**
 * Element yaratish.
 * @param {string} tag
 * @param {object} [props]  { class, text, type, placeholder, onClick, ... }
 * @param {(Node|string)[]} [children]
 * @returns {HTMLElement}
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v; // faqat ishonchli, ichki markup uchun (masalan SVG)
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'dataset' && typeof v === 'object') {
      Object.assign(node.dataset, v);
    } else {
      node.setAttribute(k, v);
    }
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

/** Konteynerni tozalab, yangi bola(lar)ni joylash. */
export function mount(container, ...nodes) {
  container.replaceChildren(...nodes);
  return container;
}

/** Qidiruv (querySelector qisqartma). */
export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export default { el, mount, qs };