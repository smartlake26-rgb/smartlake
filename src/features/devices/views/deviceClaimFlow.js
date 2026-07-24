// ============================================================
//  features/devices/views/deviceClaimFlow.js
//
//  ADMIN  → openAdminProvisionPage(nav)
//    Qurilmalar bo'limida "+" bosilganda to'liq sahifa:
//    - Device ID (AQ+8hex)
//    - Hudud (region)
//    - Seriya raqami — AVTOMATIK (SL-0001, SL-0002 ...)
//      Qayta ulanganda ham o'sha raqam saqlanadi
//    - "Kalit yaratish" → PDF ochilib yuklanadi
//    PDF ichida: Device ID, Hudud, Seriya raqami, Kalit, QR kod
//    Qurilma ro'yxatida har qurilma yonida "PDF" tugmasi
//
//  FERMER → openFarmerClaimModal({ lakeId, lakeName })
//    Ko'l kartasida "⊕ Qurilma ulash" bosilganda bottom sheet:
//    - Device ID + Kalit qo'lda
//    - YOKI QR skanerlash
//    - Saqlash → requestClaim
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { detectLocale } from '../../../core/i18n/index.js';
import { authStore } from '../../auth/index.js';
import { ownershipService } from '../../ownership/index.js';
import { deviceService } from '../index.js';
import * as dataStore from '../../../farmer/dataStore.js';
import { slIcon, slCard, slButton, slField } from '../../../design-system/index.js';
import QRCode from 'qrcode';

const uz = detectLocale() === 'uz';
const L = (u, r) => uz ? u : r;

/* ---------- PDF yaratish ---------- */
async function makePdf({ deviceId, serialNumber, region, activationKey }) {

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ format: [90, 130], unit: 'mm' });

  // Header
  doc.setFillColor(14, 124, 107);
  doc.rect(0, 0, 90, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('SmartLake', 7, 10);
  doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  doc.text(L('Qurilma faollashtirish kartasi', 'Карта активации устройства'), 7, 17);

  // Ma'lumotlar
  doc.setTextColor(20, 20, 20);
  let y = 30;
  const field = (label, value, mono = false) => {
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120);
    doc.text(label, 7, y);
    doc.setFontSize(10); doc.setTextColor(14, 60, 50);
    doc.setFont(mono ? 'courier' : 'helvetica', 'bold');
    doc.text(value || '—', 7, y + 6);
    y += 14;
  };

  field(L('Seriya raqami', 'Серийный номер'), serialNumber);
  field('Device ID', deviceId, true);
  field(L('Hudud', 'Регион'), region);

  // Kalit — alohida blok
  doc.setFillColor(240, 255, 250);
  doc.roundedRect(5, y - 2, 80, 14, 2, 2, 'F');
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(14, 124, 107);
  doc.text(L('Faollashtirish kodi', 'Код активации'), 8, y + 3);
  doc.setFontSize(11); doc.setFont('courier', 'bold'); doc.setTextColor(14, 80, 60);
  doc.text(activationKey, 8, y + 10);
  y += 18;

  // QR kod
  try {
    const resp = await fetch(qrUrl);
    const blob = await resp.blob();
    const b64 = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
    doc.addImage(b64, 'PNG', 20, y, 50, 50);
    y += 54;
  } catch { y += 4; }

  // Footer
  doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(160, 160, 160);
  doc.text(L("Bu kartani saqlab qo'ying — qurilmani ulash uchun kerak.", 'Сохраните эту карту — нужна для подключения устройства.'), 7, y, { maxWidth: 76 });

  return { blob: doc.output('blob'), filename: `smartlake-${deviceId}.pdf` };
}

function dlBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ============================================================
   ADMIN — to'liq sahifa
   ============================================================ */
