import { getCardFirePower } from '../models/Card';
import { processAbilities, hasProtectAbility, getHeavyArmorValue, hasReturnToBaseAbility } from './AbilitySystem';
import { applyBuffsToMissionRequirements, applyBuffsToLossCount } from './BuffSystem';

/**
 * CombatSystem - 处理战斗相关的逻辑（太平洋战争版本）
 */

/**
 * 计算卡牌列表的火力（按类型）
 * @param {Array} cards - 参战卡牌数组
 * @param {string} powerType - 火力类型: 'ground', 'sea', 'air'
 * @returns {number} 总火力
 */
export function calculateFirePower(cards, powerType) {
  return cards.reduce((total, card) => {
    return total + getCardFirePower(card, powerType);
  }, 0);
}

/**
 * 计算防空火力（所有单位的对空火力之和）
 * @param {Array} cards - 参战卡牌数组
 * @returns {number} 防空火力
 */
export function calculateAirDefense(cards) {
  return calculateFirePower(cards, 'air');
}

/**
 * 计算制空火力（仅空军单位的对空火力之和）
 * @param {Array} cards - 参战卡牌数组
 * @returns {number} 制空火力
 */
export function calculateAirSuperiority(cards) {
  return cards
    .filter(card => card.unitType === 'air')
    .reduce((total, card) => total + getCardFirePower(card, 'air'), 0);
}

/**
 * 计算所有类型的火力
 * @param {Array} cards - 参战卡牌数组
 * @param {Object} context - 可选的上下文对象（包含state、mission等，用于能力处理）
 * @returns {Object} { groundPower, seaPower, airPower, airDefense, airSuperiority }
 */
export function calculateAllFirePowers(cards, context = null) {
  // 计算基础火力
  const basePowers = {
    groundPower: calculateFirePower(cards, 'ground'),
    seaPower: calculateFirePower(cards, 'sea'),
    airPower: calculateFirePower(cards, 'air'),
    airDefense: calculateAirDefense(cards),
    airSuperiority: calculateAirSuperiority(cards)
  };

  // 如果没有提供context，返回基础火力
  if (!context) {
    return basePowers;
  }

  // 应用任务约束的火力调整
  const mission = context.mission || context.state?.currentMission;
  if (mission && mission.missionConstraints) {
    const powerModifiers = mission.missionConstraints.filter(c => c.type === 'modify_unit_power');

    powerModifiers.forEach(constraint => {
      const { unitTypes, powerType, multiplier } = constraint;

      // 筛选出受影响的单位
      const affectedCards = cards.filter(card => unitTypes.includes(card.unitType));

      // 计算调整量（原值 * (multiplier - 1)，因为基础火力已经计算过了）
      affectedCards.forEach(card => {
        const originalPower = getCardFirePower(card, powerType);
        const adjustment = originalPower * (multiplier - 1);

        if (powerType === 'ground') {
          basePowers.groundPower += adjustment;
        } else if (powerType === 'sea') {
          basePowers.seaPower += adjustment;
        } else if (powerType === 'air') {
          basePowers.airPower += adjustment;
          basePowers.airDefense += adjustment;
          basePowers.airSuperiority += adjustment;
        }
      });
    });
  }

  // 获取所有部署区卡牌（包括未参战的，如领袖）
  const allDeployedCards = context.state?.zones?.deployed || cards;

  // 处理combat_boost能力（从所有部署区卡牌中检查）
  const combatModifiers = allDeployedCards.flatMap(card =>
    processAbilities(card, 'during_combat', {
      state: context.state,
      card,
      cards  // 传入参战卡牌列表用于目标筛选
    })
  ).filter(result => result.type === 'combat_modifier');

  // 应用修正值
  combatModifiers.forEach(modifierResult => {
    const modifier = modifierResult.modifier;

    // 新格式：支持目标选择（如哈尔西的能力）
    if (modifier.target && modifier.stat) {
      const { target, stat, value } = modifier;

      // 根据目标类型筛选卡牌
      let targetCards = [];
      if (target === 'air_units_with_sea_power') {
        // 空军单位且对海战斗力不为0
        targetCards = cards.filter(c => c.unitType === 'air' && (c.seaPower || 0) > 0);
      } else if (target === 'all') {
        targetCards = cards;
      }

      // 为每个目标卡牌应用加成
      const boost = value * targetCards.length;
      if (stat === 'seaPower') {
        basePowers.seaPower += boost;
      } else if (stat === 'groundPower') {
        basePowers.groundPower += boost;
      } else if (stat === 'airPower') {
        basePowers.airPower += boost;
        basePowers.airDefense += boost;
        basePowers.airSuperiority += boost;
      }
    }
    // 旧格式：全局增益
    else if (modifier.powerType) {
      const { powerType, value } = modifier;

      if (powerType === 'all') {
        basePowers.groundPower += value;
        basePowers.seaPower += value;
        basePowers.airPower += value;
        basePowers.airDefense += value;
        basePowers.airSuperiority += value;
      } else if (powerType === 'groundPower' || powerType === 'ground') {
        basePowers.groundPower += value;
      } else if (powerType === 'seaPower' || powerType === 'sea') {
        basePowers.seaPower += value;
      } else if (powerType === 'airPower' || powerType === 'air') {
        basePowers.airPower += value;
        basePowers.airDefense += value;
        basePowers.airSuperiority += value;
      }
    }
  });

  // 应用战场buff的add_combat_power和reduce_combat_power效果
  const battlefieldConditions = context.state?.battlefieldConditions || [];
  battlefieldConditions.forEach(condition => {
    const effects = Array.isArray(condition.effect) ? condition.effect : [condition.effect].filter(Boolean);

    effects.forEach(effect => {
      if (effect && (effect.type === 'add_combat_power' || effect.type === 'reduce_combat_power')) {
        const { powerType, value, unitTypes } = effect;
        const isReduction = effect.type === 'reduce_combat_power';

        // 如果指定了unitTypes，只对特定单位类型生效
        let affectedCards = cards;
        if (unitTypes && unitTypes.length > 0) {
          affectedCards = cards.filter(card => unitTypes.includes(card.unitType));
        }

        // 计算加成或减益（每张受影响的卡牌获得value加成/减益）
        const modification = value * affectedCards.length * (isReduction ? -1 : 1);

        if (powerType === 'all') {
          basePowers.groundPower += modification;
          basePowers.seaPower += modification;
          basePowers.airPower += modification;
          basePowers.airDefense += modification;
          basePowers.airSuperiority += modification;
        } else if (powerType === 'ground') {
          basePowers.groundPower += modification;
        } else if (powerType === 'sea') {
          basePowers.seaPower += modification;
        } else if (powerType === 'air') {
          basePowers.airPower += modification;
          basePowers.airDefense += modification;
          basePowers.airSuperiority += modification;
        }
      }
    });
  });

  return basePowers;
}

