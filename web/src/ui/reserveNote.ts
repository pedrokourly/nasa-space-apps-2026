import { O2_RESERVE_FRACTION } from '../routing/core/walk';

/**
 * Note shown next to "O₂ left / remaining": that value is the supply minus the O₂ used, so it still
 * contains the safety reserve the GO / NO-GO verdict never plans for (`O2_RESERVE_FRACTION`).
 */
export const RESERVE_NOTE = `includes the ${Math.round(O2_RESERVE_FRACTION * 100)}% reserve`;