export function openAdminProvisionPage(nav) {
  const s = authStore.getState();
  // Sessiya keshi: yaratilgan PDF blob lar (deviceId -> {blob, filename})
  const pdfCache = new Map();

  /* ---- Forma ---- */
  const idIn = slField({
    label: 'Device ID (AQ + 8 hex)',
    type: 'text',
    attrs: { style: 'text-transform:uppercase;font-family:monospace;letter-spacing:1px;font-size:16px' },
    placeholder: 'AQ1A2B3C4D',
  });
  idIn.querySelector('.sl-help').remove();

  const regionIn = slField({
    label: L('Hudud (region)', 'Регион'),
    type: 'text',
    placeholder: L("Navoiy, O'zbekiston", 'Навои, Узбекистан'),
  });
  regionIn.querySelector('.sl-help').remove();

  const serialEl = el('div', {
    style: 'padding:10px 14px;background:var(--sl-card-inset);border-radius:var(--sl-r-md);'
         + 'font-family:monospace;font-size:15px;font-weight:700;color:var(--sl-text-secondary);'
         + 'letter-spacing:1px',
    text: L('Avtomatik beriladi...', 'Присваивается автоматически...'),
  });

  const resultBox = el('div');
  const errEl    = el('div', { style: 'display:none', class: 'sl-banner warn' });

  const genBtn = slButton({
    label: L('Kalit yaratish', 'Создать ключ'),
    variant: 'primary', icon: 'zap',
    onClick: async () => {
      errEl.style.display = 'none';
      const rawId = idIn.input.value.trim().toUpperCase();
      const region = regionIn.input.value.trim();
      if (!rawId) { errEl.textContent = L('Device ID kiriting', 'Введите Device ID'); errEl.style.display = ''; return; }
      if (!/^AQ[0-9A-F]{8}$/.test(rawId)) {
        errEl.textContent = L('Format: AQ + 8 hex belgi. Masalan: AQ1A2B3C4D', 'Формат: AQ + 8 hex. Пример: AQ1A2B3C4D');
        errEl.style.display = ''; return;
      }
      genBtn.disabled = true;
      serialEl.textContent = L('Hisoblanmoqda...', 'Вычисляется...');
      mount(resultBox, el('div', { class: 'sl-skeleton card', style: 'height:160px' }));

      try {
        // Seriya raqami: mavjud bo'lsa avvalgisi, yangi bo'lsa keyingisi
        const serial = await deviceService.getSerialNumber(rawId);
        serialEl.textContent = serial;

        // Provision yoki regenerate
        let result;
        try { result = await deviceService.regenerateKey(rawId, s.uid); }
        catch { result = await deviceService.provision({ deviceId: rawId, serialNumber: serial, region, firmwareVersion: '', hardwareRevision: '' }, s.uid); }

        await dataStore.refresh();

        // PDF yaratish
        const pdf = await makePdf({ deviceId: result.deviceId, serialNumber: serial, region, activationKey: result.activationKey });
        pdfCache.set(result.deviceId, pdf);

        // Avtomatik yuklab olish
        dlBlob(pdf.blob, pdf.filename);

        mount(resultBox, el('div', { class: 'sl-stack' }, [
          slCard([
            el('div', { style: 'display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap' }, [
              el('div', { class: 'sl-grow' }, [
                el('div', { class: 'sl-caption', text: L('Seriya raqami', 'Серийный номер') }),
                el('div', { style: 'font-family:monospace;font-weight:700;margin-bottom:6px', text: serial }),
                el('div', { class: 'sl-caption', text: 'Device ID' }),
                el('div', { style: 'font-family:monospace;font-size:18px;font-weight:800;color:var(--sl-primary);letter-spacing:1px;margin-bottom:6px', text: result.deviceId }),
                el('div', { class: 'sl-caption', text: L('Faollashtirish kodi', 'Код активации') }),
                el('div', { style: 'font-family:monospace;font-size:14px;font-weight:700;color:var(--sl-chart-feed);letter-spacing:2px;margin-bottom:6px', text: result.activationKey }),
                el('div', { class: 'sl-caption', style: 'color:var(--sl-text-secondary)',
                  text: L("PDF avtomatik yuklanmoqda...", 'PDF загружается автоматически...') }),
              ]),
              await (async () => {
                const qrEl = el('img', { alt: 'QR', width: '120', height: '120',
                  style: 'border-radius:8px;border:1px solid var(--sl-border)' });
                try {
                  qrEl.src = await QRCode.toDataURL(result.deviceId + '|' + result.activationKey, { width: 120, margin: 1, color: { dark: '#0E7C6B' } });
                } catch {}
                return qrEl;
              })(),
            ]),
            el('div', { style: 'margin-top:12px' }, [
              slButton({
                label: L('⬇ PDF qayta yuklab olish', '⬇ Скачать PDF повторно'),
                variant: 'outlined', size: 'sm',
                onClick: () => dlBlob(pdf.blob, pdf.filename),
              }),
            ]),
          ]),
        ]));
      } catch (e) {
        serialEl.textContent = L('Xato', 'Ошибка');
        errEl.textContent = e && e.message; errEl.style.display = '';
        mount(resultBox);
      } finally { genBtn.disabled = false; }
    },
  });

  /* ---- Ro'yxat ---- */
  const listBox = el('div');
  function renderList() {
    const st = dataStore.getState();
    if (st.loading) { mount(listBox, el('div', { class: 'sl-skeleton card', style: 'height:120px' })); return; }
    if (!st.devices.length) { mount(listBox); return; }
    mount(listBox, slCard([
      el('div', { class: 'sl-card-title', style: 'margin-bottom:8px', text: L('Barcha qurilmalar', 'Все устройства') }),
      el('div', {}, st.devices.map((d) => {
        const hasPdf = pdfCache.has(d.id);
        return el('div', {
          style: 'display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--sl-divider)',
        }, [
          el('div', { style: 'width:8px;height:8px;border-radius:50%;flex:none;background:' + (d.lifecycle === 'assigned' ? 'var(--sl-online)' : d.lifecycle === 'provisioned' ? 'var(--sl-warning)' : 'var(--sl-offline)') }),
          el('div', { class: 'sl-grow' }, [
            el('div', { style: 'font-family:monospace;font-weight:700;font-size:13px', text: d.id }),
            el('div', { class: 'sl-caption', text: [d.serialNumber, d.region, d.lifecycle].filter(Boolean).join(' · ') }),
          ]),
          hasPdf ? slButton({
            label: 'PDF', variant: 'text', size: 'sm',
            onClick: () => { const p = pdfCache.get(d.id); if (p) dlBlob(p.blob, p.filename); },
          }) : null,
        ].filter(Boolean));
      })),
    ]));
  }
  const unsub = dataStore.subscribe(renderList);

  const node = el('div', {}, [
    el('div', { class: 'md-appbar' }, [
      el('button', { class: 'md-iconbtn', type: 'button', 'aria-label': L('Orqaga', 'Назад'),
        onClick: () => nav.back() }, [el('span', { html: slIcon('arrowLeft', 22) })]),
      el('div', { class: 'ab-title', text: L('Yangi qurilma (provisioning)', 'Новое устройство (provisioning)') }),
    ]),
    el('div', { class: 'md-content no-nav' }, [
      el('div', { class: 'sl-stack' }, [
        slCard([
          el('div', { class: 'sl-card-title', style: 'margin-bottom:14px',
            text: L("Qurilma ma'lumotlari", 'Данные устройства') }),
          errEl,
          el('div', { class: 'sl-stack-sm' }, [
            idIn,
            regionIn,
            el('div', {}, [
              el('label', { class: 'sl-caption', style: 'display:block;margin-bottom:4px',
                text: L('Seriya raqami', 'Серийный номер') }),
              serialEl,
              el('div', { class: 'sl-caption', style: 'margin-top:4px;color:var(--sl-text-secondary)',
                text: L('Tizim tomonidan avtomatik beriladi. Qayta ulashda o\'sha raqam saqlanadi.', 'Присваивается системой автоматически. При повторном подключении номер сохраняется.') }),
            ]),
            genBtn,
          ]),
        ]),
        resultBox,
        listBox,
      ]),
    ]),
  ]);
  node.__cleanup = () => unsub();
  renderList();
  return node;
}

