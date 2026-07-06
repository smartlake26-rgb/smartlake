// ============================================================
//  shared/screen.js — Oddiy ekran boshqaruvchisi
//  Ilovaning yagona root konteynerini boshqaradi. Har ekran —
//  render funksiyasi (Node qaytaradi). Feature'lar o'z ekranini
//  ro'yxatdan o'tkazadi va show() bilan almashadi.
// ============================================================

import { mount } from './dom.js';

export function createScreenManager(rootEl) {
  const screens = new Map();

  return {
    /** Ekranni ro'yxatdan o'tkazish. render: (ctx) => Node */
    register(name, render) {
      screens.set(name, render);
      return this;
    },

    /** Ekranni ko'rsatish. ctx render funksiyasiga uzatiladi. */
    show(name, ctx = {}) {
      const render = screens.get(name);
      if (!render) {
        throw new Error(`screen: ro'yxatdan o'tmagan ekran: ${name}`);
      }
      mount(rootEl, render(ctx));
      return this;
    },
  };
}

export default createScreenManager;
