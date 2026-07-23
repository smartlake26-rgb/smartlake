// ============================================================
//  features/devices/views/deviceClaimFlow.js — QURILMA ULASH
//
//  Admin tomoni (renderDeviceProvisionCard):
//    Ko'l kartasida "⊕ Qurilma" tugmasi -> modal:
//      - DeviceID (o'zgarmaydi, tartib raqam bilan)
//      - ActivationKey (yangi generatsiya yoki mavjud)
//      - QR kod (ID + Kod)
//      - PDF yuklab olish (ID + Kod + QR)
//
//  Fermer tomoni (renderDeviceClaimModal):
//    - ID + Kod qo'lda kiritish
//    - QR kod skanerlash (kamera)
//    - ownershipService.requestClaim -> admin tasdiqlaydi
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t, detectLocale } from '../../../core/i18n/index.js';
import { authStore } from '../../auth/index.js';
import { openDialog } from '../../../shared/ui/index.js';
import { ownershipService } from '../../ownership/index.js';
import { deviceService, generateActivationKey } from '../index.js';
import * as dataStore from '../../../farmer/dataStore.js';
import {
  slIcon, slCard, slButton, slField, slBadge, slEmptyState,
} from '../../../design-system/index.js';

const isUz = () => detectLocale() === 'uz';

/* ============================================================
   QR KOD — tashqi kutubxonasiz, SVG QR (yengil, dynamic import)
   ============================================================ */
// QR rendering — qrcode lib yo'q, shuning uchun Google Charts API dan olamiz
// (internet bo'lsa) yoki matn ko'rsatamiz
function renderQrEl(text, size = 180) {
  const url = `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encodeURIComponent(text)}&choe=UTF-8`;
  const img = el('img', { src: url, alt: 'QR', width: String(size), height: String(size),
    style: `width:${size}px;height:${size}px;border-radius:8px;display:block;margin:0 auto` });
  img.onerror = () => {
    // Internet yo'q — matn
    mount(img.parentElement || img, el('div', {
      style: `width:${size}px;height:${size}px;display:flex;flex-direction:column;align-items:center;justify-content:center;`
           + 'border:2px dashed var(--sl-border);border-radius:8px;font-size:10px;text-align:center;padding:8px;gap:4px',
    }, [
      el('div', { html: slIcon('info', 18), style: 'opacity:.4' }),
      el('div', { text: text, style: 'font-family:monospace;word-break:break-all' }),
    ]));
  };
  return img;
}

/* ============================================================
   PDF YUKLAB OLISH (jspdf — dynamic import)
   ============================================================ */
async function downloadPdf({ deviceId, activationKey, lakeName, qrDataUrl }) {
  try {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ format: [80, 110], unit: 'mm' });

    doc.setFillColor(14, 124, 107);
    doc.rect(0, 0, 80, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('SmartLake', 6, 8);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(isUz() ? "Qurilma faollashtirish" : 'Активация устройства', 6, 14);

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text(isUz() ? "Ko'l:" : 'Озеро:', 6, 24);
    doc.setFont('helvetica', 'normal');
    doc.text(lakeName || '—', 22, 24);

    doc.setFont('helvetica', 'bold');
    doc.text('Device ID:', 6, 31);
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.text(deviceId, 6, 37);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(isUz() ? 'Faollashtirish kodi:' : 'Код активации:', 6, 45);
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.text(activationKey, 6, 51);

    if (qrDataUrl) {
      try {
        const resp = await fetch(qrDataUrl);
        const blob = await resp.blob();
        const b64 = await new Promise((res) => {
          const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob);
        });
        doc.addImage(b64, 'PNG', 15, 57, 50, 50);
      } catch { /* QR rasm yuklanmasa — skip */ }
    }

    doc.setFontSize(6); doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(isUz() ? 'Bu kartani saqlab qo\'ying — faollashtirish uchun kerak.' : 'Сохраните эту карту — нужна для активации.', 6, 105);

    doc.save(`smartlake-device-${deviceId}.pdf`);
  } catch (e) {
    toast(`PDF: ${e && e.message}`, 'err');
  }
}

/* ============================================================
   ADMIN — "⊕ Qurilma" modal (Ko'l kartasida tugma)
   ============================================================ */
