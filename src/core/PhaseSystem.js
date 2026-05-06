/**
 * PhaseSystem.js - Strategic Phase Management
 */

import phase1Data from '../data/phases/phase1.json';
import phase1Missions from '../data/cards/mission_phase1.json';
import phase2Data from '../data/phases/phase2.json';
import phase2Missions from '../data/cards/mission_phase2.json';
import phase3Data from '../data/phases/phase3.json';
import phase3Missions from '../data/cards/mission_phase3.json';
import phase4Data from '../data/phases/phase4.json';
import phase4Missions from '../data/cards/mission_phase4.json';
import { getCardShopType, getCardShopCopies, getCardChangeType } from './ShopSystem';

/**
 * Load phase data by phase number
 * @param {number} phaseNumber - Phase number (1-4)
 * @returns {import('../models/Phase').StrategicPhase}
 */
export function loadPhaseData(phaseNumber) {
  switch (phaseNumber) {
    case 1:
      return phase1Data;
    case 2:
      return phase2Data;
    case 3:
      return phase3Data;
    case 4:
      return phase4Data;
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
    case 2:
      return phase2Missions;
    case 3:
      return phase3Missions;
    case 4:
      return phase4Missions;
    default:
      throw new Error(`Phase ${phaseNumber} missions not implemented yet`);
  }
}

/**
 * Apply phase transition - handle card lifecycle changes
 * @param {Object} state - Current game state
 * @param {import('../models/Phase').StrategicPhase} newPhase - New phase data
 * @param {number} phaseNumber - New phase number
 * @param {Array} allCombatCards - All combat card definitions
 * @returns {Object} - Updated state with phaseCardChanges field
 */
