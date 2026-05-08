import React, { useState, useEffect, useCallback } from 'react';
import { useGameState } from '../core/GameState.jsx';
import { GamePhase, PhaseDisplayName } from '../models/GamePhase';
import Card from './Card';
import CardZone from './CardZone';
import CardStack from './CardStack';
import MissionDisplay from './MissionDisplay';
import Shop from './Shop';
import CardListModal from './CardListModal';
import BattleLog from './BattleLog';
import CombatReportModal from './CombatReportModal';
import PhaseTransitionModal from './PhaseTransitionModal';
import MissionSelectionModal from './MissionSelectionModal';
import LeaderSelectionModal from './LeaderSelectionModal';
import BattlefieldConditions from './BattlefieldConditions';
import DebugBuffPanel from './DebugBuffPanel';
import DebugMissionSwitchModal from './DebugMissionSwitchModal';
import Manual from './Manual';

// 导入卡牌数据
import combatCardsData from '../data/cards/combat.json';
import missionCardsData from '../data/cards/mission.json';
import missionPhase1Data from '../data/cards/mission_phase1.json';
import missionPhase2Data from '../data/cards/mission_phase2.json';
import missionPhase3Data from '../data/cards/mission_phase3.json';
import missionPhase4Data from '../data/cards/mission_phase4.json';
import leaderCardsData from '../data/cards/leader.json';
import gameConfig from '../data/config.json';
import { createCard } from '../models/Card';
import { shuffleDeck } from '../core/CardEngine';
import { resolveCombat, getCombatSummary, calculateCombatPower, calculateAllFirePowers } from '../core/CombatSystem';
import { canParticipateInCombat } from '../core/AbilitySystem';
import { getCardShopType, getCardShopCopies } from '../core/ShopSystem';
import { loadPhaseData, isCardBlockedByConditions, getEffectiveDrawCount } from '../core/PhaseSystem';
import { applyBuffsToMissionRequirements } from '../core/BuffSystem';

/**
 * GameBoard Component - 主游戏面板
 */
