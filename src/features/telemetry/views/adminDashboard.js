// ============================================================
//  adminDashboard.js — Enterprise Admin Dashboard v2
//  KPI + Fleet + Alerts + OTA holati
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import { icon } from '../../../shared/icons.js';
import { dataTable, pill, mdCard, mdButton } from '../../../shared/ui/index.js';
import * as adminStore from '../../../admin/adminStore.js';
import { resolveThresholds } from '../domain/thresholds.js';
import { deviceStatus } from '../domain/statusEngine.js';
import { presence } from '../domain/freshness.js';
import { DEVICE_STATUS } from '../constants/telemetryConstants.js';
import { ROLES } from '../../../core/collections.js';

/* ---- KPI Karta ---- */
function kpiCard({ ic, value, label, badge, color, bgColor }) {
  return el('div', {
    style: `background:#fff;border-radius:16px;padding:20px;box-shadow:0 1px 6px rgba(0,0,0,.04);`
         + `border:1px solid #f0f2f4;flex:1;min-width:160px;transition:transform .15s,box-shadow .15s;cursor:default`,
  }, [
    el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px' }, [
      el('div', {
        style: `width:38px;height:38px;border-radius:12px;background:${bgColor || 'color-mix(in srgb,' + color + ' 10%,transparent)'};`
             + `display:flex;align-items:center;justify-content:center`,
        innerHTML: icon(ic, 20),
      }),
      badge ? el('span', {
        style: `font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${bgColor || 'color-mix(in srgb,' + color + ' 10%,transparent)'};color:${color}`,
        text: badge,
      }) : null,
    ].filter(Boolean)),
    el('div', { style: `font-size:32px;font-weight:800;color:#1a2a3a;line-height:1;margin-bottom:4px`, text: String(value) }),
    el('div', { style: `font-size:13px;font-weight:500;color:#6a8a9a`, text: label }),
  ]);
}

/* ---- Alert qator ---- */
function alertItem({ deviceId, lake, status, tel, isUz }) {
  const sev = status === DEVICE_STATUS.CRITICAL ? { color: '#D93025', bg: '#FEE8E7', label: 'KRITIK', icon: 'bell' }
    : status === DEVICE_STATUS.OFFLINE ? { color: '#6a8a9a', bg: '#f0f4f5', label: 'OFFLINE', icon: 'wifiOff' }
    : { color: '#E8922A', bg: '#FFF3E0', label: isUz ? 'Ogohlantirish' : 'Внимание', icon: 'info' };
  const ago = tel && tel.ts ? fmtAgo(tel.ts) : '—';
  return el('div', {
    style: 'display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;background:#fff;'
         + `border-left:4px solid ${sev.color};margin-bottom:6px;box-shadow:0 1px 4px rgba(0,0,0,.03)`,
  }, [
    el('div', { style: `width:32px;height:32px;border-radius:50%;background:${sev.bg};display:flex;align-items:center;justify-content:center;flex:none;color:${sev.color}`, innerHTML: icon(sev.icon, 16) }),
    el('div', { style: 'flex:1;min-width:0' }, [
      el('div', { style: 'font-size:13px;font-weight:700;color:#1a2a3a', text: `${deviceId} — ${lake}` }),
      el('div', { style: 'font-size:11px;color:#8aa;margin-top:2px', text: ago }),
    ]),
    el('span', { style: `font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;background:${sev.bg};color:${sev.color}`, text: sev.label }),
  ]);
}

