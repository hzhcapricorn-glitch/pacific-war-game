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

  // 获取难度显示文本
  const getDifficultyText = () => {
    if (!card.difficulty) return '';
    const diffMap = {
      'easy': '简单',
      'normal': '普通',
      'hard': '困难',
      'hell': '地狱'
    };
    return diffMap[card.difficulty] || '';
  };

  // 获取战斗力显示（第一行，均匀分布）
  const getCombatLine = () => {
    const ground = `💣${card.groundPower || 0}`;
    const sea = `🌊${card.seaPower || 0}`;
    const air = `✈️${card.airPower || 0}`;
    const redeploy = `🛠️${card.redeployCost || 0}`;
    return `${ground}     ${sea}     ${air}     ${redeploy}`;
  };

  // 获取能力描述（动态生成，包含emoji）
  const getAbilityDescriptions = () => {
    if (!card.abilities || card.abilities.length === 0) {
      // 如果有航空槽位，也显示
      if (card.airSlots > 0) {
        return [`提供${card.airSlots}点航空槽位🛫`];
      }
      return [];
    }

    const descriptions = [];

    card.abilities.forEach(ability => {
      if (ability.type === 'supply') {
        descriptions.push(`提供${ability.value}点补给💰`);
      } else if (ability.type === 'draw') {
        descriptions.push(`抽${ability.value}张卡🃏`);
      } else if (ability.type === 'max_supply') {
        descriptions.push(`增加${ability.value}点最大补给保留📦`);
      } else if (ability.type === 'retire') {
        descriptions.push(`从弃牌堆移除一张卡牌🗑️`);
      } else if (ability.type !== 'goes_to_discard' && ability.type !== 'cannot_participate_in_combat') {
        descriptions.push(ability.type);
      }
    });

    // 添加航空槽位
    if (card.airSlots > 0) {
      descriptions.push(`提供${card.airSlots}点航空槽位🛫`);
    }

    return descriptions;
  };

  return (
    <div
      className={`card ${isTapped ? 'tapped' : ''} ${isMission ? 'mission-card' : ''} ${isSelected ? 'selected' : ''} ${className}`}
      data-rarity={card.rarity || 'N'}
      data-difficulty={card.difficulty || ''}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {showDetailed ? (
        // 详细视图（显示区）- 新布局
        <div className="card-detailed-new">
          {/* 区域1: 顶部信息栏 */}
          <div className="detail-header">
            <div className="detail-rarity">{isMission ? getDifficultyText() : (card.rarity || 'N')}</div>
            <div className="detail-name">{card.name}</div>
            <div className="detail-cost">{card.cost > 0 ? `💰${card.cost}` : ''}</div>
          </div>

          {/* 区域2: 图片区 */}
          <div className="detail-image-container">
            <div className="detail-image-placeholder">
              {/* 未来放置卡牌插画 */}
            </div>
            <div className="detail-type-badge">
              {isMission ? '任务卡' :
               card.cardCategory === 'tactical' ? '战术卡' :
               card.cardCategory === 'logistics' ? '后勤卡' :
               card.unitType === 'air' ? '单位：空军' :
               card.unitType === 'navy' ? '单位：海军' :
               card.unitType === 'army' ? '单位：陆军' : '单位'}
            </div>
          </div>

          {/* 区域3: 卡牌效果 */}
          <div className="detail-effects">
            {isMission ? (
              <>
                <div className="detail-combat-line">
                  💣{card.requiredGroundPower || 0}     🌊{card.requiredSeaPower || 0}     ✈️{card.requiredAirPower || 0}
                </div>
                {card.reward && <div className="detail-mission-reward">✓ {card.reward.description}</div>}
                {card.loss && <div className="detail-mission-loss">✗ {card.loss.description}</div>}
              </>
            ) : (
              <>
                <div className="detail-combat-line">
                  {getCombatLine()}
                </div>
                {getAbilityDescriptions().map((desc, idx) => (
                  <div key={idx} className="detail-ability-text">{desc}</div>
                ))}
              </>
            )}
          </div>

          {/* 区域4: 趣味信息 */}
          <div className="detail-flavor">
            {card.flavor && <em>"{card.flavor}"</em>}
          </div>
        </div>
      ) : (
        // 简略视图
        <div className="card-compact">
          <div className="card-name">{card.name}</div>
          <div className="card-stats-compact">
            {isMission ? (
              <>
                {card.requiredGroundPower > 0 && <span className="combat-requirement">💣{card.requiredGroundPower}</span>}
                {card.requiredSeaPower > 0 && <span className="combat-requirement">🌊{card.requiredSeaPower}</span>}
                {card.requiredAirPower > 0 && <span className="combat-requirement">✈️{card.requiredAirPower}</span>}
              </>
            ) : (
              <>
                {card.groundPower > 0 && <span className="combat">💣{card.groundPower}</span>}
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