export function openDeviceProvisionModal({ lakeId, lakeName, nav }) {
  const s = authStore.getState();
  const isAdmin = s.role === 'super' || s.role === 'admin';
  if (!isAdmin) {
    // Fermer: claim sahifasiga o'tish
    openDeviceClaimModal({ lakeId, lakeName, nav });
    return;
  }

  // Admin: yangi qurilma provisioning yoki mavjud qayta ulash
  const idIn = slField({ label: 'Device ID', type: 'text',
    attrs: { style: 'text-transform:uppercase;font-family:var(--sl-font-mono,monospace)' },
    placeholder: 'AQ12345678' });
  idIn.querySelector('.sl-help').remove();
  const serialIn = slField({ label: isUz() ? 'Seriya raqam (ixtiyoriy)' : 'Серийный номер (необязательно)',
    type: 'text', placeholder: 'SN-001' });
  serialIn.querySelector('.sl-help').remove();

  const resultBox = el('div');
  let currentKey = null;
  let qrImg = null;
  let qrDataUrl = null;

  async function generate() {
    const rawId = idIn.input.value.trim().toUpperCase();
    if (!rawId) { toast(isUz() ? 'Device ID kiriting' : 'Введите Device ID', 'err'); return; }

    genBtn.disabled = true;
    mount(resultBox, el('div', { class: 'sl-skeleton card', style: 'height:120px' }));
    try {
      // Mavjud qurilmani tekshirish — agar bor bo'lsa key regeneratsiya
      let result;
      try {
        result = await deviceService.regenerateKey(rawId, s.uid);
      } catch {
        // Yangi provision
        result = await deviceService.provision({
          deviceId: rawId,
          serialNumber: serialIn.input.value.trim(),
          firmwareVersion: '', hardwareRevision: '', region: '',
        }, s.uid);
      }
      currentKey = result.activationKey;
      const qrText = `${result.deviceId}|${currentKey}`;

      // QR hosil qilish (Google Charts API — kutubxonasiz)
      qrDataUrl = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(qrText)}&choe=UTF-8`;
      qrImg = renderQrEl(qrText, 160);

      mount(resultBox, el('div', { class: 'sl-stack' }, [
        slCard([
          el('div', { style: 'display:flex;gap:var(--sl-sp-4);align-items:flex-start;flex-wrap:wrap' }, [
            el('div', { class: 'sl-grow' }, [
              el('div', { class: 'sl-caption', text: 'Device ID' }),
              el('div', { style: 'font-family:monospace;font-size:18px;font-weight:800;color:var(--sl-primary);letter-spacing:1px', text: result.deviceId }),
              el('div', { class: 'sl-caption', style: 'margin-top:var(--sl-sp-3)', text: isUz() ? 'Faollashtirish kodi' : 'Код активации' }),
              el('div', { style: 'font-family:monospace;font-size:15px;font-weight:700;color:var(--sl-chart-feed);letter-spacing:2px', text: currentKey }),
              el('div', { class: 'sl-caption', style: 'margin-top:4px;color:var(--sl-text-secondary)',
                text: isUz() ? 'Bu kod bir martalik — qurilma ulanganidan keyin noto\'g\'ri bo\'ladi.' : 'Код одноразовый — после привязки устройства недействителен.' }),
            ]),
            qrImg || el('span'),
          ]),
          el('div', { style: 'margin-top:var(--sl-sp-3)' }, [
            slButton({ label: isUz() ? '⬇ PDF yuklab olish' : '⬇ Скачать PDF',
              variant: 'primary', icon: 'download',
              onClick: () => downloadPdf({ deviceId: result.deviceId, activationKey: currentKey, lakeName, qrDataUrl }) }),
          ]),
        ]),
      ]));
    } catch (e) {
      mount(resultBox, el('div', { class: 'sl-banner warn', text: e && e.message }));
    } finally { genBtn.disabled = false; }
  }

  const genBtn = slButton({ label: isUz() ? 'ID va kod yaratish' : 'Создать ID и код', variant: 'secondary', onClick: generate });

  openDialog({
    title: isUz() ? `⊕ Qurilma ulash — ${lakeName}` : `⊕ Добавить устройство — ${lakeName}`,
    body: el('div', { class: 'sl-stack' }, [
      el('div', { class: 'sl-row', style: 'gap:var(--sl-sp-2);align-items:flex-end;flex-wrap:wrap' }, [idIn, serialIn, genBtn]),
      el('div', { class: 'sl-caption', style: 'color:var(--sl-text-secondary)',
        text: isUz() ? 'Mavjud qurilma uchun: bir xil ID kiriting — kod yangilanadi, ID o\'zgarmaydi.' : 'Для повторного подключения: введите тот же ID — код обновится, ID не изменится.' }),
      resultBox,
    ]),
    actions: [{ label: isUz() ? 'Yopish' : 'Закрыть', variant: 'text' }],
  });
  const dlg = document.querySelector('.md-dialog');
  if (dlg) dlg.classList.add('wide');
}

/* ============================================================
   FERMER — qurilmani ulash modali (ID + Kod qo'lda yoki QR)
   ============================================================ */
export function openDeviceClaimModal({ lakeId, lakeName, nav }) {
  const s = authStore.getState();
  const idIn = slField({ label: 'Device ID', type: 'text',
    attrs: { style: 'text-transform:uppercase;font-family:var(--sl-font-mono,monospace)' },
    placeholder: 'AQ12345678' });
  idIn.querySelector('.sl-help').remove();
  const keyIn = slField({ label: isUz() ? 'Faollashtirish kodi' : 'Код активации', type: 'text',
    attrs: { style: 'text-transform:uppercase;font-family:var(--sl-font-mono,monospace)' },
    placeholder: 'XXXX-XXXX-XXXX-XXXX' });
  keyIn.querySelector('.sl-help').remove();

  const errEl = el('div', { class: 'sl-banner warn', style: 'display:none' });

  // QR scan tugmasi
  const scanBtn = slButton({ label: isUz() ? '📷 QR skanerlash' : '📷 Сканировать QR', variant: 'outlined',
    onClick: () => startQrScan(idIn, keyIn) });

  const submitBtn = slButton({ label: isUz() ? 'Qurilmani ulash' : 'Привязать устройство', variant: 'primary',
    onClick: async () => {
      errEl.style.display = 'none';
      const deviceId = idIn.input.value.trim().toUpperCase();
      const activationKey = keyIn.input.value.trim().toUpperCase();
      if (!deviceId || !activationKey) {
        errEl.textContent = isUz() ? 'Device ID va kodni kiriting' : 'Введите Device ID и код';
        errEl.style.display = 'flex'; return;
      }
      submitBtn.disabled = true;
      try {
        await ownershipService.requestClaim({ deviceId, activationKey, lakeName, lakeId, farmerRegion: s.profile?.vil || '' }, s.uid);
        toast(isUz() ? 'So\'rov yuborildi — admin tasdiqlagandan so\'ng qurilma biriktiriladi.' : 'Запрос отправлен — устройство подключится после одобрения.', 'ok');
        await dataStore.refresh();
        document.querySelectorAll('.md-dialog').forEach((d) => d.remove());
        document.querySelectorAll('.md-scrim').forEach((d) => d.remove());
      } catch (e) {
        const msg = String(e?.code || '').includes('permission-denied')
          ? (isUz() ? 'ID yoki kod noto\'g\'ri, yoki qurilma allaqachon biriktirilgan.' : 'Неверный ID или код, или устройство уже привязано.')
          : (e?.message || 'Xato');
        errEl.textContent = msg; errEl.style.display = 'flex';
        submitBtn.disabled = false;
      }
    },
  });

  openDialog({
    title: isUz() ? `Qurilma ulash — ${lakeName}` : `Подключить устройство — ${lakeName}`,
    body: el('div', { class: 'sl-stack' }, [
      errEl,
      el('div', { class: 'sl-banner info' }, [
        el('span', { html: slIcon('info', 14), style: 'display:inline-flex;flex:none' }),
        el('span', { text: isUz() ? 'Device ID va faollashtirish kodini qurilma qadoqidan yoki admin bergan PDF dan oling.' : 'Device ID и код активации возьмите из упаковки устройства или из PDF от администратора.' }),
      ]),
      idIn, keyIn,
      el('div', { class: 'sl-row', style: 'gap:var(--sl-sp-2)' }, [submitBtn, scanBtn]),
    ]),
    actions: [{ label: isUz() ? 'Bekor qilish' : 'Отмена', variant: 'text' }],
  });
  const dlg = document.querySelector('.md-dialog');
  if (dlg) dlg.classList.add('wide');
}

/* QR skanerlash (kamera API) */
async function startQrScan(idIn, keyIn) {
  const isUzL = isUz();
  if (!navigator.mediaDevices) {
    toast(isUzL ? 'Kamera mavjud emas' : 'Камера недоступна', 'err'); return;
  }
  const video = el('video', { autoplay: 'true', playsinline: 'true',
    style: 'width:100%;border-radius:8px;max-height:280px;object-fit:cover' });
  const scanBox = el('div', { style: 'position:relative' }, [video]);
  const stopBtn = slButton({ label: isUzL ? 'To\'xtatish' : 'Остановить', variant: 'text',
    onClick: () => stop() });

  // Scan dialogi ustiga chiqarish
  const overlay = el('div', {
    style: 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.85);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px',
  }, [
    el('div', { style: 'color:#fff;font-weight:700', text: isUzL ? 'QR kodni kameraga ko\'rsating' : 'Наведите камеру на QR-код' }),
    scanBox,
    stopBtn,
  ]);
  document.body.appendChild(overlay);

  let stream; let raf;
  const canvas = document.createElement('canvas');

  async function stop() {
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
    overlay.remove();
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    await new Promise((res) => { video.onloadedmetadata = res; });
    video.play();

    // BarcodeDetector API (modern browsers)
    const BarcodeDetector = window.BarcodeDetector;
    if (!BarcodeDetector) {
      stop();
      toast(isUzL ? 'Brauzer QR skanerlashni qo\'llab-quvvatlamaydi' : 'Браузер не поддерживает сканирование QR', 'err');
      return;
    }
    const detector = new BarcodeDetector({ formats: ['qr_code'] });

    async function scan() {
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      try {
        const [result] = await detector.detect(canvas);
        if (result) {
          const [id, key] = result.rawValue.split('|');
          if (id && key) {
            idIn.input.value = id.toUpperCase();
            keyIn.input.value = key.toUpperCase();
            toast(isUzL ? 'QR muvaffaqiyatli o\'qildi' : 'QR успешно считан', 'ok');
            stop(); return;
          }
        }
      } catch { /* detector xato — davom etish */ }
      raf = requestAnimationFrame(scan);
    }
    scan();
  } catch (e) {
    stop();
    toast(isUzL ? 'Kameraga ruxsat berilmadi' : 'Нет доступа к камере', 'err');
  }
}

export default { openDeviceProvisionModal, openDeviceClaimModal };
