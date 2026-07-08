// ============================================================
//  features/commands/validators/commandValidators.js — SOF validatsiya
// ============================================================

import { COMMAND_TYPES } from '../../../core/collections.js';
import { COMMAND_DEFS } from '../constants/commandConstants.js';

const TYPES = new Set(Object.values(COMMAND_TYPES));

export function isValidType(type) { return TYPES.has(type); }

/** commandType + payload validatsiyasi. */
export function validateCommand({ commandType, payload } = {}) {
  if (!isValidType(commandType)) return { valid: false, messageKey: 'error.badCommandType' };
  if (payload != null && (typeof payload !== 'object' || Array.isArray(payload))) {
    return { valid: false, messageKey: 'error.badPayload' };
  }
  if (!COMMAND_DEFS[commandType]) return { valid: false, messageKey: 'error.badCommandType' };
  return { valid: true };
}

export default { isValidType, validateCommand };
