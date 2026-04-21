import React from 'react';
import Card from './Card';

/**
 * CardListModal - 显示卡牌列表的弹窗
 */
function CardListModal({ isOpen, onClose, cards, title, onCardHover, onCardHoverEnd }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {cards.length === 0 ? (
            <div className="modal-empty">没有卡牌</div>
          ) : (
            <div className="modal-cards">
              {cards.map((card) => (
                <Card
                  key={card.instanceId || card.id}
                  card={card}
                  onHover={onCardHover}
                  onHoverEnd={onCardHoverEnd}
                />
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-modal-close">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export default CardListModal;
