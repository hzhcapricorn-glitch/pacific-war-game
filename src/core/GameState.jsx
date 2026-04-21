import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { GamePhase, getNextPhase } from '../models/GamePhase';
import { drawCards, moveCard, setCardStatus, shuffleDeck, createDeck } from './CardEngine';
import { getCardAbilityEffects, isSupplyCard } from '../models/Card';

/**
 * 初始游戏状态
 */
const initialState = {
  phase: GamePhase.PREPARE,
  turn: 1,
  supply: 0,
  maxSupplyRetention: 0,
  zones: {
    deck: [],
    hand: [],
    deployed: [],
    discard: [],
    shop: []
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
  battleLog: [] // 战场简讯日志（最多20条）
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
  GAME_OVER: 'GAME_OVER',
  RESET_GAME: 'RESET_GAME',
  ADD_LOG: 'ADD_LOG'
};

/**
 * 添加日志条目的辅助函数
 */
function addLogEntry(state, message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const newLog = [...state.battleLog, {
    id: Date.now(),
    timestamp,
    message,
    type,
    turn: state.turn
  }];

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
      const { starterCards, missions, shopCards } = action.payload;
      const newState = {
        ...initialState,
        zones: {
          ...initialState.zones,
          discard: starterCards,
          shop: shopCards
        },
        missions: missions,
        currentMission: missions[0] || null
      };
      newState.battleLog = addLogEntry(newState, '🎮 游戏开始！准备迎接挑战...', 'system');
      return newState;
    }

    case ActionTypes.SET_PHASE:
      return { ...state, phase: action.payload };

    case ActionTypes.NEXT_PHASE: {
      const nextPhase = getNextPhase(state.phase);
      return {
        ...state,
        phase: nextPhase,
        turn: nextPhase === GamePhase.PREPARE ? state.turn + 1 : state.turn
      };
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

      // 执行卡牌能力
      const effects = getCardAbilityEffects(card);

      // 判断卡牌是否应该直接进弃牌堆
      // 补给类卡牌直接进弃牌堆
      const shouldDiscard = isSupplyCard(card);

      let newZones;
      if (shouldDiscard) {
        // 直接从手牌移动到弃牌堆
        const result = moveCard(cardId, state.zones.hand, state.zones.discard);
        if (!result) return state;

        // 确保进入弃牌堆的卡牌状态为ready（不横置）
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

        newZones = {
          ...state.zones,
          hand: result.newFromZone,
          deployed: result.newToZone
        };
      }

      const newState = {
        ...state,
        zones: newZones,
        supply: state.supply + effects.supply,
        maxSupplyRetention: state.maxSupplyRetention + effects.maxSupply,
        stats: {
          ...state.stats,
          cardsPlayed: state.stats.cardsPlayed + 1
        }
      };

      // 添加日志
      let logMessage = `🃏 使用了「${card.name}」`;
      if (effects.supply > 0) logMessage += `，获得 ${effects.supply} 点补给`;
      if (effects.draw > 0) logMessage += `，抽取 ${effects.draw} 张卡牌`;
      if (effects.maxSupply > 0) logMessage += `，最大补给保留 +${effects.maxSupply}`;
      newState.battleLog = addLogEntry(newState, logMessage, 'action');

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
      const { cardId } = action.payload;
      const result = moveCard(cardId, state.zones.shop, state.zones.discard);
      if (!result) return state;

      const newState = {
        ...state,
        zones: {
          ...state.zones,
          shop: result.newFromZone,
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
      const { victory, cardsLost } = action.payload;
      let newMissions = [...state.missions];
      let newCurrentMission = state.currentMission;
      let newStats = { ...state.stats };

      if (victory) {
        // 移除完成的任务
        newMissions = newMissions.slice(1);
        newCurrentMission = newMissions[0] || null;
        newStats.battlesWon++;
      }

      // 横置所有参战卡牌
      let newDeployed = state.zones.deployed.map(card =>
        state.selectedForCombat.includes(card.instanceId)
          ? { ...card, status: 'tapped' }
          : card
      );

      // 移除损失的卡牌，返回商店（重置状态为ready）
      let newShop = [...state.zones.shop];
      if (cardsLost.length > 0) {
        cardsLost.forEach(lostCardId => {
          const cardIndex = newDeployed.findIndex(c => c.instanceId === lostCardId);
          if (cardIndex !== -1) {
            const lostCard = { ...newDeployed[cardIndex], status: 'ready' };
            newShop.push(lostCard);
            newDeployed.splice(cardIndex, 1);
          }
        });
      }

      const newState = {
        ...state,
        zones: {
          ...state.zones,
          deployed: newDeployed,
          shop: newShop
        },
        missions: newMissions,
        currentMission: newCurrentMission,
        selectedForCombat: [],
        stats: newStats
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

      // 添加损失日志
      if (cardsLost.length > 0) {
        const lossLog = `💔 战斗损失 ${cardsLost.length} 张卡牌，已返回商店`;
        newState.battleLog = addLogEntry(newState, lossLog, 'loss');
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
    initGame: useCallback((starterCards, missions, shopCards) => {
      dispatch({
        type: ActionTypes.INIT_GAME,
        payload: { starterCards, missions, shopCards }
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

    purchaseCard: useCallback((cardId) => {
      dispatch({ type: ActionTypes.PURCHASE_CARD, payload: { cardId } });
    }, []),

    selectForCombat: useCallback((cardId) => {
      dispatch({ type: ActionTypes.SELECT_FOR_COMBAT, payload: { cardId } });
    }, []),

    deselectForCombat: useCallback((cardId) => {
      dispatch({ type: ActionTypes.DESELECT_FOR_COMBAT, payload: { cardId } });
    }, []),

    resolveCombat: useCallback((victory, cardsLost) => {
      dispatch({
        type: ActionTypes.RESOLVE_COMBAT,
        payload: { victory, cardsLost }
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

    gameOver: useCallback(() => {
      dispatch({ type: ActionTypes.GAME_OVER });
    }, []),

    resetGame: useCallback(() => {
      dispatch({ type: ActionTypes.RESET_GAME });
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
