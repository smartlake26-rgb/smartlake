// ============================================================
//  features/commands/views/commandPanel.js — Buyruq boshqaruvi (fermer)
//
//  GW-BRIDGE versiyasi:
//   • Guruhlar firmware HAQIQATDA qo'llaydigan buyruqlarga moslandi:
//       aerator (qo'lda YOQ / avtoga qaytarish), rejim (kislorod/vaqt),
//       tizim (vaqt sinxron / holat so'rash).
//     Yem motori va restart olib tashlandi — firmware'da bunday buyruq yo'q edi,
//     tugmalar bosilsa ham hech narsa bo'lmasdi.
//   • YANGI "Kislorod chegaralari" bo'limi: minimal DO, yetarli farq va
//     kritik DO ni ilovadan kiritish -> gateway -> LoRa -> node NVS.
//   • Qurilmadagi JORIY qiymatlar jonli ko'rsatiladi (node har telemetriyada
//     mindo/farqdo/kritik ni yuboradi) — qurilma klaviaturasidan o'zgartirilsa
//     ham ilovada darhol yangilanadi (ikki tomonlama sinxron).
//   • Node ACK javobi (last_cmd_ok) telemetriyadan o'qib ko'rsatiladi.
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { icon } from '../../../shared/icons.js';
import { handleError } from '../../../core/errors.js';
import { mdCard, mdButton, input } from '../../../shared/ui/index.js';
import { COMMAND_TYPES, COMMAND_STATUS } from '../../../core/collections.js';
import { commandService } from '../services/commandService.js';
import { COMMAND_DEFS, COMMAND_TTL_MS, THRESHOLD_LIMITS } from '../constants/commandConstants.js';
import { createAckTracker } from '../domain/ackTracker.js';
import { isExpired } from '../domain/commandLifecycle.js';
import * as dataStore from '../../../farmer/dataStore.js';

const CMD_COLOR = {
  [COMMAND_STATUS.PENDING]: 'var(--md-warning)',
  [COMMAND_STATUS.SENT]: 'var(--md-primary)',
  [COMMAND_STATUS.EXECUTED]: 'var(--md-success)',
  [COMMAND_STATUS.FAILED]: 'var(--md-critical)',
  [COMMAND_STATUS.EXPIRED]: 'var(--md-neutral)',
};

function cmdChip(status) {
  const c = CMD_COLOR[status] || 'var(--md-neutral)';
  return el('span', { class: 'md-chip', style: `background:color-mix(in srgb, ${c} 16%, transparent);color:${c}`, text: t('cmdStatus.' + status) });
}

// Firmware qo'llaydigan tugma guruhlari (feed/restart olib tashlandi)
const GROUPS = [
  { key: 'aerator', types: [COMMAND_TYPES.AERATOR_ON, COMMAND_TYPES.AERATOR_OFF] },
  { key: 'mode',    types: [COMMAND_TYPES.MODE_DO, COMMAND_TYPES.MODE_TIME] },
  { key: 'system',  types: [COMMAND_TYPES.SYNC_TIME, COMMAND_TYPES.REQUEST_STATUS] },
];

// Chegara qatorlari: [type, i18n label kaliti, telemetriyadagi maydon]
const THRESHOLD_ROWS = [
  [COMMAND_TYPES.SET_MINDO,  'cmd.setMindo',  'mindo'],
  [COMMAND_TYPES.SET_FARQ,   'cmd.setFarq',   'farqdo'],
  [COMMAND_TYPES.SET_KRITIK, 'cmd.setKritik', 'kritik'],
];

