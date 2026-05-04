/**
 * BuffSystem.js - Modular Battlefield Buff Effect System
 *
 * This system provides a composable way to apply battlefield buffs that can:
 * - Modify mission requirements
 * - Modify combat losses
 * - Stack multiple effects
 */

/**
 * Supported buff effect types
 * @typedef {'reduce_mission_requirement' | 'increase_mission_requirement' | 'reduce_random_loss' | 'increase_random_loss' | 'add_combat_power' | 'modify_draw_count' | 'block_shop_card' | 'modify_max_supply' | 'modify_air_slots' | 'modify_shop_refresh_count'} BuffEffectType
 */

/**
 * Single buff effect definition
 * @typedef {Object} BuffEffect
 * @property {BuffEffectType} type - Type of buff effect
 * @property {number} [value] - Numeric modifier value
 * @property {string} [stat] - Stat to modify (for mission requirements: 'groundPower', 'seaPower', 'airDefense', 'airSuperiority')
 * @property {string} [powerType] - Power type (for combat power: 'ground', 'sea', 'air')
 * @property {string[]} [cardIds] - Card IDs affected (for block_shop_card)
 */

/**
 * Battlefield condition with multiple effects
 * @typedef {Object} BattlefieldBuff
 * @property {string} id - Unique buff ID
 * @property {string} name - Display name
 * @property {string} description - Full description
 * @property {boolean} isBuff - True if buff, false if debuff
 * @property {BuffEffect|BuffEffect[]} effect - Single effect or array of effects
 */

/**
 * Apply battlefield buffs to mission requirements
 * Reduces or increases the required power values based on active buffs
 *
 * @param {Object} baseMission - Base mission with original requirements
 * @param {BattlefieldBuff[]} battlefieldConditions - Active battlefield conditions
 * @returns {Object} Modified mission requirements
 */
export function applyBuffsToMissionRequirements(baseMission, battlefieldConditions) {
  if (!battlefieldConditions || battlefieldConditions.length === 0) {
    return {
      groundPower: baseMission.requiredGroundPower || 0,
      seaPower: baseMission.requiredSeaPower || 0,
      airDefense: baseMission.requiredAirDefense || baseMission.requiredAirPower || 0,
      airSuperiority: baseMission.requiredAirSuperiority || baseMission.requiredAirPower || 0
    };
  }

  // Start with base requirements
  const modifiedRequirements = {
    groundPower: baseMission.requiredGroundPower || 0,
    seaPower: baseMission.requiredSeaPower || 0,
    airDefense: baseMission.requiredAirDefense || baseMission.requiredAirPower || 0,
    airSuperiority: baseMission.requiredAirSuperiority || baseMission.requiredAirPower || 0
  };

  // Check if current mission is main mission
  const isMainMission = baseMission.missionType === 'main';

  // Apply each battlefield condition's effects
  battlefieldConditions.forEach(condition => {
    if (!condition.effect) return;

    // Skip buffs with "current_main_only" scope if this is not a main mission
    if (condition.scope === 'current_main_only' && !isMainMission) {
      return;
    }

    // Handle both single effect and array of effects
    const effects = Array.isArray(condition.effect) ? condition.effect : [condition.effect];

    effects.forEach(effect => {
      if (effect.type === 'reduce_mission_requirement' && effect.stat) {
        if (modifiedRequirements.hasOwnProperty(effect.stat)) {
          modifiedRequirements[effect.stat] = Math.max(0, modifiedRequirements[effect.stat] - (effect.value || 0));
        }
      } else if (effect.type === 'increase_mission_requirement' && effect.stat) {
        if (modifiedRequirements.hasOwnProperty(effect.stat)) {
          modifiedRequirements[effect.stat] += (effect.value || 0);
        }
      }
    });
  });

  return modifiedRequirements;
}

/**
 * Apply battlefield buffs to combat loss count
 * Reduces or increases the random loss value based on active buffs
 *
 * @param {number} baseLossCount - Base random loss count from mission
 * @param {BattlefieldBuff[]} battlefieldConditions - Active battlefield conditions
 * @returns {number} Modified loss count (minimum 0)
 */
export function applyBuffsToLossCount(baseLossCount, battlefieldConditions) {
  if (!battlefieldConditions || battlefieldConditions.length === 0) {
    return baseLossCount;
  }

  let modifiedLoss = baseLossCount;

  // Apply each battlefield condition's effects
  battlefieldConditions.forEach(condition => {
    if (!condition.effect) return;

    // Handle both single effect and array of effects
    const effects = Array.isArray(condition.effect) ? condition.effect : [condition.effect];

    effects.forEach(effect => {
      if (effect.type === 'reduce_random_loss') {
        modifiedLoss -= (effect.value || 0);
      } else if (effect.type === 'increase_random_loss') {
        modifiedLoss += (effect.value || 0);
      }
    });
  });

  return Math.max(0, modifiedLoss);
}

/**
 * Get description of all active buff effects
 * Useful for displaying what buffs are currently active
 *
 * @param {BattlefieldBuff[]} battlefieldConditions - Active battlefield conditions
 * @returns {string[]} Array of human-readable effect descriptions
 */
export function getActiveBuffDescriptions(battlefieldConditions) {
  if (!battlefieldConditions || battlefieldConditions.length === 0) {
    return [];
  }

  const descriptions = [];

  battlefieldConditions.forEach(condition => {
    if (condition.name && condition.description) {
      descriptions.push(`${condition.name}: ${condition.description}`);
    }
  });

  return descriptions;
}

/**
 * Check if a specific buff is active
 *
 * @param {BattlefieldBuff[]} battlefieldConditions - Active battlefield conditions
 * @param {string} buffId - Buff ID to check
 * @returns {boolean} True if buff is active
 */
export function isBuffActive(battlefieldConditions, buffId) {
  if (!battlefieldConditions || battlefieldConditions.length === 0) {
    return false;
  }

  return battlefieldConditions.some(condition => condition.id === buffId);
}

export default {
  applyBuffsToMissionRequirements,
  applyBuffsToLossCount,
  getActiveBuffDescriptions,
  isBuffActive
};
