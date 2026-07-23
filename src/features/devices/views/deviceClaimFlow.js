// ============================================================
//  features/devices/views/deviceClaimFlow.js — QURILMA ULASH
//
//  ADMIN (openAdminProvisionPage):
//    - Hudud + DeviceID (admin o'zi kiritadi, AQ+8hex)
//    - Tartib raqam tizim tomonidan avtomatik
//    - "Kalit yaratish" → PDF (DeviceID + Kalit + QR)
//    - PDF pastda yuklab olish tugmasi (qurilma holati bilan birga)
//
//  FERMER (openFarmerClaimModal, Ko'l kartasida "⊕ Qurilma"):
//    - DeviceID + Kalit qo'lda kiritish
//    - YOKI "📷 QR kod" tugmasi → kamera scan
//    - "Saqlash" → requestClaim → admin tasdiqlaydi
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t, detectLocale } from '../../../core/i18n/index.js';
import { authStore } from '../../auth/index.js';
import { ownershipService } from '../../ownership/index.js';
import { deviceService, generateActivationKey } from '../index.js';
import * as dataStore from '../../../farmer/dataStore.js';
import {
  slIcon, slCard, slButton, slField, slBadge,
} from '../../../design-system/index.js';

const L = (uz, ru) => detectLocale() === 'uz' ? uz : ru;

/* ============================================================
   DIALOG yordamchi
   ============================================================ */
function showModal(title, body, onClose) {
  const scrim = el('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2000;display:flex;align-items:flex-end' });
  const sheet = el('div', {
    style: 'background:var(--md-surface,#fff);width:100%;max-width:480px;margin:0 auto;'
         + 'border-radius:20px 20px 0 0;padding:24px 20px 32px;max-height:90vh;overflow-y:auto;'
         + 'box-shadow:0 -4px 32px rgba(0,0,0,.18);animation:sl-pdrawer-in .22s ease both',
  });
  const handle = el('div', { style: 'width:40px;height:4px;border-radius:2px;background:var(--sl-border,#ddd);margin:0 auto 16px' });
  const titleEl = el('div', { style: 'font-size:17px;font-weight:800;margin-bottom:16px', text: title });
  const closeBtn = el('button', { type: 'button',
    style: 'position:absolute;top:12px;right:16px;background:none;border:none;font-size:22px;cursor:pointer;color:var(--sl-text-secondary)',
    text: '×' });
  sheet.style.position = 'relative';
  sheet.append(handle, titleEl, closeBtn, body);
  scrim.append(sheet);
  document.body.append(scrim);

  function close() { scrim.remove(); onClose && onClose(); }
  closeBtn.addEventListener('click', close);
  scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });
  return { close };
}

/* ============================================================
   TARTIB RAQAM — mavjud qurilmalar soniga qarab
   ============================================================ */
async function nextSerialNumber() {
  try {
    const st = dataStore.getState();
    const count = st.devices.length + 1;
    return `SL-${String(count).padStart(4, '0')}`;
  } catch { return `SL-0001`; }
}

/* ============================================================
   PDF YARATISH — jspdf (dynamic import)
   ============================================================ */
