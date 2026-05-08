import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { GamePhase, getNextPhase } from '../models/GamePhase';
import { drawCards, moveCard, setCardStatus, shuffleDeck, createDeck } from './CardEngine';
import { getCardAbilityEffects, isSupplyCard } from '../models/Card';
import { processAbilities, getCardDestination, applyAbilityResults, hasReturnToBaseAbility } from './AbilitySystem';
import { createBattlefieldCondition } from '../data/buffs/BuffRegistry';
import {
  loadPhaseData,
  loadPhaseMissions,
  applyPhaseTransition,
  checkPhaseComplete
} from './PhaseSystem';

/**
 * 初始游戏状态
 */
const initialState = {
  phase: GamePhase.PREPARE,
  turn: 1,
  supply: 0,
  maxSupplyRetention: 0,
  randomShopSlots: 6, // 随机商店槽位数量（可通过卡牌能力提升）
  zones: {
    deck: [],
    hand: [],
    deployed: [],
    discard: [],
    essentialShop: [], // 必要卡牌商店（固定，堆叠显示）
    randomShop: [], // 随机卡牌商店（每回合刷新）
    randomShopDeck: [], // 随机商店牌堆（不显示）
    removed: [] // 已移除游戏的卡牌
  },
  missions: [],
  currentMission: null,
  combatPower: 0,
  stats: {
    totalTurns: 0,
    battlesWon: 0,
    cardsPlayed: 0,
    cardsPurchased: 0
  },
  selectedForCombat: [], // 选中参与战斗的卡牌ID
  battleLog: [], // 战场简讯日志（最多20条）
  combatReports: [], // 战斗简报历史（完整战斗结果）
  retireUsedThisTurn: false, // 退役能力本回合是否已使用
  usedAbilitiesThisTurn: {}, // 追踪本回合已使用的能力（用于once_per_turn约束）

  // Scout Limit System
  scoutLimit: 1, // 侦查上限（初始为1）
  scoutUsed: 0, // 本回合已使用的侦查次数

  // Strategic Phase System
  currentPhase: undefined, // Current strategic phase number (set by START_PHASE)
  phaseData: null, // Current phase definition
  availableMissions: [], // All missions for current phase
  leader: null, // Selected leader card
  turnsRemaining: 15, // Countdown timer
  battlefieldConditions: [], // Active buffs/debuffs
  completedMissions: {} // Track completed missions by phase
};

const MAX_LOG_ENTRIES = 20;

/**
 * Game State Context
 */
const GameStateContext = createContext();

/**
 * Action Types
 */
const ActionTypes = {
  INIT_GAME: 'INIT_GAME',
  SET_PHASE: 'SET_PHASE',
  NEXT_PHASE: 'NEXT_PHASE',
  DRAW_CARDS: 'DRAW_CARDS',
  PLAY_CARD: 'PLAY_CARD',
  TAP_CARD: 'TAP_CARD',
  UNTAP_CARD: 'UNTAP_CARD',
  UNTAP_ALL_DEPLOYED: 'UNTAP_ALL_DEPLOYED',
  ADD_SUPPLY: 'ADD_SUPPLY',
  SPEND_SUPPLY: 'SPEND_SUPPLY',
  PURCHASE_CARD: 'PURCHASE_CARD',
  SELECT_FOR_COMBAT: 'SELECT_FOR_COMBAT',
  DESELECT_FOR_COMBAT: 'DESELECT_FOR_COMBAT',
  RESOLVE_COMBAT: 'RESOLVE_COMBAT',
  END_TURN: 'END_TURN',
  UPDATE_MISSIONS: 'UPDATE_MISSIONS',
  SET_SHOP: 'SET_SHOP',
  REFRESH_RANDOM_SHOP: 'REFRESH_RANDOM_SHOP',
  SORT_DEPLOYED: 'SORT_DEPLOYED',
  GAME_OVER: 'GAME_OVER',
  RESET_GAME: 'RESET_GAME',
  ADD_LOG: 'ADD_LOG',
  RETIRE_CARD: 'RETIRE_CARD',
  CLEAR_PENDING_INTERACTION: 'CLEAR_PENDING_INTERACTION',
  SCOUT_AND_TAP: 'SCOUT_AND_TAP',
  TRIGGER_DEPLOYED_ABILITY: 'TRIGGER_DEPLOYED_ABILITY',
  // Strategic Phase System
  START_PHASE: 'START_PHASE',
  SELECT_MISSION: 'SELECT_MISSION',
  COMPLETE_MISSION: 'COMPLETE_MISSION',
  // Debug Actions
  DEBUG_ADD_BUFF: 'DEBUG_ADD_BUFF',
  DEBUG_REMOVE_BUFF: 'DEBUG_REMOVE_BUFF',
  DEBUG_SAVE_SNAPSHOT: 'DEBUG_SAVE_SNAPSHOT',
  DEBUG_LOAD_SNAPSHOT: 'DEBUG_LOAD_SNAPSHOT'
};

/**
 * Counter for generating unique log IDs
 */
let logIdCounter = 0;

/**
 * 构建战场局势列表（阶段全局buff + 当前任务限制）
 */
function buildBattlefieldConditions(phaseData, currentMission) {
  const conditions = [];

  // 添加阶段全局buff/debuff
  if (phaseData && phaseData.battlefieldConditions) {
    phaseData.battlefieldConditions.forEach(conditionRef => {
      // 尝试从buff注册表加载
      if (conditionRef.id) {
        const buffCondition = createBattlefieldCondition(conditionRef.id, {
          source: conditionRef.source || 'phase'
        });
        if (buffCondition) {
          // 成功从registry加载
          conditions.push(buffCondition);
        } else if (conditionRef.name && conditionRef.description) {
          // Registry中没有，但有完整的inline定义，使用inline定义
          conditions.push({
            ...conditionRef,
            source: conditionRef.source || 'phase'
          });
        } else {
          // 既没有registry定义，也没有完整inline定义
          console.warn(`[GameState] Failed to load battlefield condition: ${conditionRef.id}`);
        }
      } else {
        // 没有id，直接使用内联定义的条件
        conditions.push({
          ...conditionRef,
          source: 'phase'
        });
      }
    });
  }

  // 添加当前任务的限制条件
  if (currentMission && currentMission.missionConstraints) {
    currentMission.missionConstraints.forEach((constraint, index) => {
      // 确保约束有名称，否则跳过
      const constraintName = constraint.shortName || constraint.name;
      if (!constraintName) {
        console.warn('Mission constraint missing name:', constraint);
        return;
      }

      conditions.push({
        id: `mission_constraint_${index}`,
        name: constraintName,
        description: constraint.description || constraint.message || constraintName,
        isBuff: false, // 任务限制视为debuff
        source: 'mission'
      });
    });
  }

  return conditions;
}

/**
 * 添加日志条目的辅助函数
 */
function addLogEntry(state, message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // 支持对象类型的message（用于可点击日志）
  let logEntry = {
    id: `${Date.now()}_${logIdCounter++}`,
    timestamp,
    type,
    turn: state.turn
  };

  if (typeof message === 'object') {
    // message是对象，包含reportId等额外信息
    logEntry = { ...logEntry, ...message };
  } else {
    // message是字符串
    logEntry.message = message;
  }

  const newLog = [...state.battleLog, logEntry];

  // 保持最多 MAX_LOG_ENTRIES 条
  if (newLog.length > MAX_LOG_ENTRIES) {
    newLog.shift();
  }

  return newLog;
}

