/**
 * Entity Name Resolver — Maps entity IDs to human-readable names.
 *
 * Used by server pages that display transactions with fromEntityId/toEntityId.
 * Instead of duplicating the same forEach loop in every page, call this:
 *
 *   const entityNames = buildEntityNames(stores, supervisors, staffList);
 *   const name = entityNames[tx.fromEntityId] || tx.fromEntityType || '---';
 *
 * @param {Array} stores - Array of { id, name }
 * @param {Array} supervisors - Array of { id, name }
 * @param {Array} staffList - Array of { id, name }
 * @returns {Object} Map of entityId -> displayName
 */
export function buildEntityNames(stores = [], supervisors = [], staffList = []) {
  const map = {};
  stores.forEach(s => { map[s.id] = s.name; });
  supervisors.forEach(s => { map[s.id] = s.name; });
  staffList.forEach(s => { map[s.id] = s.name; });
  return map;
}

/**
 * Resolve an entity name from the map, with fallback.
 *
 * @param {Object} entityNames - The map from buildEntityNames
 * @param {string} entityId - The entity ID to resolve
 * @param {string} [entityType] - Fallback entity type (e.g. "WAREHOUSE", "STORE")
 * @returns {string} Display name
 */
export function resolveEntityName(entityNames, entityId, entityType) {
  if (entityType === 'WAREHOUSE') return 'Warehouse';
  return entityNames[entityId] || entityType || entityId || '---';
}
