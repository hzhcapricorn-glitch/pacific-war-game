import React, { useState, useEffect } from 'react';
import { useGameState } from '../core/GameState.jsx';
import { GamePhase, PhaseDisplayName } from '../models/GamePhase';
import Card from './Card';
import CardZone from './CardZone';
import MissionDisplay from './MissionDisplay';
import Shop from './Shop';
import CardListModal from './CardListModal';
import BattleLog from './BattleLog';
import CombatReportModal from './CombatReportModal';

// 导入卡牌数据
import combatCardsData from '../data/cards/combat.json';
import missionCardsData from '../data/cards/mission.json';
import gameConfig from '../data/config.json';
import { createCard } from '../models/Card';
import { shuffleDeck } from '../core/CardEngine';
import { resolveCombat, getCombatSummary, calculateCombatPower, calculateAllFirePowers } from '../core/CombatSystem';
import { canParticipateInCombat } from '../core/AbilitySystem';

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

  // 初始化游戏
  useEffect(() => {
    if (!gameInitialized) {
      initializeGame();
      setGameInitialized(true);
    }
  }, [gameInitialized]);

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
      // 抽卡阶段：自动抽卡
      else if (currentPhase === GamePhase.DRAW) {
        setTimeout(() => {
          actions.drawCards(gameConfig.phases.drawCount);
          actions.nextPhase();
        }, 500);
      }
      // 弃牌阶段：自动弃牌和清理
      else if (currentPhase === GamePhase.DISCARD) {
        setTimeout(() => {
          actions.endTurn();
          actions.nextPhase();
        }, 500);
      }
    };

    autoExecutePhase();
  }, [state.phase, gameInitialized]);

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

  const initializeGame = () => {
    // 创建初始牌组（5张初级补给卡）
    const starterCard = combatCardsData.find(c => c.id === gameConfig.game.starterCardId);
    const starterDeck = [];
    for (let i = 0; i < gameConfig.game.starterDeckSize; i++) {
      starterDeck.push(createCard(starterCard, `${starterCard.id}_starter_${i}`));
    }

    // 创建任务卡牌
    const missions = missionCardsData.map((m, idx) => createCard(m, `${m.id}_${idx}`));

    // 创建商店卡牌（排除初级补给卡）
    const shopCardDefinitions = combatCardsData.filter(c => c.id !== gameConfig.game.starterCardId);

    // 分离必要卡牌和随机卡牌
    const essentialCardDefs = shopCardDefinitions.filter(c => c.shopType === 'essential');
    const randomCardDefs = shopCardDefinitions.filter(c => c.shopType === 'random');

    // 创建必要商店卡牌
    const essentialShopCards = [];
    essentialCardDefs.forEach((cardDef, idx) => {
      const copies = cardDef.shopCopies || gameConfig.game.essentialShopCopies || 10;
      for (let i = 0; i < copies; i++) {
        essentialShopCards.push(createCard(cardDef, `${cardDef.id}_essential_${idx}_${i}`));
      }
    });

    // 创建随机商店卡牌堆
    const randomShopDeck = [];
    randomCardDefs.forEach((cardDef, idx) => {
      const copies = cardDef.shopCopies || gameConfig.game.randomShopCopies || 10;
      for (let i = 0; i < copies; i++) {
        randomShopDeck.push(createCard(cardDef, `${cardDef.id}_random_${idx}_${i}`));
      }
    });

    actions.initGame(
      starterDeck,
      missions,
      essentialShopCards,
      randomShopDeck,
      gameConfig.game.randomShopSlots || 6
    );
  };

  const handleNextPhase = () => {
    const currentPhase = state.phase;

    // 商店阶段特殊检查：如果商店还有卡牌可以购买或有卡牌可以整备，提示确认
    if (currentPhase === GamePhase.SHOP) {
      // 检查是否还有可以购买的卡牌（包括必要商店和随机商店）
      const allShopCards = [...(state.zones.essentialShop || []), ...(state.zones.randomShop || [])];
      const affordableCards = allShopCards.filter(card => card.cost <= state.supply);

      // 检查是否还有可以整备的卡牌
      const tappedCards = state.zones.deployed.filter(card => card.status === 'tapped');
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
      // 弃牌阶段：弃掉所有手牌，清除超限补给
      actions.endTurn();
    }

    actions.nextPhase();
  };

  const handleCardClick = (card) => {
    const currentPhase = state.phase;

    if (currentPhase === GamePhase.ACTION) {
      // 检查卡牌是否在手牌中（通过 instanceId 比较）
      const isInHand = state.zones.hand.some(c => c.instanceId === card.instanceId);
      const isInDeployed = state.zones.deployed.some(c => c.instanceId === card.instanceId);

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
            // 使用侦查能力
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
            const tappedCards = state.zones.deployed.filter(c => c.status === 'tapped' && c.instanceId !== card.instanceId);
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
      const isInDeployed = state.zones.deployed.some(c => c.instanceId === card.instanceId);

      if (isInDeployed && card.status === 'ready') {
        // 检查卡牌是否可以参加战斗（后勤卡不能参加战斗）
        const combatCheck = canParticipateInCombat(card);
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
      const isInDeployed = state.zones.deployed.some(c => c.instanceId === card.instanceId);

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
    const selectedCards = state.zones.deployed.filter(card =>
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
  };

  // 计算当前选中卡牌的火力
  const selectedFirePowers = () => {
    const selectedCards = state.zones.deployed.filter(card =>
      state.selectedForCombat.includes(card.instanceId)
    );
    return calculateAllFirePowers(selectedCards, { state });
  };

  // 计算航空槽位相关信息
  const getAirSlotInfo = () => {
    const selectedCards = state.zones.deployed.filter(card =>
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
    return (
      <div className="game-over">
        <h1>游戏结束！</h1>
        <div className="stats">
          <h2>统计信息</h2>
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

  return (
    <div className="game-board">
      {/* 顶部信息栏 */}
      <div className="game-header">
        <div className="game-info">
          <div className="info-item">
            <span className="label">回合:</span>
            <span className="value">{state.turn}</span>
          </div>
          <div className="info-item">
            <span className="label">阶段:</span>
            <span className="value phase">{PhaseDisplayName[state.phase]}</span>
          </div>
        </div>
        <div className="header-controls">
          {/* Debug控制 */}
          <div className="debug-controls">
            <button onClick={() => actions.addSupply(10)} className="btn-debug">
              补给+10
            </button>
            <button onClick={() => actions.refreshRandomShop()} className="btn-debug">
              刷新商店
            </button>
            <button onClick={handleStartNewGame} className="btn-debug">
              重新开始
            </button>
          </div>
          {/* 只在需要用户操作的阶段显示"下一阶段"按钮 */}
          {(state.phase === GamePhase.ACTION || state.phase === GamePhase.SHOP) && (
            <button onClick={handleNextPhase} className="btn-next-phase">
              下一阶段
            </button>
          )}
        </div>
      </div>

      {/* 战斗控制面板 */}
      {state.phase === GamePhase.COMBAT && state.currentMission && (
        <div className="combat-controls">
          <div className="combat-info">
            <div className="combat-stat">
              <span className="label">对地火力:</span>
              <span className="value" style={{color: selectedFirePowers().groundPower >= (state.currentMission.requiredGroundPower || 0) ? '#34d399' : '#ef4444'}}>
                {selectedFirePowers().groundPower} / {state.currentMission.requiredGroundPower || 0}
              </span>
            </div>
            <div className="combat-stat">
              <span className="label">对海火力:</span>
              <span className="value" style={{color: selectedFirePowers().seaPower >= (state.currentMission.requiredSeaPower || 0) ? '#34d399' : '#ef4444'}}>
                {selectedFirePowers().seaPower} / {state.currentMission.requiredSeaPower || 0}
              </span>
            </div>
            <div className="combat-stat">
              <span className="label">防空火力:</span>
              <span className="value" style={{color: selectedFirePowers().airDefense >= (state.currentMission.requiredAirDefense || 0) ? '#34d399' : '#f59e0b'}}>
                {selectedFirePowers().airDefense} / {state.currentMission.requiredAirDefense || 0}
              </span>
            </div>
            <div className="combat-stat">
              <span className="label">制空火力:</span>
              <span className="value" style={{color: selectedFirePowers().airSuperiority >= (state.currentMission.requiredAirSuperiority || 0) ? '#34d399' : '#f59e0b'}}>
                {selectedFirePowers().airSuperiority} / {state.currentMission.requiredAirSuperiority || 0}
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

      {/* 主游戏区域 */}
      <div className="game-main">
        {/* 左侧：任务区 */}
        <div className="game-left">
          <MissionDisplay
            currentMission={state.currentMission}
            remainingMissions={state.missions.length}
            onMissionHover={setHoveredCard}
            onMissionHoverEnd={() => setHoveredCard(null)}
          />
        </div>

        {/* 中央：游戏区域 */}
        <div className="game-center">
          {/* 商店区 */}
          <div className="top-zone">
            <Shop
              essentialShopCards={state.zones.essentialShop || []}
              randomShopCards={state.zones.randomShop || []}
              allEssentialCardTypes={combatCardsData.filter(c => c.shopType === 'essential')}
              onCardClick={handleShopCardClick}
              onCardHover={setHoveredCard}
              onCardHoverEnd={() => setHoveredCard(null)}
              currentSupply={state.supply}
              maxSupplyRetention={state.maxSupplyRetention}
              currentPhase={state.phase}
              isShopPhase={state.phase === GamePhase.SHOP}
            />
          </div>

          {/* 部署区 */}
          <div className={`middle-zone ${
            [GamePhase.PREPARE, GamePhase.DRAW, GamePhase.DISCARD].includes(state.phase) ? 'zone-disabled' : ''
          }`}>
            <CardZone
              title="部署区"
              cards={state.zones.deployed}
              onCardClick={handleCardClick}
              onCardHover={setHoveredCard}
              onCardHoverEnd={() => setHoveredCard(null)}
              className="deployed-zone"
              emptyMessage="未部署任何卡牌"
              selectedCards={state.selectedForCombat}
            />
          </div>

          {/* 底部：手牌区 */}
          <div className="bottom-zone">
            <CardZone
              title="手牌"
              cards={state.zones.hand}
              onCardClick={handleCardClick}
              onCardHover={setHoveredCard}
              onCardHoverEnd={() => setHoveredCard(null)}
              className="hand-zone"
              emptyMessage="手牌为空"
            />
            <div className="deck-zones">
              <CardZone
                title="抽牌堆"
                cards={state.zones.deck}
                className="deck-zone"
                emptyMessage="无"
                showCountOnly={true}
              />
              <CardZone
                title="弃牌堆"
                cards={state.zones.discard}
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
        cards={state.zones.deployed.filter(card =>
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
    </div>
  );
}

export default GameBoard;
