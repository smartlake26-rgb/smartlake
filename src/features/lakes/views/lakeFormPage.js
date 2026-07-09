// ============================================================
//  features/lakes/views/lakeFormPage.js — Ko'l yaratish/tahrirlash
// ============================================================

import { el } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import { appBar, mdIconButton, mdCard, mdButton, field, input } from '../../../shared/ui/index.js';
import { authStore } from '../../auth/index.js';
import { lakeService, lakeValidators, geo } from '../index.js';
import * as dataStore from '../../../farmer/dataStore.js';
import { icon } from '../../../shared/icons.js';

export function renderLakeFormPage(nav, lake) {
  const s = authStore.getState();
  const editing = !!lake;
  const L = lake || {};
  const err = el('div', { class: 'md-banner warn', style: 'display:none' });

  const name = input({ type: 'text', placeholder: "Masalan: Shirin baliqchilik ko'li", value: L.name || '' });
  const desc = input({ type: 'text', placeholder: "Masalan: Intensiv usulda karp boqiladigan suv havzasi", value: L.description || '' });
  const district = input({ type: 'text', placeholder: "Masalan: Xonqa tumani", value: L.district || '' });
  const lat = input({ type: 'text', placeholder: 'Masalan: 41.5325', value: L.coordinates ? String(L.coordinates.lat) : '' });
  const lng = input({ type: 'text', placeholder: 'Masalan: 60.6289', value: L.coordinates ? String(L.coordinates.lng) : '' });
  const area = input({ type: 'number', step: 'any', placeholder: 'Masalan: 3.5 (gektar)', value: L.area != null ? L.area : '' });
  const depth = input({ type: 'number', step: 'any', placeholder: 'Masalan: 2.3 (metr)', value: L.averageDepth != null ? L.averageDepth : '' });
  const species = input({ type: 'text', placeholder: "Masalan: Sazan, Amur, Do'ngpeshana, Karp", value: (L.fishSpecies || []).join(', ') });

  // Intelligent coordinate auto-pasting & parsing
  const handleCoordPaste = (e) => {
    // We delay slightly to let the input complete paste
    setTimeout(() => {
      const val = e.target.value.trim();
      // Split by comma, semicolon, or slash
      let parts = val.split(/[,;\/]+/).map(x => x.trim()).filter(Boolean);
      
      // If no commas/semicolons, maybe they split by spaces or N/S/E/W boundary
      if (parts.length < 2) {
        // Try finding separation between coordinates, e.g. "41.5325 60.6289" or "41°18'32.4"N 60°31'12.3"E"
        const spaceMatch = val.match(/^([^-a-zA-Z]+[N|S|deg|d|'|"]+)\s+([^-a-zA-Z]+[E|W|deg|d|'|"]+)$/i);
        if (spaceMatch) {
          parts = [spaceMatch[1], spaceMatch[2]];
        } else {
          // Fallback to split by spaces
          const decimalSpace = val.match(/^([-\d\.]+)\s+([-\d\.]+)$/);
          if (decimalSpace) {
            parts = [decimalSpace[1], decimalSpace[2]];
          }
        }
      }

      if (parts.length >= 2) {
        const pLat = geo.parseCoordinateString(parts[0]);
        const pLng = geo.parseCoordinateString(parts[1]);
        if (!Number.isNaN(pLat) && !Number.isNaN(pLng)) {
          lat.value = String(pLat);
          lng.value = String(pLng);
          toast(t('lake.coordsAutoParsed'), 'ok');
        }
      }
    }, 50);
  };
  lat.addEventListener('input', handleCoordPaste);
  lng.addEventListener('input', handleCoordPaste);

  const save = mdButton({ label: t('common.save'), full: true, onClick: async () => {
    err.style.display = 'none';
    
    const latStr = lat.value.trim();
    const lngStr = lng.value.trim();
    const hasLatInput = latStr !== '';
    const hasLngInput = lngStr !== '';

    let parsedCoords = null;
    if (hasLatInput || hasLngInput) {
      if (!hasLatInput || !hasLngInput) {
        err.textContent = t('error.bothCoordinatesRequired');
        err.style.display = 'flex';
        return;
      }
      const pLat = geo.parseCoordinateString(latStr);
      const pLng = geo.parseCoordinateString(lngStr);
      if (Number.isNaN(pLat) || Number.isNaN(pLng)) {
        err.textContent = t('error.coordinatesInvalid');
        err.style.display = 'flex';
        return;
      }
      parsedCoords = { lat: pLat, lng: pLng };
    }

    const payload = {
      name: name.value, description: desc.value, district: district.value,
      coordinates: parsedCoords,
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

  // Elegant Interactive guide/explanation box
  const guideBox = el('div', {
    style: 'background:color-mix(in srgb, var(--md-primary) 5%, var(--md-surface-container-high));padding:14px;border-radius:12px;font-size:12.5px;line-height:1.45;color:var(--md-on-surface-variant);border:1px solid var(--md-outline-variant);margin-bottom:12px'
  }, [
    el('div', { style: 'font-weight:700;color:var(--md-primary);margin-bottom:6px;display:flex;align-items:center;gap:6px' }, [
      el('span', { html: icon('info', 16), style: 'display:inline-flex' }),
      el('span', { text: 'Ko\'l Qo\'shish Bo\'yicha Yo\'riqnoma' })
    ]),
    el('ul', { style: 'margin:0;padding-left:16px;display:flex;flex-direction:column;gap:5px' }, [
      el('li', { html: '<b>Kenglik (Lat) va Uzunlik (Lng):</b> WGS84 formatidagi nuqtali koordinatalar. <i>Maslahat: Google Maps\'dan to\'liq koordinatani (masalan: <code>41.5325, 60.6289</code>) nusxalab "Kenglik" maydoniga tashlasangiz, tizim o\'zi ajratib oladi.</i>' }),
      el('li', { html: '<b>Maydoni (Gektar):</b> Ko\'l maydoni, masalan: <code>3.5</code>. Gektarda kiritishingiz shart (metr kvadratda emas).' }),
      el('li', { html: '<b>O\'rtacha chuqurlik:</b> Metrlarda, masalan: <code>2.3</code> (nuqta ishlating).' }),
      el('li', { html: '<b>Baliq turlari:</b> Ko\'ldagi baliqlarni vergul bilan ajrating, masalan: <code>Sazan, Amur, Do\'ngpeshana</code>.' })
    ])
  ]);

  return el('div', { class: 'md-app' }, [
    appBar({ title: editing ? t('lake.edit') : t('lake.create'), leading: mdIconButton({ icon: 'arrowLeft', onClick: () => nav.back() }) }),
    el('div', { class: 'md-content no-nav' }, [
      mdCard([
        err,
        guideBox,
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
