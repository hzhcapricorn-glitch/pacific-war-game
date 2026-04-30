import React from 'react';
import Card from './Card';

/**
 * CardZone Component - 显示一个卡牌区域
 */
function CardZone({
  title,
  cards,
  onCardClick,
  onCardHover,
  onCardHoverEnd,
  className = '',
  emptyMessage = '空',
  showCount = true,
  maxDisplay = null,
  selectedCards = [],
  showLastOnly = false,
  onZoneClick = null,
  showCountOnly = false,
  onSortClick = null
}) {
  let displayedCards;
  let hiddenCount = 0;

  if (showCountOnly) {
    // 只显示数量，不显示卡牌
    displayedCards = [];
    hiddenCount = cards.length;
  } else if (showLastOnly) {
    // 只显示最后一张卡牌
    displayedCards = cards.length > 0 ? [cards[cards.length - 1]] : [];
    hiddenCount = cards.length > 1 ? cards.length - 1 : 0;
  } else {
    displayedCards = maxDisplay ? cards.slice(0, maxDisplay) : cards;
    hiddenCount = maxDisplay && cards.length > maxDisplay ? cards.length - maxDisplay : 0;
  }

  const handleZoneClick = () => {
    if (onZoneClick) {
      onZoneClick();
    }
  };

  return (
    <div
      className={`card-zone ${className} ${onZoneClick ? 'clickable' : ''}`}
      onClick={onZoneClick ? handleZoneClick : undefined}
    >
      <div className="zone-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 className="zone-title">{title}</h3>
          {onSortClick && (
            <button
              className="btn-sort-zone"
              onClick={(e) => {
                e.stopPropagation();
                onSortClick();
              }}
            >
              排序
            </button>
          )}
        </div>
        {showCount && <span className="zone-count">({cards.length})</span>}
      </div>
      <div className="zone-content">
        {cards.length === 0 ? (
          <div className="zone-empty">{emptyMessage}</div>
        ) : (
          <>
            {displayedCards.map((card) => (
              <Card
                key={card.instanceId || card.id}
                card={card}
                onClick={onCardClick}
                onHover={onCardHover}
                onHoverEnd={onCardHoverEnd}
                isSelected={selectedCards.includes(card.instanceId)}
              />
            ))}
            {hiddenCount > 0 && (
              <div className="zone-hidden-count">
                +{hiddenCount} 张
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default CardZone;
