// ============================================================
//  features/lakes/views/lakeFormPage.js — Ko'l yaratish/tahrirlash
// ============================================================

import { el } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import { appBar, mdIconButton, mdCard, mdButton, field, input } from '../../../shared/ui/index.js';
import { authStore } from '../../auth/index.js';
import { lakeService, lakeValidators } from '../index.js';
import * as dataStore from '../../../farmer/dataStore.js';

export function renderLakeFormPage(nav, lake) {
  const s = authStore.getState();
  const editing = !!lake;
  const L = lake || {};
  const err = el('div', { class: 'md-banner warn', style: 'display:none' });

  const name = input({ type: 'text', value: L.name || '' });
  const desc = input({ type: 'text', value: L.description || '' });
  const district = input({ type: 'text', value: L.district || '' });
  const lat = input({ type: 'number', step: 'any', value: L.coordinates ? L.coordinates.lat : '' });
  const lng = input({ type: 'number', step: 'any', value: L.coordinates ? L.coordinates.lng : '' });
  const area = input({ type: 'number', step: 'any', value: L.area != null ? L.area : '' });
  const depth = input({ type: 'number', step: 'any', value: L.averageDepth != null ? L.averageDepth : '' });
  const species = input({ type: 'text', value: (L.fishSpecies || []).join(', ') });

  const save = mdButton({ label: t('common.save'), full: true, onClick: async () => {
    err.style.display = 'none';
    const hasCoords = lat.value !== '' && lng.value !== '';
    const payload = {
      name: name.value, description: desc.value, district: district.value,
      coordinates: hasCoords ? { lat: Number(lat.value), lng: Number(lng.value) } : null,
      area: area.value, averageDepth: depth.value,
      fishSpecies: species.value.split(',').map((x) => x.trim()).filter(Boolean),
    };
    const check = lakeValidators.validateLakeForm(payload);
    if (!check.valid) { err.textContent = t(check.messageKey); err.style.display = 'flex'; return; }
    save.disabled = true;
    try {
      if (editing) await lakeService.update(lake.id, payload, s.uid);
      else await lakeService.create(payload, s.uid, s.profile ? s.profile.vil : '');
      await dataStore.refresh();
      toast(t('common.saved'), 'ok');
      nav.back();
    } catch (e) { err.textContent = t(handleError(e, 'lake.save').messageKey); err.style.display = 'flex'; save.disabled = false; }
  } });

  return el('div', { class: 'md-app' }, [
    appBar({ title: editing ? t('lake.edit') : t('lake.create'), leading: mdIconButton({ icon: 'arrowLeft', onClick: () => nav.back() }) }),
    el('div', { class: 'md-content no-nav' }, [
      mdCard([
        err,
        el('div', { class: 'stack' }, [
          field(t('lake.name'), name),
          field(t('lake.description'), desc),
          field(t('lake.district'), district),
          el('div', { class: 'row', style: 'gap:10px' }, [
            el('div', { class: 'grow' }, [field(t('lake.lat'), lat)]),
            el('div', { class: 'grow' }, [field(t('lake.lng'), lng)]),
          ]),
          el('div', { class: 'row', style: 'gap:10px' }, [
            el('div', { class: 'grow' }, [field(t('lake.area'), area)]),
            el('div', { class: 'grow' }, [field(t('lake.depth'), depth)]),
          ]),
          field(t('lake.species'), species),
          save,
        ]),
      ], { elevated: true }),
    ]),
  ]);
}

export default renderLakeFormPage;
