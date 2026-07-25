// ============================================================
//  features/notifications/views/adminPush.js
//  Admin: Push xabar yuborish + Support ticketlar
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { icon } from '../../../shared/icons.js';
import { mdCard, mdButton, field, input, select, dataTable, pill } from '../../../shared/ui/index.js';
import * as adminStore from '../../../admin/adminStore.js';
import { db } from '../../../core/firebase.js';
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { authStore } from '../../auth/index.js';

export function renderAdminPushSupport() {
  const wrap = el('div', { style: 'max-width:900px' });

  // ======== PUSH BROADCAST ========
  const titleIn = input({ type: 'text', placeholder: 'Xabar sarlavhasi' });
  const bodyIn  = el('textarea', {
    style: 'width:100%;min-height:80px;border-radius:10px;border:1.5px solid #e0e4e8;padding:12px;font-size:14px;font-family:inherit;resize:vertical',
    placeholder: 'Xabar matni...',
  });
  const audienceSel = select([
    { value: 'all', label: 'Barcha foydalanuvchilar' },
    { value: 'farmers', label: 'Faqat fermerlar' },
    { value: 'admins', label: 'Faqat adminlar' },
  ], 'all');

  const sendBtn = mdButton({ label: 'Xabar yuborish', full: true, onClick: async () => {
    const title = titleIn.value.trim();
    const body = bodyIn.value.trim();
    if (!title || !body) { toast('Sarlavha va matnni kiriting', 'err'); return; }
    sendBtn.disabled = true;
    try {
      const st = adminStore.getState();
      const audience = audienceSel.value;
      let targets = st.users.filter((u) => u.fcmToken);
      if (audience === 'farmers') targets = targets.filter((u) => u.role === 'farmer');
      if (audience === 'admins') targets = targets.filter((u) => ['super', 'operator'].includes(u.role));

      if (!targets.length) { toast('Push token bor foydalanuvchi topilmadi', 'err'); return; }

      // Firestore'ga broadcast yozish (Cloud Function trigger qiladi)
      await addDoc(collection(db, 'pushBroadcasts'), {
        title, body, audience,
        sentBy: authStore.getState().uid,
        sentAt: serverTimestamp(),
        targetCount: targets.length,
        status: 'pending',
      });

      toast(`${targets.length} ta foydalanuvchiga yuborildi`, 'ok');
      titleIn.value = ''; bodyIn.value = '';
      loadHistory();
    } catch (e) { toast(e && e.message || 'Xato', 'err'); }
    finally { sendBtn.disabled = false; }
  } });

  const historyBox = el('div');
  async function loadHistory() {
    try {
      const q = query(collection(db, 'pushBroadcasts'), orderBy('sentAt', 'desc'), limit(10));
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (!rows.length) { mount(historyBox, el('div', { style: 'color:#8aa;padding:12px;font-size:13px', text: 'Hali xabar yuborilmagan' })); return; }
      mount(historyBox, el('div', {}, rows.map((r) =>
        el('div', { style: 'display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f0f2f4' }, [
          el('div', { style: 'width:8px;height:8px;border-radius:50%;background:#0E7C6B;flex:none' }),
          el('div', { style: 'flex:1' }, [
            el('div', { style: 'font-size:13px;font-weight:700', text: r.title }),
            el('div', { style: 'font-size:11px;color:#8aa', text: `${r.targetCount || 0} ta · ${r.audience || 'all'}` }),
          ]),
          el('div', { style: 'font-size:10px;color:#8aa', text: r.sentAt ? new Date(r.sentAt.seconds * 1000).toLocaleDateString() : '—' }),
        ])
      )));
    } catch { mount(historyBox, el('div', { style: 'color:#8aa;font-size:12px', text: 'Tarix yuklanmadi' })); }
  }

  const pushSection = mdCard([
    el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:14px' }, [
      el('span', { style: 'color:#6366F1', innerHTML: icon('bell', 20) }),
      el('div', { style: 'font-size:16px;font-weight:800;color:#1a2a3a', text: 'Push xabar yuborish' }),
    ]),
    el('div', { style: 'display:flex;flex-direction:column;gap:10px;margin-bottom:14px' }, [
      field('Sarlavha', titleIn),
      bodyIn,
      el('div', { style: 'display:flex;gap:10px;align-items:end' }, [
        el('div', { style: 'flex:1' }, [el('label', { style: 'font-size:12px;font-weight:600;color:#6a8a9a;display:block;margin-bottom:4px', text: 'Kimga' }), audienceSel]),
      ]),
      sendBtn,
    ]),
    el('div', { style: 'font-size:14px;font-weight:700;color:#1a2a3a;margin:16px 0 8px', text: 'Yuborilgan xabarlar' }),
    historyBox,
  ]);

  // ======== SUPPORT ========
  const ticketBox = el('div');
  async function loadTickets() {
    try {
      const q = query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc'), limit(20));
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (!rows.length) { mount(ticketBox, el('div', { style: 'color:#8aa;padding:12px;font-size:13px;text-align:center', text: 'Murojaat topilmadi' })); return; }

      mount(ticketBox, el('div', {}, rows.map((r) => {
        const statusColor = r.status === 'open' ? '#E8922A' : r.status === 'resolved' ? '#0E7C6B' : '#8aa';
        return el('div', {
          style: `display:flex;align-items:flex-start;gap:12px;padding:14px;border-radius:12px;background:#fff;margin-bottom:8px;border-left:4px solid ${statusColor};box-shadow:0 1px 4px rgba(0,0,0,.03)`,
        }, [
          el('div', { style: 'flex:1' }, [
            el('div', { style: 'font-size:14px;font-weight:700;color:#1a2a3a', text: r.subject || 'Sarlavhasiz' }),
            el('div', { style: 'font-size:12px;color:#6a8a9a;margin-top:4px;line-height:1.4', text: r.message || '' }),
            el('div', { style: 'font-size:11px;color:#8aa;margin-top:6px',
              text: `${r.userName || r.userEmail || '—'} · ${r.createdAt ? new Date(r.createdAt.seconds * 1000).toLocaleDateString() : '—'}` }),
          ]),
          el('div', { style: 'display:flex;flex-direction:column;gap:4px;align-items:flex-end' }, [
            el('span', { style: `font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;background:color-mix(in srgb,${statusColor} 12%,transparent);color:${statusColor}`,
              text: r.status === 'open' ? 'Ochiq' : r.status === 'resolved' ? 'Hal qilingan' : 'Yopiq' }),
            r.status === 'open' ? el('button', {
              type: 'button',
              style: 'font-size:11px;color:#0E7C6B;background:none;border:none;cursor:pointer;font-weight:600;padding:2px',
              text: '✓ Hal qilish',
              onClick: async () => {
                try {
                  await updateDoc(doc(db, 'supportTickets', r.id), { status: 'resolved', resolvedAt: serverTimestamp() });
                  toast('Hal qilingan deb belgilandi', 'ok');
                  loadTickets();
                } catch (e) { toast(e?.message || 'Xato', 'err'); }
              },
            }) : null,
          ].filter(Boolean)),
        ]);
      })));
    } catch { mount(ticketBox, el('div', { style: 'color:#8aa;font-size:12px', text: 'Ticketlar yuklanmadi' })); }
  }

  const supportSection = mdCard([
    el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:14px' }, [
      el('span', { style: 'color:#0E7C6B', innerHTML: icon('help', 20) }),
      el('div', { style: 'font-size:16px;font-weight:800;color:#1a2a3a', text: 'Support murojaatlar' }),
    ]),
    ticketBox,
  ]);

  mount(wrap, el('div', { class: 'stack', style: 'gap:16px' }, [pushSection, supportSection]));
  loadHistory();
  loadTickets();

  return wrap;
}

export default renderAdminPushSupport;
