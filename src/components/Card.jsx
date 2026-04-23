import React from 'react';

/**
 * Card Component - 显示单张卡牌
 */
function Card({ card, onClick, onHover, onHoverEnd, className = '', showDetailed = false, isSelected = false }) {
  const handleClick = () => {
    if (onClick) {
      onClick(card);
    }
  };

  const handleMouseEnter = () => {
    if (onHover) {
      onHover(card);
    }
  };

  const handleMouseLeave = () => {
    if (onHoverEnd) {
      onHoverEnd();
    }
  };

  const isTapped = card.status === 'tapped';
  const isMission = card.type === 'mission';

  return (
    <div
      className={`card ${isTapped ? 'tapped' : ''} ${isMission ? 'mission-card' : ''} ${isSelected ? 'selected' : ''} ${className}`}
      data-rarity={card.rarity || 'N'}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {showDetailed ? (
        // 详细视图（显示区）
        <div className="card-detailed">
          <h3 className="card-name">{card.name}</h3>
          {isMission ? (
            <>
              <div className="card-stats">
                {card.requiredGroundPower > 0 && (
                  <div className="card-stat">
                    <span className="label">需要对地火力:</span>
                    <span className="value combat">{card.requiredGroundPower}</span>
                  </div>
                )}
                {card.requiredSeaPower > 0 && (
                  <div className="card-stat">
                    <span className="label">需要对海火力:</span>
                    <span className="value combat">{card.requiredSeaPower}</span>
                  </div>
                )}
                {card.requiredAirPower > 0 && (
                  <div className="card-stat">
                    <span className="label">需要对空火力:</span>
                    <span className="value" style={{color: '#f59e0b'}}>{card.requiredAirPower}</span>
                  </div>
                )}
              </div>
              <div className="card-description">{card.description}</div>
              {card.reward && (
                <div className="card-reward">
                  <strong>奖励:</strong> {card.reward.description}
                </div>
              )}
              {card.loss && (
                <div className="card-loss">
                  <strong>损失:</strong> {card.loss.description}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="card-stats">
                {card.rarity && card.rarity !== 'N' && (
                  <div className="card-stat">
                    <span className="label">稀有度:</span>
                    <span className="value" style={{
                      color: card.rarity === 'R' ? '#60a5fa' :
                             card.rarity === 'SR' ? '#c084fc' :
                             card.rarity === 'UR' ? '#fbbf24' : '#fff'
                    }}>{card.rarity}</span>
                  </div>
                )}
                {card.cardCategory && (
                  <div className="card-stat">
                    <span className="label">类别:</span>
                    <span className="value" style={{
                      color: card.cardCategory === 'tactical' ? '#34d399' :
                             card.cardCategory === 'logistics' ? '#60a5fa' : '#fff'
                    }}>{
                      card.cardCategory === 'tactical' ? '战术' :
                      card.cardCategory === 'logistics' ? '后勤' :
                      card.cardCategory === 'combat' ? '单位' : card.cardCategory
                    }</span>
                  </div>
                )}
                {card.unitType && (
                  <div className="card-stat">
                    <span className="label">单位:</span>
                    <span className="value">{
                      card.unitType === 'air' ? '空军' :
                      card.unitType === 'navy' ? '海军' :
                      card.unitType === 'army' ? '陆军' : card.unitType
                    }</span>
                  </div>
                )}
                {card.cost > 0 && (
                  <div className="card-stat">
                    <span className="label">价格:</span>
                    <span className="value">{card.cost}</span>
                  </div>
                )}
                {card.groundPower > 0 && (
                  <div className="card-stat">
                    <span className="label">对地火力:</span>
                    <span className="value combat">{card.groundPower}</span>
                  </div>
                )}
                {card.seaPower > 0 && (
                  <div className="card-stat">
                    <span className="label">对海火力:</span>
                    <span className="value combat">{card.seaPower}</span>
                  </div>
                )}
                {card.airPower > 0 && (
                  <div className="card-stat">
                    <span className="label">对空火力:</span>
                    <span className="value combat">{card.airPower}</span>
                  </div>
                )}
                {card.airSlots > 0 && (
                  <div className="card-stat">
                    <span className="label">航空槽位:</span>
                    <span className="value" style={{color: '#60a5fa'}}>+{card.airSlots}</span>
                  </div>
                )}
                {card.redeployCost > 0 && (
                  <div className="card-stat">
                    <span className="label">重置费用:</span>
                    <span className="value">{card.redeployCost}</span>
                  </div>
                )}
              </div>
              <div className="card-description">{card.description}</div>
              {card.abilities && card.abilities.length > 0 && (
                <div className="card-abilities">
                  {card.abilities.map((ability, idx) => (
                    <div key={idx} className="ability">
                      {ability.type}: +{ability.value}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {card.flavor && (
            <div className="card-flavor">
              <em>"{card.flavor}"</em>
            </div>
          )}
        </div>
      ) : (
        // 简略视图
        <div className="card-compact">
          <div className="card-name">{card.name}</div>
          <div className="card-stats-compact">
            {isMission ? (
              <>
                {card.requiredGroundPower > 0 && <span className="combat-requirement">地:{card.requiredGroundPower}</span>}
                {card.requiredSeaPower > 0 && <span className="combat-requirement">海:{card.requiredSeaPower}</span>}
                {card.requiredAirPower > 0 && <span className="combat-requirement">空:{card.requiredAirPower}</span>}
              </>
            ) : (
              <>
                {card.groundPower > 0 && <span className="combat">🏔️{card.groundPower}</span>}
                {card.seaPower > 0 && <span className="combat">🌊{card.seaPower}</span>}
                {card.airPower > 0 && <span className="combat">✈️{card.airPower}</span>}
                {card.airSlots > 0 && <span style={{color: '#60a5fa'}}>🛫{card.airSlots}</span>}
                {card.cost > 0 && <span className="cost">💰{card.cost}</span>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Card;
