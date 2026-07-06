// ============================================================
//  shared/toast.js — Qisqa bildirishnoma (toast)
//  Asl ilovadagi toast() ning modul, qayta ishlatiladigan shakli.
// ============================================================

let _node = null;
let _timer = null;

function ensure() {
  if (_node) return _node;
  _node = document.createElement('div');
  _node.className = 'toast';
  document.body.appendChild(_node);
  return _node;
}

/**
 * Toast ko'rsatish.
 * @param {string} message
 * @param {'default'|'ok'|'err'} [type='default']
 * @param {number} [ms=2600]
 */
export function toast(message, type = 'default', ms = 2600) {
  const node = ensure();
  node.textContent = message;
  node.className = 'toast show' + (type === 'ok' ? ' ok' : type === 'err' ? ' err' : '');
  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(() => { node.className = 'toast'; }, ms);
}

export default toast;
