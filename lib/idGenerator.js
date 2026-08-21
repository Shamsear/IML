/**
 * ID Generator — delegates to ledger engine.
 * Kept for backward compatibility with existing imports.
 */
import { generateGlobalId } from './ledger';

export async function generateId(modelName, prefix, padding = 3) {
  return generateGlobalId(modelName, prefix, padding);
}