export function applyPhaseTransition(state, newPhase, phaseNumber, allCombatCards) {
  const newState = { ...state };
  const oldPhase = state.currentPhase || 0; // 0 means not initialized yet

  // Track card changes for display in transition modal
  const cardChanges = {
    retired: [],
    added: [],
    promoted: []
  };

  // Ensure zones exist
  if (!newState.zones) {
    newState.zones = {
      deck: [],
      hand: [],
      deployed: [],
      discard: [],
      essentialShop: [],
      randomShop: [],
      randomShopDeck: [],
      removed: []
    };
  }

  // 后勤卡不再随战略阶段改动而损失，保留在部署区
  // 注释掉原来的后勤卡返回商店逻辑

  // const logisticsCards = (newState.zones.deployed || []).filter(
  //   card => card.cardCategory === 'logistics'
  // );
  //
  // logisticsCards.forEach(card => {
  //   // Determine shop type for this card in new phase
  //   const newShopType = getCardShopType(card, phaseNumber);
  //
  //   if (newShopType === 'essential') {
  //     const existingInShop = (newState.zones.essentialShop || []).find(c => c.id === card.id);
  //     if (!existingInShop) {
  //       newState.zones.essentialShop = [...(newState.zones.essentialShop || []), { ...card, status: 'ready' }];
  //     }
  //   } else if (newShopType === 'random') {
  //     newState.zones.randomShopDeck = [...(newState.zones.randomShopDeck || []), { ...card, status: 'ready' }];
  //   }
  // });
  //
  // // Remove logistics cards from deployed zone
  // newState.zones.deployed = (newState.zones.deployed || []).filter(
  //   card => card.cardCategory !== 'logistics'
  // );

  // Skip shop rebuild during initial setup (oldPhase === 0)
  // INIT_GAME has already set up the shops correctly
  if (oldPhase === 0) {
    newState.phaseCardChanges = cardChanges;
    return newState;
  }

  // Process all cards to determine changes and rebuild shops
  if (allCombatCards && allCombatCards.length > 0) {
    // Build a map of existing card instances
    const existingCards = new Map();
    [...newState.zones.essentialShop, ...newState.zones.randomShopDeck, ...newState.zones.randomShop].forEach(card => {
      if (!existingCards.has(card.id)) {
        existingCards.set(card.id, []);
      }
      existingCards.get(card.id).push(card);
    });

    // Rebuild shops based on new phase
    const newEssentialShop = [];
    const newRandomShopDeck = [];
    let cardInstanceId = Date.now();

    allCombatCards.forEach(cardDef => {
      const changeType = getCardChangeType(cardDef, oldPhase, phaseNumber);
      const newShopType = getCardShopType(cardDef, phaseNumber);

      // Debug logging for large_supply
      if (cardDef.id === 'large_supply') {
        console.log('[DEBUG] large_supply phase transition:', {
          oldPhase,
          phaseNumber,
          changeType,
          newShopType,
          existingInstances: existingCards.get(cardDef.id)?.length || 0
        });
      }

      // Track changes
      if (changeType === 'retired') {
        if (!cardChanges.retired.find(c => c.id === cardDef.id)) {
          cardChanges.retired.push({
            id: cardDef.id,
            name: cardDef.name,
            rarity: cardDef.rarity
          });
        }
      } else if (changeType === 'added') {
        if (!cardChanges.added.find(c => c.id === cardDef.id)) {
          cardChanges.added.push({
            id: cardDef.id,
            name: cardDef.name,
            rarity: cardDef.rarity
          });
        }
      } else if (changeType === 'promoted') {
        if (!cardChanges.promoted.find(c => c.id === cardDef.id)) {
          cardChanges.promoted.push({
            id: cardDef.id,
            name: cardDef.name,
            rarity: cardDef.rarity
          });
        }
      }

      // Add cards to appropriate shop
      if (newShopType) {
        // Check if this card is unique and already deployed/in hand/in deck
        const isUniqueCardInUse = cardDef.unique && (
          newState.zones.deployed.some(c => c.id === cardDef.id) ||
          newState.zones.hand.some(c => c.id === cardDef.id) ||
          newState.zones.deck.some(c => c.id === cardDef.id) ||
          newState.zones.discard.some(c => c.id === cardDef.id)
        );

        const existingInstances = existingCards.get(cardDef.id) || [];
        const shopCopies = getCardShopCopies(cardDef, newShopType);
        const targetShop = newShopType === 'essential' ? newEssentialShop : newRandomShopDeck;

        // Reuse existing instances first
        for (let i = 0; i < shopCopies; i++) {
          if (i < existingInstances.length) {
            targetShop.push({ ...existingInstances[i], status: 'ready' });
          } else {
            // Don't create new instances of unique cards already in use
            if (isUniqueCardInUse) {
              continue;
            }
            // Create new instance
            targetShop.push({
              ...cardDef,
              instanceId: `${cardDef.id}_${cardInstanceId++}`,
              status: 'ready'
            });
          }
        }

        // Debug logging for large_supply
        if (cardDef.id === 'large_supply') {
          console.log('[DEBUG] large_supply added to shop:', {
            shopType: newShopType,
            shopCopies,
            reusedCount: Math.min(shopCopies, existingInstances.length),
            createdCount: Math.max(0, shopCopies - existingInstances.length),
            targetShopName: newShopType === 'essential' ? 'essentialShop' : 'randomShopDeck'
          });
        }
      }
    });

    newState.zones.essentialShop = newEssentialShop;
    newState.zones.randomShopDeck = newRandomShopDeck;
    newState.zones.randomShop = []; // Clear random shop, will be refilled on next turn
  }

  // Store card changes in state for modal display
  newState.phaseCardChanges = cardChanges;

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

  // Skip conditions without effect (e.g., mission constraints)
  if (!condition.effect || !condition.effect.type) {
    return newState;
  }

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

  // Check battlefield conditions
  if (state.battlefieldConditions) {
    state.battlefieldConditions.forEach(condition => {
      // Support both single effect (old format) and effects array (registry format)
      const effects = Array.isArray(condition.effect) ? condition.effect : [condition.effect].filter(Boolean);

      effects.forEach(effect => {
        if (effect && effect.type === 'modify_draw_count') {
          baseDrawCount += effect.value || 0;
        }
      });
    });
  }

  // Check leader abilities in deployed zone
  if (state.zones && state.zones.deployed) {
    state.zones.deployed.forEach(card => {
      if (card.type === 'leader' && card.abilities) {
        card.abilities.forEach(ability => {
          if (ability.type === 'modify_draw_count') {
            baseDrawCount += ability.effect?.value || 0;
          }
        });
      }
    });
  }

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
    // Support both single effect and effects array
    const effects = Array.isArray(condition.effect) ? condition.effect : [condition.effect].filter(Boolean);

    effects.forEach(effect => {
      if (
        effect &&
        effect.type === 'add_combat_power' &&
        effect.powerType === powerType
      ) {
        bonus += effect.value || 0;
      }
    });
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
    // Support both single effect and effects array
    const effects = Array.isArray(condition.effect) ? condition.effect : [condition.effect].filter(Boolean);

    for (const effect of effects) {
      if (
        effect &&
        effect.type === 'block_shop_card' &&
        effect.cardIds &&
        effect.cardIds.includes(card.id)
      ) {
        return true;
      }
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
      // Support both single effect and effects array
      const effects = Array.isArray(condition.effect) ? condition.effect : [condition.effect].filter(Boolean);

      effects.forEach(effect => {
        if (effect && effect.type === 'modify_shop_refresh_count') {
          baseCount += effect.value || 0;
        }
      });
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
