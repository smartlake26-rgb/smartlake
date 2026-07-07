// ============================================================
//  shared/toast.js — MD3 toast (snackbar)
// ============================================================

let wrap = null;
function ensureWrap() {
  if (!wrap || !document.body.contains(wrap)) {
    wrap = document.createElement('div');
    wrap.className = 'md-toast-wrap';
    document.body.appendChild(wrap);
  }
  return wrap;
}

/** Toast ko'rsatish. type: 'info' | 'ok' | 'err'. */
export function toast(message, type = 'info', ms = 2600) {
  const w = ensureWrap();
  const t = document.createElement('div');
  t.className = `md-toast ${type === 'ok' ? 'ok' : type === 'err' ? 'err' : ''}`;
  t.textContent = message;
  w.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity .25s, transform .25s';
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
    setTimeout(() => t.remove(), 260);
  }, ms);
}

export default toast;
