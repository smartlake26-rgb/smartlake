// ============================================================
//  features/lakes/views/lakeFormView.js — Ko'l yaratish/tahrirlash
// ============================================================

import { el } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import { lakeService } from '../services/lakeService.js';
import { lakeValidators } from '../index.js';
import { authStore } from '../../auth/index.js';

function field(labelKey, input) {
  return el('div', { class: 'field' }, [el('label', { text: t(labelKey) }), input]);
}

export function renderLakeForm(ctx = {}) {
  const s = authStore.getState();
  const editing = !!ctx.lake;
  const L = ctx.lake || {};
  const errEl = el('div', { class: 'form-err' });

  const name = el('input', { type: 'text', value: L.name || '' });
  const desc = el('input', { type: 'text', value: L.description || '' });
  const district = el('input', { type: 'text', value: L.district || '' });
  const lat = el('input', { type: 'number', step: 'any', value: L.coordinates ? L.coordinates.lat : '' });
  const lng = el('input', { type: 'number', step: 'any', value: L.coordinates ? L.coordinates.lng : '' });
  const area = el('input', { type: 'number', step: 'any', value: L.area != null ? L.area : '' });
  const depth = el('input', { type: 'number', step: 'any', value: L.averageDepth != null ? L.averageDepth : '' });
  const volume = el('input', { type: 'number', step: 'any', value: L.waterVolume != null ? L.waterVolume : '' });
  const species = el('input', { type: 'text', value: (L.fishSpecies || []).join(', ') });

  const saveBtn = el('button', { class: 'btn', type: 'button', text: t('common.save') });
  saveBtn.addEventListener('click', async () => {
    errEl.textContent = '';
    const hasCoords = lat.value !== '' && lng.value !== '';
    const payload = {
      name: name.value, description: desc.value, district: district.value,
      coordinates: hasCoords ? { lat: Number(lat.value), lng: Number(lng.value) } : null,
      area: area.value, averageDepth: depth.value, waterVolume: volume.value,
      fishSpecies: species.value.split(',').map((x) => x.trim()).filter(Boolean),
    };
    const check = lakeValidators.validateLakeForm(payload);
    if (!check.valid) { errEl.textContent = t(check.messageKey); return; }
    saveBtn.disabled = true;
    try {
      if (editing) await lakeService.update(ctx.lake.id, payload, s.uid);
      else await lakeService.create(payload, s.uid, s.profile ? s.profile.vil : '');
      toast(t('common.saved'), 'ok');
      ctx.onDone && ctx.onDone();
    } catch (e) { errEl.textContent = t(handleError(e, 'lake.save').messageKey); saveBtn.disabled = false; }
  });

  return el('div', { class: 'app' }, [
    el('div', { class: 'topbar', text: editing ? t('lake.edit') : t('lake.create') }),
    el('div', { class: 'auth-wrap' }, [
      el('div', { class: 'card' }, [
        errEl,
        field('lake.name', name),
        field('lake.description', desc),
        field('lake.district', district),
        el('div', { style: 'display:flex;gap:8px' }, [
          el('div', { style: 'flex:1' }, [field('lake.lat', lat)]),
          el('div', { style: 'flex:1' }, [field('lake.lng', lng)]),
        ]),
        field('lake.area', area),
        field('lake.depth', depth),
        field('lake.volume', volume),
        field('lake.species', species),
        saveBtn,
        el('button', { class: 'btn ghost', type: 'button', text: t('common.back'), onClick: () => ctx.onBack && ctx.onBack() }),
      ]),
    ]),
  ]);
}

export default renderLakeForm;
