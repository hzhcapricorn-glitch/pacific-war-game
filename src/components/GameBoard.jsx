import React, { useState, useEffect } from 'react';
import { useGameState } from '../core/GameState.jsx';
import { GamePhase, PhaseDisplayName } from '../models/GamePhase';
import Card from './Card';
import CardZone from './CardZone';
import MissionDisplay from './MissionDisplay';
import Shop from './Shop';
import CardListModal from './CardListModal';
import BattleLog from './BattleLog';

// 导入卡牌数据
import combatCardsData from '../data/cards/combat.json';
import missionCardsData from '../data/cards/mission.json';
import gameConfig from '../data/config.json';
import { createCard } from '../models/Card';
import { shuffleDeck } from '../core/CardEngine';
import { resolveCombat, getCombatSummary, calculateCombatPower } from '../core/CombatSystem';
import { canParticipateInCombat } from '../models/Card';

/**
 * GameBoard Component - 主游戏面板
 */
function GameBoard() {
  const { state, actions } = useGameState();
  const [hoveredCard, setHoveredCard] = useState(null);
  const [gameInitialized, setGameInitialized] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
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

      // 准备阶段：自动重置所有横置卡牌
      if (currentPhase === GamePhase.PREPARE) {
        setTimeout(() => {
          state.zones.deployed.forEach(card => {
            if (card.status === 'tapped') {
              actions.untapCard(card.instanceId);
            }
          });
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
    const shopCards = [];
    shopCardDefinitions.forEach((cardDef, idx) => {
      // 每种卡牌10张
      for (let i = 0; i < gameConfig.game.shopCardCopies; i++) {
        shopCards.push(createCard(cardDef, `${cardDef.id}_shop_${idx}_${i}`));
      }
    });

    actions.initGame(starterDeck, missions, shuffleDeck(shopCards));
  };

  const handleNextPhase = () => {
    const currentPhase = state.phase;

    // 商店阶段特殊检查：如果商店还有卡牌可以购买，提示确认
    if (currentPhase === GamePhase.SHOP) {
      // 检查是否还有可以购买的卡牌
      const affordableCards = state.zones.shop.filter(card => card.cost <= state.supply);

      if (state.supply > 0 && affordableCards.length > 0) {
        const confirmed = window.confirm(
          `您还有 ${state.supply} 点补给未使用，商店中还有卡牌可以购买。\n\n确定要进入下一阶段吗？`
        );
        if (!confirmed) {
          return; // 用户取消，不进入下一阶段
        }
      }
    }

    // 根据不同阶段执行不同逻辑
    if (currentPhase === GamePhase.PREPARE) {
      // 准备阶段：重置所有部署卡牌
      state.zones.deployed.forEach(card => {
        if (card.status === 'tapped') {
          actions.untapCard(card.instanceId);
        }
      });
    } else if (currentPhase === GamePhase.DRAW) {
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
      } else if (isInDeployed && card.status === 'tapped') {
        // 行动阶段：重置横置的卡牌
        if (state.supply >= card.redeployCost) {
          actions.spendSupply(card.redeployCost);
          actions.untapCard(card.instanceId);
        } else {
          alert(`补给不足！需要 ${card.redeployCost} 点补给来重置此卡牌`);
        }
      }
    } else if (currentPhase === GamePhase.COMBAT) {
      // 检查卡牌是否在部署区
      const isInDeployed = state.zones.deployed.some(c => c.instanceId === card.instanceId);

      if (isInDeployed && card.status === 'ready') {
        // 检查卡牌是否可以参加战斗（后勤卡不能参加战斗）
        if (!canParticipateInCombat(card)) {
          alert(`「${card.name}」是后勤卡，不能参加战斗！`);
          return;
        }

        // 战斗阶段：选择参战卡牌（切换选中状态）
        if (state.selectedForCombat.includes(card.instanceId)) {
          actions.deselectForCombat(card.instanceId);
        } else {
          actions.selectForCombat(card.instanceId);
        }
      }
    }
  };

  const handleShopCardClick = (card) => {
    if (state.phase === GamePhase.SHOP) {
      if (state.supply >= card.cost) {
        // 从商店中找到这个类型的第一张卡牌实例
        const actualCard = state.zones.shop.find(c => c.id === card.id);
        if (actualCard) {
          actions.spendSupply(card.cost);
          actions.purchaseCard(actualCard.instanceId);
        }
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

    // 显示战斗结果
    const summary = getCombatSummary(combatResult);
    alert(summary);

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

    // 应用战斗结算
    actions.resolveCombat(combatResult.victory, combatResult.lostCardIds);

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

  // 计算当前选中卡牌的总战斗力
  const selectedCombatPower = () => {
    const selectedCards = state.zones.deployed.filter(card =>
      state.selectedForCombat.includes(card.instanceId)
    );
    return calculateCombatPower(selectedCards);
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
          <div className="info-item supply-container">
            <span className="label">补给:</span>
            <span className={`value supply ${supplyChanged ? 'supply-changed' : ''}`}>
              {state.supply} / {state.maxSupplyRetention}
            </span>
            {supplyChanged && state.supply > prevSupply && (
              <span className="supply-increase">+{state.supply - prevSupply}</span>
            )}
          </div>
        </div>
        <div className="header-controls">
          {/* Debug控制 */}
          <div className="debug-controls">
            <button onClick={() => actions.addSupply(10)} className="btn-debug">
              补给+10
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
      {state.phase === GamePhase.COMBAT && (
        <div className="combat-controls">
          <div className="combat-info">
            <div className="combat-stat">
              <span className="label">己方战斗力:</span>
              <span className="value combat-power">{selectedCombatPower()}</span>
            </div>
            <div className="combat-stat">
              <span className="label">需要战斗力:</span>
              <span className="value required-power">
                {state.currentMission ? state.currentMission.requiredCombat : 0}
              </span>
            </div>
            <div className="combat-stat">
              <span className="label">航空槽位:</span>
              <span className={`value ${getAirSlotInfo().isValid ? '' : 'air-slot-insufficient'}`} style={{color: getAirSlotInfo().isValid ? '#34d399' : '#ef4444'}}>
                {getAirSlotInfo().airUnitsCount} / {getAirSlotInfo().totalAirSlots}
              </span>
            </div>
            <div className="combat-stat">
              <span className="label">已选择卡牌:</span>
              <span className="value">{state.selectedForCombat.length}</span>
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
              shopCards={state.zones.shop}
              allCardTypes={combatCardsData.filter(c => c.id !== gameConfig.game.starterCardId)}
              onCardClick={handleShopCardClick}
              onCardHover={setHoveredCard}
              onCardHoverEnd={() => setHoveredCard(null)}
              currentSupply={state.supply}
            />
          </div>

          {/* 部署区 */}
          <div className="middle-zone">
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
                showLastOnly={true}
                onZoneClick={() => setShowDiscardModal(true)}
                onCardHover={setHoveredCard}
                onCardHoverEnd={() => setHoveredCard(null)}
              />
            </div>
          </div>
        </div>

        {/* 右侧：显示区 */}
        <div className="game-right">
          <div className="card-preview">
            <h3>详细信息</h3>
            {hoveredCard ? (
              <Card card={hoveredCard} showDetailed={true} />
            ) : (
              <div className="preview-empty">
                将鼠标悬停在卡牌上查看详情
              </div>
            )}
          </div>
          <BattleLog logs={state.battleLog} />
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
    </div>
  );
}

export default GameBoard;
