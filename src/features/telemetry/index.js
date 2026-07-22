// ============================================================
//  features/telemetry/index.js — telemetry feature ochiq API'si
// ============================================================

// Domain (sof mantiq)
export * as sensorStatus from './domain/sensorStatus.js';
export * as signalQuality from './domain/signalQuality.js';
export * as freshness from './domain/freshness.js';
export { healthScore } from './domain/healthScore.js';
export { deviceStatus, worstLevel } from './domain/statusEngine.js';
export { aggregateLake } from './domain/aggregate.js';
export { resolveThresholds } from './domain/thresholds.js';

// Services
export { telemetryService } from './services/telemetryService.js';
export { historyService, RANGES } from './services/historyService.js';

// Views

// Constants
export { DEVICE_STATUS, LEVEL, DEFAULT_THRESHOLDS } from './constants/telemetryConstants.js';
