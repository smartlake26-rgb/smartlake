// ============================================================
//  features/ota/views/adminOta.js — OTA Firmware Boshqaruvi
//  Admin panelda: Firmware yuklash, versiya boshqaruv,
//  Gateway/Node yangilash, progress va loglar.
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import { toast } from '../../../shared/toast.js';
import { authStore } from '../../auth/index.js';
import { db } from '../../../core/firebase.js';
import { ref as rtdbRef, set, onValue, off } from 'firebase/database';
import { ref as stRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { rtdb } from '../../../core/firebase.js';
import { appBar, mdButton, mdCard, mdIconButton, statusChip, field, input } from '../../../shared/ui/index.js';

// Firebase Storage import
let storage = null;
async function getStorage() {
  if (storage) return storage;
  const { getStorage: gs } = await import('firebase/storage');
  const { app } = await import('../../../core/firebase.js');
  storage = gs(app);
  return storage;
}

export function renderAdminOtaPage(nav) {
  const wrap = el('div', {});
  const uid = authStore.getState().uid;

  // ---- Gateway OTA ----
  const gwVersionIn  = input({ type: 'text', placeholder: '32.6', style: 'font-family:monospace' });
  const gwFileIn     = el('input', { type: 'file', accept: '.bin' });
  const gwStatusBox  = el('div');
  const gwProgressEl = el('div', { style: 'height:8px;border-radius:4px;background:var(--md-surface-container);overflow:hidden;margin-top:8px' });
  const gwProgressBar = el('div', { style: 'height:100%;width:0%;background:var(--md-primary);transition:width .3s;border-radius:4px' });
  gwProgressEl.append(gwProgressBar);

  const gwUploadBtn = mdButton({ label: 'Gateway firmware yuklash', full: true, onClick: async () => {
    const file = gwFileIn.files[0];
    const ver = gwVersionIn.value.trim();
    if (!file || !ver) { toast('Versiya va .bin faylni tanlang', 'err'); return; }
    gwUploadBtn.disabled = true;
    try {
      const st = await getStorage();
      const { ref: sRef, uploadBytes: up, getDownloadURL: gUrl } = await import('firebase/storage');
      const fRef = sRef(st, `firmware/gateway/${ver}/${file.name}`);
      mount(gwStatusBox, el('div', { class: 't-body', text: 'Yuklanmoqda...' }));
      await up(fRef, file);
      const url = await gUrl(fRef);

      // RTDB'ga versiya va URL yozish
      const { getDatabase, ref: rRef, set: rSet } = await import('firebase/database');
      const rtdbI = getDatabase();
      await rSet(rRef(rtdbI, 'ota/gateway/version'), ver);
      await rSet(rRef(rtdbI, 'ota/gateway/url'), url);
      await rSet(rRef(rtdbI, 'ota/gateway/updatedBy'), uid);
      await rSet(rRef(rtdbI, 'ota/gateway/updatedAt'), Date.now());

      mount(gwStatusBox, el('div', { class: 't-body', style: 'color:var(--md-primary)',
        text: `✓ v${ver} yuklandi — Gateway'lar 5 daqiqada yangilanadi` }));
      toast('Gateway firmware yuklandi', 'ok');
    } catch (e) {
      mount(gwStatusBox, el('div', { class: 't-body', style: 'color:var(--md-critical)', text: e.message }));
    } finally { gwUploadBtn.disabled = false; }
  } });

  // ---- Node OTA ----
  const nodeVersionIn = input({ type: 'text', placeholder: '16.3', style: 'font-family:monospace' });
  const nodeFileIn    = el('input', { type: 'file', accept: '.bin' });
  const nodeStatusBox = el('div');

  const nodeUploadBtn = mdButton({ label: 'Node firmware yuklash', full: true, onClick: async () => {
    const file = nodeFileIn.files[0];
    const ver = nodeVersionIn.value.trim();
    if (!file || !ver) { toast('Versiya va .bin faylni tanlang', 'err'); return; }
    nodeUploadBtn.disabled = true;
    try {
      const st = await getStorage();
      const { ref: sRef, uploadBytes: up, getDownloadURL: gUrl } = await import('firebase/storage');
      const fRef = sRef(st, `firmware/node/${ver}/${file.name}`);
      mount(nodeStatusBox, el('div', { class: 't-body', text: 'Yuklanmoqda...' }));
      await up(fRef, file);
      const url = await gUrl(fRef);

      const { getDatabase, ref: rRef, set: rSet } = await import('firebase/database');
      const rtdbI = getDatabase();
      await rSet(rRef(rtdbI, 'ota/node/version'), ver);
      await rSet(rRef(rtdbI, 'ota/node/url'), url);
      await rSet(rRef(rtdbI, 'ota/node/updatedBy'), uid);
      await rSet(rRef(rtdbI, 'ota/node/updatedAt'), Date.now());

      mount(nodeStatusBox, el('div', { class: 't-body', style: 'color:var(--md-primary)',
        text: `✓ v${ver} yuklandi — Gateway orqali Node'larga yuboriladi` }));
      toast('Node firmware yuklandi', 'ok');
    } catch (e) {
      mount(nodeStatusBox, el('div', { class: 't-body', style: 'color:var(--md-critical)', text: e.message }));
    } finally { nodeUploadBtn.disabled = false; }
  } });

  // ---- Gateway'lar holati (real-time) ----
  const gwListBox = el('div');
  let gwListener = null;

  function startListening() {
    const { getDatabase, ref: rRef, onValue: rOn } = {};
    import('firebase/database').then(({ getDatabase, ref, onValue }) => {
      const rtdbI = getDatabase();
      const gwRef = ref(rtdbI, 'gateway');
      gwListener = onValue(gwRef, (snap) => {
        const data = snap.val();
        if (!data) { mount(gwListBox, el('div', { class: 't-body muted', text: 'Gateway topilmadi' })); return; }

        const rows = Object.entries(data).map(([gwid, gw]) => {
          const ota = gw.ota || {};
          const status = gw.status || {};
          const otaStatus = ota.status || 'idle';
          const progress = ota.progress || 0;
          const fwVer = ota.fw_current || '?';

          const chipColor = otaStatus === 'verified' ? 'healthy'
            : otaStatus === 'downloading' ? 'warning'
            : otaStatus === 'failed' ? 'critical'
            : otaStatus === 'rebooting' ? 'good'
            : 'neutral';

          return el('div', {
            style: 'display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--md-outline-variant)',
          }, [
            el('div', {
              style: `width:8px;height:8px;border-radius:50%;flex:none;`
                   + `background:${status.lora ? 'var(--md-primary)' : 'var(--md-outline)'}`,
            }),
            el('div', { class: 'grow' }, [
              el('div', { class: 't-mono', style: 'font-weight:700', text: gwid }),
              el('div', { class: 't-body muted', style: 'font-size:11px',
                text: `FW: ${fwVer} · Nodes: ${status.nodes || 0} · Heap: ${status.gw_heap || '?'}` }),
            ]),
            statusChip(otaStatus, chipColor),
            otaStatus === 'downloading' ? el('div', { style: 'width:60px' }, [
              el('div', { style: `height:4px;border-radius:2px;background:var(--md-surface-container)` }, [
                el('div', { style: `height:100%;width:${progress}%;background:var(--md-primary);border-radius:2px;transition:width .3s` }),
              ]),
            ]) : null,
          ].filter(Boolean));
        });

        mount(gwListBox, el('div', {}, rows));
      });
    });
  }

  // ---- UI ----
  const content = el('div', { class: 'md-content no-nav' }, [
    el('div', { class: 'stack' }, [
      // Gateway OTA
      mdCard([
        el('div', { class: 't-title', style: 'margin-bottom:8px', text: '📡 Gateway OTA' }),
        el('div', { class: 't-body muted', style: 'margin-bottom:12px',
          text: 'Gateway firmware (.bin) ni yuklang. Barcha Gateway\'lar 5 daqiqa ichida avtomatik yangilanadi.' }),
        el('div', { class: 'stack', style: 'gap:8px' }, [
          field('Versiya raqami', gwVersionIn),
          el('div', {}, [
            el('label', { class: 't-label', text: 'Firmware fayl (.bin)' }),
            gwFileIn,
          ]),
          gwUploadBtn,
          gwStatusBox,
          gwProgressEl,
        ]),
      ]),

      // Node OTA
      mdCard([
        el('div', { class: 't-title', style: 'margin-bottom:8px', text: '🔌 Node OTA (LoRa orqali)' }),
        el('div', { class: 't-body muted', style: 'margin-bottom:12px',
          text: 'Node firmware ni yuklang. Gateway yuklab olib, LoRa orqali har bir Node\'ga uzatadi.' }),
        el('div', { class: 'stack', style: 'gap:8px' }, [
          field('Versiya raqami', nodeVersionIn),
          el('div', {}, [
            el('label', { class: 't-label', text: 'Firmware fayl (.bin)' }),
            nodeFileIn,
          ]),
          nodeUploadBtn,
          nodeStatusBox,
        ]),
      ]),

      // Gateway holatlari
      mdCard([
        el('div', { class: 't-title', style: 'margin-bottom:8px', text: '📊 Gateway\'lar holati' }),
        el('div', { class: 't-body muted', style: 'margin-bottom:8px',
          text: 'Real-vaqt: OTA progress, firmware versiyasi, node soni.' }),
        gwListBox,
      ]),
    ]),
  ]);

  const node = el('div', {}, [
    appBar({ title: 'OTA Firmware Yangilash',
      leading: mdIconButton({ icon: 'arrowLeft', onClick: () => nav.back() }) }),
    content,
  ]);

  startListening();
  node.__cleanup = () => {
    // Listener tozalash
    if (gwListener) {
      import('firebase/database').then(({ getDatabase, ref, off }) => {
        off(ref(getDatabase(), 'gateway'));
      });
    }
  };

  return node;
}

export default renderAdminOtaPage;
