/**
 * BuffRegistry.js - Centralized Buff Management
 *
 * Provides utility functions for loading, validating, and applying buffs from the registry.
 */

import buffRegistryData from './buff_registry.json';

/**
 * Get a buff definition by its ID
 * @param {string} buffId - Buff ID to retrieve
 * @returns {Object|null} Buff definition or null if not found
 */
export function getBuffById(buffId) {
  const buff = buffRegistryData.buffs[buffId];
  if (!buff) {
    console.warn(`[BuffRegistry] Buff ID not found: ${buffId}`);
    return null;
  }
  return buff;
}

/**
 * Get all registered buffs
 * @returns {Object} Map of buff ID to buff definition
 */
export function getAllBuffs() {
  return buffRegistryData.buffs;
}

/**
 * Get buffs filtered by category
 * @param {string} category - Category to filter by
 * @returns {Object[]} Array of buff definitions
 */
export function getBuffsByCategory(category) {
  return Object.values(buffRegistryData.buffs).filter(
    buff => buff.category === category
  );
}

/**
 * Get buffs filtered by tag
 * @param {string} tag - Tag to filter by
 * @returns {Object[]} Array of buff definitions
 */
export function getBuffsByTag(tag) {
  return Object.values(buffRegistryData.buffs).filter(
    buff => buff.tags && buff.tags.includes(tag)
  );
}

/**
 * Get buffs filtered by scope
 * @param {string} scope - Scope to filter by
 * @returns {Object[]} Array of buff definitions
 */
export function getBuffsByScope(scope) {
  return Object.values(buffRegistryData.buffs).filter(
    buff => buff.scope === scope
  );
}

/**
 * Validate that a buff ID exists in the registry
 * @param {string} buffId - Buff ID to validate
 * @returns {boolean} True if buff exists
 */
export function validateBuffId(buffId) {
  return buffId in buffRegistryData.buffs;
}

/**
 * Convert buff definition to battlefield condition format
 * Used when applying a buff from registry to game state
 *
 * @param {string} buffId - Buff ID to load
 * @param {Object} options - Additional options (source, linkedCardId, etc.)
 * @returns {Object|null} Battlefield condition object or null if buff not found
 */
export function createBattlefieldCondition(buffId, options = {}) {
  const buff = getBuffById(buffId);
  if (!buff) {
    return null;
  }

  // Convert buff definition to battlefield condition format
  const condition = {
    id: buff.id,
    name: buff.name,
    description: buff.description,
    isBuff: buff.isBuff,
    effect: buff.effects, // Can be single effect or array
    scope: buff.scope,
    duration: buff.duration,
    category: buff.category,
    tags: buff.tags,
    ...options // source, linkedCardId, appliedAt, etc.
  };

  return condition;
}

/**
 * Get category definitions
 * @returns {Object} Map of category ID to description
 */
export function getCategories() {
  return buffRegistryData.categories;
}

/**
 * Get scope definitions
 * @returns {Object} Map of scope ID to description
 */
export function getScopes() {
  return buffRegistryData.scopes;
}

/**
 * Get registry version
 * @returns {string} Version number
 */
export function getRegistryVersion() {
  return buffRegistryData.version;
}

/**
 * Validate buff definition structure
 * Checks for required fields and valid effect types
 *
 * @param {Object} buff - Buff definition to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateBuffDefinition(buff) {
  const errors = [];

  // Required fields
  if (!buff.id) errors.push('Missing required field: id');
  if (!buff.name) errors.push('Missing required field: name');
  if (!buff.description) errors.push('Missing required field: description');
  if (!buff.effects || buff.effects.length === 0) {
    errors.push('Missing or empty effects array');
  }

  // Validate effect types
  const validEffectTypes = [
    'reduce_mission_requirement',
    'increase_mission_requirement',
    'reduce_random_loss',
    'increase_random_loss',
    'add_combat_power',
    'modify_draw_count',
    'block_shop_card',
    'modify_max_supply',
    'modify_air_slots',
    'modify_shop_refresh_count'
  ];

  const effects = Array.isArray(buff.effects) ? buff.effects : [buff.effects];
  effects.forEach((effect, index) => {
    if (!effect.type) {
      errors.push(`Effect ${index}: missing type`);
    } else if (!validEffectTypes.includes(effect.type)) {
      errors.push(`Effect ${index}: invalid type '${effect.type}'`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Log buff registry statistics
 * Useful for debugging and documentation
 */
export function logRegistryStats() {
  const buffs = Object.values(buffRegistryData.buffs);
  const stats = {
    total: buffs.length,
    byCategory: {},
    byScope: {},
    buffs: buffs.filter(b => b.isBuff).length,
    debuffs: buffs.filter(b => !b.isBuff).length
  };

  buffs.forEach(buff => {
    stats.byCategory[buff.category] = (stats.byCategory[buff.category] || 0) + 1;
    stats.byScope[buff.scope] = (stats.byScope[buff.scope] || 0) + 1;
  });

  console.log('[BuffRegistry] Statistics:', stats);
  return stats;
}

export default {
  getBuffById,
  getAllBuffs,
  getBuffsByCategory,
  getBuffsByTag,
  getBuffsByScope,
  validateBuffId,
  createBattlefieldCondition,
  getCategories,
  getScopes,
  getRegistryVersion,
  validateBuffDefinition,
  logRegistryStats
};