/**
 * 判断战斗是否胜利
 * @param {Object} attackPowers - 己方火力 { groundPower, seaPower, airPower }
 * @param {Object} requiredPowers - 调整后的任务需求（可以是mission对象或者已调整的需求对象）
 * @returns {boolean} 是否胜利
 */
export function isVictorious(attackPowers, requiredPowers) {
  const groundMet = attackPowers.groundPower >= (requiredPowers.groundPower || requiredPowers.requiredGroundPower || 0);
  const seaMet = attackPowers.seaPower >= (requiredPowers.seaPower || requiredPowers.requiredSeaPower || 0);
  // 对空火力不足不影响胜利，但会影响损失
  return groundMet && seaMet;
}

/**
 * 检查防空火力是否满足（用于判断损失是否加倍）
 * @param {Object} attackPowers - 己方火力
 * @param {Object} requiredPowers - 调整后的任务需求（可以是mission对象或者已调整的需求对象）
 * @returns {boolean} 防空火力是否满足
 */
export function isAirDefenseSufficient(attackPowers, requiredPowers) {
  return attackPowers.airDefense >= (requiredPowers.airDefense || requiredPowers.requiredAirDefense || requiredPowers.requiredAirPower || 0);
}

/**
 * 检查制空火力是否满足（用于判断返航能力是否触发）
 * @param {Object} attackPowers - 己方火力
 * @param {Object} requiredPowers - 调整后的任务需求（可以是mission对象或者已调整的需求对象）
 * @returns {boolean} 制空火力是否满足
 */
export function isAirSuperiorityAchieved(attackPowers, requiredPowers) {
  return attackPowers.airSuperiority >= (requiredPowers.airSuperiority || requiredPowers.requiredAirSuperiority || requiredPowers.requiredAirPower || 0);
}

/**
 * 应用战斗奖励
 * @param {Object} reward - 奖励对象 { type, value, description }
 * @param {Object} gameState - 当前游戏状态
 * @returns {Object} 奖励效果 { supply, maxSupply, ... }
 */
