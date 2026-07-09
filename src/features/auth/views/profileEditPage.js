// ============================================================
//  features/auth/views/profileEditPage.js — Profilni tahrirlash
// ============================================================

import { el } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import { VILOYATLAR } from '../../../core/config.js';
import { icon } from '../../../shared/icons.js';
import { appBar, mdIconButton, mdCard, mdButton, field, input, select } from '../../../shared/ui/index.js';
import { authStore } from '../index.js';
import { userService, userValidators } from '../../users/index.js';

export function renderProfileEditPage(nav) {
  const s = authStore.getState();
  const p = s.profile || {};
  const err = el('div', { class: 'md-banner warn', style: 'display:none' });

  let currentPhotoUrl = p.photoUrl || null;

  const ism = input({ type: 'text', value: p.ism || '' });
  const fam = input({ type: 'text', value: p.fam || '' });
  const vil = select([{ value: '', label: t('profile.selectRegion') }, ...VILOYATLAR.map((v) => ({ value: v, label: v }))], p.vil);
  const tum = input({ type: 'text', value: p.tum || '' });
  const phone = input({ type: 'tel', value: p.phone || '' });

  // Avatar yuklash elementi (Drag & Drop + Click)
  const fileInput = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
  const avatarImg = el('img', { 
    style: `width:100%;height:100%;object-fit:cover;border-radius:50%;display:${currentPhotoUrl ? 'block' : 'none'}`,
    src: currentPhotoUrl || ''
  });
  const avatarInitials = el('span', {
    style: `font-size:24px;font-weight:700;display:${currentPhotoUrl ? 'none' : 'block'}`,
    text: `${(p.ism || '?')[0] || ''}${(p.fam || '')[0] || ''}`.toUpperCase()
  });

  const avatarBox = el('div', {
    class: 'avatar-box tap',
    style: 'width:92px;height:92px;border-radius:50%;background:var(--md-primary-container);color:var(--md-on-primary-container);display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;overflow:hidden;border:2px dashed var(--md-primary);transition:all var(--motion-fast)'
  }, [
    avatarImg,
    avatarInitials,
    el('div', {
      style: 'position:absolute;inset:0;background:rgba(0,0,0,0.5);color:#fff;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity var(--motion-fast);flex-direction:column;gap:2px',
      class: 'hover-overlay'
    }, [
      el('span', { html: icon('camera', 18) }),
      el('span', { style: 'font-size:9px;font-weight:700', text: 'YUKLASH' })
    ])
  ]);

  const removeBtn = el('button', {
    class: 'md-btn text danger',
    style: `display:${currentPhotoUrl ? 'inline-flex' : 'none'};padding:4px 8px;font-size:11px;min-height:30px;margin-top:4px`,
    text: "Rasmni o'chirish"
  });

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      toast('Iltimos, faqat rasm faylini tanlang', 'err');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const SIZE = 160;
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
        
        currentPhotoUrl = canvas.toDataURL('image/jpeg', 0.85);
        avatarImg.src = currentPhotoUrl;
        avatarImg.style.display = 'block';
        avatarInitials.style.display = 'none';
        removeBtn.style.display = 'inline-flex';
        toast('Rasm tanlandi', 'ok');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });

  avatarBox.addEventListener('click', () => fileInput.click());

  // Drag over, leave, drop
  avatarBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    avatarBox.style.borderColor = 'var(--md-success)';
    avatarBox.style.transform = 'scale(1.05)';
  });
  avatarBox.addEventListener('dragleave', () => {
    avatarBox.style.borderColor = 'var(--md-primary)';
    avatarBox.style.transform = 'scale(1)';
  });
  avatarBox.addEventListener('drop', (e) => {
    e.preventDefault();
    avatarBox.style.borderColor = 'var(--md-primary)';
    avatarBox.style.transform = 'scale(1)';
    if (e.dataTransfer.files.length) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  removeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    currentPhotoUrl = null;
    avatarImg.src = '';
    avatarImg.style.display = 'none';
    avatarInitials.style.display = 'block';
    removeBtn.style.display = 'none';
    fileInput.value = '';
    toast('Rasm olib tashlandi', 'ok');
  });

  const save = mdButton({ label: t('common.save'), full: true, onClick: async () => {
    err.style.display = 'none';
    const profile = { 
      ism: ism.value, 
      fam: fam.value, 
      vil: vil.value, 
      tum: tum.value, 
      phone: phone.value,
      photoUrl: currentPhotoUrl 
    };
    const check = userValidators.validateProfile(profile);
    if (!check.valid) { err.textContent = t(check.messageKey); err.style.display = 'flex'; return; }
    save.disabled = true;
    try {
      await userService.updateProfile(s.uid, profile);
      await authStore.reload();
      toast(t('common.saved'), 'ok');
      nav.back();
    } catch (e) { 
      err.textContent = t(handleError(e, 'profile.save').messageKey); 
      err.style.display = 'flex'; 
      save.disabled = false; 
    }
  } });

  return el('div', { class: 'md-app' }, [
    appBar({ title: t('profile.title'), leading: mdIconButton({ icon: 'arrowLeft', onClick: () => nav.back() }) }),
    el('div', { class: 'md-content no-nav' }, [
      mdCard([
        err,
        el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:6px;margin-bottom:18px' }, [
          avatarBox,
          fileInput,
          removeBtn,
          el('span', { style: 'font-size:11px;color:var(--md-on-surface-variant);text-align:center;max-width:240px;opacity:0.8', text: 'Rasm yuklash uchun ustiga bosing yoki faylni bu yerga tashlang' })
        ]),
        el('div', { class: 'stack' }, [
          field(t('profile.firstName'), ism),
          field(t('profile.lastName'), fam),
          field(t('profile.region'), vil),
          field(t('profile.district'), tum),
          field(t('profile.phone'), phone),
          save,
        ]),
      ], { elevated: true }),
    ]),
  ]);
}

export default renderProfileEditPage;
