// ============================================================
//  features/auth/index.js — Auth feature'ining ochiq API'si
//  Boshqa qatlamlar faqat shu fayl orqali auth'ga murojaat qiladi
//  (feature ichki tuzilishi tashqaridan yashirin -> past bog'lanish).
// ============================================================

export { authService } from './services/authService.js';
export { renderAuth } from './views/authView.js';
export * as authValidators from './validators/authValidators.js';
