// ============================================================
//  features/telemetry/views/deviceDetailView.js — Qurilma detali
//  Barcha maydonlar + realtime telemetriya + status + Health Score.
//  History: historyService bilan (24h/7d/30d) — grafik HALI yo'q,
//  hozircha o'lchovlar soni ko'rsatiladi (Sprint-11 grafik uchun seam).
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import { deviceService } from '../../devices/index.js';
import { lakeService } from '../../lakes/index.js';
import { authStore } from '../../auth/index.js';
import { telemetryService } from '../services/telemetryService.js';
import { historyService, RANGES } from '../services/historyService.js';
import { resolveThresholds } from '../domain/thresholds.js';
import { deviceStatus } from '../domain/statusEngine.js';
import { healthScore } from '../domain/healthScore.js';
import { telemetryAge } from '../domain/freshness.js';
import { statusBadge } from '../components/statusBadge.js';
import { skeletonCards } from '../components/skeleton.js';

function fmtAge(ts) {
  const age = telemetryAge(ts);
  if (age == null) return '—';
  const m = Math.floor(age / 60000);
  return m < 1 ? t('tm.justNow') : m < 60 ? `${m} ${t('tm.minAgo')}` : `${Math.floor(m / 60)} ${t('tm.hourAgo')}`;
}
function row(labelKey, value) {
  return el('div', { class: 'set-row' }, [
    el('span', { style: 'color:var(--ink-soft)', text: t(labelKey) }),
    el('span', { style: 'font-weight:600', text: value == null || value === '' ? '—' : String(value) }),
  ]);
}

export function renderDeviceDetail(ctx = {}) {
  const s = authStore.getState();
  const body = el('div', {});
  const root = el('div', { class: 'app' }, [
    el('div', { class: 'topbar', text: t('tm.deviceDetail') }),
    el('div', { class: 'auth-wrap' }, [
      body,
      el('button', { class: 'btn ghost', text: t('common.back'), onClick: () => ctx.onBack && ctx.onBack() }),
    ]),
  ]);

  let device = null;
  let lake = null;
  let tel = null;
  let unsub = null;

  mount(body, skeletonCards(2));

  function render() {
    if (!device) { mount(body, el('div', { class: 'banner err', text: t('error.deviceNotFound') })); return; }
    const th = resolveThresholds(lake);
    const head = el('div', { class: 'card' }, [
      el('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, [
        el('div', { style: 'font-family:var(--mono);font-weight:800;font-size:16px', text: device.id }),
        statusBadge(deviceStatus(tel, th)),
      ]),
      el('div', { style: 'font-size:13px;color:var(--ink-soft);margin-top:6px', text: `${t('tm.health')}: ${healthScore(tel, th)}/100` }),
    ]);

    const sensors = el('div', { class: 'card' }, [
      el('div', { style: 'font-weight:700;margin-bottom:4px', text: t('tm.sensors') }),
      row('tm.do', tel ? tel.do : null),
      row('tm.temp', tel ? tel.t : null),
      row('tm.ph', tel ? tel.ph : null),
      row('tm.battery', tel && tel.battery != null ? `${tel.battery}%` : null),
      row('tm.rssi', tel && tel.rssi != null ? `${tel.rssi} dBm` : null),
      row('tm.telemetryAge', fmtAge(tel ? tel.ts : null)),
    ]);

    const info = el('div', { class: 'card' }, [
      el('div', { style: 'font-weight:700;margin-bottom:4px', text: t('tm.deviceInfo') }),
      row('tm.firmware', device.firmwareVersion),
      row('tm.gateway', tel ? tel.gwVersion : null),
      row('tm.region', device.region),
      row('tm.lake', lake ? lake.name : null),
      row('tm.owner', device.ownerUid === s.uid ? t('tm.you') : device.ownerUid),
    ]);

    // History seam (grafik yo'q — o'lchovlar sonini ko'rsatamiz)
    const histOut = el('div', { style: 'font-size:13px;color:var(--ink-soft);margin-top:8px', text: t('tm.historyHint') });
    const histBtns = Object.keys(RANGES).map((rk) => {
      const b = el('button', { class: 'btn ghost', style: 'width:auto;padding:6px 12px', text: rk });
      b.addEventListener('click', async () => {
        histOut.textContent = t('app.loading');
        try {
          const points = await historyService.getHistory(device.id, rk);
          histOut.textContent = `${points.length} ${t('tm.points')} (${rk})`;
        } catch (e) { histOut.textContent = t(handleError(e, 'history').messageKey); }
      });
      return b;
    });
    const history = el('div', { class: 'card' }, [
      el('div', { style: 'font-weight:700;margin-bottom:6px', text: t('tm.history') }),
      el('div', { style: 'display:flex;gap:8px' }, histBtns),
      histOut,
    ]);

    mount(body, head, sensors, info, history);
  }

  async function boot() {
    try {
      device = await deviceService.getDevice(ctx.deviceId);
      if (device && device.lakeId) lake = await lakeService.getLake(device.lakeId);
    } catch (e) {
      mount(body, el('div', { class: 'banner err', text: t(handleError(e, 'device.load').messageKey) }));
      return;
    }
    unsub = telemetryService.watchByOwner(s.uid, ({ telemetry }) => {
      tel = telemetry.get(ctx.deviceId) || null;
      render();
    }, () => render());
    render();
  }
  boot();

  root.__cleanup = () => { if (unsub) unsub(); };
  return root;
}

export default renderDeviceDetail;
