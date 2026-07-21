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
  const serialIn = input({ type: 'text', placeholder: 'Ixtiyoriy' });

  function showErr(msg) { err.textContent = msg; err.style.display = 'flex'; }

  const submit = mdButton({ label: 'Kalit yaratish (provisioning)', full: true, onClick: async () => {
    err.style.display = 'none';
    const deviceId = idIn.value.toUpperCase().trim();

    if (!DEVICE_ID_PATTERN.test(deviceId)) {
      showErr("Device ID formati: AQ + 8 ta hex belgi (masalan AQ84E991BE)");
      return;
    }
    if (!regionIn.value.trim()) {
      showErr("Hudud (region) majburiy — claim so'rovlari hudud bo'yicha tasdiqlanadi");
      return;
    }
    // Takroriy provisioning oldi olinadi (mavjud kalit ustidan yozilib ketmasin)
    const st = adminStore.getState();
    if (st.devices.some((d) => d.id === deviceId)) {
      showErr(`${deviceId} allaqachon ro'yxatda — kaliti mavjud. Yangi kalit kerak bo'lsa, avval qurilmani super admin orqali o'chiring.`);
      return;
    }

    submit.disabled = true;
    try {
      const actorUid = authStore.getState().uid;
      const { activationKey } = await deviceService.provision({
        deviceId,
        region: regionIn.value.trim(),
        serialNumber: serialIn.value.trim(),
        firmwareVersion: '',
        hardwareRevision: '',
      }, actorUid);

      // Kalit shu dialogda ko'rsatiladi — darhol yozib oling / nusxalang.
      const keyEl = el('div', {
        class: 't-mono',
        style: 'font-size:20px;letter-spacing:1px;padding:12px;border:1px dashed var(--md-outline);border-radius:8px;text-align:center;user-select:all',
        text: activationKey,
      });
      openDialog({
        title: `${deviceId} — faollashtirish kaliti`,
        body: el('div', { class: 'stack' }, [
          keyEl,
          el('div', { class: 't-body muted', style: 'margin-top:8px',
            text: "Kalitni fermerga bering (qadoq stikeri). Fermer 'Qurilma qo'shish' ekranida shu kalitni kiritadi." }),
        ]),
        actions: [
          { label: 'Nusxalash', variant: 'filled', onClick: () => {
            navigator.clipboard.writeText(activationKey)
              .then(() => toast('Kalit nusxalandi', 'ok'))
              .catch(() => toast("Nusxalab bo'lmadi — qo'lda ko'chiring", 'err'));
          } },
          { label: 'Yopish', variant: 'text' },
        ],
      });

      idIn.value = ''; serialIn.value = '';
      toast(`${deviceId} ro'yxatga olindi`, 'ok');
      adminStore.refresh();   // jadval yangilanadi
    } catch (e) {
      showErr(e && e.message ? e.message : 'Provisioning xatosi');
    } finally {
      submit.disabled = false;
    }
  } });

  return mdCard([
    el('div', { class: 't-title', style: 'margin-bottom:4px', text: 'Yangi qurilma (provisioning)' }),
    el('div', { class: 't-body muted', style: 'margin-bottom:12px',
      text: "Qurilma ID sini kiriting — faollashtirish kaliti avtomatik yaratiladi va ko'rsatiladi." }),
    err,
    el('div', { class: 'stack' }, [
      field('Device ID (AQ + 8 hex)', idIn),
      field('Hudud (region)', regionIn),
      field('Seriya raqami', serialIn),
      submit,
    ]),
  ]);
}

export function renderAdminDevices() {
  const wrap = el('div', {});
  const isSuper = authStore.getState().userDoc?.role === ROLES.SUPER;

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
        { key: 'ownerName', label: t('tm.owner') },
        { key: 'lakeName', label: t('tm.lake') },
        { key: 'region', label: t('tm.region') },
        { key: 'lifecycle', label: t('device.lifecycle'), render: (r) => pill(r.lifecycle || '—', 'neutral') },
        { key: 'status', label: t('tm.status'), render: (r) => pill(t('tm.status_' + r.status), r.status) },
      ],
      rows, pageSize: 14,
      filters: [{ key: 'status', label: t('tm.status'), options: ['healthy', 'good', 'warning', 'critical', 'offline', 'unknown'].map((s) => ({ value: s, label: t('tm.status_' + s) })) }],
    });

    // Provisioning kartasi + jadval. Karta faqat super adminga ko'rinadi.
    mount(wrap, el('div', { class: 'stack' },
      isSuper ? [provisioningCard(), table] : [table]));
  }
  const unsub = adminStore.subscribe(render); render(); wrap.__cleanup = unsub; return wrap;
}
export default renderAdminDevices;
