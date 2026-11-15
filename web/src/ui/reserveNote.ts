import { O2_RESERVE_FRACTION } from '../routing/core/walk';

/**
 * Note for "O₂ left / remaining": that value is the supply minus the O₂ used, so it still contains
 * the safety reserve the GO / NO-GO verdict never plans for (`O2_RESERVE_FRACTION`).
 */
export const RESERVE_NOTE = `${Math.round(O2_RESERVE_FRACTION * 100)}% reserved`;

/** Column title of the O₂ left column, e.g. "O₂ left (10% reserved)". */
export const O2_LEFT_TITLE = `O₂ left (${RESERVE_NOTE})`;
