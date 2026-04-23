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
  isShopPhase
}) {
  // 保存所有见过的必要卡牌种类
  const [knownEssentialTypes, setKnownEssentialTypes] = useState([]);

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
        <div className="supply-display">
          补给: <span className="supply-value">{currentSupply} / {maxSupplyRetention}</span>
        </div>
      </div>
      <div className="shop-content-horizontal">
        <div className="shop-section shop-section-left">
          <h4 className="shop-section-title">必要卡牌</h4>
          <div className="shop-cards essential-shop">
            {essentialStacks.length === 0 ? (
              <div className="shop-empty">暂无必要卡牌</div>
            ) : (
              essentialStacks.map((stack) => (
                <div
                  key={stack.card.id}
                  className={`shop-card-stack ${stack.count === 0 ? 'empty' : ''}`}
                >
                  <Card
                    card={stack.card}
                    onClick={stack.count > 0 && isShopPhase ? () => onCardClick(stack.actualCards[0], 'essential') : undefined}
                    onHover={onCardHover}
                    onHoverEnd={onCardHoverEnd}
                    className={`shop-card ${stack.count === 0 ? 'sold-out' : ''}`}
                  />
                  <div className={`card-stack-count ${stack.count === 0 ? 'empty' : ''}`}>
                    {stack.count}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="shop-section shop-section-right">
          <h4 className="shop-section-title">随机卡牌</h4>
          <div className="shop-cards random-shop">
            {randomShopCards.length === 0 ? (
              <div className="shop-empty">暂无随机卡牌</div>
            ) : (
              randomShopCards.map((card) => (
                <div key={card.instanceId} className="shop-card-single">
                  <Card
                    card={card}
                    onClick={isShopPhase ? () => onCardClick(card, 'random') : undefined}
                    onHover={onCardHover}
                    onHoverEnd={onCardHoverEnd}
                    className="shop-card"
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Shop;
