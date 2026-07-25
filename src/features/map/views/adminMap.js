// ============================================================
//  features/map/views/adminMap.js — Qurilmalar xaritasi
//  Leaflet.js + OpenStreetMap (bepul, API kalit kerak emas)
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { icon } from '../../../shared/icons.js';
import * as adminStore from '../../../admin/adminStore.js';
import { presence } from '../../telemetry/domain/freshness.js';

// Leaflet CSS va JS lazy yuklash
async function loadLeaflet() {
  if (window.L) return window.L;
  // CSS
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(css);
  // JS
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  return window.L;
}

export function renderAdminMap() {
  const wrap = el('div', {});
  const mapEl = el('div', { id: 'sl-admin-map', style: 'width:100%;height:500px;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)' });
  const statsRow = el('div', { style: 'display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap' });
  const listBox = el('div', { style: 'margin-top:16px' });

  mount(wrap, el('div', { style: 'max-width:1200px' }, [
    el('div', { style: 'font-size:18px;font-weight:800;color:#1a2a3a;margin-bottom:16px;display:flex;align-items:center;gap:8px' }, [
      el('span', { style: 'color:#2A8FC4', innerHTML: icon('location', 20) }),
      el('span', { text: 'Qurilmalar xaritasi' }),
    ]),
    statsRow,
    mapEl,
    listBox,
  ]));

  async function init() {
    const L = await loadLeaflet();
    const st = adminStore.getState();

    // Qurilmalar + ko'l koordinatalari
    const points = [];
    st.devices.forEach((d) => {
      const lake = st.lakes.find((l) => l.id === d.lakeId);
      const tel = st.telemetry.get(d.id) || null;
      const isOn = tel && presence(tel.ts) === 'online';
      const coord = lake && lake.coordinates;
      if (coord && coord.lat != null && coord.lng != null) {
        points.push({
          lat: coord.lat, lng: coord.lng,
          deviceId: d.id, lakeName: lake.name || '—', region: d.region || lake.region || '—',
          online: isOn, do: tel && tel.do, temp: tel && tel.t,
          serialNumber: d.serialNumber || '—',
        });
      }
    });

    // Koordinatasiz qurilmalar
    const noCoord = st.devices.filter((d) => {
      const lake = st.lakes.find((l) => l.id === d.lakeId);
      return !lake || !lake.coordinates || lake.coordinates.lat == null;
    });

    // Stats
    mount(statsRow, ...[
      statChip('location', `${points.length}`, 'Xaritada', '#2A8FC4'),
      statChip('info', `${noCoord.length}`, 'Koordinatasiz', '#E8922A'),
      statChip('wifi', `${points.filter((p) => p.online).length}`, 'Online', '#0E7C6B'),
      statChip('wifiOff', `${points.filter((p) => !p.online).length}`, 'Offline', '#D93025'),
    ]);

    if (!points.length) {
      mapEl.style.height = '200px';
      mapEl.style.display = 'flex';
      mapEl.style.alignItems = 'center';
      mapEl.style.justifyContent = 'center';
      mapEl.style.background = '#f5f7f8';
      mapEl.innerHTML = `<div style="text-align:center;color:#8aa"><div style="font-size:32px;margin-bottom:8px">📍</div><div>Koordinatali qurilma topilmadi</div><div style="font-size:12px;margin-top:4px">Ko'l yaratishda koordinatalarni kiriting</div></div>`;
      return;
    }

    // Xarita
    const center = [points.reduce((s, p) => s + p.lat, 0) / points.length,
                     points.reduce((s, p) => s + p.lng, 0) / points.length];
    const map = L.map(mapEl).setView(center, 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 18,
    }).addTo(map);

    // Markerlar
    const bounds = [];
    points.forEach((p) => {
      bounds.push([p.lat, p.lng]);
      const color = p.online ? '#0E7C6B' : '#D93025';
      const markerIcon = L.divIcon({
        className: '',
        html: `<div style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M12 2v6m0 4v6M5 12h6m2 0h6"/></svg>
        </div>`,
        iconSize: [32, 32], iconAnchor: [16, 16],
      });
      const marker = L.marker([p.lat, p.lng], { icon: markerIcon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family:sans-serif;min-width:180px">
          <div style="font-weight:800;font-size:14px;color:#1a2a3a">${p.lakeName}</div>
          <div style="font-size:12px;color:#6a8a9a;margin:4px 0">${p.deviceId} · ${p.region}</div>
          <div style="display:flex;gap:10px;margin-top:8px">
            <span style="font-weight:700;color:${p.online ? '#0E7C6B' : '#D93025'}">${p.online ? '● Online' : '● Offline'}</span>
            ${p.do != null ? `<span>DO: <b>${p.do.toFixed(1)}</b></span>` : ''}
            ${p.temp != null ? `<span>${p.temp.toFixed(1)}°C</span>` : ''}
          </div>
        </div>
      `);
    });

    if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });

    // Koordinatasiz qurilmalar ro'yxati
    if (noCoord.length) {
      mount(listBox, el('div', {
        style: 'background:#fff;border-radius:14px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.03)',
      }, [
        el('div', { style: 'font-size:14px;font-weight:700;color:#E8922A;margin-bottom:10px',
          text: `⚠ ${noCoord.length} ta qurilma koordinatasiz` }),
        ...noCoord.slice(0, 10).map((d) =>
          el('div', { style: 'font-family:monospace;font-size:12px;color:#6a8a9a;padding:3px 0', text: `${d.id} — ${d.region || '—'}` })
        ),
      ]));
    }
  }

  function statChip(ic, val, label, color) {
    return el('div', {
      style: `display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:12px;`
           + `background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.03);border:1px solid #f0f2f4`,
    }, [
      el('span', { style: `color:${color}`, innerHTML: icon(ic, 16) }),
      el('span', { style: 'font-size:18px;font-weight:800;color:#1a2a3a', text: val }),
      el('span', { style: 'font-size:11px;color:#6a8a9a', text: label }),
    ]);
  }

  init().catch((e) => { mapEl.textContent = 'Xarita yuklanmadi: ' + (e && e.message); });
  return wrap;
}

export default renderAdminMap;
