// ============================================================
//  features/lakes/index.js — lakes feature ochiq API'si
// ============================================================

export { lakeService } from './services/lakeService.js';
export { deviceAssignmentService } from './services/deviceAssignmentService.js';
export * as lakeStatus from './domain/lakeStatus.js';
export * as geo from './domain/geo.js';
export * as lakeValidators from './validators/lakeValidators.js';
export { renderLakesList } from './views/lakesListView.js';
export { renderLakeForm } from './views/lakeFormView.js';
export { renderLakeDetail } from './views/lakeDetailView.js';