async function generatePdf({ deviceId, activationKey, serialNumber, region }) {
  const qrUrl = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(deviceId + '|' + activationKey)}&choe=UTF-8&chld=M|1`;

  try {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ format: [85, 120], unit: 'mm' });

    // Header
    doc.setFillColor(14, 124, 107);
    doc.rect(0, 0, 85, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text('SmartLake', 7, 9);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(L('Qurilma faollashtirish kartasi', 'Карта активации устройства'), 7, 15);

    // Ma'lumotlar
    doc.setTextColor(20, 20, 20);
    const rows = [
      [L('Tartib raqam', 'Серийный №'), serialNumber],
      ['Device ID', deviceId],
      [L('Hudud', 'Регион'), region || '—'],
      [L('Faollashtirish kodi', 'Код активации'), activationKey],
    ];
    let y = 28;
    rows.forEach(([label, value]) => {
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
      doc.text(label + ':', 7, y);
      doc.setFontSize(9); doc.setFont(label === 'Device ID' || label.includes('kod') ? 'courier' : 'helvetica', 'bold');
      doc.setTextColor(14, 124, 107);
      doc.text(value, 7, y + 5);
      y += 12;
    });

    // QR kod
    try {
      const resp = await fetch(qrUrl);
      const blob = await resp.blob();
      const b64 = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
      doc.addImage(b64, 'PNG', 17, y + 2, 52, 52);
      y += 58;
    } catch { y += 4; }

    doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(140, 140, 140);
    doc.text(L("Bu kartani saqlab qo'ying — qurilmani ulash uchun kerak.", 'Сохраните эту карту — нужна для подключения устройства.'), 7, y + 4, { maxWidth: 71 });

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    return { url, filename: `smartlake-device-${deviceId}.pdf` };
  } catch (e) {
    throw new Error('PDF: ' + (e && e.message));
  }
}

/* ============================================================
   ADMIN — Qurilmalar bo'limida yangi qurilma provisioning
   @param {object} nav — navigatsiya ob'ekti
   ============================================================ */
export function openAdminProvisionPage(nav) {
  const s = authStore.getState();

  const regionIn = slField({ label: L('Hudud', 'Регион'), type: 'text', placeholder: L('Navoiy, O\'zbekiston', 'Навои, Узбекистан') });
  regionIn.querySelector('.sl-help').remove();

  const idIn = slField({ label: 'Device ID', type: 'text',
    attrs: { style: 'text-transform:uppercase;font-family:monospace;letter-spacing:1px' },
    placeholder: 'AQ12345678' });
  idIn.querySelector('.sl-help').remove();

  const resultBox = el('div');
  let pdfData = null;  // { url, filename }

  const genBtn = slButton({
    label: L('Kalit yaratish', 'Создать ключ'), variant: 'primary',
    onClick: async () => {
      const rawId = idIn.input.value.trim().toUpperCase();
      const region = regionIn.input.value.trim();
      if (!rawId) { toast(L('Device ID kiriting', 'Введите Device ID'), 'err'); return; }
      if (!/^AQ[0-9A-F]{8}$/.test(rawId)) { toast(L("Format: AQ + 8 hex belgi (masalan AQ1A2B3C4D)", "Формат: AQ + 8 hex символов"), 'err'); return; }

      genBtn.disabled = true;
      mount(resultBox, el('div', { class: 'sl-skeleton card', style: 'height:100px' }));
      pdfData = null;

      try {
        const serial = await nextSerialNumber();
        // Mavjud qurilma bo'lsa — kalit yangilanadi, bo'lmasa — yangi provision
        let result;
        try {
          result = await deviceService.regenerateKey(rawId, s.uid);
        } catch {
          result = await deviceService.provision({ deviceId: rawId, serialNumber: serial, region, firmwareVersion: '', hardwareRevision: '' }, s.uid);
        }

        // PDF yaratish
        pdfData = await generatePdf({ deviceId: result.deviceId, activationKey: result.activationKey, serialNumber: serial, region });
        await dataStore.refresh();

        mount(resultBox, slCard([
          el('div', { class: 'sl-stack-sm' }, [
            el('div', { style: 'display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap' }, [
              el('div', { class: 'sl-grow' }, [
                el('div', { class: 'sl-caption', text: L('Tartib raqam', 'Серийный №') }),
                el('div', { style: 'font-weight:700;margin-bottom:8px', text: serial }),
                el('div', { class: 'sl-caption', text: 'Device ID' }),
                el('div', { style: 'font-family:monospace;font-size:17px;font-weight:800;color:var(--sl-primary);letter-spacing:1px;margin-bottom:8px', text: result.deviceId }),
                el('div', { class: 'sl-caption', text: L('Faollashtirish kodi', 'Код активации') }),
                el('div', { style: 'font-family:monospace;font-size:14px;font-weight:700;color:var(--sl-chart-feed);letter-spacing:2px', text: result.activationKey }),
              ]),
              el('img', {
                src: `https://chart.googleapis.com/chart?chs=120x120&cht=qr&chl=${encodeURIComponent(result.deviceId + '|' + result.activationKey)}&choe=UTF-8&chld=M|1`,
                alt: 'QR',
                style: 'width:120px;height:120px;border-radius:8px;border:1px solid var(--sl-border)',
              }),
            ]),
            el('div', { class: 'sl-caption', style: 'color:var(--sl-text-secondary)',
              text: L("Bu kalit bir martalik. Qurilma biriktirilgach yangi kalit kerak bo'ladi.", "Ключ одноразовый. После привязки устройства потребуется новый ключ.") }),
            slButton({
              label: L('⬇ PDF yuklab olish', '⬇ Скачать PDF'),
              variant: 'secondary', icon: 'download',
              onClick: () => {
                if (!pdfData) return;
                const a = document.createElement('a');
                a.href = pdfData.url; a.download = pdfData.filename; a.click();
              },
            }),
          ]),
        ]));
      } catch (e) {
        mount(resultBox, el('div', { class: 'sl-banner warn', text: e && e.message }));
      } finally { genBtn.disabled = false; }
    },
  });

  // To'liq sahifa sifatida qaytarish
  const node = el('div', {}, [
    el('div', { class: 'md-appbar' }, [
      el('button', { class: 'md-iconbtn', type: 'button', 'aria-label': L('Orqaga', 'Назад'),
        html: slIcon('arrowLeft', 22), onClick: () => nav.back() }),
      el('div', { class: 'grow', style: 'font-size:17px;font-weight:700', text: L('Yangi qurilma ulash', 'Подключить устройство') }),
    ]),
    el('div', { class: 'md-content no-nav' }, [
      el('div', { class: 'sl-stack' }, [
        slCard([
          el('div', { class: 'sl-card-title', style: 'margin-bottom:12px', text: L("Qurilma ma'lumotlari", 'Данные устройства') }),
          el('div', { class: 'sl-stack-sm' }, [
            regionIn,
            idIn,
            el('div', { class: 'sl-caption', style: 'color:var(--sl-text-secondary)',
              text: L('Format: AQ + 8 hex belgi. Misol: AQ1A2B3C4D. Tartib raqam avtomatik beriladi.', 'Формат: AQ + 8 hex символов. Пример: AQ1A2B3C4D. Серийный номер присваивается автоматически.') }),
            genBtn,
          ]),
        ]),
        resultBox,
      ]),
    ]),
  ]);
  node.__cleanup = () => { if (pdfData) URL.revokeObjectURL(pdfData.url); };
  return node;
}

