// ============================================================
//  features/devices/views/adminDevices.js — Qurilmalar jadvali (admin)
//
//  v2 YANGILIK — PROVISIONING UI:
//    deviceService.provision() ilgari hech qayerdan chaqirilmasdi —
//    faollashtirish kalitini yaratishning ilovada yo'li yo'q edi.
//    Endi Super Admin shu sahifada qurilmani ro'yxatga oladi:
//    Device ID kiritiladi -> kalit generatsiya qilinadi -> dialogda
//    BIR MARTA ko'rsatiladi (nusxalash tugmasi bilan). Kalit fermerga
//    beriladi (stiker), fermer "Qurilma qo'shish" ekranida kiritadi.
//    Firmware (gateway/node) kodiga TEGILMAGAN.
// ============================================================
import { el, mount } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import { toast } from '../../../shared/toast.js';
import { dataTable, pill, mdCard, mdButton, field, input, openDialog } from '../../../shared/ui/index.js';
import * as adminStore from '../../../admin/adminStore.js';
import { authStore } from '../../auth/index.js';
import { ROLES } from '../../../core/collections.js';
import { DEVICE_ID_PATTERN } from '../../../core/config.js';
import { deviceService } from '../index.js';
import { resolveThresholds } from '../../telemetry/domain/thresholds.js';
import { deviceStatus } from '../../telemetry/domain/statusEngine.js';

