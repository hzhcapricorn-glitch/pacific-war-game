import React, { useState, useEffect } from 'react';
import Card from './Card';

/**
 * Shop Component - 显示商店（堆叠卡牌）
 */
function Shop({ shopCards, onCardClick, onCardHover, onCardHoverEnd, currentSupply, allCardTypes }) {
  // 保存所有见过的卡牌种类
  const [knownCardTypes, setKnownCardTypes] = useState([]);

  useEffect(() => {
    // 收集所有卡牌种类（包括当前存在的）
    const currentTypes = {};
    shopCards.forEach(card => {
      if (!currentTypes[card.id]) {
        currentTypes[card.id] = card;
      }
    });

    // 合并已知的卡牌种类
    setKnownCardTypes(prev => {
      const merged = { ...prev };
      Object.keys(currentTypes).forEach(id => {
        if (!merged[id]) {
          merged[id] = currentTypes[id];
        }
      });
      return merged;
    });
  }, [shopCards]);

  // 初始化时从所有卡牌中提取种类
  useEffect(() => {
    if (allCardTypes && allCardTypes.length > 0) {
      const types = {};
      allCardTypes.forEach(card => {
        if (!types[card.id]) {
          types[card.id] = card;
        }
      });
      setKnownCardTypes(types);
    }
  }, [allCardTypes]);

  // 按卡牌种类分组
  const groupedCards = {};

  // 首先基于已知的所有种类创建空堆
  Object.values(knownCardTypes).forEach(cardDef => {
    groupedCards[cardDef.id] = {
      card: cardDef,
      count: 0
    };
  });

  // 然后计算实际数量
  shopCards.forEach(card => {
    if (groupedCards[card.id]) {
      groupedCards[card.id].count++;
    }
  });

  const cardStacks = Object.values(groupedCards);

  return (
    <div className="shop">
      <div className="shop-header">
        <h3>商店</h3>
        <div className="supply-display">
          补给: <span className="supply-value">{currentSupply}</span>
        </div>
      </div>
      <div className="shop-content">
        {cardStacks.length === 0 ? (
          <div className="shop-empty">商店已售空</div>
        ) : (
          <div className="shop-cards">
            {cardStacks.map((stack) => (
              <div
                key={stack.card.id}
                className={`shop-card-stack ${stack.count === 0 ? 'empty' : ''}`}
              >
                <Card
                  card={stack.card}
                  onClick={stack.count > 0 ? onCardClick : undefined}
                  onHover={onCardHover}
                  onHoverEnd={onCardHoverEnd}
                  className={`shop-card ${stack.count === 0 ? 'sold-out' : ''}`}
                />
                <div className={`card-stack-count ${stack.count === 0 ? 'empty' : ''}`}>
                  {stack.count}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Shop;
