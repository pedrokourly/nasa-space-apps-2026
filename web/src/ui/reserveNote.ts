import { O2_RESERVE_FRACTION } from '../routing/core/walk';

/**
 * Note for "O₂ left / remaining": that value is the supply minus the O₂ used, so it still contains
 * the safety reserve the GO / NO-GO verdict never plans for (`O2_RESERVE_FRACTION`).
 */
export const RESERVE_NOTE = `${Math.round(O2_RESERVE_FRACTION * 100)}% reserved`;

/**
 * Column title of the O₂ left column. The reserve is not repeated here: the assumptions line under
 * the table already says "10% kept as reserve".
 */
export const O2_LEFT_TITLE = 'O₂ left';
