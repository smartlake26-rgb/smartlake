// ============================================================
//  farmer/onboarding.js — Premium Onboarding Flow
//  Provides an immersive, modern first-time user experience
//  with elegant water-themed micro-interactions and illustrations.
// ============================================================

import { el, mount } from '../shared/dom.js';
import { icon } from '../shared/icons.js';
import { t } from '../core/i18n/index.js';

export function renderOnboarding(uid, onComplete) {
  let activeSlide = 0;
  const root = el('div', { 
    style: 'min-height: 100dvh; display: flex; flex-direction: column; justify-content: space-between; background: linear-gradient(180deg, #021a24 0%, #052c3a 100%); color: #FFFFFF; padding: 24px; position: relative; overflow: hidden; font-family: var(--sans);' 
  });

  // Background animated-like water ripple SVG for premium aquatic ambient
  const bgRipples = el('div', {
    style: 'position: absolute; bottom: 0; left: 0; width: 100%; height: 60%; opacity: 0.12; pointer-events: none; z-index: 1;'
  }, [
    document.createRange().createContextualFragment(`
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%; height:100%;">
        <path d="M0,50 C30,55 70,45 100,52 L100,100 L0,100 Z" fill="#007090" opacity="0.4"></path>
        <path d="M0,65 C40,58 60,70 100,63 L100,100 L0,100 Z" fill="#00A3C4" opacity="0.3"></path>
      </svg>
    `)
  ]);
  root.appendChild(bgRipples);

  const container = el('div', { style: 'flex: 1; display: flex; flex-direction: column; justify-content: center; z-index: 2; position: relative; max-width: 500px; margin: 0 auto; width: 100%;' });
  root.appendChild(container);

  // Slides definition
  const SLIDES = [
    {
      title: 'SmartLake Havzalar Nazorati',
      description: 'Baliqchilik xoʻjaliklari va koʻllardagi suv sifatini 24/7 rejimida avtomatlashtirilgan masofaviy monitoring qilish tizimiga xush kelibsiz. Havzalaringiz doimiy nazorat ostida.',
      illustration: () => el('div', { 
        style: 'display: flex; align-items: center; justify-content: center; height: 200px; position: relative; margin-bottom: 12px;' 
      }, [
        // Hydro-buoy stylized vector
        el('div', { 
          style: 'width: 160px; height: 160px; border-radius: 50%; background: radial-gradient(circle, rgba(0, 112, 144, 0.25) 0%, rgba(0,0,0,0) 70%); display: flex; align-items: center; justify-content: center; position: relative;' 
        }, [
          // Simulated premium hardware buoy in deep ocean water
          document.createRange().createContextualFragment(`
            <svg width="120" height="120" viewBox="0 0 100 100" style="overflow: visible;">
              <!-- Concentric waves -->
              <circle cx="50" cy="50" r="35" fill="none" stroke="#80D5FF" stroke-width="1" opacity="0.25" style="animation: pulse-ring 3s infinite ease-out;" />
              <circle cx="50" cy="50" r="48" fill="none" stroke="#80E2F4" stroke-width="0.75" opacity="0.15" style="animation: pulse-ring 3s infinite ease-out; animation-delay: 1s;" />
              
              <!-- Water Surface Line -->
              <path d="M15 65 Q 35 60, 50 65 T 85 65" fill="none" stroke="#00A3C4" stroke-width="2" stroke-linecap="round" />
              
              <!-- Device Buoy Body -->
              <g transform="translate(0, -3)">
                <!-- Antenna & Blinking Beacon -->
                <line x1="50" y1="20" x2="50" y2="45" stroke="#D1E5EC" stroke-width="2" />
                <circle cx="50" cy="18" r="4" fill="#FF8A80" style="animation: led-blink 1.2s infinite;" />
                
                <!-- Buoy Float -->
                <path d="M35 45 L65 45 L60 58 L40 58 Z" fill="#007090" stroke="#80D5FF" stroke-width="1.5" />
                <rect x="42" y="45" width="16" height="5" fill="#FFFFFF" opacity="0.8" />
                
                <!-- Underwater Sensor Cable -->
                <path d="M50 58 Q48 70, 52 82 T50 92" fill="none" stroke="#80E2F4" stroke-width="1.5" stroke-dasharray="2 2" />
                <!-- Submerged probe terminal -->
                <rect x="47" y="80" width="6" height="10" rx="2" fill="#5CE3A7" />
              </g>
            </svg>
          `)
        ])
      ])
    },
    {
      title: 'Uchta Muhim Kimyoviy Meʻyor',
      description: 'Suvning eng muhim koʻrsatkichlari: Erimagan Kislorod (DO mg/L), Harorat (°C) hamda vodorod darajasi (pH) yuqori aniqlikdagi datchiklar yordamida uzluksiz tahlil qilinadi.',
      illustration: () => el('div', { 
        style: 'display: flex; flex-direction: column; gap: 14px; padding: 18px; background: rgba(255, 255, 255, 0.04); border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(12px); margin: 10px 0;' 
      }, [
        el('div', { style: 'display: flex; align-items: center; justify-content: space-between; font-size: 11px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1);' }, [
          el('span', { style: 'font-weight:700; color:#80D5FF; letter-spacing: 0.5px;', text: 'LABORATORIYA ANALIZI' }),
          el('span', { style: 'font-family: monospace; color: #5CE3A7; font-weight: bold;', text: 'OK • TIZIM FAOL' })
        ]),
        el('div', { style: 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;' }, [
          el('div', { style: 'background: rgba(128, 213, 255, 0.08); border-radius: 12px; padding: 12px 8px; text-align: center; border: 1px solid rgba(128, 213, 255, 0.15);' }, [
            el('div', { style: 'color: #80D5FF; display: flex; justify-content: center; margin-bottom: 6px;' }, [
              document.createRange().createContextualFragment(icon('waves', 20))
            ]),
            el('span', { style: 'font-size: 10px; display: block; opacity: 0.7; font-weight: 600; margin-bottom: 2px;', text: 'Kislorod (DO)' }),
            el('span', { style: 'font-size: 14px; font-weight: 700; font-family: monospace; color: #FFFFFF;', text: '7.8 mg/L' })
          ]),
          el('div', { style: 'background: rgba(255, 138, 128, 0.08); border-radius: 12px; padding: 12px 8px; text-align: center; border: 1px solid rgba(255, 138, 128, 0.15);' }, [
            el('div', { style: 'color: #FF8A80; display: flex; justify-content: center; margin-bottom: 6px;' }, [
              document.createRange().createContextualFragment(icon('thermometer', 20))
            ]),
            el('span', { style: 'font-size: 10px; display: block; opacity: 0.7; font-weight: 600; margin-bottom: 2px;', text: 'Harorat' }),
            el('span', { style: 'font-size: 14px; font-weight: 700; font-family: monospace; color: #FFFFFF;', text: '24.5 °C' })
          ]),
          el('div', { style: 'background: rgba(92, 227, 167, 0.08); border-radius: 12px; padding: 12px 8px; text-align: center; border: 1px solid rgba(92, 227, 167, 0.15);' }, [
            el('div', { style: 'color: #5CE3A7; display: flex; justify-content: center; margin-bottom: 6px;' }, [
              document.createRange().createContextualFragment(icon('chip', 20))
            ]),
            el('span', { style: 'font-size: 10px; display: block; opacity: 0.7; font-weight: 600; margin-bottom: 2px;', text: 'Vodorod (pH)' }),
            el('span', { style: 'font-size: 14px; font-weight: 700; font-family: monospace; color: #FFFFFF;', text: '7.4' })
          ])
        ])
      ])
    },
    {
      title: 'Sunʻiy Intellekt va Maslahat',
      description: 'Suv koʻrsatkichlari oʻzgarishiga qarab SmartLake AI avtomatlashtirilgan maslahatlar beradi. Baliqlar nobud boʻlishining oldini olish uchun zudlik bilan ogohlantirish oling.',
      illustration: () => el('div', { 
        style: 'display: flex; align-items: center; justify-content: center; height: 180px; position: relative;' 
      }, [
        // AI Network styled graphic
        el('div', { 
          style: 'width: 140px; height: 140px; border-radius: 50%; background: radial-gradient(circle, rgba(128, 226, 244, 0.2) 0%, rgba(0,0,0,0) 70%); display: flex; align-items: center; justify-content: center; position: relative;' 
        }, [
          document.createRange().createContextualFragment(`
            <svg width="110" height="110" viewBox="0 0 100 100" style="overflow: visible;">
              <!-- Glowing brain or logic nodes -->
              <g stroke="#80D5FF" stroke-width="1" opacity="0.6">
                <line x1="50" y1="25" x2="25" y2="50" />
                <line x1="50" y1="25" x2="75" y2="50" />
                <line x1="25" y1="50" x2="50" y2="75" />
                <line x1="75" y1="50" x2="50" y2="75" />
                <line x1="50" y1="25" x2="50" y2="75" />
                <line x1="25" y1="50" x2="75" y2="50" />
              </g>
              
              <!-- Outer glowing orbits -->
              <circle cx="50" cy="50" r="40" fill="none" stroke="#5CE3A7" stroke-width="1.5" stroke-dasharray="4 6" style="animation: spin-slow 15s linear infinite;" />
              <circle cx="50" cy="50" r="28" fill="none" stroke="#80D5FF" stroke-width="1" stroke-dasharray="2 3" style="animation: spin-slow 8s linear infinite reverse;" />
              
              <!-- Solid Nodes -->
              <circle cx="50" cy="25" r="5" fill="#FFFFFF" stroke="#007090" stroke-width="1.5" />
              <circle cx="50" cy="75" r="5" fill="#FFFFFF" stroke="#007090" stroke-width="1.5" />
              <circle cx="25" cy="50" r="5" fill="#80D5FF" stroke="#007090" stroke-width="1.5" />
              <circle cx="75" cy="50" r="5" fill="#5CE3A7" stroke="#007090" stroke-width="1.5" />
              
              <!-- Center Core Beacon -->
              <circle cx="50" cy="50" r="10" fill="#007090" stroke="#80E2F4" stroke-width="2" />
              <circle cx="50" cy="50" r="4" fill="#FFFFFF" style="animation: led-blink 0.8s infinite;" />
            </svg>
          `)
        ])
      ])
    }
  ];

  function renderSlide() {
    const slide = SLIDES[activeSlide];
    container.replaceChildren(
      el('div', { style: 'display: flex; flex-direction: column; gap: 20px; animation: fade-in 0.35s cubic-bezier(0.4, 0, 0.2, 1);' }, [
        slide.illustration(),
        el('div', { style: 'text-align: center; display: flex; flex-direction: column; gap: 14px; padding: 0 10px;' }, [
          el('h1', { 
            style: 'font-size: 22px; font-weight: 800; letter-spacing: -0.4px; color: #FFFFFF; font-family: var(--sans);',
            text: slide.title 
          }),
          el('p', { 
            style: 'font-size: 14px; line-height: 1.6; opacity: 0.85; color: #D1E5EC; padding: 0 4px; font-weight: 400;',
            text: slide.description 
          })
        ])
      ])
    );

    // Render indicators and controls
    renderControls();
  }

  const controlsContainer = el('div', { style: 'z-index: 2; position: relative; display: flex; flex-direction: column; gap: 16px; margin-top: 24px; max-width: 500px; margin-left: auto; margin-right: auto; width: 100%;' });
  root.appendChild(controlsContainer);

  function completeOnboarding() {
    try {
      localStorage.setItem('sl_onboarded_' + uid, 'true');
    } catch (_) {}
    onComplete();
  }

  function renderControls() {
    const isLast = activeSlide === SLIDES.length - 1;

    // Bullet indicators
    const bullets = el('div', { style: 'display: flex; justify-content: center; gap: 8px;' }, 
      SLIDES.map((_, idx) => el('span', {
        style: `width: ${idx === activeSlide ? '22px' : '8px'}; height: 8px; border-radius: 4px; background: ${idx === activeSlide ? '#80D5FF' : 'rgba(255,255,255,0.22)'}; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);`
      }))
    );

    // Navigation buttons (Wired up correctly using second parameter onClick)
    const actionRow = el('div', { style: 'display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 4px;' }, [
      // Skip or Back button
      activeSlide > 0 
        ? el('button', {
            style: 'background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255,255,255,0.15); color: #FFFFFF; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 12px; cursor: pointer; transition: all 0.2s; outline: none;',
            text: 'Orqaga',
            onClick: () => { activeSlide--; renderSlide(); }
          })
        : el('button', {
            style: 'background: transparent; border: none; color: rgba(255, 255, 255, 0.55); font-weight: 600; font-size: 14px; padding: 12px 16px; cursor: pointer; outline: none; transition: color 0.2s;',
            text: 'Oʻtkazib yuborish',
            onClick: completeOnboarding
          }),

      // Next or Start button
      el('button', {
        style: `flex: 1; text-align: center; font-weight: 700; font-size: 15px; padding: 13px 24px; border-radius: 12px; border: none; cursor: pointer; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 14px rgba(0, 112, 144, 0.3); outline: none; ${
          isLast ? 'background: #00A36C; color: #FFFFFF;' : 'background: #80D5FF; color: #002B36;'
        }`,
        text: isLast ? 'Havzalarni Koʻrish 🚀' : 'Keyingi',
        onClick: () => {
          if (isLast) {
            completeOnboarding();
          } else {
            activeSlide++;
            renderSlide();
          }
        }
      })
    ]);

    controlsContainer.replaceChildren(bullets, actionRow);
  }

  // Inject animations to document head if not present
  if (!document.getElementById('onboarding-styles')) {
    const styleTag = el('style', { id: 'onboarding-styles' }, [
      document.createTextNode(`
        @keyframes pulse-ring {
          0% { transform: scale(0.65); opacity: 0; }
          50% { opacity: 0.4; }
          100% { transform: scale(1.1); opacity: 0; }
        }
        @keyframes led-blink {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes spin-slow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `)
    ]);
    document.head.appendChild(styleTag);
  }

  renderSlide();
  return root;
}
