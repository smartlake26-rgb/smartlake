// ============================================================
//  features/devices/index.js — devices feature ochiq API'si
// ============================================================

export { deviceService, generateActivationKey } from './services/deviceService.js';
export * as deviceLifecycle from './domain/deviceLifecycle.js';
export { assertTransition, canTransition } from './domain/deviceLifecycle.js';
export { devicePresence } from './domain/devicePresence.js';