/* ============================================================
   FERMER — Ko'l kartasida "⊕ Qurilma ulash" → bottom sheet
   ============================================================ */
export function openFarmerClaimModal({ lakeId, lakeName }) {
  const s = authStore.getState();

  const idIn = slField({ label: 'Device ID', type: 'text',
    attrs: { style: 'text-transform:uppercase;font-family:monospace;letter-spacing:1px' },
    placeholder: 'AQ12345678' });
  idIn.querySelector('.sl-help').remove();

  const keyIn = slField({
    label: L('Faollashtirish kodi', 'Код активации'), type: 'text',
    attrs: { style: 'text-transform:uppercase;font-family:monospace;letter-spacing:2px' },
    placeholder: 'XXXX-XXXX-XXXX-XXXX' });
  keyIn.querySelector('.sl-help').remove();

  const errEl = el('div', { style: 'display:none;color:var(--sl-critical);font-size:13px;padding:8px;background:color-mix(in srgb,var(--sl-critical) 10%,transparent);border-radius:8px' });

  const saveBtn = slButton({
    label: L('Saqlash', 'Сохранить'), variant: 'primary',
    onClick: async () => {
      errEl.style.display = 'none';
      const deviceId = idIn.input.value.trim().toUpperCase();
      const activationKey = keyIn.input.value.trim().toUpperCase();
      if (!deviceId || !activationKey) {
        errEl.textContent = L('Device ID va kodni kiriting', 'Введите Device ID и код');
        errEl.style.display = 'block'; return;
      }
      saveBtn.disabled = true;
      try {
        await ownershipService.requestClaim({ deviceId, activationKey, lakeName, lakeId, farmerRegion: s.profile?.vil || '' }, s.uid);
        modal.close();
        toast(L("So'rov yuborildi — admin tasdiqlagach qurilma biriktiriladi.", "Запрос отправлен — устройство подключится после одобрения."), 'ok');
        await dataStore.refresh();
      } catch (e) {
        errEl.textContent = String(e?.code || '').includes('permission-denied')
          ? L("ID yoki kod noto'g'ri, yoki qurilma allaqachon band.", 'Неверный ID или код, или устройство уже занято.')
          : (e?.message || L('Xato yuz berdi', 'Произошла ошибка'));
        errEl.style.display = 'block';
        saveBtn.disabled = false;
      }
    },
  });

  // QR skanerlash
  const scanBtn = slButton({
    label: L('📷 QR kod orqali', '📷 Через QR-код'), variant: 'outlined',
    onClick: () => startQrScan(idIn, keyIn),
  });

  const body = el('div', { class: 'sl-stack' }, [
    el('div', { class: 'sl-banner info', style: 'font-size:12px' }, [
      el('span', { html: slIcon('info', 14), style: 'display:inline-flex;flex:none' }),
      el('span', { text: L("Device ID va faollashtirish kodini admin bergan PDF dan oling yoki QR kodni skaner qiling.", "Возьмите Device ID и код из PDF от администратора или отсканируйте QR-код.") }),
    ]),
    errEl,
    idIn,
    keyIn,
    el('div', { class: 'sl-row', style: 'gap:8px' }, [saveBtn, scanBtn]),
  ]);

  const modal = showModal(L(`⊕ Qurilma ulash — ${lakeName}`, `⊕ Устройство — ${lakeName}`), body);
}

