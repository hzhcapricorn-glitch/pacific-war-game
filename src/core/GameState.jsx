import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { GamePhase, getNextPhase } from '../models/GamePhase';
import { drawCards, moveCard, setCardStatus, shuffleDeck, createDeck } from './CardEngine';
import { getCardAbilityEffects, isSupplyCard } from '../models/Card';
import { processAbilities, getCardDestination, applyAbilityResults } from './AbilitySystem';
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

  // Strategic Phase System
  currentPhase: 1, // Current strategic phase number
  phaseData: null, // Current phase definition
  availableMissions: [], // All missions for current phase
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
  COMPLETE_MISSION: 'COMPLETE_MISSION'
};

/**
 * 添加日志条目的辅助函数
 */
function addLogEntry(state, message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // 支持对象类型的message（用于可点击日志）
  let logEntry = {
    id: Date.now(),
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
      const { starterCards, missions, essentialShopCards, randomShopDeck, randomShopSlots } = action.payload;

      // 从随机商店堆中抽取初始卡牌
      const shuffledRandomDeck = shuffleDeck([...randomShopDeck]);
      const initialRandomShop = shuffledRandomDeck.slice(0, randomShopSlots);
      const remainingRandomDeck = shuffledRandomDeck.slice(randomShopSlots);

      const newState = {
        ...initialState,
        randomShopSlots: randomShopSlots || 6, // 保存随机商店槽位数
        zones: {
          ...initialState.zones,
          discard: starterCards,
          essentialShop: essentialShopCards,
          randomShop: initialRandomShop,
          randomShopDeck: remainingRandomDeck,
          removed: []
        },
        missions: missions,
        currentMission: missions[0] || null,
        retireUsedThisTurn: false,
        usedAbilitiesThisTurn: {}
      };
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
        usedAbilitiesThisTurn: isNewTurn ? {} : state.usedAbilitiesThisTurn
      };

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

      // 在准备阶段刷新随机商店（除了游戏开始的第一回合）
      if (isNewTurn && state.turn >= 1) {
        // 计算实际槽位数量：基础槽位 + 部署区中expand_shop能力的总和
        const baseSlots = state.randomShopSlots || 6;
        const expandShopBonus = (state.zones.deployed || []).reduce((total, card) => {
          const expandAbility = card.abilities?.find(ab => ab.type === 'expand_shop');
          return total + (expandAbility?.value || 0);
        }, 0);
        const actualSlots = baseSlots + expandShopBonus;

        // 将当前随机商店中未购买的卡牌送回随机商店堆
        const returnedCards = state.zones.randomShop || [];
        const newRandomDeck = shuffleDeck([...state.zones.randomShopDeck, ...returnedCards]);

        // 从随机商店堆中抽取新卡牌
        const newRandomShop = newRandomDeck.slice(0, actualSlots);
        const remainingDeck = newRandomDeck.slice(actualSlots);

        newState.zones = {
          ...newState.zones,
          randomShop: newRandomShop,
          randomShopDeck: remainingDeck
        };

        // 添加日志
        let logMessage = `🔄 随机商店已刷新 (${newRandomShop.length}/${actualSlots} 张卡牌)`;
        if (expandShopBonus > 0) {
          logMessage += ` [+${expandShopBonus}]`;
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

      const newState = {
        ...state,
        zones: {
          ...state.zones,
          essentialShop: newEssentialShop,
          randomShop: newRandomShop,
          discard: result.newToZone
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

          if (state.currentMission.type === 'main') {
            newCompletedMissions[phaseKey] = {
              ...phaseCompletion,
              main: true
            };
          } else if (state.currentMission.type === 'side') {
            newCompletedMissions[phaseKey] = {
              ...phaseCompletion,
              side: [...phaseCompletion.side, state.currentMission.id]
            };
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

      // 移除损失的卡牌，根据shopType返回到相应位置
      let newEssentialShop = [...state.zones.essentialShop];
      let newRandomShopDeck = [...state.zones.randomShopDeck];

      if (cardsLost.length > 0) {
        cardsLost.forEach(lostCardId => {
          const cardIndex = newDeployed.findIndex(c => c.instanceId === lostCardId);
          if (cardIndex !== -1) {
            const lostCard = { ...newDeployed[cardIndex], status: 'ready' };
            // 根据shopType决定返回位置
            if (lostCard.shopType === 'essential') {
              newEssentialShop.push(lostCard);
            } else if (lostCard.shopType === 'random') {
              newRandomShopDeck.push(lostCard);
            }
            // 如果没有shopType（如战术卡），则移除
            newDeployed.splice(cardIndex, 1);
          }
        });
      }

      const newState = {
        ...state,
        zones: {
          ...state.zones,
          deployed: newDeployed,
          essentialShop: newEssentialShop,
          randomShopDeck: newRandomShopDeck
        },
        missions: newMissions,
        currentMission: newCurrentMission,
        selectedForCombat: [],
        stats: newStats,
        completedMissions: newCompletedMissions
      };

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

        // 添加可点击的损失日志
        if (cardsLost.length > 0) {
          const lossLog = {
            message: `💔 战斗结束`,
            reportId, // 关联战斗简报ID
            isClickable: true
          };
          newState.battleLog = addLogEntry(newState, lossLog, 'combat_report');
        }
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
          // Note: Card creation would require importing card data
          // For now, log it - implementation can be added later
          newState.battleLog = addLogEntry(
            newState,
            `🎁 任务奖励：获得卡牌「${reward.card}」`,
            'reward'
          );
        }

        // Battlefield buff reward
        if (reward.battlefieldBuff) {
          newState.battlefieldConditions = [
            ...newState.battlefieldConditions,
            reward.battlefieldBuff
          ];
          newState.battleLog = addLogEntry(
            newState,
            `⚡ 任务奖励：获得战场增益「${reward.battlefieldBuff.name}」`,
            'reward'
          );
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
      const randomShopSlots = action.payload || 6;

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
        }
      };

      // 添加日志
      newState.battleLog = addLogEntry(
        newState,
        `🔍 侦查：抽取了 ${result.drawnCards.length} 张卡牌`,
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
      const { phaseNumber } = action.payload;

      // Load phase data
      const phaseData = loadPhaseData(phaseNumber);
      const phaseMissions = loadPhaseMissions(phaseNumber);

      // Apply phase transition (handle card lifecycle)
      let newState = applyPhaseTransition(state, phaseData);

      // Set up new phase
      newState = {
        ...newState,
        currentPhase: phaseNumber,
        phaseData: phaseData,
        availableMissions: phaseMissions,
        currentMission: phaseMissions.find(m => m.id === phaseData.mainMission) || phaseMissions[0],
        turnsRemaining: phaseData.turnLimit,
        battlefieldConditions: phaseData.battlefieldConditions || [],
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

      const newState = {
        ...state,
        currentMission: mission
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
    initGame: useCallback((starterCards, missions, essentialShopCards, randomShopDeck, randomShopSlots) => {
      dispatch({
        type: ActionTypes.INIT_GAME,
        payload: { starterCards, missions, essentialShopCards, randomShopDeck, randomShopSlots }
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
    startPhase: useCallback((phaseNumber) => {
      dispatch({ type: ActionTypes.START_PHASE, payload: { phaseNumber } });
    }, []),

    selectMission: useCallback((missionId) => {
      dispatch({ type: ActionTypes.SELECT_MISSION, payload: { missionId } });
    }, []),

    completeMission: useCallback((missionId, missionType) => {
      dispatch({ type: ActionTypes.COMPLETE_MISSION, payload: { missionId, missionType } });
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
