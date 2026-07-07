// ============================================================
//  components/skeleton.js — Yuklanish skeleti (professional loading)
// ============================================================

import { el } from '../../../shared/dom.js';

export function skeletonCards(count = 3) {
  const cards = [];
  for (let i = 0; i < count; i += 1) {
    cards.push(el('div', { class: 'card sk-card' }, [
      el('div', { class: 'sk-line', style: 'width:55%' }),
      el('div', { class: 'sk-line', style: 'width:80%' }),
      el('div', { class: 'sk-line', style: 'width:40%' }),
    ]));
  }
  return el('div', {}, cards);
}

export default skeletonCards;