export function applyReward(reward, gameState) {
  const effects = {
    supply: 0,
    maxSupply: 0,
    victory: false
  };

  if (!reward) return effects;

  switch (reward.type) {
    case 'supply':
      effects.supply = reward.value;
      break;
    case 'max_supply':
      effects.maxSupply = reward.value;
      break;
    case 'victory':
      effects.victory = true;
      break;
    default:
      break;
  }

  return effects;
}

/**
 * 计算战斗损失 - 随机选择需要损失的卡牌，支持重甲和幸运能力
 * @param {Array} participatingCards - 参战卡牌数组
 * @param {Object} loss - 损失对象 { randomLoss, description }
 * @param {boolean} airDefenseSufficient - 对空火力是否满足
 * @returns {Object} { lostCardIds: Array, damageDetails: Array, abilitiesDisabled: Object }
 */
export function calculateLosses(participatingCards, loss, airDefenseSufficient, battlefieldConditions = [], airSuperiorityAchieved = true) {
  if (!loss || !loss.randomLoss || loss.randomLoss === 0 || participatingCards.length === 0) {
    return { lostCardIds: [], damageDetails: [], abilitiesDisabled: { heavyArmor: false, lucky: false } };
  }

  // 检查是否有禁用能力的效果（神风威胁）
  let disableHeavyArmor = false;
  let disableLucky = false;

  battlefieldConditions.forEach(condition => {
    const effects = Array.isArray(condition.effect) ? condition.effect : [condition.effect].filter(Boolean);

    effects.forEach(effect => {
      if (effect && effect.type === 'disable_abilities_when_no_air_superiority' && !airSuperiorityAchieved) {
        const disabledAbilities = effect.disabledAbilities || [];
        if (disabledAbilities.includes('heavy_armor')) {
          disableHeavyArmor = true;
        }
        if (disabledAbilities.includes('lucky')) {
          disableLucky = true;
        }
      }
    });
  });

  // 应用战场buff修改损失数量
  let baseLoss = applyBuffsToLossCount(loss.randomLoss, battlefieldConditions);

  // 对空火力不足时损失加倍
  let lossCount = baseLoss;
  if (!airDefenseSufficient) {
    lossCount *= 2;
  }

  // 构建卡牌池：重甲X的卡牌算作X+1个单位（除非被禁用）
  const cardPool = [];
  participatingCards.forEach(card => {
    const armorValue = disableHeavyArmor ? 0 : getHeavyArmorValue(card);
    const copies = armorValue + 1; // 重甲X需要被选中X+1次
    for (let i = 0; i < copies; i++) {
      cardPool.push({
        card,
        isLucky: disableLucky ? false : hasProtectAbility(card),
        hitCount: 0 // 记录该卡已被选中的次数
      });
    }
  });

  // 将卡牌池分为两组：有幸运能力的和没有的
  const vulnerablePool = cardPool.filter(entry => !entry.isLucky);
  const luckyPool = cardPool.filter(entry => entry.isLucky);

  // 跟踪每张卡牌被选中的次数
  const hitTracker = new Map(); // instanceId -> 被选中次数
  participatingCards.forEach(card => {
    hitTracker.set(card.instanceId, 0);
  });

  const lostCards = [];
  let remainingLoss = lossCount;

  // 第一阶段：优先从普通卡牌池中随机选择
  const availableVulnerable = [...vulnerablePool];
  while (remainingLoss > 0 && availableVulnerable.length > 0) {
    const randomIndex = Math.floor(Math.random() * availableVulnerable.length);
    const selected = availableVulnerable.splice(randomIndex, 1)[0];

    const cardId = selected.card.instanceId;
    const currentHits = hitTracker.get(cardId) + 1;
    hitTracker.set(cardId, currentHits);

    const armorValue = disableHeavyArmor ? 0 : getHeavyArmorValue(selected.card);
    const requiredHits = armorValue + 1;

    // 检查是否达到损失条件
    if (currentHits >= requiredHits) {
      // 卡牌真正损失（返回商店）
      if (!lostCards.includes(cardId)) {
        lostCards.push(cardId);
      }
    }

    remainingLoss--;
  }

  // 第二阶段：如果还需要更多损失，从幸运卡牌池中选择
  const availableLucky = [...luckyPool];
  while (remainingLoss > 0 && availableLucky.length > 0) {
    const randomIndex = Math.floor(Math.random() * availableLucky.length);
    const selected = availableLucky.splice(randomIndex, 1)[0];

    const cardId = selected.card.instanceId;
    const currentHits = hitTracker.get(cardId) + 1;
    hitTracker.set(cardId, currentHits);

    const armorValue = disableHeavyArmor ? 0 : getHeavyArmorValue(selected.card);
    const requiredHits = armorValue + 1;

    if (currentHits >= requiredHits) {
      if (!lostCards.includes(cardId)) {
        lostCards.push(cardId);
      }
    }

    remainingLoss--;
  }

  // 生成损伤详情
  const damageDetails = [];
  participatingCards.forEach(card => {
    const hits = hitTracker.get(card.instanceId);
    if (hits > 0) {
      const originalArmorValue = getHeavyArmorValue(card);
      // 如果神风威胁禁用了重甲，则armorValue视为0
      const armorValue = disableHeavyArmor ? 0 : originalArmorValue;
      const requiredHits = armorValue + 1;
      const isDestroyed = hits >= requiredHits;

      damageDetails.push({
        card,
        hits,
        armorValue,
        originalArmorValue, // 保存原始装甲值用于显示
        requiredHits,
        isDestroyed
      });
    }
  });

  return {
    lostCardIds: lostCards,
    damageDetails,
    abilitiesDisabled: {
      heavyArmor: disableHeavyArmor,
      lucky: disableLucky
    }
  };
}

