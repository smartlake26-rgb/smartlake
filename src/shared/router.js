// ============================================================
//  shared/router.js — Ekran routeri (guard'lar bilan)
//  Himoyalangan yo'nalishlar: har route ixtiyoriy guard'ga ega.
//  Guard(ctx) -> falsy = ruxsat; string qaytarsa = o'sha route'ga
//  yo'naltiradi (redirect). Feature'ga bog'liq emas (generic).
// ============================================================

import { mount } from './dom.js';
import { logger } from '../core/logger.js';

export function createRouter(rootEl) {
  const routes = new Map();
  let currentName = null;
  let currentCleanup = null;   // joriy view'ning tozalash funksiyasi (listener unsubscribe)

  const api = {
    /**
     * Route belgilash.
     * @param {string} name
     * @param {(ctx)=>Node} render  — qaytargan Node'da `.__cleanup` bo'lsa,
     *   navigatsiyada avtomatik chaqiriladi (memory-leak oldini oladi).
     * @param {(ctx)=>(string|false|null|undefined)} [guard]
     */
    define(name, render, guard = null) {
      routes.set(name, { render, guard });
      return api;
    },

    /** Route'ga o'tish (guard + oldingi view cleanup bilan). */
    go(name, ctx = {}) {
      logger.info('[router] go ->', name, '| joriy:', currentName);
      const r = routes.get(name);
      if (!r) throw new Error(`router: ro'yxatdan o'tmagan route: ${name}`);
      if (r.guard) {
        const redirect = r.guard(ctx);
        if (redirect && redirect !== name) return api.go(redirect, ctx);
      }
      // Oldingi view'ni tozalash (listener'larni yopish).
      if (typeof currentCleanup === 'function') { try { currentCleanup(); } catch (_) { /* ignore */ } }
      currentCleanup = null;
      currentName = name;
      const node = r.render(ctx);
      if (node && typeof node.__cleanup === 'function') currentCleanup = node.__cleanup;
      mount(rootEl, node);
      return api;
    },

    current() { return currentName; },
  };

  return api;
}

export default createRouter;