/* QR skanerlash */
async function startQrScan(idIn, keyIn) {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast(L('Kamera mavjud emas', 'Камера недоступна'), 'err'); return;
  }
  const video = el('video', { autoplay: 'true', playsinline: 'true',
    style: 'width:100%;border-radius:10px;max-height:260px;object-fit:cover' });
  const stopBtn = slButton({ label: L("To'xtatish", 'Остановить'), variant: 'text' });
  const scanBody = el('div', { class: 'sl-stack-sm' }, [
    el('div', { style: 'font-size:13px;color:var(--sl-text-secondary);text-align:center',
      text: L('QR kodni kameraga yaqinlashtiring', 'Наведите камеру на QR-код') }),
    video, stopBtn,
  ]);
  const m = showModal(L('QR skanerlash', 'Сканирование QR'), scanBody);
  stopBtn.addEventListener('click', () => { stop(); m.close(); });

  let stream; let raf;
  function stop() {
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach((tr) => tr.stop());
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    video.play();
    if (!window.BarcodeDetector) {
      stop(); m.close();
      toast(L('Brauzer QR skanerlashni qo\'llab-quvvatlamaydi', 'Браузер не поддерживает QR'), 'err');
      return;
    }
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const canvas = document.createElement('canvas');
    async function scan() {
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      try {
        const [res] = await detector.detect(canvas);
        if (res) {
          const [id, key] = res.rawValue.split('|');
          if (id && key) {
            idIn.input.value = id.toUpperCase();
            keyIn.input.value = key.toUpperCase();
            stop(); m.close();
            toast(L('QR muvaffaqiyatli o\'qildi', 'QR успешно считан'), 'ok');
            return;
          }
        }
      } catch {}
      raf = requestAnimationFrame(scan);
    }
    scan();
  } catch {
    stop(); m.close();
    toast(L('Kameraga ruxsat berilmadi', 'Нет доступа к камере'), 'err');
  }
}

export default { openAdminProvisionPage, openFarmerClaimModal };