/**
 * 战斗结算 - 完整的战斗流程
 * @param {Array} selectedCards - 选中参战的卡牌
 * @param {Object} mission - 当前任务
 * @param {Object} gameState - 当前游戏状态
 * @returns {Object} 战斗结果 { victory, attackPowers, requiredPowers, rewards, lostCardIds, lostCards, damageDetails, airDefenseSufficient, airSuperiorityAchieved, abilitiesDisabled }
 */
export function resolveCombat(selectedCards, mission, gameState) {
  // 计算己方火力（包括combat_boost能力和任务约束）
  const attackPowers = calculateAllFirePowers(selectedCards, { state: gameState, mission });

  // 应用战场buff修改任务需求
  const requiredPowers = applyBuffsToMissionRequirements(
    mission,
    gameState.battlefieldConditions || []
  );

  // 判断胜负（使用调整后的需求）
  const victory = isVictorious(attackPowers, requiredPowers);

  // 检查防空火力是否满足（影响损失加倍，使用调整后的需求）
  const airDefenseSufficient = isAirDefenseSufficient(attackPowers, requiredPowers);

  // 检查制空火力是否满足（影响返航能力，使用调整后的需求）
  const airSuperiorityAchieved = isAirSuperiorityAchieved(attackPowers, requiredPowers);

  // 应用奖励（仅在胜利时）
  const rewards = victory ? applyReward(mission.reward, gameState) : { supply: 0, maxSupply: 0, victory: false };

  // 计算损失（无论胜负都会有损失，防空不足时加倍）
  const lossResult = calculateLosses(
    selectedCards,
    mission.loss,
    airDefenseSufficient,
    gameState.battlefieldConditions || [],
    airSuperiorityAchieved
  );

  // 获取损失的卡牌对象（用于显示具体卡牌名称）
  const lostCards = selectedCards.filter(card => lossResult.lostCardIds.includes(card.instanceId));

  return {
    victory,
    attackPowers,
    requiredPowers,
    rewards,
    lostCardIds: lossResult.lostCardIds,
    lostCards,
    damageDetails: lossResult.damageDetails,
    airDefenseSufficient,
    airSuperiorityAchieved,
    abilitiesDisabled: lossResult.abilitiesDisabled
  };
}

/**
 * 获取战斗结果摘要文本
 * @param {Object} combatResult - 战斗结果
 * @returns {string} 摘要文本
 */