/* ============================================================
   FERMER — Ko'l kartasi bottom sheet
   ============================================================ */
export function openFarmerClaimModal({ lakeId, lakeName }) {
  const s = authStore.getState();

  const idIn = slField({
    label: 'Device ID',
    type: 'text',
    attrs: { style: 'text-transform:uppercase;font-family:monospace;letter-spacing:1px' },
    placeholder: 'AQ1A2B3C4D',
  });
  idIn.querySelector('.sl-help').remove();

  const keyIn = slField({
    label: L('Faollashtirish kodi', 'Код активации'),
    type: 'text',
    attrs: { style: 'text-transform:uppercase;font-family:monospace;letter-spacing:2px' },
    placeholder: 'XXXX-XXXX-XXXX-XXXX',
  });
  keyIn.querySelector('.sl-help').remove();

  const errEl = el('div', {
    style: 'display:none;color:var(--sl-critical);font-size:13px;padding:10px 12px;'
         + 'background:color-mix(in srgb,var(--sl-critical) 8%,transparent);border-radius:10px',
  });

  const saveBtn = slButton({
    label: L('Saqlash', 'Сохранить'), variant: 'primary',
    onClick: async () => {
      errEl.style.display = 'none';
      const deviceId = idIn.input.value.trim().toUpperCase();
      const activationKey = keyIn.input.value.trim().toUpperCase();
      if (!deviceId || !activationKey) {
        errEl.textContent = L('Device ID va kodni kiriting', 'Введите Device ID и код');
        errEl.style.display = ''; return;
      }
      saveBtn.disabled = true;
      try {
        await ownershipService.requestClaim({ deviceId, activationKey, lakeName, lakeId, farmerRegion: s.profile?.vil || '' }, s.uid);
        close();
        toast(L("So'rov yuborildi — admin tasdiqlagach qurilma biriktiriladi.", "Запрос отправлен — устройство будет подключено после одобрения."), 'ok');
        await dataStore.refresh();
      } catch (e) {
        errEl.textContent = String(e?.code || '').includes('permission-denied')
          ? L("ID yoki kod noto'g'ri, yoki qurilma allaqachon band.", 'Неверный ID/код или устройство уже занято.')
          : (e?.message || L('Xato', 'Ошибка'));
        errEl.style.display = '';
        saveBtn.disabled = false;
      }
    },
  });

  const scanBtn = slButton({
    label: L('📷 QR kod orqali', '📷 Через QR-код'), variant: 'outlined',
    onClick: () => startQrScan(idIn, keyIn),
  });

  const scrim = el('div', {
    style: 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;display:flex;align-items:flex-end',
  });
  const sheet = el('div', {
    style: 'background:var(--md-surface,#fff);width:100%;max-width:480px;margin:0 auto;'
         + 'border-radius:20px 20px 0 0;padding:8px 20px 36px;max-height:90vh;overflow-y:auto;'
         + 'box-shadow:0 -4px 32px rgba(0,0,0,.2)',
  });

  function close() { scrim.remove(); }
  scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });

  sheet.append(
    // Handle + sarlavha
    el('div', { style: 'width:40px;height:4px;border-radius:2px;background:var(--sl-border);margin:12px auto 16px' }),
    el('div', { style: 'font-size:16px;font-weight:800;margin-bottom:16px', text: L(`⊕ Qurilma ulash`, '⊕ Подключить устройство') }),
    el('div', {
      style: 'background:color-mix(in srgb,var(--sl-primary) 8%,transparent);'
           + 'border-left:3px solid var(--sl-primary);border-radius:0 8px 8px 0;'
           + 'padding:10px 12px;font-size:12px;color:var(--sl-text-secondary);margin-bottom:14px',
      text: lakeName,
    }),
    el('div', {
      style: 'background:color-mix(in srgb,var(--sl-info) 8%,transparent);border-radius:10px;'
           + 'padding:10px 12px;font-size:12px;color:var(--sl-text-secondary);margin-bottom:14px;display:flex;gap:8px',
    }, [
      el('span', { html: slIcon('info', 14), style: 'color:var(--sl-info);display:inline-flex;flex:none;margin-top:1px' }),
      el('span', { text: L("Device ID va faollashtirish kodini admin bergan PDF dan oling yoki QR kodni skaner qiling.", "Возьмите Device ID и код из PDF от администратора или отсканируйте QR-код.") }),
    ]),
    errEl,
    idIn,
    el('div', { style: 'height:8px' }),
    keyIn,
    el('div', { style: 'display:flex;gap:8px;margin-top:16px' }, [saveBtn, scanBtn]),
  );
  scrim.append(sheet);
  document.body.append(scrim);
}