/**
 * Game State Reducer
 */
function gameStateReducer(state, action) {
  switch (action.type) {
    case ActionTypes.INIT_GAME: {
      const { starterCards, missions, essentialShopCards, randomShopDeck, randomShopSlots, leader, allCombatCards } = action.payload;

      // 计算初始商店槽位数（基础槽位 + 领袖能力）
      let actualRandomShopSlots = randomShopSlots || 6;
      if (leader) {
        const increaseShopAbility = leader.abilities?.find(
          ability => ability.type === 'increase_shop_slots'
        );
        if (increaseShopAbility) {
          actualRandomShopSlots += increaseShopAbility.value || 0;
        }
      }

      // 从随机商店堆中抽取初始卡牌
      const shuffledRandomDeck = shuffleDeck([...randomShopDeck]);
      const initialRandomShop = shuffledRandomDeck.slice(0, actualRandomShopSlots);
      const remainingRandomDeck = shuffledRandomDeck.slice(actualRandomShopSlots);

      // Leader card is deployed immediately and already ready (not tapped)
      const initialDeployed = leader ? [{ ...leader, status: 'ready' }] : [];

      // Calculate initial scout limit (base 1 + leader abilities)
      let initialScoutLimit = 1;
      if (leader && leader.abilities) {
        leader.abilities.forEach(ability => {
          if (ability.type === 'increase_scout_limit') {
            initialScoutLimit += ability.value || 0;
          }
        });
      }

      const newState = {
        ...initialState,
        randomShopSlots: randomShopSlots || 6, // 保存随机商店槽位数
        zones: {
          ...initialState.zones,
          discard: starterCards,
          deployed: initialDeployed, // Leader starts deployed
          essentialShop: essentialShopCards,
          randomShop: initialRandomShop,
          randomShopDeck: remainingRandomDeck,
          removed: []
        },
        missions: missions,
        currentMission: missions[0] || null,
        retireUsedThisTurn: false,
        usedAbilitiesThisTurn: {},
        scoutLimit: initialScoutLimit, // 设置初始侦查上限
        scoutUsed: 0, // 初始化侦查使用次数
        leader: leader || null, // Store leader reference
        allCombatCards: allCombatCards || [] // Store card definitions for snapshot updates
      };

      if (leader) {
        newState.battleLog = addLogEntry(newState, `👑 ${leader.name}加入指挥！`, 'system');

        // 处理 grant_card 效果（邓尼茨的狼群捕杀能力）
        leader.abilities?.forEach(ability => {
          if (ability.type === 'submarine_boost' && ability.effects) {
            ability.effects.forEach(effect => {
              if (effect.type === 'grant_card' && effect.cardId) {
                // 从 allCombatCards 中找到对应的卡牌定义
                const grantedCardDef = allCombatCards?.find(c => c.id === effect.cardId);
                if (grantedCardDef) {
                  // 创建新卡牌实例并添加到手牌
                  const newCard = {
                    ...grantedCardDef,
                    instanceId: `${grantedCardDef.id}_${Date.now()}_granted`,
                    status: 'ready'
                  };
                  newState.zones.hand = [...(newState.zones.hand || []), newCard];
                  newState.battleLog = addLogEntry(
                    newState,
                    `🎁 ${leader.name} - ${ability.name}：获得卡牌「${grantedCardDef.name}」`,
                    'system'
                  );
                }
              }
            });
          }
        });

        // 处理 supply_per_turn 效果（山本五十六的联合舰队能力）
        const supplyAbility = leader.abilities?.find(
          ability => ability.type === 'supply_per_turn' && ability.trigger === 'on_prepare_phase'
        );
        if (supplyAbility) {
          let supplyGain = 0;
          if (supplyAbility.value === 'current_phase') {
            // 游戏开始时，使用初始战略阶段数（默认为1，因为START_PHASE尚未调用）
            supplyGain = 1;
          } else {
            supplyGain = supplyAbility.value || 0;
          }

          if (supplyGain > 0) {
            newState.supply = supplyGain;
            newState.battleLog = addLogEntry(
              newState,
              `⚡ ${leader.name} - ${supplyAbility.name}：初始补给 +${supplyGain}`,
              'system'
            );
          }
        }
      }
      newState.battleLog = addLogEntry(newState, '🎮 游戏开始！准备迎接挑战...', 'system');
      return newState;
    }

    case ActionTypes.SET_PHASE:
      return { ...state, phase: action.payload };

    case ActionTypes.NEXT_PHASE: {
      const nextPhase = getNextPhase(state.phase);
      const isNewTurn = nextPhase === GamePhase.PREPARE;

      let newState = {
        ...state,
        phase: nextPhase,
        turn: isNewTurn ? state.turn + 1 : state.turn,
        turnsRemaining: isNewTurn && state.turnsRemaining > 0 ? state.turnsRemaining - 1 : state.turnsRemaining,
        retireUsedThisTurn: isNewTurn ? false : state.retireUsedThisTurn,
        usedAbilitiesThisTurn: isNewTurn ? {} : state.usedAbilitiesThisTurn,
        scoutUsed: isNewTurn ? 0 : state.scoutUsed, // 准备阶段重置侦查次数
        selectedForCombat: [] // 清除战斗选择状态
      };

      // 山本五十六的 supply_per_turn 能力（准备阶段开始时触发）
      if (isNewTurn && state.leader) {
        const supplyAbility = state.leader.abilities?.find(
          ability => ability.type === 'supply_per_turn' && ability.trigger === 'on_prepare_phase'
        );
        if (supplyAbility) {
          let supplyGain = 0;
          if (supplyAbility.value === 'current_phase') {
            // 根据当前战略阶段数给予补给（1-4）
            supplyGain = state.currentPhase || 1;
          } else {
            supplyGain = supplyAbility.value || 0;
          }

          if (supplyGain > 0) {
            newState.supply = (newState.supply || 0) + supplyGain;
            newState.battleLog = addLogEntry(
              newState,
              `⚡ ${state.leader.name} - ${supplyAbility.name}：补给 +${supplyGain}`,
              'system'
            );
          }
        }
      }

      // Check for phase completion at start of new turn
      if (isNewTurn && state.phaseData) {
        const phaseComplete = checkPhaseComplete(newState);
        if (phaseComplete) {
          // Main mission complete - ready for next phase
          // Note: Actual phase transition will be triggered by user interaction
          newState.battleLog = addLogEntry(
            newState,
            `✅ 阶段「${state.phaseData.name}」主线任务完成！`,
            'system'
          );
        } else if (newState.turnsRemaining === 0) {
          // Out of time - game over
          newState.battleLog = addLogEntry(
            newState,
            `⏰ 时间耗尽！未能完成主线任务「${state.currentMission?.name}」`,
            'system'
          );
          // Trigger game over
          newState.phase = GamePhase.GAME_OVER;
        }
      }

      // 在准备阶段刷新随机商店并补充缺失卡牌（除了游戏开始的第一回合）
      if (isNewTurn && state.turn >= 1) {
        // 计算实际槽位数量：基础槽位 + 部署区中expand_shop能力的总和 + 领袖increase_shop_slots能力
        let baseSlots = state.randomShopSlots || 6;

        // 检查恩斯特·金的 increase_shop_slots 能力
        if (state.leader) {
          const increaseShopAbility = state.leader.abilities?.find(
            ability => ability.type === 'increase_shop_slots'
          );
          if (increaseShopAbility) {
            baseSlots += increaseShopAbility.value || 0;
          }
        }

        const expandShopBonus = (state.zones.deployed || []).reduce((total, card) => {
          const expandAbility = card.abilities?.find(ab => ab.type === 'expand_shop');
          return total + (expandAbility?.value || 0);
        }, 0);
        const actualSlots = baseSlots + expandShopBonus;

        // 补充缺失的卡牌到商店
        const allCombatCards = state.allCombatCards || [];
        let newEssentialShop = [...state.zones.essentialShop];
        let newRandomShopDeck = [...state.zones.randomShopDeck];
        let addedCount = 0;

        allCombatCards.forEach(cardDef => {
          const cardId = cardDef.id;

          // 计算应有数量
          const essentialCopies = cardDef.essentialShopCopies !== undefined
            ? cardDef.essentialShopCopies
            : (cardDef.shopCopies !== undefined ? cardDef.shopCopies : 0);
          const randomCopies = cardDef.randomShopCopies !== undefined
            ? cardDef.randomShopCopies
            : (cardDef.shopCopies !== undefined ? cardDef.shopCopies : 0);

          // 计算当前在商店的数量
          const essentialShopCount = newEssentialShop.filter(c => c.id === cardId).length;
          const randomShopCount = (state.zones.randomShop || []).filter(c => c.id === cardId).length;
          const randomShopDeckCount = newRandomShopDeck.filter(c => c.id === cardId).length;

          // 计算玩家拥有的数量
          const deployedCount = (state.zones.deployed || []).filter(c => c.id === cardId).length;
          const handCount = (state.zones.hand || []).filter(c => c.id === cardId).length;
          const deckCount = (state.zones.deck || []).filter(c => c.id === cardId).length;
          const discardCount = (state.zones.discard || []).filter(c => c.id === cardId).length;
          const owned = deployedCount + handCount + deckCount + discardCount;

          // 计算essential商店需要补充的数量
          const essentialTotal = essentialShopCount + owned;
          const essentialMissing = essentialCopies - essentialTotal;
          if (essentialMissing > 0) {
            for (let i = 0; i < essentialMissing; i++) {
              newEssentialShop.push({
                ...cardDef,
                instanceId: `${cardId}_${Date.now()}_${Math.random()}`,
                status: 'ready'
              });
              addedCount++;
            }
          }

          // 计算random商店需要补充的数量
          const randomTotal = randomShopCount + randomShopDeckCount + owned;
          const randomMissing = randomCopies - randomTotal;
          if (randomMissing > 0) {
            for (let i = 0; i < randomMissing; i++) {
              newRandomShopDeck.push({
                ...cardDef,
                instanceId: `${cardId}_${Date.now()}_${Math.random()}`,
                status: 'ready'
              });
              addedCount++;
            }
          }
        });

        // 将当前随机商店中未购买的卡牌送回随机商店堆
        const returnedCards = state.zones.randomShop || [];
        const shuffledRandomDeck = shuffleDeck([...newRandomShopDeck, ...returnedCards]);

        // 从随机商店堆中抽取新卡牌
        const newRandomShop = shuffledRandomDeck.slice(0, actualSlots);
        const remainingDeck = shuffledRandomDeck.slice(actualSlots);

        newState.zones = {
          ...newState.zones,
          essentialShop: newEssentialShop,
          randomShop: newRandomShop,
          randomShopDeck: remainingDeck
        };

        // 添加日志
        const leaderBonus = (state.leader?.abilities?.find(ab => ab.type === 'increase_shop_slots')?.value || 0);
        const totalBonus = leaderBonus + expandShopBonus;
        let logMessage = `🔄 随机商店已刷新 (${newRandomShop.length}/${actualSlots} 张卡牌)`;
        if (totalBonus > 0) {
          logMessage += ` [+${totalBonus}]`;
        }
        if (addedCount > 0) {
          logMessage += ` [补充${addedCount}张]`;
        }
        newState.battleLog = addLogEntry(newState, logMessage, 'system');
      }

      return newState;
    }

    case ActionTypes.DRAW_CARDS: {
      const { count } = action.payload;
      const result = drawCards(state.zones.deck, state.zones.discard, count);
      return {
        ...state,
        zones: {
          ...state.zones,
          deck: result.newDeck,
          hand: [...state.zones.hand, ...result.drawnCards],
          discard: result.newDiscard
        }
      };
    }

    case ActionTypes.PLAY_CARD: {
      const { cardId } = action.payload;
      const card = state.zones.hand.find(c => c.instanceId === cardId);

      if (!card) return state;

      // 使用AbilitySystem处理能力
      const abilityResults = processAbilities(card, 'on_play', {
        state,
        card,
        phase: state.phase
      });

      // 使用AbilitySystem确定目标位置
      const destination = getCardDestination(card);

      // 移动卡牌到正确位置
      let newZones;
      if (destination === 'discard') {
        // 直接从手牌移动到弃牌堆
        const result = moveCard(cardId, state.zones.hand, state.zones.discard);
        if (!result) return state;

        // 确保进入弃牌堆的卡牌状态为ready（已就绪）
        const discardedCard = { ...result.movedCard, status: 'ready' };
        newZones = {
          ...state.zones,
          hand: result.newFromZone,
          discard: [...result.newToZone.slice(0, -1), discardedCard]
        };
      } else {
        // 移动到部署区
        const result = moveCard(cardId, state.zones.hand, state.zones.deployed);
        if (!result) return state;

        // 检查卡牌是否拥有扩容(expand_shop)或储备(max_supply)能力
        const hasExpandOrReserve = card.abilities?.some(ability =>
          ability.type === 'expand_shop' || ability.type === 'max_supply'
        );

        // 拥有扩容或储备能力的卡牌部署时为已就绪状态，其他卡牌为整备中状态
        const deployedCard = {
          ...result.movedCard,
          status: hasExpandOrReserve ? 'ready' : 'tapped'
        };
        const newDeployedZone = [...result.newToZone.slice(0, -1), deployedCard];

        newZones = {
          ...state.zones,
          hand: result.newFromZone,
          deployed: newDeployedZone
        };
      }

      // 处理on_deploy触发的能力（部署时立即生效）
      const onDeployAbilities = processAbilities(card, 'on_deploy', {
        state,
        card,
        phase: state.phase
      });

      // 应用能力效果（on_play + on_deploy）
      const allAbilityResults = [...abilityResults, ...onDeployAbilities];
      let newState = applyAbilityResults(state, allAbilityResults, newZones);

      // 更新统计
      newState = {
        ...newState,
        stats: {
          ...newState.stats,
          cardsPlayed: newState.stats.cardsPlayed + 1
        }
      };

      // 添加主日志（跳过补给类卡牌的日志）
      const hasSupplyAbility = card.abilities?.some(ability => ability.type === 'supply');
      if (!hasSupplyAbility) {
        let logMessage = `🃏 使用了「${card.name}」`;
        newState.battleLog = addLogEntry(newState, logMessage, 'action');
      }

      // 添加能力日志（跳过补给能力的日志）
      if (newState.abilityLogs && newState.abilityLogs.length > 0) {
        newState.abilityLogs.forEach(log => {
          // 跳过补给日志
          if (!log.includes('补给') || !hasSupplyAbility) {
            newState.battleLog = addLogEntry(newState, `  ↳ ${log}`, 'ability');
          }
        });
        // 清除临时日志
        delete newState.abilityLogs;
      }

      // 处理待执行的actions（如draw cards）
      if (newState.pendingActions && newState.pendingActions.length > 0) {
        newState.pendingActions.forEach(({ action: actionType, payload }) => {
          if (actionType === 'DRAW_CARDS') {
            const drawResult = drawCards(newState.zones.deck, newState.zones.discard, payload.count);
            newState.zones = {
              ...newState.zones,
              deck: drawResult.newDeck,
              hand: [...newState.zones.hand, ...drawResult.drawnCards],
              discard: drawResult.newDiscard
            };
          }
        });
        // 清除已执行的actions
        delete newState.pendingActions;
      }

      // 标记使用过的能力（用于once_per_turn约束）
      const abilitiesWithConstraints = card.abilities?.filter(a =>
        a.constraints && a.constraints.includes('once_per_turn')
      ) || [];
      if (abilitiesWithConstraints.length > 0) {
        const newUsedAbilities = { ...newState.usedAbilitiesThisTurn };
        abilitiesWithConstraints.forEach(ability => {
          const key = `${card.instanceId}_${ability.type}`;
          newUsedAbilities[key] = true;
        });
        newState.usedAbilitiesThisTurn = newUsedAbilities;
      }

      return newState;
    }

    case ActionTypes.TAP_CARD: {
      const { cardId } = action.payload;
      return {
        ...state,
        zones: {
          ...state.zones,
          deployed: setCardStatus(cardId, state.zones.deployed, 'tapped')
        }
      };
    }

    case ActionTypes.UNTAP_CARD: {
      const { cardId } = action.payload;
      return {
        ...state,
        zones: {
          ...state.zones,
          deployed: setCardStatus(cardId, state.zones.deployed, 'ready')
        }
      };
    }

    case ActionTypes.UNTAP_ALL_DEPLOYED: {
      // 批量整备所有部署区的整备中卡牌
      const newDeployed = state.zones.deployed.map(card =>
        card.status === 'tapped' ? { ...card, status: 'ready' } : card
      );
      return {
        ...state,
        zones: {
          ...state.zones,
          deployed: newDeployed
        }
      };
    }

    case ActionTypes.ADD_SUPPLY:
      return { ...state, supply: state.supply + action.payload };

    case ActionTypes.SPEND_SUPPLY: {
      const amount = action.payload;
      if (state.supply < amount) return state;
      return { ...state, supply: state.supply - amount };
    }

    case ActionTypes.PURCHASE_CARD: {
      const { cardId, shopType } = action.payload;

      let result;
      let newEssentialShop = state.zones.essentialShop;
      let newRandomShop = state.zones.randomShop;

      if (shopType === 'essential') {
        // 从必要商店购买（堆叠卡牌，保留在商店）
        result = moveCard(cardId, state.zones.essentialShop, state.zones.discard);
        if (!result) return state;
        newEssentialShop = result.newFromZone;
      } else {
        // 从随机商店购买（移除该卡牌）
        result = moveCard(cardId, state.zones.randomShop, state.zones.discard);
        if (!result) return state;
        newRandomShop = result.newFromZone;
      }

      // 给购买的卡牌添加shopType标记，这样损失后能返回正确的商店
      const purchasedCard = { ...result.movedCard, shopType };
      const newDiscard = [...result.newToZone];
      newDiscard[newDiscard.length - 1] = purchasedCard;

      const newState = {
        ...state,
        zones: {
          ...state.zones,
          essentialShop: newEssentialShop,
          randomShop: newRandomShop,
          discard: newDiscard
        },
        stats: {
          ...state.stats,
          cardsPurchased: state.stats.cardsPurchased + 1
        }
      };

      // 添加日志
      newState.battleLog = addLogEntry(
        newState,
        `💰 购买了「${result.movedCard.name}」(花费 ${result.movedCard.cost} 补给)`,
        'action'
      );

      return newState;
    }

    case ActionTypes.SELECT_FOR_COMBAT: {
      const { cardId } = action.payload;
      if (state.selectedForCombat.includes(cardId)) return state;
      return {
        ...state,
        selectedForCombat: [...state.selectedForCombat, cardId]
      };
    }

    case ActionTypes.DESELECT_FOR_COMBAT: {
      const { cardId } = action.payload;
      return {
        ...state,
        selectedForCombat: state.selectedForCombat.filter(id => id !== cardId)
      };
    }

    case ActionTypes.RESOLVE_COMBAT: {
      const { victory, cardsLost, combatResult } = action.payload;
      let newMissions = [...state.missions];
      let newCurrentMission = state.currentMission;
      let newStats = { ...state.stats };
      let newCompletedMissions = { ...state.completedMissions };

      if (victory) {
        // Check if this is a phase mission
        if (state.currentMission && state.currentMission.phase) {
          // Mark mission as complete
          const phaseKey = `phase_${state.currentPhase}`;
          const phaseCompletion = newCompletedMissions[phaseKey] || { main: false, side: [] };

          if (state.currentMission.missionType === 'main') {
            newCompletedMissions[phaseKey] = {
              ...phaseCompletion,
              main: true
            };
          } else if (state.currentMission.missionType === 'side') {
            newCompletedMissions[phaseKey] = {
              ...phaseCompletion,
              side: [...phaseCompletion.side, state.currentMission.id]
            };
            // 支线任务完成后自动切换回主线任务，但保留战场buff
            const mainMission = state.availableMissions?.find(m => m.missionType === 'main');
            if (mainMission) {
              newCurrentMission = mainMission;
              // 注意：战场条件的更新会在下面统一处理
            }
          }

          // Process mission rewards (will be applied in newState below)
          // Note: Actual reward application happens after creating newState
        } else {
          // Old mission system: remove from mission list
          newMissions = newMissions.slice(1);
          newCurrentMission = newMissions[0] || null;
        }

        newStats.battlesWon++;
      }

      // 将所有参战卡牌设为整备中状态
      let newDeployed = state.zones.deployed.map(card =>
        state.selectedForCombat.includes(card.instanceId)
          ? { ...card, status: 'tapped' }
          : card
      );

      // 移除损失的卡牌，根据返航能力和制空权决定去向
      let newEssentialShop = [...state.zones.essentialShop];
      let newRandomShopDeck = [...state.zones.randomShopDeck];
      let newDiscard = [...state.zones.discard];

      // 从 combatResult 获取制空权状态
      const airSuperiorityAchieved = combatResult?.airSuperiorityAchieved ?? false;

      // 检查邓尼茨的 submarine_return_to_discard 能力
      const submarineReturnToDiscard = state.leader?.abilities?.find(
        ability => ability.type === 'submarine_boost'
      )?.effects?.find(
        effect => effect.type === 'submarine_return_to_discard'
      );

      if (cardsLost.length > 0) {
        cardsLost.forEach(lostCardId => {
          const cardIndex = newDeployed.findIndex(c => c.instanceId === lostCardId);
          if (cardIndex !== -1) {
            const lostCard = { ...newDeployed[cardIndex], status: 'ready' };

            // 检查是否有返航能力且制空权满足
            const canReturnToBase = hasReturnToBaseAbility(lostCard) && airSuperiorityAchieved;

            // 检查是否是邓尼茨能力保护的潜艇/潜水航母
            const isProtectedSubmarine = submarineReturnToDiscard &&
              submarineReturnToDiscard.cardIds?.includes(lostCard.id);

            if (canReturnToBase || isProtectedSubmarine) {
              // 返航成功或邓尼茨保护：进入弃牌堆
              newDiscard.push(lostCard);
            } else {
              // 正常损失：根据shopType返回商店
              if (lostCard.shopType === 'essential') {
                newEssentialShop.push(lostCard);
              } else if (lostCard.shopType === 'random') {
                newRandomShopDeck.push(lostCard);
              }
              // 如果没有shopType（如战术卡），则移除
            }

            newDeployed.splice(cardIndex, 1);
          }
        });
      }

      let newState = {
        ...state,
        zones: {
          ...state.zones,
          deployed: newDeployed,
          discard: newDiscard,
          essentialShop: newEssentialShop,
          randomShopDeck: newRandomShopDeck
        },
        missions: newMissions,
        currentMission: newCurrentMission,
        selectedForCombat: [],
        stats: newStats,
        completedMissions: newCompletedMissions
      };

      // 如果支线任务完成后切换到了主线任务，需要更新战场条件
      if (victory && state.currentMission?.missionType === 'side' && newCurrentMission?.missionType === 'main') {
        // 构建新的战场条件（阶段全局buff + 主线任务限制）
        const baseBattlefieldConditions = buildBattlefieldConditions(state.phaseData, newCurrentMission);
        // 保留任务奖励buff
        const rewardBuffs = (state.battlefieldConditions || []).filter(
          condition => condition.source === 'reward'
        );
        // 合并条件
        newState.battlefieldConditions = [...baseBattlefieldConditions, ...rewardBuffs];
      }

      // 添加战斗日志
      const participatingCards = state.zones.deployed.filter(c =>
        state.selectedForCombat.includes(c.instanceId)
      );

      // 计算三种火力
      const groundPower = participatingCards.reduce((sum, c) => sum + (c.groundPower || 0), 0);
      const seaPower = participatingCards.reduce((sum, c) => sum + (c.seaPower || 0), 0);
      const airPower = participatingCards.reduce((sum, c) => sum + (c.airPower || 0), 0);

      let combatLog = `⚔️ 战斗！派出 ${participatingCards.length} 张卡牌 `;
      combatLog += `[地:${groundPower} 海:${seaPower} 空:${airPower}] `;
      combatLog += `对抗「${state.currentMission.name}」`;
      combatLog += `[需求 地:${state.currentMission.requiredGroundPower || 0} 海:${state.currentMission.requiredSeaPower || 0} 空:${state.currentMission.requiredAirPower || 0}]`;

      if (victory) {
        combatLog += ` → 🎉 胜利！`;
      } else {
        combatLog += ` → ❌ 失败...`;
      }

      newState.battleLog = addLogEntry(newState, combatLog, 'combat');

      // 保存完整战斗简报
      if (combatResult) {
        const reportId = `combat_${newState.turn}_${Date.now()}`;
        const combatReport = {
          id: reportId,
          turn: newState.turn,
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          mission: state.currentMission,
          participatingCards,
          ...combatResult
        };

        // 保存战斗简报（最多保留最近20场战斗）
        const newReports = [combatReport, ...state.combatReports].slice(0, 20);
        newState.combatReports = newReports;

        // 添加可点击的战斗简报链接（每次战斗都添加）
        const reportLog = {
          message: `📋 战斗结束`,
          reportId, // 关联战斗简报ID
          isClickable: true
        };
        newState.battleLog = addLogEntry(newState, reportLog, 'combat_report');
      } else {
        // 兼容旧代码：如果没有combatResult
        if (cardsLost.length > 0) {
          const lossLog = `💔 战斗损失 ${cardsLost.length} 张卡牌，已返回商店`;
          newState.battleLog = addLogEntry(newState, lossLog, 'loss');
        }
      }

      // Apply mission rewards if victory
      if (victory && state.currentMission && state.currentMission.reward) {
        const reward = state.currentMission.reward;

        // Supply reward
        if (reward.supply) {
          newState.supply = (newState.supply || 0) + reward.supply;
          newState.battleLog = addLogEntry(
            newState,
            `💰 任务奖励：获得${reward.supply}点补给`,
            'reward'
          );
        }

        // Extra turns reward
        if (reward.extraTurns) {
          newState.turnsRemaining += reward.extraTurns;
          newState.battleLog = addLogEntry(
            newState,
            `⏰ 任务奖励：增加${reward.extraTurns}回合`,
            'reward'
          );
        }

        // Card reward (create new card instance)
        if (reward.card) {
          // Find card definition from allCombatCards
          const cardDef = state.allCombatCards?.find(c => c.id === reward.card);
          if (cardDef) {
            // Create new card instance
            const newCardInstance = {
              ...cardDef,
              instanceId: `${cardDef.id}_${Date.now()}_reward`,
              status: 'ready'
            };
            // Add directly to hand
            newState.zones.hand = [...newState.zones.hand, newCardInstance];
            newState.battleLog = addLogEntry(
              newState,
              `🎁 任务奖励：获得卡牌「${cardDef.name.replace(/\n/g, '')}」`,
              'reward'
            );
          } else {
            console.error(`[GameState] Reward card not found: ${reward.card}`);
            newState.battleLog = addLogEntry(
              newState,
              `⚠️ 任务奖励卡牌「${reward.card}」未找到`,
              'error'
            );
          }
        }

        // Battlefield buff reward - support both inline and registry-based buffs
        if (reward.battlefieldBuff || reward.battlefieldBuffId) {
          let buffCondition = null;

          // Priority 1: Load from registry by ID
          if (reward.battlefieldBuffId) {
            buffCondition = createBattlefieldCondition(reward.battlefieldBuffId, {
              source: 'reward',
              appliedAt: newState.turn
            });
            if (!buffCondition) {
              console.error(`[GameState] Buff ID not found in registry: ${reward.battlefieldBuffId}`);
            }
          }

          // Priority 2: Use inline buff definition (backward compatibility)
          if (!buffCondition && reward.battlefieldBuff) {
            buffCondition = {
              ...reward.battlefieldBuff,
              source: 'reward',
              appliedAt: newState.turn
            };
          }

          if (buffCondition) {
            newState.battlefieldConditions = [
              ...newState.battlefieldConditions,
              buffCondition
            ];
            newState.battleLog = addLogEntry(
              newState,
              `⚡ 任务奖励：获得战场增益「${buffCondition.name}」`,
              'reward'
            );
          }
        }
      }

      return newState;
    }

    case ActionTypes.END_TURN: {
      // 弃掉所有手牌（确保状态为ready）
      const handCardsToDiscard = state.zones.hand.map(card => ({ ...card, status: 'ready' }));
      const newDiscard = [...state.zones.discard, ...handCardsToDiscard];
      // 清除超限补给
      const newSupply = Math.min(state.supply, state.maxSupplyRetention);

      return {
        ...state,
        zones: {
          ...state.zones,
          hand: [],
          discard: newDiscard
        },
        supply: newSupply,
        selectedForCombat: []
      };
    }

    case ActionTypes.UPDATE_MISSIONS:
      return {
        ...state,
        missions: action.payload,
        currentMission: action.payload[0] || null
      };

    case ActionTypes.SET_SHOP:
      return {
        ...state,
        zones: {
          ...state.zones,
          shop: action.payload
        }
      };

    case ActionTypes.REFRESH_RANDOM_SHOP: {
      let randomShopSlots = action.payload || 6;

      // 检查恩斯特·金的 increase_shop_slots 能力
      if (state.leader) {
        const increaseShopAbility = state.leader.abilities?.find(
          ability => ability.type === 'increase_shop_slots'
        );
        if (increaseShopAbility) {
          randomShopSlots += increaseShopAbility.value || 0;
        }
      }

      // 将当前随机商店中未购买的卡牌送回随机商店堆
      const returnedCards = state.zones.randomShop || [];
      const newRandomDeck = shuffleDeck([...state.zones.randomShopDeck, ...returnedCards]);

      // 从随机商店堆中抽取新卡牌
      const newRandomShop = newRandomDeck.slice(0, randomShopSlots);
      const remainingDeck = newRandomDeck.slice(randomShopSlots);

      return {
        ...state,
        zones: {
          ...state.zones,
          randomShop: newRandomShop,
          randomShopDeck: remainingDeck
        }
      };
    }

    case ActionTypes.GAME_OVER:
      return {
        ...state,
        phase: GamePhase.GAME_OVER,
        stats: {
          ...state.stats,
          totalTurns: state.turn
        }
      };

    case ActionTypes.RESET_GAME:
      return initialState;

    case ActionTypes.RETIRE_CARD: {
      const { cardId } = action.payload;
      const result = moveCard(cardId, state.zones.discard, state.zones.removed);
      if (!result) return state;

      const newState = {
        ...state,
        zones: {
          ...state.zones,
          discard: result.newFromZone,
          removed: result.newToZone
        },
        retireUsedThisTurn: true
      };

      // 添加日志
      newState.battleLog = addLogEntry(
        newState,
        `🗑️ 退役了「${result.movedCard.name}」，该卡牌已移除游戏`,
        'action'
      );

      return newState;
    }

    case ActionTypes.CLEAR_PENDING_INTERACTION: {
      const newState = { ...state };
      delete newState.pendingInteraction;
      return newState;
    }

    case ActionTypes.SCOUT_AND_TAP: {
      const { count, cardInstanceId } = action.payload;

      // 抽取卡牌
      const result = drawCards(state.zones.deck, state.zones.discard, count);

      // 将使用侦查能力的卡牌设为整备中状态
      const newDeployed = state.zones.deployed.map(card =>
        card.instanceId === cardInstanceId
          ? { ...card, status: 'tapped' }
          : card
      );

      const newState = {
        ...state,
        zones: {
          ...state.zones,
          deck: result.newDeck,
          hand: [...state.zones.hand, ...result.drawnCards],
          discard: result.newDiscard,
          deployed: newDeployed
        },
        scoutUsed: (state.scoutUsed || 0) + 1 // 增加侦查使用次数
      };

      // 添加日志
      newState.battleLog = addLogEntry(
        newState,
        `🔍 侦查：抽取了 ${result.drawnCards.length} 张卡牌（${newState.scoutUsed}/${state.scoutLimit}）`,
        'action'
      );

      return newState;
    }

    case ActionTypes.TRIGGER_DEPLOYED_ABILITY: {
      const { cardId, abilityType } = action.payload;

      // 找到部署区中的卡牌
      const card = state.zones.deployed.find(c => c.instanceId === cardId);
      if (!card) {
        console.error('Card not found in deployed zone:', cardId);
        return state;
      }

      // 处理能力
      const abilityResults = processAbilities(card, 'on_tap', {
        state,
        card,
        phase: state.phase
      });

      // 应用能力结果
      let newState = applyAbilityResults(state, abilityResults, state.zones);

      // 处理能力日志
      if (newState.abilityLogs && newState.abilityLogs.length > 0) {
        newState.abilityLogs.forEach(log => {
          newState.battleLog = addLogEntry(newState, log, 'action');
        });
        delete newState.abilityLogs;
      }

      // 处理待执行的actions（如侦查抽卡）
      if (newState.pendingActions && newState.pendingActions.length > 0) {
        newState.pendingActions.forEach(({ action: actionType, payload }) => {
          if (actionType === 'DRAW_CARDS') {
            const drawResult = drawCards(newState.zones.deck, newState.zones.discard, payload.count);
            newState.zones = {
              ...newState.zones,
              deck: drawResult.newDeck,
              hand: [...newState.zones.hand, ...drawResult.drawnCards],
              discard: drawResult.newDiscard
            };
          } else if (actionType === 'SCOUT_AND_TAP') {
            // 处理侦查能力：抽牌
            const drawResult = drawCards(newState.zones.deck, newState.zones.discard, payload.count);
            newState.zones = {
              ...newState.zones,
              deck: drawResult.newDeck,
              hand: [...newState.zones.hand, ...drawResult.drawnCards],
              discard: drawResult.newDiscard
            };
          }
        });
        delete newState.pendingActions;
      }

      return newState;
    }

    case ActionTypes.SORT_DEPLOYED: {
      if (state.zones.deployed.length === 0) return state;

      const getCardOrder = (card) => {
        if (card.type === 'leader') return -1; // Leader always first
        if (card.cardCategory === 'logistics' || card.cardCategory === 'tactical') return 0;
        if (card.unitType === 'navy') return 1;
        if (card.unitType === 'air') return 2;
        if (card.unitType === 'army') return 3;
        return 4;
      };

      const sortedDeployed = [...state.zones.deployed].sort((a, b) => {
        return getCardOrder(a) - getCardOrder(b);
      });

      return {
        ...state,
        zones: {
          ...state.zones,
          deployed: sortedDeployed
        }
      };
    }

    case ActionTypes.START_PHASE: {
      const { phaseNumber, allCombatCards } = action.payload;

      // Load phase data
      const phaseData = loadPhaseData(phaseNumber);
      const phaseMissions = loadPhaseMissions(phaseNumber);

      // Apply phase transition (handle card lifecycle)
      let newState = applyPhaseTransition(state, phaseData, phaseNumber, allCombatCards);

      // Store updated card definitions
      newState.allCombatCards = allCombatCards || state.allCombatCards || [];

      // Set up new phase
      const initialMission = phaseMissions.find(m => m.id === phaseData.mainMission) || phaseMissions[0];
      const initialBattlefieldConditions = buildBattlefieldConditions(phaseData, initialMission);

      // Calculate scout limit (base 1 + leader abilities)
      let scoutLimit = 1; // 基础侦查上限
      if (newState.zones && newState.zones.deployed) {
        newState.zones.deployed.forEach(card => {
          if (card.type === 'leader' && card.abilities) {
            card.abilities.forEach(ability => {
              if (ability.type === 'increase_scout_limit') {
                scoutLimit += ability.value || 0;
              }
            });
          }
        });
      }

      newState = {
        ...newState,
        currentPhase: phaseNumber,
        phaseData: phaseData,
        availableMissions: phaseMissions,
        currentMission: initialMission,
        turnsRemaining: phaseData.turnLimit,
        battlefieldConditions: initialBattlefieldConditions,
        scoutLimit: scoutLimit, // 设置侦查上限
        scoutUsed: 0, // 重置侦查使用次数
        completedMissions: {
          ...state.completedMissions,
          [`phase_${phaseNumber}`]: { main: false, side: [] }
        }
      };

      // Add log
      newState.battleLog = addLogEntry(
        newState,
        `🎯 进入新阶段：${phaseData.name}（剩余${phaseData.turnLimit}回合）`,
        'system'
      );

      return newState;
    }

    case ActionTypes.SELECT_MISSION: {
      const { missionId } = action.payload;
      const mission = state.availableMissions.find(m => m.id === missionId);

      if (!mission) return state;

      // 构建新的战场条件（阶段全局buff + 当前任务限制）
      const baseBattlefieldConditions = buildBattlefieldConditions(state.phaseData, mission);

      // 保留现有的任务奖励buff（source !== 'phase' 且 source !== 'mission'）
      const rewardBuffs = (state.battlefieldConditions || []).filter(
        condition => condition.source !== 'phase' && condition.source !== 'mission'
      );

      // 合并：阶段buff + 奖励buff + 新任务约束
      const newBattlefieldConditions = [...baseBattlefieldConditions, ...rewardBuffs];

      const newState = {
        ...state,
        currentMission: mission,
        battlefieldConditions: newBattlefieldConditions
      };

      newState.battleLog = addLogEntry(
        newState,
        `📋 切换任务：${mission.name}`,
        'system'
      );

      return newState;
    }

    case ActionTypes.COMPLETE_MISSION: {
      const { missionId, missionType } = action.payload;

      const phaseKey = `phase_${state.currentPhase}`;
      const phaseCompletion = state.completedMissions[phaseKey] || { main: false, side: [] };

      let newCompletedMissions;
      if (missionType === 'main') {
        newCompletedMissions = {
          ...state.completedMissions,
          [phaseKey]: {
            ...phaseCompletion,
            main: true
          }
        };
      } else {
        newCompletedMissions = {
          ...state.completedMissions,
          [phaseKey]: {
            ...phaseCompletion,
            side: [...phaseCompletion.side, missionId]
          }
        };
      }

      return {
        ...state,
        completedMissions: newCompletedMissions
      };
    }

    case ActionTypes.DEBUG_ADD_BUFF: {
      const { buffId } = action.payload;
      const buffCondition = createBattlefieldCondition(buffId, {
        source: 'debug',
        appliedAt: state.turn
      });

      if (!buffCondition) {
        console.error(`[DEBUG] Buff ID not found: ${buffId}`);
        return state;
      }

      const newState = {
        ...state,
        battlefieldConditions: [
          ...state.battlefieldConditions,
          buffCondition
        ]
      };

      newState.battleLog = addLogEntry(
        newState,
        `🐛 DEBUG: 添加buff「${buffCondition.name}」`,
        'debug'
      );

      return newState;
    }

    case ActionTypes.DEBUG_REMOVE_BUFF: {
      const { buffIndex } = action.payload;
      const removedBuff = state.battlefieldConditions[buffIndex];

      if (!removedBuff) {
        console.warn(`[DEBUG] Buff index out of range: ${buffIndex}`);
        return state;
      }

      const newState = {
        ...state,
        battlefieldConditions: state.battlefieldConditions.filter(
          (_, index) => index !== buffIndex
        )
      };

      newState.battleLog = addLogEntry(
        newState,
        `🐛 DEBUG: 移除buff「${removedBuff.name}」`,
        'debug'
      );

      return newState;
    }

    case ActionTypes.DEBUG_SAVE_SNAPSHOT: {
      // Serialize SELECTIVE state for debug purposes
      const snapshot = {
        version: "2.0.0-selective",
        snapshotType: "debug-minimal",
        timestamp: new Date().toISOString(),
        warning: "此快照仅用于调试卡牌组合，不适合完整游戏恢复",
        metadata: {
          turn: state.turn,
          phase: state.phase,
          currentPhase: state.currentPhase
        },
        zones: {
          deck: state.zones.deck,
          hand: state.zones.hand,
          deployed: state.zones.deployed,
          discard: state.zones.discard
        },
        gameState: {
          supply: state.supply,
          maxSupplyRetention: state.maxSupplyRetention,
          scoutLimit: state.scoutLimit,
          scoutUsed: state.scoutUsed
        },
        leader: state.leader
      };

      // Trigger file download with "debug" prefix
      const jsonStr = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `snapshot-debug-turn${state.turn}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Add log entry with clarification
      const newState = { ...state };
      newState.battleLog = addLogEntry(
        newState,
        `💾 调试快照已保存 (回合 ${state.turn}, 仅卡牌区域)`,
        'debug'
      );

      return newState;
    }

    case ActionTypes.DEBUG_LOAD_SNAPSHOT: {
      const { snapshot } = action.payload;

      // Enhanced validation for selective snapshot
      if (!snapshot.version || !snapshot.zones || !snapshot.gameState) {
        alert('快照加载失败：缺少必需字段 (version, zones, gameState)');
        console.error('[DEBUG] Invalid snapshot format', snapshot);
        return state;
      }

      // Check if this is a selective (debug) snapshot
      const isSelectiveSnapshot = snapshot.version.includes('selective') || snapshot.snapshotType === 'debug-minimal';

      // Version validation
      if (!snapshot.version.startsWith('2.0')) {
        const proceed = window.confirm(
          `快照版本不匹配：${snapshot.version}\n` +
          '这是旧版本快照，可能无法正常加载。是否继续？'
        );
        if (!proceed) {
          return state;
        }
      }

      // Validate essential fields exist
      const requiredFields = ['deck', 'hand', 'deployed', 'discard'];
      const missingZones = requiredFields.filter(zone => !snapshot.zones[zone]);
      if (missingZones.length > 0) {
        alert(`快照加载失败：缺少卡牌区域 - ${missingZones.join(', ')}`);
        console.error('[DEBUG] Missing zones:', missingZones);
        return state;
      }

      // Helper function: Update card with latest definitions from combat.json
      const updateCardDefinition = (snapshotCard) => {
        if (!state.allCombatCards || state.allCombatCards.length === 0) {
          // No card definitions available, use snapshot data as-is
          return snapshotCard;
        }

        // Find matching card definition by id
        const latestDef = state.allCombatCards.find(def => def.id === snapshotCard.id);
        if (!latestDef) {
          // Card not found in current definitions (maybe removed/renamed), keep snapshot version
          console.warn(`[DEBUG] Card ${snapshotCard.id} not found in current combat.json`);
          return snapshotCard;
        }

        // Merge: take latest stats/abilities from combat.json, keep snapshot state (instanceId, status, tapped)
        return {
          ...latestDef, // Use latest card definition
          instanceId: snapshotCard.instanceId, // Preserve instance identity
          status: snapshotCard.status, // Preserve status (ready/tapped)
          // Note: Leader cards and mission cards are handled separately, but this works for combat cards
        };
      };

      // Update all card zones with latest definitions
      const updatedDeck = snapshot.zones.deck.map(updateCardDefinition);
      const updatedHand = snapshot.zones.hand.map(updateCardDefinition);
      const updatedDeployed = snapshot.zones.deployed.map(card => {
        // Leader cards might not be in allCombatCards, handle separately
        if (card.type === 'leader') {
          return card; // Keep leader as-is
        }
        return updateCardDefinition(card);
      });
      const updatedDiscard = snapshot.zones.discard.map(updateCardDefinition);

      // Restore selective state, keep current non-saved state
      const restoredState = {
        ...state, // Keep current state as base
        turn: snapshot.metadata.turn,
        phase: snapshot.metadata.phase,
        currentPhase: snapshot.metadata.currentPhase,
        zones: {
          ...state.zones, // Keep current shop zones - BUT they may be mismatched!
          deck: updatedDeck,
          hand: updatedHand,
          deployed: updatedDeployed,
          discard: updatedDiscard
        },
        supply: snapshot.gameState.supply,
        maxSupplyRetention: snapshot.gameState.maxSupplyRetention,
        scoutLimit: snapshot.gameState.scoutLimit || 1, // Default if missing
        scoutUsed: snapshot.gameState.scoutUsed || 0,
        leader: snapshot.leader || state.leader, // Keep current leader if missing
        // Clear transient state
        selectedForCombat: [],
        retireUsedThisTurn: false,
        usedAbilitiesThisTurn: {},
        // Mark that shops need rebuild (will be handled by next phase transition or user can manually switch phase)
        snapshotLoadedPhase: snapshot.metadata.currentPhase
      };

      // Add log entry
      const reloadPhaseFlag = action.payload.reloadPhase;
      let logMessage = `📂 调试快照已加载 (原回合 ${snapshot.metadata.turn})${isSelectiveSnapshot ? ' [仅卡牌区域]' : ''}`;
      if (reloadPhaseFlag) {
        logMessage += ' - 将重载阶段数据...';
      }

      restoredState.battleLog = addLogEntry(
        restoredState,
        logMessage,
        'debug'
      );

      return restoredState;
    }

    default:
      return state;
  }
}

/**
 * Game State Provider
 */
export function GameStateProvider({ children }) {
  const [state, dispatch] = useReducer(gameStateReducer, initialState);

  // Actions
  const actions = {
    initGame: useCallback((starterCards, missions, essentialShopCards, randomShopDeck, randomShopSlots, leader, allCombatCards) => {
      dispatch({
        type: ActionTypes.INIT_GAME,
        payload: { starterCards, missions, essentialShopCards, randomShopDeck, randomShopSlots, leader, allCombatCards }
      });
    }, []),

    setPhase: useCallback((phase) => {
      dispatch({ type: ActionTypes.SET_PHASE, payload: phase });
    }, []),

    nextPhase: useCallback(() => {
      dispatch({ type: ActionTypes.NEXT_PHASE });
    }, []),

    drawCards: useCallback((count = 5) => {
      dispatch({ type: ActionTypes.DRAW_CARDS, payload: { count } });
    }, []),

    playCard: useCallback((cardId) => {
      dispatch({ type: ActionTypes.PLAY_CARD, payload: { cardId } });
    }, []),

    tapCard: useCallback((cardId) => {
      dispatch({ type: ActionTypes.TAP_CARD, payload: { cardId } });
    }, []),

    untapCard: useCallback((cardId) => {
      dispatch({ type: ActionTypes.UNTAP_CARD, payload: { cardId } });
    }, []),

    untapAllDeployed: useCallback(() => {
      dispatch({ type: ActionTypes.UNTAP_ALL_DEPLOYED });
    }, []),

    addSupply: useCallback((amount) => {
      dispatch({ type: ActionTypes.ADD_SUPPLY, payload: amount });
    }, []),

    spendSupply: useCallback((amount) => {
      dispatch({ type: ActionTypes.SPEND_SUPPLY, payload: amount });
    }, []),

    purchaseCard: useCallback((cardId, shopType) => {
      dispatch({ type: ActionTypes.PURCHASE_CARD, payload: { cardId, shopType } });
    }, []),

    selectForCombat: useCallback((cardId) => {
      dispatch({ type: ActionTypes.SELECT_FOR_COMBAT, payload: { cardId } });
    }, []),

    deselectForCombat: useCallback((cardId) => {
      dispatch({ type: ActionTypes.DESELECT_FOR_COMBAT, payload: { cardId } });
    }, []),

    resolveCombat: useCallback((victory, cardsLost, combatResult = null) => {
      dispatch({
        type: ActionTypes.RESOLVE_COMBAT,
        payload: { victory, cardsLost, combatResult }
      });
    }, []),

    endTurn: useCallback(() => {
      dispatch({ type: ActionTypes.END_TURN });
    }, []),

    updateMissions: useCallback((missions) => {
      dispatch({ type: ActionTypes.UPDATE_MISSIONS, payload: missions });
    }, []),

    setShop: useCallback((shopCards) => {
      dispatch({ type: ActionTypes.SET_SHOP, payload: shopCards });
    }, []),

    refreshRandomShop: useCallback((slots = 6) => {
      dispatch({ type: ActionTypes.REFRESH_RANDOM_SHOP, payload: slots });
    }, []),

    gameOver: useCallback(() => {
      dispatch({ type: ActionTypes.GAME_OVER });
    }, []),

    resetGame: useCallback(() => {
      dispatch({ type: ActionTypes.RESET_GAME });
    }, []),

    retireCard: useCallback((cardId) => {
      dispatch({ type: ActionTypes.RETIRE_CARD, payload: { cardId } });
    }, []),

    clearPendingInteraction: useCallback(() => {
      dispatch({ type: ActionTypes.CLEAR_PENDING_INTERACTION });
    }, []),

    triggerDeployedAbility: useCallback((cardId, abilityType) => {
      dispatch({ type: ActionTypes.TRIGGER_DEPLOYED_ABILITY, payload: { cardId, abilityType } });
    }, []),

    scoutAndTap: useCallback((count, cardInstanceId) => {
      dispatch({
        type: ActionTypes.SCOUT_AND_TAP,
        payload: { count, cardInstanceId }
      });
    }, []),

    sortDeployed: useCallback(() => {
      dispatch({ type: ActionTypes.SORT_DEPLOYED });
    }, []),

    // Strategic Phase System Actions
    startPhase: useCallback((phaseNumber, allCombatCards) => {
      dispatch({ type: ActionTypes.START_PHASE, payload: { phaseNumber, allCombatCards } });
    }, []),

    selectMission: useCallback((missionId) => {
      dispatch({ type: ActionTypes.SELECT_MISSION, payload: { missionId } });
    }, []),

    completeMission: useCallback((missionId, missionType) => {
      dispatch({ type: ActionTypes.COMPLETE_MISSION, payload: { missionId, missionType } });
    }, []),

    // Debug Actions
    debugAddBuff: useCallback((buffId) => {
      dispatch({ type: ActionTypes.DEBUG_ADD_BUFF, payload: { buffId } });
    }, []),

    debugRemoveBuff: useCallback((buffIndex) => {
      dispatch({ type: ActionTypes.DEBUG_REMOVE_BUFF, payload: { buffIndex } });
    }, []),

    debugSaveSnapshot: useCallback(() => {
      dispatch({ type: ActionTypes.DEBUG_SAVE_SNAPSHOT });
    }, []),

    debugLoadSnapshot: useCallback((snapshot, reloadPhase = false) => {
      dispatch({ type: ActionTypes.DEBUG_LOAD_SNAPSHOT, payload: { snapshot, reloadPhase } });
    }, [])
  };

  return (
    <GameStateContext.Provider value={{ state, actions }}>
      {children}
    </GameStateContext.Provider>
  );
}

/**
 * Hook to use game state
 */
export function useGameState() {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error('useGameState must be used within GameStateProvider');
  }
  return context;
}
