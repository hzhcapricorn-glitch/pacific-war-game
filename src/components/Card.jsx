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

  // 获取战斗力显示（详细视图：只显示三种火力，不含整备费用）
  const getCombatLine = () => {
    const ground = `💣${card.groundPower || 0}`;
    const sea = `🌊${card.seaPower || 0}`;
    const air = `✈️${card.airPower || 0}`;
    return `${ground}       ${sea}       ${air}`;
  };

  // 获取任务卡需求战斗力显示（动态调整空格）
  const getMissionRequirementLine = () => {
    const ground = card.requiredGroundPower || 0;
    const sea = card.requiredSeaPower || 0;
    const airDef = card.requiredAirDefense || 0;
    const airSup = card.requiredAirSuperiority || 0;

    // 计算每个数字的位数
    const groundLen = String(ground).length;
    const seaLen = String(sea).length;
    const airDefLen = String(airDef).length;

    // 基础空格数（1位数时用4个空格）
    const baseSpaces = 4;

    // 根据数字位数减少空格（每多1位减1个空格）
    const spaces1 = ' '.repeat(Math.max(1, baseSpaces - groundLen + 1));
    const spaces2 = ' '.repeat(Math.max(1, baseSpaces - seaLen + 1));
    const spaces3 = ' '.repeat(Math.max(1, baseSpaces - airDefLen + 1));

    return `💣${ground}${spaces1}🌊${sea}${spaces2}🎯${airDef}${spaces3}✈️${airSup}`;
  };

  // 获取能力名称（用于简略视图）
  const getAbilityNames = () => {
    if (!card.abilities || card.abilities.length === 0) {
      if (card.airSlots > 0) {
        return [`航空${card.airSlots}`];
      }
      return [];
    }

    const names = [];
    card.abilities.forEach(ability => {
      if (ability.type === 'supply') {
        names.push(`补给+${ability.value || 1}`);
      } else if (ability.type === 'draw') {
        names.push('抽卡');
      } else if (ability.type === 'max_supply') {
        names.push(`储备+${ability.value || 1}`);
      } else if (ability.type === 'retire') {
        names.push('退役');
      } else if (ability.type === 'protect') {
        names.push('幸运');
      } else if (ability.type === 'return_to_base') {
        names.push('返航');
      } else if (ability.type === 'scout') {
        names.push('侦查');
      } else if (ability.type === 'expand_shop') {
        names.push('扩容');
      } else if (ability.type === 'quick_response') {
        names.push('快整');
      } else if (ability.type === 'heavy_armor') {
        names.push(`重甲${ability.value || 1}`);
      }
    });

    if (card.airSlots > 0) {
      names.push(`航空${card.airSlots}`);
    }

    return names;
  };

  // 获取能力描述（详细视图，带能力名称前缀）
  const getAbilityDescriptions = () => {
    if (!card.abilities || card.abilities.length === 0) {
      if (card.airSlots > 0) {
        return [`航空：提供${card.airSlots}点航空槽位🛫`];
      }
      return [];
    }

    const descriptions = [];

    card.abilities.forEach(ability => {
      if (ability.type === 'supply') {
        descriptions.push(`补给：提供${ability.value}点补给💰`);
      } else if (ability.type === 'draw') {
        descriptions.push(`抽卡：抽${ability.value}张卡🃏`);
      } else if (ability.type === 'max_supply') {
        descriptions.push(`储备：增加${ability.value}点最大补给保留📦`);
      } else if (ability.type === 'retire') {
        descriptions.push(`退役：从弃牌堆移除一张卡牌🗑️`);
      } else if (ability.type === 'protect') {
        descriptions.push(`幸运：战斗损失时优先损失其他卡牌🍀`);
      } else if (ability.type === 'return_to_base') {
        descriptions.push(`返航：对空充足时损失后进入弃牌堆`);
      } else if (ability.type === 'scout') {
        descriptions.push(`侦查：抽${ability.value}张卡后整备🔍`);
      } else if (ability.type === 'expand_shop') {
        descriptions.push(`扩容：商店刷新时+${ability.value}张卡牌🏪`);
      } else if (ability.type === 'quick_response') {
        descriptions.push(`快速整备：激活一张整备中的卡牌⚡`);
      } else if (ability.type === 'heavy_armor') {
        descriptions.push(`重甲${ability.value}：战斗损失时需被选中${ability.value + 1}次才损失🛡️`);
      } else if (ability.type !== 'goes_to_discard' && ability.type !== 'cannot_participate_in_combat') {
        descriptions.push(ability.type);
      }
    });

    if (card.airSlots > 0) {
      descriptions.push(`航空：提供${card.airSlots}点航空槽位🛫`);
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
      {/* 整备中卡牌整备提示 */}
      {isTapped && !isMission && card.redeployCost > 0 && (
        <div className="card-redeploy-overlay">
          🛠️{card.redeployCost}
        </div>
      )}
      {showDetailed ? (
        // 详细视图（显示区）- 新布局
        <div className="card-detailed-new">
          {/* 区域1: 顶部信息栏 */}
          <div className="detail-header">
            <div className="detail-rarity">{isMission ? getDifficultyText() : (card.rarity || 'N')}</div>
            <div className="detail-name">{card.name}</div>
            <div className="detail-cost">
              {card.cost > 0 && `💰${card.cost}`}
              {!isMission && card.redeployCost > 0 && (card.cost > 0 ? `  🛠️${card.redeployCost}` : `🛠️${card.redeployCost}`)}
            </div>
          </div>

          {/* 区域2: 图片区 */}
          <div className="detail-image-container">
            <div className="detail-image-placeholder">
              {card.backgroundImage && (
                <img
                  src={card.backgroundImage}
                  alt={`${card.name} 背景`}
                  className="card-background-image"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              )}
              {card.image && (
                <img
                  src={card.image}
                  alt={card.name}
                  className={card.backgroundImage ? 'card-foreground-image' : ''}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              )}
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
                  {getMissionRequirementLine()}
                </div>
                {card.reward && <div className="detail-mission-reward">✓ {card.reward.description}</div>}
                {card.loss && <div className="detail-mission-loss">✗ {card.loss.description}</div>}
              </>
            ) : (
              <>
                {(card.groundPower > 0 || card.seaPower > 0 || card.airPower > 0) && (
                  <div className="detail-combat-line">
                    {getCombatLine()}
                  </div>
                )}
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
          {!isMission && (
            <div className="card-price-line">
              {card.cost > 0 && <span className="cost">💰{card.cost}</span>}
              {card.redeployCost > 0 && <span className="redeploy-cost">🛠️{card.redeployCost}</span>}
            </div>
          )}
          <div className="card-stats-compact">
            {isMission ? (
              <>
                {card.requiredGroundPower > 0 && <span className="combat-requirement">💣{card.requiredGroundPower}</span>}
                {card.requiredSeaPower > 0 && <span className="combat-requirement">🌊{card.requiredSeaPower}</span>}
                {card.requiredAirDefense > 0 && <span className="combat-requirement">🎯{card.requiredAirDefense}</span>}
                {card.requiredAirSuperiority > 0 && <span className="combat-requirement">✈️{card.requiredAirSuperiority}</span>}
              </>
            ) : (
              <>
                {card.groundPower > 0 && <span className="combat">💣{card.groundPower}</span>}
                {card.seaPower > 0 && <span className="combat">🌊{card.seaPower}</span>}
                {card.airPower > 0 && <span className="combat">✈️{card.airPower}</span>}
              </>
            )}
          </div>
          {!isMission && getAbilityNames().length > 0 && (
            <div className="card-abilities-compact">
              {getAbilityNames().map((name, idx) => (
                <span key={idx} className="ability-name">{name}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Card;
