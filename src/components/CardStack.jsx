import React, { useMemo } from 'react';
import { GamePhase } from '../models/GamePhase';
import Card from './Card';

/**
 * CardStack - 相同ID卡牌的竖直堆叠显示
 *
 * 功能：
 * - 相同卡牌竖直堆叠，露出上沿便于点击
 * - 显示 X/Y 指示器（仅当堆叠数量 > 1）
 * - 阶段智能排序：
 *   - SHOP: tapped在上（方便整备）
 *   - COMBAT: ready在上（方便选择）
 *   - 其他: ready在上（默认）
 */
function CardStack({
  cards,              // 同ID的卡牌数组
  phase,              // 当前游戏阶段
  onCardClick,        // 点击回调
  onCardHover,        // Hover回调
  onCardHoverEnd,     // Hover结束回调
  selectedCards = []  // 已选中的卡牌ID数组
}) {
  // 根据阶段智能排序
  const sortedCards = useMemo(() => {
    const sorted = [...cards];

    if (phase === GamePhase.SHOP) {
      // 商店阶段：tapped在上（方便整备）
      // 注意：数组最后的元素显示在视觉最上方，所以ready在前，tapped在后
      sorted.sort((a, b) => {
        if (a.status === 'ready' && b.status === 'tapped') return -1;
        if (a.status === 'tapped' && b.status === 'ready') return 1;
        return 0;
      });
    } else if (phase === GamePhase.COMBAT) {
      // 战斗阶段：ready在上（方便选择）
      // 注意：数组最后的元素显示在视觉最上方，所以tapped在前，ready在后
      sorted.sort((a, b) => {
        if (a.status === 'tapped' && b.status === 'ready') return -1;
        if (a.status === 'ready' && b.status === 'tapped') return 1;
        return 0;
      });
    } else {
      // 默认：ready在上
      // 注意：数组最后的元素显示在视觉最上方，所以tapped在前，ready在后
      sorted.sort((a, b) => {
        if (a.status === 'tapped' && b.status === 'ready') return -1;
        if (a.status === 'ready' && b.status === 'tapped') return 1;
        return 0;
      });
    }

    return sorted;
  }, [cards, phase]);

  // 计算ready数量
  const readyCount = cards.filter(c => c.status === 'ready').length;
  const totalCount = cards.length;

  // 计算堆叠偏移（从底部往上堆叠，后面的卡在上方）
  const getStackOffset = (index) => {
    // 从最后一张开始往前计算位置
    // 最后一张在底部(top=0)，前面的卡依次向下偏移
    const reverseIndex = totalCount - 1 - index;
    if (reverseIndex === 0) return 0; // 最后一张在底部

    let gap;
    if (totalCount <= 3) gap = 20;      // 20px间距
    else if (totalCount <= 5) gap = 16; // 16px间距
    else if (totalCount <= 8) gap = 12; // 12px间距
    else gap = 10;                       // 10px最小间距

    return reverseIndex * gap;
  };

  // 指示器颜色类
  const getIndicatorClass = () => {
    if (readyCount === totalCount) return 'all-ready';
    if (readyCount === 0) return 'none-ready';
    return '';
  };

  // 计算堆叠容器高度（使用第一张卡的offset，因为它在最上方）
  const stackHeight = 140 + getStackOffset(0);

  // 计算行间距：堆叠超出基础卡高的部分 + 5px缓冲（使用第一张卡的offset）
  const bottomMargin = totalCount > 1 ? getStackOffset(0) - 40 : 10;

  return (
    <div
      className="card-stack"
      style={{
        minHeight: `${stackHeight}px`,
        marginBottom: `${bottomMargin}px`
      }}
    >
      {/* X/Y 指示器 - 只在堆叠数量 > 1 时显示 */}
      {totalCount > 1 && (
        <div className={`stack-indicator ${getIndicatorClass()}`}>
          {readyCount}/{totalCount}
        </div>
      )}

      {/* 堆叠卡牌 - 逆序渲染，第一张在最底部 */}
      {sortedCards.map((card, index) => (
        <div
          key={card.instanceId}
          className="card-stack-item"
          style={{
            top: `${getStackOffset(index)}px`,
            zIndex: index + 1 // 越靠后的卡z-index越高
          }}
        >
          <Card
            card={card}
            onClick={onCardClick}
            onHover={onCardHover}
            onHoverEnd={onCardHoverEnd}
            className={selectedCards.includes(card.instanceId) ? 'selected' : ''}
          />
        </div>
      ))}
    </div>
  );
}

export default CardStack;