function fmtAgo(ts) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function renderAdminDashboard() {
  const wrap = el('div', {});
  const isUz = true; // TODO: detectLocale

  function render() {
    const st = adminStore.getState();
    let gwOnline = 0, nodeActive = 0, critAlerts = 0;
    const alertRows = [];
    const fleetRows = [];

    st.devices.forEach((d) => {
      const tel = st.telemetry.get(d.id) || null;
      const lake = st.lakes.find((l) => l.id === d.lakeId);
      const isOn = tel && presence(tel.ts) === 'online';
      const th = resolveThresholds(lake);
      const status = deviceStatus(tel, th);

      if (isOn) gwOnline++;
      if (tel && typeof tel.rssi === 'number') nodeActive++;
      if (status === DEVICE_STATUS.CRITICAL) critAlerts++;
      if ([DEVICE_STATUS.CRITICAL, DEVICE_STATUS.WARNING, DEVICE_STATUS.OFFLINE].includes(status)) {
        alertRows.push({ deviceId: d.id, lake: lake ? lake.name : '—', status, tel });
      }

      fleetRows.push({
        id: d.id,
        lake: lake ? lake.name : '—',
        region: d.region || '—',
        serialNumber: d.serialNumber || '—',
        lifecycle: d.lifecycle || '—',
        rssi: tel ? (tel.rssi ?? '—') : '—',
        battery: tel ? (tel.battery ?? '—') : '—',
        fw: tel ? (tel.fw || '—') : '—',
        lastSeen: tel && tel.ts ? fmtAgo(tel.ts) : '—',
        statusKey: isOn ? 'online' : 'offline',
        do: tel && typeof tel.do === 'number' ? tel.do.toFixed(1) : '—',
        temp: tel && typeof tel.t === 'number' ? tel.t.toFixed(1) : '—',
      });
    });

    const pendingCount = st.requests.length;
    const totalDevices = st.devices.length;

    // ========= KPI ROW =========
    const kpiRow = el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px' }, [
      kpiCard({ ic: 'wifi', value: gwOnline, label: 'Gateway online', badge: `+${totalDevices - gwOnline}`, color: '#0E7C6B', bgColor: '#E8FAF6' }),
      kpiCard({ ic: 'radio', value: nodeActive, label: 'Node faol', badge: 'LoRa', color: '#6366F1', bgColor: '#EEF2FF' }),
      kpiCard({ ic: 'bell', value: critAlerts, label: 'Kritik alert', badge: '24h', color: '#D93025', bgColor: '#FEE8E7' }),
      kpiCard({ ic: 'check', value: pendingCount, label: isUz ? 'Kutilayotgan' : 'Pending', badge: isUz ? "So'rov" : 'Req', color: '#E8922A', bgColor: '#FFF3E0' }),
    ]);

    // ========= ALERT CENTER =========
    const alertSection = el('div', {
      style: 'background:#fff;border-radius:16px;padding:18px;margin-bottom:20px;box-shadow:0 1px 6px rgba(0,0,0,.04)',
    }, [
      el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:14px' }, [
        el('div', { style: 'font-size:16px;font-weight:800;color:#1a2a3a;display:flex;align-items:center;gap:8px' }, [
          el('span', { style: 'color:#D93025', innerHTML: icon('bell', 18) }),
          el('span', { text: isUz ? 'Ogohlantirish markazi' : 'Alert Center' }),
          alertRows.length ? el('span', {
            style: 'font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:#FEE8E7;color:#D93025',
            text: String(alertRows.length),
          }) : null,
        ].filter(Boolean)),
      ]),
      ...(alertRows.length
        ? alertRows.slice(0, 8).map((r) => alertItem({ ...r, isUz }))
        : [el('div', { style: 'text-align:center;padding:24px;color:#8aa;font-size:13px' }, [
            el('div', { style: 'color:#0E7C6B;margin-bottom:6px', innerHTML: icon('check', 28) }),
            el('div', { text: isUz ? 'Barcha qurilmalar sog\'lom' : 'Все устройства в норме' }),
          ])]),
    ]);

    // ========= DEVICE FLEET =========
    const fleetSection = el('div', {
      style: 'background:#fff;border-radius:16px;padding:18px;margin-bottom:20px;box-shadow:0 1px 6px rgba(0,0,0,.04)',
    }, [
      el('div', { style: 'font-size:16px;font-weight:800;color:#1a2a3a;margin-bottom:14px;display:flex;align-items:center;gap:8px' }, [
        el('span', { style: 'color:#6366F1', innerHTML: icon('chip', 18) }),
        el('span', { text: isUz ? 'Qurilmalar floti' : 'Device Fleet' }),
        el('span', { style: 'font-size:12px;color:#8aa;font-weight:500', text: `(${totalDevices})` }),
      ]),
      dataTable({
        columns: [
          { key: 'id', label: 'Device ID', render: (r) => el('span', { style: 'font-family:monospace;font-weight:700;font-size:12px', text: r.id }) },
          { key: 'lake', label: isUz ? "Ko'l" : 'Озеро' },
          { key: 'region', label: isUz ? 'Hudud' : 'Регион' },
          { key: 'do', label: 'DO', render: (r) => el('span', { style: `font-weight:700;color:${parseFloat(r.do) < 4 ? '#D93025' : parseFloat(r.do) < 6 ? '#E8922A' : '#0E7C6B'}`, text: r.do }) },
          { key: 'temp', label: '°C' },
          { key: 'rssi', label: 'RSSI', render: (r) => el('span', { style: `font-weight:600;color:${typeof r.rssi === 'number' && r.rssi > -80 ? '#0E7C6B' : '#E8922A'}`, text: String(r.rssi) }) },
          { key: 'lastSeen', label: isUz ? 'Oxirgi' : 'Посл.' },
          { key: 'statusKey', label: isUz ? 'Holat' : 'Статус', render: (r) => pill(r.statusKey === 'online' ? 'Online' : 'Offline', r.statusKey === 'online' ? 'healthy' : 'critical') },
        ],
        rows: fleetRows, pageSize: 12, searchable: true,
        emptyText: isUz ? 'Qurilma topilmadi' : 'Устройства не найдены',
      }),
    ]);

    // ========= QUICK STATS =========
    const quickStats = el('div', {
      style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:20px',
    }, [
      miniStat(isUz ? 'Foydalanuvchilar' : 'Пользователи', st.users.length, 'user', '#2A8FC4'),
      miniStat(isUz ? 'Fermerlar' : 'Фермеры', st.users.filter((u) => u.role === ROLES.FARMER).length, 'user', '#0E7C6B'),
      miniStat(isUz ? "Ko'llar" : 'Озёра', st.lakes.length, 'droplet', '#6366F1'),
    ]);

    mount(wrap, el('div', { style: 'max-width:1200px' }, [kpiRow, alertSection, fleetSection, quickStats]));
  }

  function miniStat(label, value, ic, color) {
    return el('div', {
      style: 'background:#fff;border-radius:14px;padding:16px;display:flex;align-items:center;gap:14px;box-shadow:0 1px 4px rgba(0,0,0,.03)',
    }, [
      el('div', { style: `width:42px;height:42px;border-radius:12px;background:color-mix(in srgb,${color} 10%,transparent);display:flex;align-items:center;justify-content:center;color:${color}`, innerHTML: icon(ic, 20) }),
      el('div', {}, [
        el('div', { style: 'font-size:24px;font-weight:800;color:#1a2a3a', text: String(value) }),
        el('div', { style: 'font-size:12px;color:#6a8a9a', text: label }),
      ]),
    ]);
  }

  const unsub = adminStore.subscribe(render);
  render();
  wrap.__cleanup = unsub;
  return wrap;
}

export default renderAdminDashboard;
