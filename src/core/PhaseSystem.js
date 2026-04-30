/**
 * PhaseSystem.js - Strategic Phase Management
 */

import phase1Data from '../data/phases/phase1.json';
import phase1Missions from '../data/cards/mission_phase1.json';

/**
 * Load phase data by phase number
 * @param {number} phaseNumber - Phase number (1-4)
 * @returns {import('../models/Phase').StrategicPhase}
 */
export function loadPhaseData(phaseNumber) {
  switch (phaseNumber) {
    case 1:
      return phase1Data;
    // Future phases will be added here
    default:
      throw new Error(`Phase ${phaseNumber} not implemented yet`);
  }
}

/**
 * Load mission cards for a phase
 * @param {number} phaseNumber - Phase number (1-4)
 * @returns {import('../models/Phase').MissionCard[]}
 */
export function loadPhaseMissions(phaseNumber) {
  switch (phaseNumber) {
    case 1:
      return phase1Missions;
    // Future phases will be added here
    default:
      throw new Error(`Phase ${phaseNumber} missions not implemented yet`);
  }
}

/**
 * Apply phase transition - handle card lifecycle changes
 * @param {Object} state - Current game state
 * @param {import('../models/Phase').StrategicPhase} newPhase - New phase data
 * @returns {Object} - Updated state
 */
export function applyPhaseTransition(state, newPhase) {
  const newState = { ...state };

  // Remove cards that retire this phase
  if (newPhase.cardsToRetire && newPhase.cardsToRetire.length > 0) {
    // Remove from essential shop
    newState.essentialShop = newState.essentialShop.filter(
      card => !newPhase.cardsToRetire.includes(card.id)
    );

    // Remove from random shop
    newState.randomShop = newState.randomShop.filter(
      card => !newPhase.cardsToRetire.includes(card.id)
    );

    // Remove from random shop deck
    newState.randomShopDeck = newState.randomShopDeck.filter(
      card => !newPhase.cardsToRetire.includes(card.id)
    );
  }

  // Return deployed logistics cards to shop (as per requirements)
  const logisticsCards = newState.deployed.filter(
    card => card.cardCategory === 'logistics'
  );

  logisticsCards.forEach(card => {
    if (card.shopType === 'essential') {
      // Return to essential shop
      const existingInShop = newState.essentialShop.find(c => c.id === card.id);
      if (!existingInShop) {
        newState.essentialShop.push({ ...card, status: 'ready' });
      }
    } else if (card.shopType === 'random') {
      // Return to random shop deck
      newState.randomShopDeck.push({ ...card, status: 'ready' });
    }
  });

  // Remove logistics cards from deployed zone
  newState.deployed = newState.deployed.filter(
    card => card.cardCategory !== 'logistics'
  );

  // Add new cards that appear this phase
  // This will be implemented when we load the full card database with phase filtering

  return newState;
}

/**
 * Check if current phase is complete
 * @param {Object} state - Current game state
 * @returns {boolean} - True if main mission is complete
 */
export function checkPhaseComplete(state) {
  if (!state.phaseData || !state.completedMissions) {
    return false;
  }

  const phaseKey = `phase_${state.currentPhase}`;
  const phaseCompletion = state.completedMissions[phaseKey];

  return phaseCompletion && phaseCompletion.main === true;
}

/**
 * Apply battlefield condition effects to game state
 * @param {Object} state - Current game state
 * @param {import('../models/Phase').BattlefieldCondition} condition - Condition to apply
 * @returns {Object} - Updated state
 */
export function applyBattlefieldCondition(state, condition) {
  const newState = { ...state };

  switch (condition.effect.type) {
    case 'block_shop_card':
      // Filter will be applied in shop system
      break;

    case 'modify_draw_count':
      // Will be applied during draw phase
      break;

    case 'modify_max_supply':
      newState.maxSupply += condition.effect.value;
      break;

    case 'add_combat_power':
      // Will be applied during combat calculation
      break;

    case 'modify_air_slots':
      // Will be applied during combat air slot calculation
      break;

    case 'modify_shop_refresh_count':
      // Will be applied during shop refresh
      break;

    default:
      console.warn(`Unknown condition effect type: ${condition.effect.type}`);
  }

  return newState;
}

/**
 * Get effective draw count with battlefield conditions
 * @param {Object} state - Current game state
 * @returns {number} - Number of cards to draw
 */
export function getEffectiveDrawCount(state) {
  let baseDrawCount = 5; // Default draw count

  if (!state.battlefieldConditions) {
    return baseDrawCount;
  }

  state.battlefieldConditions.forEach(condition => {
    if (condition.effect.type === 'modify_draw_count') {
      baseDrawCount += condition.effect.value;
    }
  });

  return Math.max(1, baseDrawCount); // Minimum 1 card
}

/**
 * Get combat power bonus from battlefield conditions
 * @param {Object} state - Current game state
 * @param {string} powerType - 'ground', 'sea', or 'air'
 * @returns {number} - Bonus power
 */
export function getCombatPowerBonus(state, powerType) {
  let bonus = 0;

  if (!state.battlefieldConditions) {
    return bonus;
  }

  state.battlefieldConditions.forEach(condition => {
    if (
      condition.effect.type === 'add_combat_power' &&
      condition.effect.powerType === powerType
    ) {
      bonus += condition.effect.value;
    }
  });

  return bonus;
}

/**
 * Check if a card is blocked by battlefield conditions
 * @param {Object} card - Card to check
 * @param {Object} state - Current game state
 * @returns {boolean} - True if card is blocked
 */
export function isCardBlockedByConditions(card, state) {
  if (!state.battlefieldConditions) {
    return false;
  }

  for (const condition of state.battlefieldConditions) {
    if (
      condition.effect.type === 'block_shop_card' &&
      condition.effect.cardIds &&
      condition.effect.cardIds.includes(card.id)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Get shop refresh count with battlefield conditions
 * @param {Object} state - Current game state
 * @returns {number} - Number of random shop slots
 */
export function getShopRefreshCount(state) {
  let baseCount = 6; // Default random shop size

  // Add expand_shop abilities from deployed cards
  state.deployed.forEach(card => {
    if (card.abilities) {
      card.abilities.forEach(ability => {
        if (ability.type === 'expand_shop') {
          baseCount += ability.value || 1;
        }
      });
    }
  });

  // Apply battlefield conditions
  if (state.battlefieldConditions) {
    state.battlefieldConditions.forEach(condition => {
      if (condition.effect.type === 'modify_shop_refresh_count') {
        baseCount += condition.effect.value;
      }
    });
  }

  return Math.max(1, baseCount); // Minimum 1 slot
}

export default {
  loadPhaseData,
  loadPhaseMissions,
  applyPhaseTransition,
  checkPhaseComplete,
  applyBattlefieldCondition,
  getEffectiveDrawCount,
  getCombatPowerBonus,
  isCardBlockedByConditions,
  getShopRefreshCount,
};