function GameBoard() {
  const { state, actions } = useGameState();
  const [hoveredCard, setHoveredCard] = useState(null);
  const [gameInitialized, setGameInitialized] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showRetireModal, setShowRetireModal] = useState(false);
  const [showQuickResponseModal, setShowQuickResponseModal] = useState(false);
  const [showCombatReportModal, setShowCombatReportModal] = useState(false);
  const [currentReport, setCurrentReport] = useState(null);
  const [activeAbilityCardId, setActiveAbilityCardId] = useState(null); // 记录正在使用能力的卡牌ID（用于排除自身）
  const [supplyChanged, setSupplyChanged] = useState(false);
  const [prevSupply, setPrevSupply] = useState(0);
  // Strategic Phase System modals
  const [showPhaseTransitionModal, setShowPhaseTransitionModal] = useState(false);
  const [showMissionSelectionModal, setShowMissionSelectionModal] = useState(false);
  // Leader selection
  const [showLeaderSelectionModal, setShowLeaderSelectionModal] = useState(false);
  const [selectedLeader, setSelectedLeader] = useState(null);
  const [availableLeaders, setAvailableLeaders] = useState([]);
  // Debug buff panel
  const [showDebugBuffPanel, setShowDebugBuffPanel] = useState(false);
  // Debug mission switch
  const [showDebugMissionSwitch, setShowDebugMissionSwitch] = useState(false);
  // Manual
  const [showManual, setShowManual] = useState(false);
  // Track if phase transition is in progress
  const phaseTransitionInProgress = React.useRef(false);

  // 初始化游戏 - 显示领袖选择
  useEffect(() => {
    if (!gameInitialized && state.zones.discard.length === 0) {
      // Load available leaders
      const leaders = leaderCardsData.map((l, idx) => createCard(l, `${l.id}_${idx}`));
      setAvailableLeaders(leaders);
      setShowLeaderSelectionModal(true);
      setGameInitialized(true);
    }
  }, [gameInitialized, state.zones.discard.length]);

  // 自动执行不需要用户输入的阶段
  useEffect(() => {
    if (!gameInitialized) return;

    const autoExecutePhase = () => {
      const currentPhase = state.phase;

      // 准备阶段：不再自动整备，直接进入下一阶段
      if (currentPhase === GamePhase.PREPARE) {
        setTimeout(() => {
          actions.nextPhase();
        }, 500); // 延迟500ms让玩家看到阶段变化
      }
      // 抽卡阶段：自动抽卡（考虑战场局势的影响）
      else if (currentPhase === GamePhase.DRAW) {
        setTimeout(() => {
          const drawCount = getEffectiveDrawCount(state);
          actions.drawCards(drawCount);
          actions.nextPhase();
        }, 500);
      }
      // 弃牌阶段：自动弃牌和清理
      else if (currentPhase === GamePhase.DISCARD) {
        if (phaseTransitionInProgress.current) {
          console.log('[DEBUG] Discard phase: transition already in progress, skipping');
          return;
        }
        console.log('[DEBUG] Discard phase: starting auto-execution');
        phaseTransitionInProgress.current = true;
        const timerId = setTimeout(() => {
          console.log('[DEBUG] Discard phase: executing endTurn and nextPhase');
          try {
            actions.endTurn();
            actions.nextPhase();
          } catch (error) {
            console.error('[DEBUG] Discard phase execution error:', error);
          } finally {
            phaseTransitionInProgress.current = false;
            console.log('[DEBUG] Discard phase: auto-execution complete');
          }
        }, 500);
        // Store timer ID for cleanup
        return () => {
          clearTimeout(timerId);
          phaseTransitionInProgress.current = false;
        };
      }
    };

    autoExecutePhase();
  }, [state.phase, gameInitialized]);

  // Keyboard shortcut for debug buff panel (Ctrl+Shift+B)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        setShowDebugBuffPanel(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 监测补给变化并触发动画
  useEffect(() => {
    if (state.supply !== prevSupply) {
      setSupplyChanged(true);
      setPrevSupply(state.supply);

      // 500ms 后移除动画class
      const timer = setTimeout(() => {
        setSupplyChanged(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [state.supply]);

  // Check for phase completion - will be called after combat report is closed
  const checkForPhaseTransition = useCallback(() => {
    if (!state.phaseData) return;

    // Check if main mission is complete
    const phaseKey = `phase_${state.currentPhase}`;
    const phaseCompletion = state.completedMissions[phaseKey];

    if (phaseCompletion && phaseCompletion.main && state.turnsRemaining > 0) {
      // Main mission complete
      console.log(`Phase ${state.currentPhase} complete! Main mission accomplished.`);

      // Check if there is a next phase
      const nextPhaseNumber = state.currentPhase + 1;
      try {
        // Try to load next phase data
        loadPhaseData(nextPhaseNumber);

        // If successful, transition to next phase and show modal
        actions.startPhase(nextPhaseNumber, combatCardsData);
        setShowPhaseTransitionModal(true);
      } catch (error) {
        // No next phase - game complete!
        console.log('All phases complete! Game won!');
        actions.gameOver();
      }
    }
  }, [state.completedMissions, state.currentPhase, state.turnsRemaining, state.phaseData, gameInitialized, actions]);

  // 监听pending interaction（如retire能力、快速响应能力）
  useEffect(() => {
    if (state.pendingInteraction) {
      const { zone, title, filter, excludeCardId } = state.pendingInteraction;
      if (excludeCardId) {
        setActiveAbilityCardId(excludeCardId);
      }
      if (zone === 'discard') {
        setShowRetireModal(true);
      } else if (zone === 'deployed' && filter === 'tapped') {
        setShowQuickResponseModal(true);
      }
    }
  }, [state.pendingInteraction]);

  const handleLeaderSelected = (leader) => {
    setSelectedLeader(leader);
    setShowLeaderSelectionModal(false);
    // Initialize game with selected leader
    initializeGame(leader);
  };

  const initializeGame = (leader) => {
    try {
      // 创建初始牌组（5张初级补给卡）
      const starterCard = combatCardsData.find(c => c.id === gameConfig.game.starterCardId);
      const starterDeck = [];
      for (let i = 0; i < gameConfig.game.starterDeckSize; i++) {
        starterDeck.push(createCard(starterCard, `${starterCard.id}_starter_${i}`));
      }

      // Load phase 1 data
      const phase1Data = loadPhaseData(1);
      const initialPhase = 1;

      // Use phase 1 missions instead of old missions
      const missions = missionPhase1Data.map((m, idx) => createCard(m, `${m.id}_${idx}`));

    // Filter shop cards by phase availability
    const shopCardDefinitions = combatCardsData.filter(c => {
      return c.id !== gameConfig.game.starterCardId && // Exclude starter card
        getCardShopType(c, initialPhase) !== null; // Card is available in this phase
    });

    // 分离必要卡牌和随机卡牌
    const essentialCardDefs = shopCardDefinitions.filter(c => getCardShopType(c, initialPhase) === 'essential');
    const randomCardDefs = shopCardDefinitions.filter(c => getCardShopType(c, initialPhase) === 'random');

    // 创建必要商店卡牌
    const essentialShopCards = [];
    essentialCardDefs.forEach((cardDef, idx) => {
      const copies = getCardShopCopies(cardDef, 'essential');
      for (let i = 0; i < copies; i++) {
        essentialShopCards.push(createCard(cardDef, `${cardDef.id}_essential_${idx}_${i}`));
      }
    });

    // 创建随机商店卡牌堆
    const randomShopDeck = [];
    randomCardDefs.forEach((cardDef, idx) => {
      const copies = getCardShopCopies(cardDef, 'random');
      for (let i = 0; i < copies; i++) {
        randomShopDeck.push(createCard(cardDef, `${cardDef.id}_random_${idx}_${i}`));
      }
    });

    // Initialize game with filtered cards and leader
    actions.initGame(
      starterDeck,
      missions,
      essentialShopCards,
      randomShopDeck,
      gameConfig.game.randomShopSlots || 6,
      leader,  // Pass leader card
      combatCardsData  // Pass all combat card definitions for snapshot updates
    );

      // Start phase 1 and show phase transition modal
      setTimeout(() => {
        actions.startPhase(initialPhase, combatCardsData);
        setShowPhaseTransitionModal(true);
      }, 100);
    } catch (error) {
      console.error('Game initialization error:', error);
      alert('游戏初始化失败: ' + error.message);
    }
  };

  const handleNextPhase = () => {
    const currentPhase = state.phase;

    // 商店阶段特殊检查：如果商店还有卡牌可以购买或有卡牌可以整备，提示确认
    if (currentPhase === GamePhase.SHOP) {
      // 检查是否还有可以购买的卡牌（包括必要商店和随机商店）
      const allShopCards = [...(state.zones.essentialShop || []), ...(state.zones.randomShop || [])];
      const affordableCards = allShopCards.filter(card => card.cost <= state.supply);

      // 检查是否还有可以整备的卡牌
      const tappedCards = (state.zones.deployed || []).filter(card => card.status === 'tapped');
      const affordableRedeployCards = tappedCards.filter(card => card.redeployCost <= state.supply);

      const hasAffordableShopCards = state.supply > 0 && affordableCards.length > 0;
      const hasAffordableRedeployCards = state.supply > 0 && affordableRedeployCards.length > 0;

      if (hasAffordableShopCards || hasAffordableRedeployCards) {
        let message = '您还有补给未使用：\n\n';
        if (hasAffordableShopCards) {
          message += `- 商店中有 ${affordableCards.length} 张可购买的卡牌\n`;
        }
        if (hasAffordableRedeployCards) {
          message += `- 部署区有 ${affordableRedeployCards.length} 张可整备的卡牌\n`;
        }
        message += '\n确定要进入下一阶段吗？';

        const confirmed = window.confirm(message);
        if (!confirmed) {
          return; // 用户取消，不进入下一阶段
        }
      }
    }

    // 根据不同阶段执行不同逻辑
    if (currentPhase === GamePhase.DRAW) {
      // 抽卡阶段：抽5张牌
      actions.drawCards(gameConfig.phases.drawCount);
    } else if (currentPhase === GamePhase.DISCARD) {
      // 弃牌阶段：防止重复执行（可能已经自动执行了）
      if (phaseTransitionInProgress.current) {
        console.log('[DEBUG] handleNextPhase: discard phase transition in progress, forcing unlock');
        // Force unlock if stuck
        phaseTransitionInProgress.current = false;
      }
      // 弃掉所有手牌，清除超限补给
      console.log('[DEBUG] handleNextPhase: executing endTurn for discard phase');
      actions.endTurn();
    }

    actions.nextPhase();
  };

  const handleCardClick = (card) => {
    const currentPhase = state.phase;

    if (currentPhase === GamePhase.ACTION) {
      // 检查卡牌是否在手牌中（通过 instanceId 比较）
      const isInHand = (state.zones.hand || []).some(c => c.instanceId === card.instanceId);
      const isInDeployed = (state.zones.deployed || []).some(c => c.instanceId === card.instanceId);

      if (isInHand) {
        // 行动阶段：打出手牌
        actions.playCard(card.instanceId);
      } else if (isInDeployed && card.status === 'ready') {
        // 行动阶段：使用部署区已就绪卡牌的主动能力（如侦查、快速整备）
        const activeAbility = card.abilities?.find(ability =>
          ability.trigger === 'on_tap' &&
          ['scout', 'draw', 'supply', 'quick_response'].includes(ability.type)
        );

        if (activeAbility) {
          if (activeAbility.type === 'scout') {
            // 使用侦查能力 - 检查侦查上限
            const scoutUsed = state.scoutUsed || 0;
            const scoutLimit = state.scoutLimit || 1;
            if (scoutUsed >= scoutLimit) {
              alert(`已达到侦查上限（${scoutUsed}/${scoutLimit}）！`);
              return;
            }
            actions.scoutAndTap(activeAbility.value, card.instanceId);
          } else if (activeAbility.type === 'draw') {
            // 使用抽卡能力
            actions.drawCards(activeAbility.value);
            actions.tapCard(card.instanceId);
          } else if (activeAbility.type === 'supply') {
            // 使用补给能力
            actions.addSupply(activeAbility.value);
            actions.tapCard(card.instanceId);
          } else if (activeAbility.type === 'quick_response') {
            // 使用快速整备能力
            const tappedCards = (state.zones.deployed || []).filter(c => c.status === 'tapped' && c.instanceId !== card.instanceId);
            if (tappedCards.length === 0) {
              alert('没有可以激活的整备中卡牌');
            } else {
              // 整备使用能力的卡牌
              actions.tapCard(card.instanceId);
              // 触发快速整备能力
              actions.triggerDeployedAbility(card.instanceId, 'quick_response');
            }
          }
        }
        // 如果没有主动能力，点击不做任何事
      }
      // 行动阶段不允许整备卡牌
    } else if (currentPhase === GamePhase.COMBAT) {
      // 检查卡牌是否在部署区
      const isInDeployed = (state.zones.deployed || []).some(c => c.instanceId === card.instanceId);

      if (isInDeployed && card.status === 'ready') {
        // 检查卡牌是否可以参加战斗（检查卡牌能力和任务约束）
        const missionConstraints = state.currentMission?.missionConstraints || [];
        const combatCheck = canParticipateInCombat(card, missionConstraints);
        if (!combatCheck.canParticipate) {
          alert(combatCheck.reason || `「${card.name}」不能参加战斗！`);
          return;
        }

        // 战斗阶段：选择参战卡牌（切换选中状态）
        if (state.selectedForCombat.includes(card.instanceId)) {
          actions.deselectForCombat(card.instanceId);
        } else {
          actions.selectForCombat(card.instanceId);
        }
      }
    } else if (currentPhase === GamePhase.SHOP) {
      // 购买阶段：整备部署区的整备中卡牌
      const isInDeployed = (state.zones.deployed || []).some(c => c.instanceId === card.instanceId);

      if (isInDeployed && card.status === 'tapped') {
        if (state.supply >= card.redeployCost) {
          actions.spendSupply(card.redeployCost);
          actions.untapCard(card.instanceId);
        } else {
          alert(`补给不足！需要 ${card.redeployCost} 点补给来整备此卡牌`);
        }
      }
    }
  };

  const handleAbilitySelect = (selectedCard) => {
    // 执行退役
    actions.retireCard(selectedCard.instanceId);
    // 清除pending interaction
    actions.clearPendingInteraction();
    // 清除正在使用能力的卡牌ID
    setActiveAbilityCardId(null);
    // 关闭弹窗
    setShowRetireModal(false);
  };

  const handleQuickResponseSelect = (selectedCard) => {
    // 执行激活
    actions.untapCard(selectedCard.instanceId);
    // 清除pending interaction
    actions.clearPendingInteraction();
    // 清除正在使用能力的卡牌ID
    setActiveAbilityCardId(null);
    // 关闭弹窗
    setShowQuickResponseModal(false);
  };

  const handleShopCardClick = (card, shopType) => {
    if (state.phase === GamePhase.SHOP) {
      if (state.supply >= card.cost) {
        // card 已经是实际的卡牌实例，直接使用
        actions.spendSupply(card.cost);
        actions.purchaseCard(card.instanceId, shopType);
      } else {
        alert('补给不足！');
      }
    }
  };

  const handleStartCombat = () => {
    if (state.selectedForCombat.length === 0) {
      alert('请先选择参战的卡牌！');
      return;
    }

    // 检查航空槽位是否足够
    const airSlotInfo = getAirSlotInfo();
    if (!airSlotInfo.isValid) {
      alert(`航空槽位不足！\n\n当前航空槽位: ${airSlotInfo.totalAirSlots}\n选中空军单位: ${airSlotInfo.airUnitsCount}\n\n请选择提供航空槽位的单位（如航空母舰），或减少空军单位数量。`);
      return;
    }

    // 获取选中的卡牌对象
    const selectedCards = (state.zones.deployed || []).filter(card =>
      state.selectedForCombat.includes(card.instanceId)
    );

    // 执行战斗
    const combatResult = resolveCombat(selectedCards, state.currentMission, state);

    // 应用战斗奖励
    if (combatResult.victory) {
      if (combatResult.rewards.supply > 0) {
        actions.addSupply(combatResult.rewards.supply);
      }
      if (combatResult.rewards.maxSupply > 0) {
        // 增加最大补给保留（这需要在游戏状态中实现）
        // 暂时通过添加一个临时方案
      }
      // 检查是否是最后一个任务
      if (combatResult.rewards.victory) {
        actions.gameOver();
        return;
      }
    }

    // 构建战斗简报并显示
    const reportId = `combat_${state.turn}_${Date.now()}`;
    const combatReport = {
      id: reportId,
      turn: state.turn,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      mission: state.currentMission,
      participatingCards: selectedCards,
      leader: state.leader, // 添加领袖信息用于判断潜艇返回基地
      ...combatResult
    };
    setCurrentReport(combatReport);
    setShowCombatReportModal(true);

    // 应用战斗结算（传递完整战斗结果）
    actions.resolveCombat(combatResult.victory, combatResult.lostCardIds, combatResult);

    // 自动进入下一阶段
    actions.nextPhase();
  };

  const handleSkipCombat = () => {
    // 跳过战斗，直接进入下一阶段
    actions.nextPhase();
  };

  const handleStartNewGame = () => {
    setGameInitialized(false);
    actions.resetGame();
  };

  const handleReportClick = (reportId) => {
    const report = state.combatReports.find(r => r.id === reportId);
    if (report) {
      setCurrentReport(report);
      setShowCombatReportModal(true);
    }
  };

  const handleCloseCombatReport = () => {
    setShowCombatReportModal(false);
    setCurrentReport(null);

    // Check for phase transition after closing combat report
    checkForPhaseTransition();
  };

  // 计算当前选中卡牌的火力
  const selectedFirePowers = () => {
    const selectedCards = (state.zones.deployed || []).filter(card =>
      state.selectedForCombat.includes(card.instanceId)
    );
    return calculateAllFirePowers(selectedCards, { state, mission: state.currentMission });
  };

  // 计算调整后的任务需求（应用buff效果）
  const getAdjustedMissionRequirements = () => {
    if (!state.currentMission) {
      return { groundPower: 0, seaPower: 0, airDefense: 0, airSuperiority: 0 };
    }
    return applyBuffsToMissionRequirements(state.currentMission, state.battlefieldConditions || []);
  };

  // 计算航空槽位相关信息
  const getAirSlotInfo = () => {
    const selectedCards = (state.zones.deployed || []).filter(card =>
      state.selectedForCombat.includes(card.instanceId)
    );

    // 计算提供的航空槽位总数
    const totalAirSlots = selectedCards.reduce((sum, card) => sum + (card.airSlots || 0), 0);

    // 计算选中的空军单位数量
    const airUnitsCount = selectedCards.filter(card => card.unitType === 'air').length;

    return {
      totalAirSlots,
      airUnitsCount,
      isValid: airUnitsCount <= totalAirSlots
    };
  };

  // 游戏结束界面
  if (state.phase === GamePhase.GAME_OVER) {
    // Check if game was won (completed all phases)
    const gameWon = state.phaseData && state.completedMissions[`phase_${state.currentPhase}`]?.main;

    return (
      <div className="game-over">
        <h1>{gameWon ? '🎉 胜利！' : '游戏结束'}</h1>
        {gameWon && (
          <div className="victory-message">
            <h2>恭喜完成「{state.phaseData.name}」</h2>
            <p>你成功指挥美军完成了太平洋战场的战略目标，夺回了战争主动权！</p>
          </div>
        )}
        <div className="stats">
          <h2>统计信息</h2>
          <p>完成阶段: {state.currentPhase}</p>
          <p>总回合数: {state.stats.totalTurns}</p>
          <p>胜利战斗: {state.stats.battlesWon}</p>
          <p>打出卡牌数: {state.stats.cardsPlayed}</p>
          <p>购买卡牌数: {state.stats.cardsPurchased}</p>
        </div>
        <button onClick={handleStartNewGame} className="btn-restart">
          重新开始
        </button>
      </div>
    );
  }

  // Strategic Phase System handlers
  const handleChangeMission = () => {
    // Only allow changing mission during action phase
    if (state.phase === GamePhase.ACTION) {
      setShowMissionSelectionModal(true);
    }
  };

  const handleSelectMission = (missionId) => {
    actions.selectMission(missionId);
  };

  // Safety check - ensure state is initialized
  if (!state || !state.zones) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        color: '#fff',
        fontSize: '18px'
      }}>
        游戏加载中...
      </div>
    );
  }

  return (
    <div className="game-board">

      {/* 战斗控制面板 */}

      {/* 主游戏区域 */}
      <div className="game-main">
        {/* 左侧：任务区 */}
        <div className="game-left">
          {/* 回合阶段信息 */}
          <div className="game-info-box">
            <div className="info-item">
              <span className="label">回合:</span>
              <span className="value">{state.turn}</span>
            </div>
            <div className="info-item">
              <span className="label">阶段:</span>
              <span className="value phase">{PhaseDisplayName[state.phase]}</span>
            </div>
            {/* 只在需要用户操作的阶段显示"下一阶段"按钮 */}
            {(state.phase === GamePhase.ACTION || state.phase === GamePhase.SHOP) && (
              <button onClick={handleNextPhase} className="btn-next-phase">
                下一阶段
              </button>
            )}
          </div>

          <MissionDisplay
            currentMission={state.currentMission}
            remainingMissions={state.availableMissions ? state.availableMissions.length : state.missions.length}
            turnsRemaining={state.turnsRemaining}
            phaseData={state.phaseData}
            onMissionHover={setHoveredCard}
            onMissionHoverEnd={() => setHoveredCard(null)}
            onChangeMission={handleChangeMission}
            canChangeMission={state.phase === GamePhase.ACTION && state.availableMissions && state.availableMissions.length > 1}
          />

          {/* 战场局势 */}
          {state.phaseData && state.battlefieldConditions && state.battlefieldConditions.length > 0 && (
            <BattlefieldConditions
              conditions={state.battlefieldConditions}
              currentMission={state.currentMission}
            />
          )}
        </div>

        {/* 中央：游戏区域 */}
        <div className="game-center">
          {/* 商店区 */}
          <div className="top-zone" style={{ position: 'relative' }}>
            {/* 战斗阶段：战斗统计覆盖层 */}
            {state.phase === GamePhase.COMBAT && state.currentMission && (
              <div className="combat-overlay">
                <div className="combat-stats-grid">
                  <div className="combat-stat">
                    <span className="label">对地火力:</span>
                    <span className="value" style={{color: selectedFirePowers().groundPower >= getAdjustedMissionRequirements().groundPower ? '#34d399' : '#ef4444'}}>
                      {selectedFirePowers().groundPower} / {getAdjustedMissionRequirements().groundPower}
                    </span>
                  </div>
                  <div className="combat-stat">
                    <span className="label">对海火力:</span>
                    <span className="value" style={{color: selectedFirePowers().seaPower >= getAdjustedMissionRequirements().seaPower ? '#34d399' : '#ef4444'}}>
                      {selectedFirePowers().seaPower} / {getAdjustedMissionRequirements().seaPower}
                    </span>
                  </div>
                  <div className="combat-stat">
                    <span className="label">防空火力:</span>
                    <span className="value" style={{color: selectedFirePowers().airDefense >= getAdjustedMissionRequirements().airDefense ? '#34d399' : '#f59e0b'}}>
                      {selectedFirePowers().airDefense} / {getAdjustedMissionRequirements().airDefense}
                    </span>
                  </div>
                  <div className="combat-stat">
                    <span className="label">制空火力:</span>
                    <span className="value" style={{color: selectedFirePowers().airSuperiority >= getAdjustedMissionRequirements().airSuperiority ? '#34d399' : '#f59e0b'}}>
                      {selectedFirePowers().airSuperiority} / {getAdjustedMissionRequirements().airSuperiority}
                    </span>
                  </div>
                  <div className="combat-stat">
                    <span className="label">航空槽位:</span>
                    <span className={`value ${getAirSlotInfo().isValid ? '' : 'air-slot-insufficient'}`} style={{color: getAirSlotInfo().isValid ? '#34d399' : '#ef4444'}}>
                      {getAirSlotInfo().airUnitsCount} / {getAirSlotInfo().totalAirSlots}
                    </span>
                  </div>
                  <div className="combat-stat">
                    <span className="label">已选择:</span>
                    <span className="value">{state.selectedForCombat.length}张</span>
                  </div>
                  <div className="combat-stat">
                    <span className="label">总整备消耗:</span>
                    <span className="value">
                      {(() => {
                        const selectedCards = state.zones.deployed.filter(card =>
                          state.selectedForCombat.includes(card.instanceId)
                        );
                        return selectedCards.reduce((sum, c) => sum + (c.redeployCost || 0), 0);
                      })()}
                    </span>
                  </div>
                </div>
                <div className="combat-buttons">
                  <button onClick={handleStartCombat} className="btn-start-combat">
                    开始战斗
                  </button>
                  <button onClick={handleSkipCombat} className="btn-skip-combat">
                    跳过战斗
                  </button>
                </div>
              </div>
            )}

            {/* 商店 - 始终显示 */}
            <Shop
              essentialShopCards={(state.zones.essentialShop || []).filter(
                card => !isCardBlockedByConditions(card, state)
              )}
              randomShopCards={(state.zones.randomShop || []).filter(
                card => !isCardBlockedByConditions(card, state)
              )}
              allEssentialCardTypes={combatCardsData.filter(c =>
                getCardShopType(c, state.currentPhase || 1) === 'essential' && !isCardBlockedByConditions(c, state)
              )}
              onCardClick={handleShopCardClick}
              onCardHover={setHoveredCard}
              onCardHoverEnd={() => setHoveredCard(null)}
              currentSupply={state.supply}
              maxSupplyRetention={state.maxSupplyRetention}
              currentPhase={state.phase}
              isShopPhase={state.phase === GamePhase.SHOP}
              onDebugAddSupply={() => actions.addSupply(10)}
              onDebugRefreshShop={() => actions.refreshRandomShop()}
              onDebugDrawCard={() => actions.drawCards(1)}
              onDebugUntapAll={() => {
                // 批量整备所有部署区的整备中卡牌
                actions.untapAllDeployed();
              }}
              onDebugToggleBuffPanel={() => setShowDebugBuffPanel(prev => !prev)}
              onDebugSwitchMission={() => setShowDebugMissionSwitch(true)}
              onDebugSaveSnapshot={() => actions.debugSaveSnapshot()}
              onDebugLoadSnapshot={(snapshot, reloadPhase) => {
                if (reloadPhase && snapshot.metadata?.currentPhase) {
                  // Load snapshot first
                  actions.debugLoadSnapshot(snapshot, false);
                  // Then reload phase to rebuild shops
                  setTimeout(() => {
                    actions.startPhase(snapshot.metadata.currentPhase, combatCardsData);
                  }, 100);
                } else {
                  // Just load snapshot without phase reload
                  actions.debugLoadSnapshot(snapshot, false);
                }
              }}
              onOpenManual={() => setShowManual(true)}
              allCombatCards={combatCardsData}
              gameState={state}
            />
          </div>

          {/* 部署区 */}
          <div className={`middle-zone ${
            [GamePhase.PREPARE, GamePhase.DRAW, GamePhase.DISCARD].includes(state.phase) ? 'zone-disabled' : ''
          }`}>
            <div className="card-zone deployed-zone">
              <div className="zone-header">
                <h3>部署区 ({state.zones?.deployed.length || 0}) <span style={{marginLeft: '10px', fontSize: '0.85em', color: '#64b5f6'}}>侦查上限：{state.scoutUsed || 0}/{state.scoutLimit || 1}</span></h3>
                <button
                  className="zone-action-button"
                  onClick={() => actions.sortDeployed()}
                  disabled={!state.zones?.deployed.length}
                >
                  排序
                </button>
              </div>
              <div className="zone-content zone-content-stacks">
                {(!state.zones?.deployed || state.zones.deployed.length === 0) ? (
                  <div className="empty-message">未部署任何卡牌</div>
                ) : (
                  // 按卡牌ID分组
                  (() => {
                    const groups = (state.zones.deployed || []).reduce((groups, card) => {
                      if (!groups[card.id]) {
                        groups[card.id] = [];
                      }
                      groups[card.id].push(card);
                      return groups;
                    }, {});
                    return Object.values(groups);
                  })().map(stack => (
                    <CardStack
                      key={`${stack[0].id}_${stack.map(c => c.instanceId).join('_')}`}
                      cards={stack}
                      phase={state.phase}
                      onCardClick={handleCardClick}
                      onCardHover={setHoveredCard}
                      onCardHoverEnd={() => setHoveredCard(null)}
                      selectedCards={state.selectedForCombat}
                      selectedForCombat={state.selectedForCombat}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 底部：手牌区 */}
          <div className="bottom-zone">
            <CardZone
              title="手牌"
              cards={state.zones?.hand || []}
              onCardClick={handleCardClick}
              onCardHover={setHoveredCard}
              onCardHoverEnd={() => setHoveredCard(null)}
              className="hand-zone"
              emptyMessage="手牌为空"
            />
            <div className="deck-zones">
              <CardZone
                title="抽牌堆"
                cards={state.zones?.deck || []}
                className="deck-zone"
                emptyMessage="无"
                showCountOnly={true}
              />
              <CardZone
                title="弃牌堆"
                cards={state.zones?.discard || []}
                className="discard-zone"
                emptyMessage="无"
                showCountOnly={true}
                onZoneClick={() => setShowDiscardModal(true)}
              />
            </div>
          </div>
        </div>

        {/* 右侧：显示区 */}
        <div className="game-right">
          <div className="card-preview">
            {hoveredCard ? (
              <Card card={hoveredCard} showDetailed={true} />
            ) : (
              <div className="preview-empty">
                将鼠标悬停在卡牌上查看详情
              </div>
            )}
          </div>
          <BattleLog logs={state.battleLog} onReportClick={handleReportClick} />
        </div>
      </div>

      {/* 弃牌堆查看弹窗 */}
      <CardListModal
        isOpen={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        cards={state.zones.discard}
        title="弃牌堆"
        onCardHover={setHoveredCard}
        onCardHoverEnd={() => setHoveredCard(null)}
      />

      {/* 退役选择弹窗 */}
      <CardListModal
        isOpen={showRetireModal}
        onClose={() => {
          setShowRetireModal(false);
          actions.clearPendingInteraction();
          setActiveAbilityCardId(null);
        }}
        cards={state.zones.discard.filter(card =>
          card.instanceId !== activeAbilityCardId
        )}
        title="选择要退役的卡牌"
        onCardHover={setHoveredCard}
        onCardHoverEnd={() => setHoveredCard(null)}
        onCardSelect={handleAbilitySelect}
      />

      {/* 快速响应选择弹窗 */}
      <CardListModal
        isOpen={showQuickResponseModal}
        onClose={() => {
          setShowQuickResponseModal(false);
          actions.clearPendingInteraction();
          setActiveAbilityCardId(null);
        }}
        cards={(state.zones.deployed || []).filter(card =>
          card.status === 'tapped' && card.instanceId !== activeAbilityCardId
        )}
        title="选择要激活的卡牌"
        onCardHover={setHoveredCard}
        onCardHoverEnd={() => setHoveredCard(null)}
        onCardSelect={handleQuickResponseSelect}
      />

      {/* 战斗简报弹窗 */}
      {showCombatReportModal && (
        <CombatReportModal
          report={currentReport}
          onClose={handleCloseCombatReport}
        />
      )}

      {/* 领袖选择弹窗 */}
      {showLeaderSelectionModal && availableLeaders.length > 0 && (
        <LeaderSelectionModal
          leaders={availableLeaders}
          onSelectLeader={handleLeaderSelected}
          onCardHover={setHoveredCard}
          onCardHoverEnd={() => setHoveredCard(null)}
          onOpenManual={() => setShowManual(true)}
        />
      )}

      {/* 游戏手册 */}
      <Manual
        isOpen={showManual}
        onClose={() => setShowManual(false)}
      />

      {/* 战略阶段过渡弹窗 */}
      {showPhaseTransitionModal && state.phaseData && state.availableMissions && (
        <PhaseTransitionModal
          phaseData={state.phaseData}
          missions={state.availableMissions}
          cardChanges={state.phaseCardChanges}
          onClose={() => setShowPhaseTransitionModal(false)}
          onCardHover={setHoveredCard}
          onCardHoverEnd={() => setHoveredCard(null)}
        />
      )}

      {/* 任务选择弹窗 */}
      {showMissionSelectionModal && state.phaseData && state.availableMissions && (
        <MissionSelectionModal
          phaseData={state.phaseData}
          missions={state.availableMissions}
          currentMissionId={state.currentMission?.id}
          turnsRemaining={state.turnsRemaining}
          completedMissions={state.completedMissions}
          currentPhase={state.currentPhase}
          onSelectMission={handleSelectMission}
          onClose={() => setShowMissionSelectionModal(false)}
          onCardHover={setHoveredCard}
          onCardHoverEnd={() => setHoveredCard(null)}
        />
      )}

      {/* Debug Buff Panel */}
      {showDebugBuffPanel && (
        <DebugBuffPanel
          gameState={state}
          onAddBuff={(buffId) => actions.debugAddBuff(buffId)}
          onRemoveBuff={(buffIndex) => actions.debugRemoveBuff(buffIndex)}
          onClose={() => setShowDebugBuffPanel(false)}
        />
      )}

      {/* Debug Mission Switch Modal */}
      {showDebugMissionSwitch && (
        <DebugMissionSwitchModal
          onClose={() => setShowDebugMissionSwitch(false)}
          onSelectMission={(mission) => {
            // Check if mission is from a different phase
            if (mission.phase && mission.phase !== state.currentPhase) {
              // Switch to the target phase first
              console.log(`[DEBUG] Switching from Phase ${state.currentPhase} to Phase ${mission.phase}`);
              actions.startPhase(mission.phase, combatCardsData);

              // Wait for phase transition to complete, then select mission
              setTimeout(() => {
                actions.selectMission(mission.id);
              }, 100);
            } else {
              // Same phase, just switch mission
              actions.selectMission(mission.id);
            }
          }}
          allMissions={[
            ...missionPhase1Data,
            ...missionPhase2Data,
            ...missionPhase3Data,
            ...missionPhase4Data
          ]}
          currentMissionId={state.currentMission?.id}
        />
      )}
    </div>
  );
}

export default GameBoard;
