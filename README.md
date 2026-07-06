# SmartLake 2.0

Baliq ko'llari uchun real-time monitoring platformasi (Firestore + LoRa/ESP32).

## Ishga tushirish (dev)
```bash
cp .env.example .env      # Firebase kalitlari (public)
npm install
npm run dev               # Fermer ilovasi: http://localhost:5173/index.html
                          # Admin panel:    http://localhost:5173/admin.html
```

## Lokal test (Firebase Emulator)
```bash
# .env da VITE_USE_EMULATOR=true qiling
npm run emulators         # Auth:9099, Firestore:8080
npm run dev
```

## Testlar
```bash
npm test
```

## Struktura (Feature-based)
```
src/
  core/        firebase, config, logger, errors, i18n
  shared/      dom, icons, toast, screen, base.css
  features/    auth/  (services · validators · views)
  farmer/      fermer ilovasi (entry)
  admin/       admin panel (entry)
firmware/      ESP32 Node + Gateway (.ino)
legacy/        eski monolit (parity'gacha reference)
docs/          hujjatlar
```

Arxitektura qarorlari: `docs/` (ADR-001 — Firestore-primary).