export function renderCommandPanel(deviceId, ownerUid) {
  const listEl = el('div', { class: 'stack-2' });
  let commands = [];
  let sending = false;

  const buttons = [];
  function setDisabled(v) { buttons.forEach((b) => { b.disabled = v; }); }

  // --- QURILMA TASDIG'I (ackTracker) ---
  // 'waiting' -> kulrang "javob kutilmoqda", 'acked' -> ko'k oraliq,
  // 'saved' -> YASHIL "qurilmada saqlandi" + toast, 'timeout'/'rejected' -> ogohlantirish.
  const ackEl = el('div', { class: 't-body-sm', style: 'margin-top:6px;font-weight:600', text: '' });
  const ack = createAckTracker((state, p) => {
    const map = {
      waiting:  ['cmd.waitAck',    'var(--md-on-surface-variant)'],
      acked:    ['cmd.ackedMid',   'var(--md-primary)'],
      saved:    ['cmd.savedOk',    'var(--md-success)'],
      rejected: ['cmd.ackRejected','var(--md-critical)'],
      timeout:  ['cmd.ackTimeout', 'var(--md-warning)'],
    };
    const [key, color] = map[state] || map.waiting;
    ackEl.textContent = t(key);
    ackEl.style.color = color;
    if (state === 'saved')    toast(t('cmd.savedOk'), 'ok');
    if (state === 'timeout')  toast(t('cmd.ackTimeout'), 'err');
    if (state === 'rejected') toast(t('cmd.ackRejected'), 'err');
  });

  async function send(type, payload = null) {
    if (sending) return false;
    sending = true; setDisabled(true);
    try {
      await commandService.createCommand({ deviceId, commandType: type, payload }, ownerUid);
      // Chegara buyrug'i bo'lsa — "saqlandi" faqat qiymat qurilmadan qaytganda.
      const thrRow = THRESHOLD_ROWS.find(([tt]) => tt === type);
      ack.expect(type, thrRow
        ? { value: payload && payload.value, telKey: thrRow[2] }
        : {});
      return true;
    } catch (e) {
      toast(t(handleError(e, 'command.create').messageKey), 'err');
      return false;
    } finally { sending = false; setDisabled(false); }
  }

  // --- Boshqaruv tugmalari ---
  const groupRows = GROUPS.map((g) => el('div', {}, [
    el('div', { class: 't-label muted', style: 'margin:6px 0 4px', text: t('cmdGroup.' + g.key) }),
    el('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap' }, g.types.map((type) => {
      const def = COMMAND_DEFS[type];
      const variant = (type === COMMAND_TYPES.AERATOR_OFF || type === COMMAND_TYPES.MODE_TIME) ? 'outlined' : 'tonal';
      const b = mdButton({ label: t(def.labelKey), icon: def.icon, variant, onClick: () => send(type) });
      buttons.push(b);
      return b;
    })),
  ]));

  // --- Kislorod chegaralari (qurilma bilan ikki tomonlama) ---
  const thrInputs = new Map();     // type -> input element
  const thrCurrent = new Map();    // type -> "joriy qiymat" span
  const thrPrefilled = new Set();  // faqat bir marta avtomatik to'ldiramiz

  const thresholdRows = THRESHOLD_ROWS.map(([type, labelKey, telKey]) => {
    const lim = THRESHOLD_LIMITS[type];
    const inp = input({
      type: 'number', min: String(lim.min), max: String(lim.max), step: '1',
      placeholder: `${lim.min}–${lim.max}`, style: 'max-width:110px;text-align:center',
    });
    thrInputs.set(type, inp);
    const cur = el('span', { class: 't-body-sm muted', text: t('cmd.deviceNow', { v: '—' }) });
    thrCurrent.set(type, cur);
    const btn = mdButton({ label: t('cmd.send'), variant: 'tonal', onClick: async () => {
      const v = parseInt(inp.value, 10);
      if (!Number.isInteger(v) || v < lim.min || v > lim.max) {
        toast(t('cmd.rangeErr', { min: lim.min, max: lim.max }), 'err');
        return;
      }
      await send(type, { value: v });
    } });
    buttons.push(btn);
    return el('div', { style: 'padding:6px 0;border-bottom:1px solid var(--md-outline-variant)' }, [
      el('div', { class: 'row-between', style: 'gap:8px;flex-wrap:wrap;align-items:center' }, [
        el('div', {}, [
          el('div', { class: 't-body-sm', text: t(labelKey) }),
          cur,
        ]),
        el('div', { class: 'row', style: 'gap:8px;align-items:center' }, [inp, btn]),
      ]),
    ]);
  });

  // Telemetriya obunasi: joriy chegaralar jonli yangilanadi + tracker'ga oziq.
  // Node klaviaturasidan o'zgartirilsa ham keyingi telemetriyada shu yerda ko'rinadi.
  const unsubTel = dataStore.subscribe((st) => {
    const tel = st.telemetry && st.telemetry.get ? st.telemetry.get(deviceId) : null;
    if (!tel) return;
    for (const [type, , telKey] of THRESHOLD_ROWS) {
      const v = tel[telKey];
      if (typeof v === 'number' && Number.isFinite(v)) {
        thrCurrent.get(type).textContent = t('cmd.deviceNow', { v: v });
        const inp = thrInputs.get(type);
        if (!thrPrefilled.has(type) && !inp.value) { inp.value = String(Math.round(v)); thrPrefilled.add(type); }
      }
    }
    ack.feed(tel);   // qurilma tasdig'ini tekshirish
  });

  // --- Oxirgi buyruqlar ro'yxati (Firestore tarixi) ---
  function renderList() {
    if (!commands.length) { mount(listEl, el('div', { class: 't-body-sm muted', text: t('cmd.none') })); return; }
    mount(listEl, ...commands.slice(0, 5).map((c) => {
      const createdMs = c.createdAt && typeof c.createdAt.toMillis === 'function' ? c.createdAt.toMillis() : null;
      const visualExpired = isExpired(createdMs, c.status, Date.now(), COMMAND_TTL_MS);
      const status = visualExpired ? COMMAND_STATUS.EXPIRED : c.status;
      const def = COMMAND_DEFS[c.commandType] || { labelKey: 'cmd.unknown' };
      const valTxt = c.payload && typeof c.payload.value === 'number' ? ` = ${c.payload.value}` : '';
      return el('div', { class: 'row-between', style: 'padding:6px 0;border-bottom:1px solid var(--md-outline-variant)' }, [
        el('div', { class: 'row', style: 'gap:8px' }, [
          el('span', { style: 'color:var(--md-on-surface-variant)', html: icon(def.icon || 'activity', 18) }),
          el('span', { class: 't-body-sm', text: t(def.labelKey) + valTxt }),
        ]),
        cmdChip(status),
      ]);
    }));
  }

  const unsubCmd = commandService.subscribeByDevice(deviceId, (list) => { commands = list; renderList(); }, () => renderList());
  renderList();

  const card = mdCard([
    el('div', { class: 't-title-sm', style: 'margin-bottom:4px', text: t('cmd.control') }),
    ...groupRows,
    el('div', { class: 't-label muted', style: 'margin:12px 0 4px', text: t('cmdGroup.thresholds') }),
    el('div', { class: 't-body-sm muted', style: 'margin-bottom:4px', text: t('cmd.thresholdsHint') }),
    ...thresholdRows,
    ackEl,
    el('div', { class: 't-label muted', style: 'margin:12px 0 4px', text: t('cmd.recent') }),
    listEl,
  ], { elevated: true });

  card.__cleanup = () => { unsubCmd(); unsubTel(); ack.cancel(); };
  return card;
}

export default renderCommandPanel;