export function getCombatSummary(combatResult) {
  const {
    victory,
    attackPowers,
    requiredPowers,
    rewards,
    lostCards,
    damageDetails,
    airDefenseSufficient,
    airSuperiorityAchieved,
    abilitiesDisabled
  } = combatResult;

  let summary = victory ? '🎉 战斗胜利！\n\n' : '❌ 战斗失败...\n\n';

  summary += '己方火力:\n';
  summary += `  对地: ${attackPowers.groundPower} / ${requiredPowers.groundPower}\n`;
  summary += `  对海: ${attackPowers.seaPower} / ${requiredPowers.seaPower}\n`;
  summary += `  防空: ${attackPowers.airDefense} / ${requiredPowers.airDefense}`;

  if (!airDefenseSufficient && requiredPowers.airDefense > 0) {
    summary += ' ⚠️ 不足！损失加倍\n';
  } else {
    summary += '\n';
  }

  summary += `  制空: ${attackPowers.airSuperiority} / ${requiredPowers.airSuperiority}`;
  if (airSuperiorityAchieved) {
    summary += ' ✓ 空军可返航\n';
  } else {
    summary += '\n';
  }

  if (victory) {
    summary += '\n获得奖励:\n';
    if (rewards.supply > 0) summary += `  - 补给 +${rewards.supply}\n`;
    if (rewards.maxSupply > 0) summary += `  - 最大补给保留 +${rewards.maxSupply}\n`;
    if (rewards.victory) summary += '  - 完成最终任务！\n';
  }

  // 显示损伤详情
  if (damageDetails && damageDetails.length > 0) {
    summary += '\n战损情况:\n';
    damageDetails.forEach(detail => {
      const { card, hits, armorValue, originalArmorValue, isDestroyed } = detail;
      const cardName = card.name.replace(/\n/g, '');

      // 检查是否有返航能力
      const hasReturnAbility = hasReturnToBaseAbility(card);

      // 检查是否有幸运能力（用于判断是否被神风击沉）
      const hasLucky = hasProtectAbility(card);
      const kamikazeActive = abilitiesDisabled && (abilitiesDisabled.heavyArmor || abilitiesDisabled.lucky);

      // 使用originalArmorValue判断单位是否本来有重甲
      const hadHeavyArmor = (originalArmorValue !== undefined ? originalArmorValue : armorValue) > 0;

      if (hadHeavyArmor) {
        // 本来有重甲的单位
        if (isDestroyed) {
          // 如果神风威胁禁用了重甲，使用特殊描述
          if (kamikazeActive && abilitiesDisabled.heavyArmor) {
            summary += `  - ${cardName} 被神风特攻击沉 🛡️💥☠️\n`;
          } else {
            summary += `  - ${cardName} 被重创${hits}次并击沉 🛡️💥\n`;
          }
        } else {
          summary += `  - ${cardName} 被重创${hits}次但未被击沉 🛡️\n`;
        }
      } else if (hasReturnAbility) {
        // 有返航能力的空军
        if (airSuperiorityAchieved) {
          summary += `  - ${cardName} 被击中但成功返航 ✈️\n`;
        } else {
          summary += `  - ${cardName} 被击中并坠毁 ✈️💥\n`;
        }
      } else {
        // 普通单位：根据单位类型使用不同的词汇
        let lossText = '损失';
        if (card.unitType === 'navy') {
          lossText = '沉没';
        } else if (card.unitType === 'army') {
          lossText = '阵亡';
        }

        // 如果神风威胁禁用了幸运且该单位有幸运能力，使用特殊描述
        if (kamikazeActive && abilitiesDisabled.lucky && hasLucky && isDestroyed) {
          summary += `  - ${cardName} 被神风特攻击沉 ☠️\n`;
        } else {
          summary += `  - ${cardName} ${lossText}\n`;
        }
      }
    });
  } else if (lostCards && lostCards.length > 0) {
    // 兼容旧版：如果没有damageDetails但有lostCards
    summary += `\n损失卡牌 (${lostCards.length}张):\n`;
    lostCards.forEach(card => {
      const cardName = card.name.replace(/\n/g, '');
      let lossText = '损失';
      if (card.unitType === 'navy') {
        lossText = '沉没';
      } else if (card.unitType === 'army') {
        lossText = '阵亡';
      }
      summary += `  - ${cardName} ${lossText}\n`;
    });
  }

  return summary;
}

/**
 * 检查是否可以开始战斗
 * @param {Array} selectedCards - 选中的卡牌
 * @param {Object} currentMission - 当前任务
 * @returns {Object} { canFight, reason }
 */
export function canStartCombat(selectedCards, currentMission) {
  if (!currentMission) {
    return { canFight: false, reason: '没有当前任务' };
  }

  if (selectedCards.length === 0) {
    return { canFight: false, reason: '未选择任何参战卡牌' };
  }

  // 检查选中的卡牌是否都是ready状态
  const hasTappedCard = selectedCards.some(card => card.status === 'tapped');
  if (hasTappedCard) {
    return { canFight: false, reason: '选中的卡牌中有已整备中的卡牌' };
  }

  return { canFight: true, reason: '' };
}

// 为了向后兼容，保留旧的函数名
export function calculateCombatPower(cards) {
  const powers = calculateAllFirePowers(cards);
  return powers.groundPower + powers.seaPower + powers.airPower;
}
