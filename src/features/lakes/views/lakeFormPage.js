// ============================================================
//  features/lakes/views/lakeFormPage.js — Ko'l yaratish/tahrirlash
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import { appBar, mdIconButton, mdCard, mdButton, field, input } from '../../../shared/ui/index.js';
import { authStore } from '../../auth/index.js';
import { lakeService, lakeValidators, geo } from '../index.js';
import * as dataStore from '../../../farmer/dataStore.js';
import { icon } from '../../../shared/icons.js';

const FISH_SPECIES_LIST = [
  "Sazan",
  "Oq amur",
  "Oq do'ngpeshana",
  "Chipor do'ngpeshana",
  "Ilon bosh",
  "Laqqa",
  "Sudak"
];

export function renderLakeFormPage(nav, lake) {
  const s = authStore.getState();
  const editing = !!lake;
  const L = lake || {};
  const err = el('div', { class: 'md-banner warn', style: 'display:none' });

  const name = input({ type: 'text', placeholder: "Masalan: Shirin baliqchilik ko'li", value: L.name || '' });
  const desc = input({ type: 'text', placeholder: "Masalan: Intensiv usulda karp boqiladigan suv havzasi", value: L.description || '' });
  const regionInput = input({ type: 'text', placeholder: "Masalan: Xorazm viloyati", value: L.region || (s.profile ? s.profile.vil : '') || '' });
  const district = input({ type: 'text', placeholder: "Masalan: Xonqa tumani", value: L.district || '' });
  const lat = input({ type: 'text', placeholder: 'Masalan: 41.5325', value: L.coordinates ? String(L.coordinates.lat) : '' });
  const lng = input({ type: 'text', placeholder: 'Masalan: 60.6289', value: L.coordinates ? String(L.coordinates.lng) : '' });
  const area = input({ type: 'number', step: 'any', placeholder: 'Masalan: 3.5 (gektar)', value: L.area != null ? L.area : '' });
  const depth = input({ type: 'number', step: 'any', placeholder: 'Masalan: 2.3 (metr)', value: L.averageDepth != null ? L.averageDepth : '' });

  // Intelligent coordinate auto-pasting & parsing
  const handleCoordPaste = (e) => {
    setTimeout(() => {
      const val = e.target.value.trim();
      let parts = val.split(/[,;\/]+/).map(x => x.trim()).filter(Boolean);
      if (parts.length < 2) {
        const spaceMatch = val.match(/^([^-a-zA-Z]+[N|S|deg|d|'|"]+)\s+([^-a-zA-Z]+[E|W|deg|d|'|"]+)$/i);
        if (spaceMatch) {
          parts = [spaceMatch[1], spaceMatch[2]];
        } else {
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

  // GPS geolocation button
  const gpsButton = mdButton({
    label: "GPS orqali aniqlash",
    icon: 'location',
    variant: 'tonal',
    onClick: () => {
      if (!navigator.geolocation) {
        toast("GPS aniqlash brauzer tomonidan qo'llab-quvvatlanmaydi", 'err');
        return;
      }
      toast("GPS koordinatalari aniqlanmoqda...", 'info');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          lat.value = pos.coords.latitude.toFixed(6);
          lng.value = pos.coords.longitude.toFixed(6);
          toast("Koordinatalar muvaffaqiyatli aniqlandi!", 'ok');
        },
        (error) => {
          toast("Koordinatani aniqlashda xatolik: " + error.message, 'err');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  });

  // Stateful list of selected species
  // Support both old array of strings ["Sazan"] and new array of objects [{species, count, avgWeight}]
  let selectedSpeciesList = [];
  if (Array.isArray(L.fishSpecies)) {
    selectedSpeciesList = L.fishSpecies.map(item => {
      if (item && typeof item === 'object' && item.species) {
        return {
          species: item.species,
          count: item.count != null ? String(item.count) : '',
          avgWeight: item.avgWeight != null ? String(item.avgWeight) : ''
        };
      }
      return { species: String(item), count: '', avgWeight: '' };
    });
  }

  const speciesListContainer = el('div', { class: 'stack', style: 'gap:10px; margin-top:8px; margin-bottom:8px' });
  const speciesSelect = el('select', {
    style: 'width:100%; padding:10px; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface-container); color:var(--md-on-surface); font-size:13.5px; font-weight:600; outline:none; cursor:pointer'
  });

  function updateDropdownOptions() {
    speciesSelect.innerHTML = '';
    const placeholderOpt = el('option', { value: '', text: "+ Baliq turi qo'shish..." });
    speciesSelect.appendChild(placeholderOpt);

    FISH_SPECIES_LIST.forEach(sp => {
      if (!selectedSpeciesList.some(item => item.species === sp)) {
        speciesSelect.appendChild(el('option', { value: sp, text: sp }));
      }
    });
  }

  function renderSelectedSpecies() {
    mount(speciesListContainer, ...selectedSpeciesList.map((item, idx) => {
      const countInput = el('input', {
        type: 'number',
        placeholder: 'Soni (masalan: 5000)',
        value: item.count,
        style: 'flex:1; min-width:80px; padding:6px 10px; border-radius:6px; border:1px solid var(--md-outline-variant); background:var(--md-surface); font-size:12px; color:var(--md-on-surface)'
      });
      countInput.addEventListener('input', (e) => {
        item.count = e.target.value;
      });

      const weightInput = el('input', {
        type: 'number',
        step: 'any',
        placeholder: 'O\'rtacha vazni, kg (masalan: 1.2)',
        value: item.avgWeight,
        style: 'flex:1; min-width:80px; padding:6px 10px; border-radius:6px; border:1px solid var(--md-outline-variant); background:var(--md-surface); font-size:12px; color:var(--md-on-surface)'
      });
      weightInput.addEventListener('input', (e) => {
        item.avgWeight = e.target.value;
      });

      const removeBtn = el('button', {
        style: 'background:transparent; border:none; cursor:pointer; color:var(--md-critical); display:inline-flex; align-items:center; justify-content:center; padding:4px',
        html: icon('trash', 18)
      });
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        selectedSpeciesList.splice(idx, 1);
        renderSelectedSpecies();
        updateDropdownOptions();
      });

      return el('div', {
        style: 'padding:10px; border-radius:8px; background:var(--md-surface-container-high); border:1px solid var(--md-outline-variant); display:flex; flex-direction:column; gap:8px; margin-bottom:4px'
      }, [
        el('div', { style: 'display:flex; align-items:center; justify-content:space-between' }, [
          el('span', { style: 'font-weight:700; font-size:13px; color:var(--md-primary)', text: item.species }),
          removeBtn
        ]),
        el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap' }, [
          countInput,
          weightInput
        ])
      ]);
    }));
  }

  speciesSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val) {
      selectedSpeciesList.push({ species: val, count: '', avgWeight: '' });
      renderSelectedSpecies();
      updateDropdownOptions();
      speciesSelect.value = '';
    }
  });

  renderSelectedSpecies();
  updateDropdownOptions();

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

    // Map species list inputs
    const mappedSpecies = selectedSpeciesList.map(item => ({
      species: item.species,
      count: item.count !== '' && !isNaN(Number(item.count)) ? Number(item.count) : null,
      avgWeight: item.avgWeight !== '' && !isNaN(Number(item.avgWeight)) ? Number(item.avgWeight) : null
    }));

    const payload = {
      name: name.value,
      description: desc.value,
      district: district.value,
      region: regionInput.value,
      coordinates: parsedCoords,
      area: area.value,
      averageDepth: depth.value,
      fishSpecies: mappedSpecies,
    };

    const check = lakeValidators.validateLakeForm(payload);
    if (!check.valid) { err.textContent = t(check.messageKey); err.style.display = 'flex'; return; }
    save.disabled = true;
    try {
      if (editing) await lakeService.update(lake.id, payload, s.uid);
      else await lakeService.create(payload, s.uid, regionInput.value || (s.profile ? s.profile.vil : ''));
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
      el('li', { html: '<b>Viloyat va tuman:</b> Ko\'lning geografik joylashuvi (masalan: <i>Xorazm viloyati, Xonqa tumani</i>).' }),
      el('li', { html: '<b>GPS orqali aniqlash:</b> Qurilmangiz GPS ma\'lumotlaridan ko\'lning ayni koordinatalarini avtomatik olish uchun bosing.' }),
      el('li', { html: '<b>Maydoni (Gektar) va Chuqurlik:</b> Ko\'lning o\'lchamlari. Bu baliq biomassasini to\'g\'ri tahlil qilish va yem miqdorini aniq hisoblash uchun zarur.' }),
      el('li', { html: '<b>Baliq turlari:</b> Ko\'ldagi baliq turlarini ro\'yxatdan tanlang va har biri uchun soni hamda o\'rtacha vaznini kiriting. Ushbu ma\'lumotlar orqali sun\'iy intellekt ertangi yem miqdorini aniq hisoblab beradi.' })
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
          el('div', { class: 'row', style: 'gap:10px' }, [
            el('div', { class: 'grow' }, [field("Viloyat", regionInput)]),
            el('div', { class: 'grow' }, [field(t('lake.district'), district)]),
          ]),
          el('div', { class: 'row', style: 'gap:10px; align-items:flex-end' }, [
            el('div', { class: 'grow' }, [field(t('lake.lat'), lat)]),
            el('div', { class: 'grow' }, [field(t('lake.lng'), lng)]),
          ]),
          el('div', { style: 'margin-top:-4px; margin-bottom:10px' }, [gpsButton]),
          el('div', { class: 'row', style: 'gap:10px' }, [
            el('div', { class: 'grow' }, [field(t('lake.area'), area)]),
            el('div', { class: 'grow' }, [field(t('lake.depth'), depth)]),
          ]),
          el('div', { style: 'margin-top:4px; margin-bottom:6px' }, [
            el('div', { style: 'font-size:11.5px; font-weight:700; color:var(--md-on-surface-variant); margin-bottom:6px; text-transform:uppercase', text: 'Ko\'ldagi baliq turlari' }),
            speciesSelect,
            speciesListContainer
          ]),
          save,
        ]),
      ], { elevated: true }),
    ]),
  ]);
}

export default renderLakeFormPage;
