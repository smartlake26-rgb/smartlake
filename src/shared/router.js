// ============================================================
//  shared/router.js — Ekran routeri (guard'lar bilan)
//  Himoyalangan yo'nalishlar: har route ixtiyoriy guard'ga ega.
//  Guard(ctx) -> falsy = ruxsat; string qaytarsa = o'sha route'ga
//  yo'naltiradi (redirect). Feature'ga bog'liq emas (generic).
// ============================================================

import { mount } from './dom.js';

export function createRouter(rootEl) {
  const routes = new Map();
  let currentName = null;

  const api = {
    /**
     * Route belgilash.
     * @param {string} name
     * @param {(ctx)=>Node} render
     * @param {(ctx)=>(string|false|null|undefined)} [guard]
     */
    define(name, render, guard = null) {
      routes.set(name, { render, guard });
      return api;
    },

    /** Route'ga o'tish (guard tekshiruvi bilan). */
    go(name, ctx = {}) {
      const r = routes.get(name);
      if (!r) throw new Error(`router: ro'yxatdan o'tmagan route: ${name}`);
      if (r.guard) {
        const redirect = r.guard(ctx);
        if (redirect && redirect !== name) return api.go(redirect, ctx);
      }
      currentName = name;
      mount(rootEl, r.render(ctx));
      return api;
    },

    current() { return currentName; },
  };

  return api;
}

export default createRouter;
