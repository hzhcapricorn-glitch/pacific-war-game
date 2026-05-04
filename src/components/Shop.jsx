import React, { useState, useEffect } from 'react';
import Card from './Card';

/**
 * Shop Component - 显示商店（分为必要卡牌和随机卡牌）
 */
function Shop({
  essentialShopCards,
  randomShopCards,
  onCardClick,
  onCardHover,
  onCardHoverEnd,
  currentSupply,
  maxSupplyRetention,
  allEssentialCardTypes,
  currentPhase,
  isShopPhase,
  onDebugAddSupply,
  onDebugRefreshShop,
  onDebugDrawCard,
  onDebugUntapAll,
  onDebugToggleBuffPanel
}) {
  // 保存所有见过的必要卡牌种类
  const [knownEssentialTypes, setKnownEssentialTypes] = useState([]);
  // 补给变化动画状态
  const [supplyIncreasing, setSupplyIncreasing] = useState(false);
  const [prevSupply, setPrevSupply] = useState(currentSupply);

  // 初始化时从所有卡牌中提取必要卡牌种类
  useEffect(() => {
    if (allEssentialCardTypes && allEssentialCardTypes.length > 0) {
      const types = {};
      allEssentialCardTypes.forEach(card => {
        if (!types[card.id]) {
          types[card.id] = card;
        }
      });
      setKnownEssentialTypes(types);
    }
  }, [allEssentialCardTypes]);

  // 监听补给变化，触发动画
  useEffect(() => {
    if (currentSupply > prevSupply) {
      setSupplyIncreasing(true);
      const timer = setTimeout(() => {
        setSupplyIncreasing(false);
      }, 800);
      return () => clearTimeout(timer);
    }
    setPrevSupply(currentSupply);
  }, [currentSupply, prevSupply]);

  // 按卡牌种类分组必要卡牌
  const groupedEssentialCards = {};

  // 首先基于已知的所有种类创建空堆
  Object.values(knownEssentialTypes).forEach(cardDef => {
    groupedEssentialCards[cardDef.id] = {
      card: cardDef,
      count: 0,
      actualCards: [] // 存储实际的卡牌实例
    };
  });

  // 然后计算实际数量并保存实例
  essentialShopCards.forEach(card => {
    if (groupedEssentialCards[card.id]) {
      groupedEssentialCards[card.id].count++;
      groupedEssentialCards[card.id].actualCards.push(card);
    }
  });

  const essentialStacks = Object.values(groupedEssentialCards);

  return (
    <div className={`shop ${!isShopPhase ? 'shop-disabled' : ''}`}>
      <div className="shop-header">
        <h3>商店</h3>
        {(onDebugAddSupply || onDebugRefreshShop || onDebugDrawCard || onDebugUntapAll || onDebugToggleBuffPanel) && (
          <div className="debug-controls-inline">
            {onDebugAddSupply && (
              <button onClick={onDebugAddSupply} className="btn-debug-inline">
                补给+10
              </button>
            )}
            {onDebugRefreshShop && (
              <button onClick={onDebugRefreshShop} className="btn-debug-inline">
                刷新商店
              </button>
            )}
            {onDebugDrawCard && (
              <button onClick={onDebugDrawCard} className="btn-debug-inline">
                抽一张卡
              </button>
            )}
            {onDebugUntapAll && (
              <button onClick={onDebugUntapAll} className="btn-debug-inline">
                整备所有
              </button>
            )}
            {onDebugToggleBuffPanel && (
              <button onClick={onDebugToggleBuffPanel} className="btn-debug-inline">
                Buff面板
              </button>
            )}
          </div>
        )}
        <div className="supply-display">
          补给: <span className={`supply-value ${supplyIncreasing ? 'supply-increasing' : ''}`}>
            {currentSupply}
            {supplyIncreasing && <span className="supply-arrow">↑</span>}
          </span> / {maxSupplyRetention}
        </div>
      </div>
      <div className="shop-content-horizontal">
        <div className="shop-section shop-section-left">
          <h4 className="shop-section-title">必要卡牌</h4>
          <div className="shop-cards essential-shop">
            {essentialStacks.length === 0 ? (
              <div className="shop-empty">暂无必要卡牌</div>
            ) : (
              essentialStacks
                .filter(stack => stack.count > 0) // 只显示有库存的卡牌
                .map((stack) => {
                  const canAfford = stack.card.cost <= currentSupply;
                  const isAvailable = isShopPhase && canAfford;
                  return (
                    <div
                      key={stack.card.id}
                      className={`shop-card-stack ${!canAfford && isShopPhase ? 'unaffordable' : ''}`}
                    >
                      <Card
                        card={stack.card}
                        onClick={isAvailable ? () => onCardClick(stack.actualCards[0], 'essential') : undefined}
                        onHover={onCardHover}
                        onHoverEnd={onCardHoverEnd}
                        className={`shop-card ${!canAfford && isShopPhase ? 'unaffordable' : ''}`}
                      />
                      <div className="card-stack-count">
                        {stack.count}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        <div className="shop-section shop-section-right">
          <h4 className="shop-section-title">随机卡牌</h4>
          <div className="shop-cards random-shop">
            {randomShopCards.length === 0 ? (
              <div className="shop-empty">暂无随机卡牌</div>
            ) : (
              randomShopCards.map((card) => {
                const canAfford = card.cost <= currentSupply;
                const isAvailable = isShopPhase && canAfford;
                return (
                  <div key={card.instanceId} className={`shop-card-single ${!canAfford && isShopPhase ? 'unaffordable' : ''}`}>
                    <Card
                      card={card}
                      onClick={isAvailable ? () => onCardClick(card, 'random') : undefined}
                      onHover={onCardHover}
                      onHoverEnd={onCardHoverEnd}
                      className={`shop-card ${!canAfford && isShopPhase ? 'unaffordable' : ''}`}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Shop;