/* QR skanerlash */
async function startQrScan(idIn, keyIn) {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast(L('Kamera mavjud emas', 'Камера недоступна'), 'err'); return;
  }
  const video = el('video', { autoplay: 'true', playsinline: 'true',
    style: 'width:100%;border-radius:10px;max-height:260px;object-fit:cover' });

  const scrim = el('div', {
    style: 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:3000;'
         + 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px',
  });
  const stopBtn = slButton({ label: L("To'xtatish", 'Остановить'), variant: 'outlined' });
  scrim.append(
    el('div', { style: 'color:#fff;font-weight:700;font-size:15px',
      text: L('QR kodni kameraga yaqinlashtiring', 'Наведите камеру на QR-код') }),
    el('div', { style: 'width:100%;max-width:340px;border-radius:12px;overflow:hidden' }, [video]),
    stopBtn,
  );
  document.body.append(scrim);

  let stream; let raf;
  function stop() { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); scrim.remove(); }
  stopBtn.addEventListener('click', stop);

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    video.play();
    if (!window.BarcodeDetector) {
      stop();
      toast(L('Brauzer QR skanerlashni qo\'llab-quvvatlamaydi', 'Браузер не поддерживает QR'), 'err');
      return;
    }
    const det = new window.BarcodeDetector({ formats: ['qr_code'] });
    const canvas = document.createElement('canvas');
    async function scan() {
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      try {
        const [res] = await det.detect(canvas);
        if (res) {
          const [id, key] = res.rawValue.split('|');
          if (id && key) {
            idIn.input.value = id.toUpperCase();
            keyIn.input.value = key.toUpperCase();
            stop();
            toast(L("QR muvaffaqiyatli o'qildi", 'QR успешно считан'), 'ok');
            return;
          }
        }
      } catch {}
      raf = requestAnimationFrame(scan);
    }
    scan();
  } catch { stop(); toast(L('Kameraga ruxsat berilmadi', 'Нет доступа к камере'), 'err'); }
}

export default { openAdminProvisionPage, openFarmerClaimModal };
