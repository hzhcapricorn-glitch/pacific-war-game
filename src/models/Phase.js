/**
 * Phase.js - Strategic Phase and Battlefield Condition Types
 */

/**
 * Battlefield condition effect types
 * @typedef {'block_shop_card' | 'modify_draw_count' | 'modify_max_supply' | 'add_combat_power' | 'modify_air_slots' | 'modify_shop_refresh_count' | 'reduce_mission_requirement' | 'increase_mission_requirement' | 'reduce_random_loss' | 'increase_random_loss'} ConditionEffectType
 */

/**
 * Battlefield condition effect
 * @typedef {Object} ConditionEffect
 * @property {ConditionEffectType} type - Type of effect
 * @property {number} [value] - Numeric value for the effect
 * @property {string[]} [cardIds] - Card IDs affected by the effect
 * @property {string} [powerType] - Type of power affected (ground/sea/air)
 * @property {string} [stat] - Stat to modify (groundPower/seaPower/airDefense/airSuperiority)
 */

/**
 * Battlefield condition
 * @typedef {Object} BattlefieldCondition
 * @property {string} id - Unique condition ID
 * @property {string} name - Display name
 * @property {string} description - Full description
 * @property {boolean} [isBuff] - True if buff, false if debuff
 * @property {ConditionEffect|ConditionEffect[]} effect - Single effect or array of effects
 */

/**
 * Mission constraint types
 * @typedef {'night_battle' | 'no_air_units' | 'no_navy_units' | 'limited_air_slots'} ConstraintType
 */

/**
 * Mission constraint
 * @typedef {Object} MissionConstraint
 * @property {ConstraintType} type - Type of constraint
 * @property {string} description - Human-readable description
 * @property {number} [value] - Optional value for the constraint
 */

/**
 * Mission reward types
 * @typedef {Object} MissionReward
 * @property {string} description - Human-readable reward description
 * @property {number} [supply] - Supply reward
 * @property {number} [maxSupply] - Max supply increase
 * @property {number} [extraTurns] - Extra turns added to phase countdown
 * @property {string} [card] - Card ID to award
 * @property {BattlefieldCondition} [battlefieldBuff] - Battlefield buff to apply
 */

/**
 * Mission loss
 * @typedef {Object} MissionLoss
 * @property {string} description - Human-readable loss description
 * @property {number} randomLoss - Number of random cards to lose
 */

/**
 * Mission type
 * @typedef {'main' | 'side'} MissionType
 */

/**
 * Mission card (enhanced)
 * @typedef {Object} MissionCard
 * @property {string} id - Unique mission ID
 * @property {string} name - Mission name
 * @property {MissionType} type - Main or side mission
 * @property {number} phase - Strategic phase number
 * @property {string} difficulty - Difficulty level
 * @property {string} [image] - Image path
 * @property {number} requiredGroundPower - Required ground power
 * @property {number} requiredSeaPower - Required sea power
 * @property {number} requiredAirDefense - Required air defense
 * @property {number} requiredAirSuperiority - Required air superiority
 * @property {MissionReward} reward - Mission rewards
 * @property {MissionLoss} loss - Mission losses
 * @property {MissionConstraint[]} missionConstraints - Mission-specific constraints
 * @property {string} [flavor] - Flavor text
 */

/**
 * Strategic Phase
 * @typedef {Object} StrategicPhase
 * @property {string} id - Unique phase ID
 * @property {string} name - Phase name
 * @property {string} historicalContext - Historical background text
 * @property {number} turnLimit - Maximum turns allowed for this phase
 * @property {string} mainMission - Main mission ID (must complete to advance)
 * @property {string[]} sideMissions - Side mission IDs
 * @property {BattlefieldCondition[]} battlefieldConditions - Active conditions for this phase
 * @property {string[]} cardsToRetire - Card IDs that leave the game
 * @property {string[]} cardsToAdd - Card IDs that enter the game
 */

/**
 * Phase completion status
 * @typedef {Object} PhaseCompletion
 * @property {boolean} main - Whether main mission is complete
 * @property {string[]} side - IDs of completed side missions
 */

export default {
  // This file exports type definitions for use in JSDoc comments
  // No runtime exports needed
};