// ------------------------------------------------------------
//  Provisioning kartasi (faqat Super Admin ko'radi — rules ham
//  faqat super'ga ruxsat beradi, UI shunga mos).
// ------------------------------------------------------------
function provisioningCard() {
  const err = el('div', { class: 'md-banner warn', style: 'display:none' });

  const idIn = input({
    type: 'text', placeholder: 'AQ84E991BE', maxlength: 10,
    style: 'text-transform:uppercase;font-family:var(--mono)',
  });
  const regionIn = input({ type: 'text', placeholder: 'Masalan: Xorazm' });

  // Seriya raqami — faqat ko'rsatish, avtomatik beriladi
  const serialDisplay = el('div', {
    style: 'padding:8px 12px;border-radius:8px;background:var(--md-surface-container);'
         + 'font-family:var(--mono);font-weight:700;color:var(--md-on-surface-variant);font-size:14px',
    text: 'Yuklanmoqda...',
  });
  function refreshSerial() {
    const st = adminStore.getState();
    const next = st.devices.length + 1;
    serialDisplay.textContent = `SL-${String(next).padStart(4, '0')}`;
  }
  refreshSerial();

  // PDF yaratish funksiyasi
  async function makePdf({ deviceId, serialNumber, region, activationKey }) {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ format: [90, 130], unit: 'mm' });

    doc.setFillColor(14, 124, 107);
    doc.rect(0, 0, 90, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('SmartLake', 7, 10);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text("Qurilma faollashtirish kartasi", 7, 17);

    doc.setTextColor(20, 20, 20);
    let y = 30;
    const row = (label, value, mono = false) => {
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120);
      doc.text(label + ':', 7, y);
      doc.setFontSize(10); doc.setTextColor(14, 60, 50);
      doc.setFont(mono ? 'courier' : 'helvetica', 'bold');
      doc.text(value || '—', 7, y + 6); y += 14;
    };
    row("Seriya raqami", serialNumber);
    row("Device ID", deviceId, true);
    row("Hudud", region);

    // Faollashtirish kodi — ajratilgan blok
    doc.setFillColor(240, 255, 250);
    doc.roundedRect(5, y - 2, 80, 14, 2, 2, 'F');
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(14, 124, 107);
    doc.text("Faollashtirish kodi:", 8, y + 3);
    doc.setFontSize(11); doc.setFont('courier', 'bold'); doc.setTextColor(14, 80, 60);
    doc.text(activationKey, 8, y + 10); y += 18;

    // QR kod (Google Charts API)
    try {
      const qrUrl = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(deviceId + '|' + activationKey)}&choe=UTF-8&chld=M|1`;
      const resp = await fetch(qrUrl);
      const blob = await resp.blob();
      const b64 = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
      doc.addImage(b64, 'PNG', 20, y, 50, 50); y += 54;
    } catch { y += 4; }

    doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(160, 160, 160);
    doc.text("Bu kartani saqlab qo'ying — qurilmani ulash uchun kerak.", 7, y + 4, { maxWidth: 76 });

    return doc.output('blob');
  }

  // PDF blob keshlash (qurilma ID -> blob)
  const pdfBlobs = new Map();

  function showErr(msg) { err.textContent = msg; err.style.display = 'flex'; }

  const submit = mdButton({ label: 'Kalit yaratish', full: true, onClick: async () => {
    err.style.display = 'none';
    const deviceId = idIn.value.toUpperCase().trim();
    if (!DEVICE_ID_PATTERN.test(deviceId)) {
      showErr("Device ID formati: AQ + 8 ta hex belgi (masalan AQ84E991BE)");
      return;
    }
    if (!regionIn.value.trim()) {
      showErr("Hudud (region) majburiy");
      return;
    }

    const serialNumber = serialDisplay.textContent.trim();
    submit.disabled = true;

    try {
      const actorUid = authStore.getState().uid;
      const st = adminStore.getState();

      // Mavjud qurilma — kalit yangilanadi, ID o'zgarmaydi
      let result;
      if (st.devices.some((d) => d.id === deviceId)) {
        result = await deviceService.regenerateKey(deviceId, actorUid);
        // Mavjud qurilmaning serialNumber ini olish
        const existing = st.devices.find((d) => d.id === deviceId);
        result.serialNumber = existing?.serialNumber || serialNumber;
      } else {
        result = await deviceService.provision({
          deviceId, region: regionIn.value.trim(), serialNumber,
          firmwareVersion: '', hardwareRevision: '',
        }, actorUid);
        result.serialNumber = serialNumber;
      }

      // PDF yaratish va avtomatik yuklab olish
      const pdfBlob = await makePdf({
        deviceId: result.deviceId,
        serialNumber: result.serialNumber,
        region: regionIn.value.trim(),
        activationKey: result.activationKey,
      });
      pdfBlobs.set(result.deviceId, pdfBlob);

      // PDF yuklab olish
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url; a.download = `smartlake-${result.deviceId}.pdf`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      idIn.value = '';
      toast(`${result.deviceId} tayyor — PDF yuklanmoqda`, 'ok');
      await adminStore.refresh();
      refreshSerial();
    } catch (e) {
      showErr(e && e.message ? e.message : 'Xato');
    } finally {
      submit.disabled = false;
    }
  } });

  return mdCard([
    el('div', { class: 't-title', style: 'margin-bottom:4px', text: 'Yangi qurilma (provisioning)' }),
    el('div', { class: 't-body muted', style: 'margin-bottom:12px',
      text: "Qurilma ID sini kiriting — seriya raqami avtomatik beriladi, faollashtirish kaliti yaratiladi va PDF yuklanadi." }),
    err,
    el('div', { class: 'stack' }, [
      field('Device ID (AQ + 8 hex)', idIn),
      field('Hudud (region)', regionIn),
      el('div', {}, [
        el('label', { class: 't-label', style: 'display:block;margin-bottom:4px', text: 'Seriya raqami (avtomatik)' }),
        serialDisplay,
        el('div', { class: 't-body muted', style: 'font-size:11px;margin-top:3px',
          text: "Tizim tomonidan beriladi. Qayta ulanganda o'sha raqam saqlanadi." }),
      ]),
      submit,
    ]),
  ]);
}

export function renderAdminDevices() {
  const wrap = el('div', {});
  const isSuper = (authStore.getState().role === ROLES.SUPER)
    || (authStore.getState().userDoc?.role === ROLES.SUPER);
  // MUHIM: karta BIR MARTA yaratiladi — har store-emit'da qayta qurilsa
  // inputga yozayotganda fokus va qiymat yo'qoladi
  const provCard = isSuper ? provisioningCard() : null;
  const tableBox = el('div');

  function render() {
    const st = adminStore.getState();
    const rows = st.devices.map((d) => {
      const owner = st.users.find((u) => u.uid === d.ownerUid);
      const lake = st.lakes.find((l) => l.id === d.lakeId);
      return { ...d, ownerName: owner ? `${owner.profile?.ism || ''} ${owner.profile?.fam || ''}`.trim() : '—',
        lakeName: lake ? lake.name : '—', status: deviceStatus(st.telemetry.get(d.id) || null, resolveThresholds(lake)) };
    });
    const table = dataTable({
      columns: [
        { key: 'id', label: t('device.deviceId'), render: (r) => el('span', { class: 't-mono', text: r.id }) },
        { key: 'serialNumber', label: 'Seriya №', render: (r) => el('span', { class: 't-mono', text: r.serialNumber || '—' }) },
        { key: 'ownerName', label: t('tm.owner') },
        { key: 'lakeName', label: t('tm.lake') },
        { key: 'region', label: t('tm.region') },
        { key: 'lifecycle', label: t('device.lifecycle'), render: (r) => pill(r.lifecycle || '—', 'neutral') },
        { key: 'status', label: t('tm.status'), render: (r) => pill(t('tm.status_' + r.status), r.status) },
        { key: '_pdf', label: 'PDF', render: (r) => {
          const btn = mdButton({ label: 'PDF', variant: 'text' });
          btn.addEventListener('click', async () => {
            btn.disabled = true;
            try {
              const actorUid = authStore.getState().uid;
              // Yangi kalit generatsiya (PDF uchun)
              let key;
              try { const res = await deviceService.regenerateKey(r.id, actorUid); key = res.activationKey; }
              catch { key = '????-????-????-????'; }
              const { jsPDF } = await import('jspdf');
              const doc = new jsPDF({ format: [90, 130], unit: 'mm' });
              doc.setFillColor(14, 124, 107); doc.rect(0, 0, 90, 22, 'F');
              doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont('helvetica', 'bold');
              doc.text('SmartLake', 7, 10);
              doc.setFontSize(7); doc.setFont('helvetica', 'normal');
              doc.text("Qurilma faollashtirish kartasi", 7, 17);
              doc.setTextColor(20, 20, 20);
              let y = 30;
              const rf = (lb, v, mono) => { doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(120,120,120); doc.text(lb+':', 7, y); doc.setFontSize(10); doc.setTextColor(14,60,50); doc.setFont(mono?'courier':'helvetica','bold'); doc.text(v||'—', 7, y+6); y+=14; };
              rf("Seriya raqami", r.serialNumber || '—');
              rf("Device ID", r.id, true);
              rf("Hudud", r.region || '—');
              doc.setFillColor(240, 255, 250); doc.roundedRect(5, y-2, 80, 14, 2, 2, 'F');
              doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(14,124,107);
              doc.text("Faollashtirish kodi (yangi):", 8, y+3);
              doc.setFontSize(11); doc.setFont('courier','bold'); doc.setTextColor(14,80,60);
              doc.text(key, 8, y+10); y+=18;
              try {
                const qrUrl2 = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(r.id + '|' + key)}&choe=UTF-8&chld=M|1`;
                const resp2 = await fetch(qrUrl2);
                const blob2 = await resp2.blob();
                const b642 = await new Promise((res) => { const rdr = new FileReader(); rdr.onload = () => res(rdr.result); rdr.readAsDataURL(blob2); });
                doc.addImage(b642, 'PNG', 20, y, 50, 50); y+=54;
              } catch {}
              const url = URL.createObjectURL(doc.output('blob'));
              const a = document.createElement('a'); a.href=url; a.download=`smartlake-${r.id}.pdf`; a.click();
              setTimeout(() => URL.revokeObjectURL(url), 5000);
              toast(`PDF yuklandi (${r.id})`, 'ok');
            } catch (e) { toast(e && e.message, 'err'); }
            finally { btn.disabled = false; }
          });
          return btn;
        }},
      ],
      rows, pageSize: 14,
      filters: [{ key: 'status', label: t('tm.status'), options: ['healthy', 'good', 'warning', 'critical', 'offline', 'unknown'].map((s) => ({ value: s, label: t('tm.status_' + s) })) }],
    });

    mount(tableBox, table);
  }
  mount(wrap, el('div', { class: 'stack' }, [provCard, tableBox].filter(Boolean)));
  const unsub = adminStore.subscribe(render); render(); wrap.__cleanup = unsub; return wrap;
}
export default renderAdminDevices;
