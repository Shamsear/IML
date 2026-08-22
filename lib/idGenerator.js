/**
 * ID Generator — re-exports from ledger.js for backward compatibility.
 *
 * All entity IDs use the format PREFIX-NNN (e.g. BRND-001, STOR-042).
 * Transaction IDs use PREFIX-NNNNN (e.g. TRAN-00001).
 *
 * ID prefixes used in this system:
 *   BRND  — Brand
 *   STOR  — Store
 *   PROD  — Product
 *   STAF  — Staff
 *   SUPR  — Supervisor
 *   ALOC  — Staff Uniform Allocation
 *   TRAN  — Inventory Transaction
 */
export { generateGlobalId as generateId } from './ledger';
