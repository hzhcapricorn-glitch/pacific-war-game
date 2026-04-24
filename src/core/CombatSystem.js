import { getCardFirePower } from '../models/Card';
import { processAbilities, hasProtectAbility } from './AbilitySystem';

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
 * @param {Object} context - 可选的上下文对象（包含state等，用于能力处理）
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

  // 处理combat_boost能力
  const combatModifiers = cards.flatMap(card =>
    processAbilities(card, 'during_combat', {
      state: context.state,
      card,
      cards
    })
  ).filter(result => result.type === 'combat_modifier');

  // 应用修正值
  combatModifiers.forEach(modifierResult => {
    const { powerType, value, scope } = modifierResult.modifier;

    // 根据powerType应用增益
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
  });

  return basePowers;
}

/**
 * 判断战斗是否胜利
 * @param {Object} attackPowers - 己方火力 { groundPower, seaPower, airPower }
 * @param {Object} mission - 任务对象（包含火力需求）
 * @returns {boolean} 是否胜利
 */
export function isVictorious(attackPowers, mission) {
  const groundMet = attackPowers.groundPower >= (mission.requiredGroundPower || 0);
  const seaMet = attackPowers.seaPower >= (mission.requiredSeaPower || 0);
  // 对空火力不足不影响胜利，但会影响损失
  return groundMet && seaMet;
}

/**
 * 检查防空火力是否满足（用于判断损失是否加倍）
 * @param {Object} attackPowers - 己方火力
 * @param {Object} mission - 任务对象
 * @returns {boolean} 防空火力是否满足
 */
export function isAirDefenseSufficient(attackPowers, mission) {
  return attackPowers.airDefense >= (mission.requiredAirDefense || mission.requiredAirPower || 0);
}

/**
 * 检查制空火力是否满足（用于判断返航能力是否触发）
 * @param {Object} attackPowers - 己方火力
 * @param {Object} mission - 任务对象
 * @returns {boolean} 制空火力是否满足
 */
export function isAirSuperiorityAchieved(attackPowers, mission) {
  return attackPowers.airSuperiority >= (mission.requiredAirSuperiority || mission.requiredAirPower || 0);
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
 * 计算战斗损失 - 随机选择需要损失的卡牌
 * @param {Array} participatingCards - 参战卡牌数组
 * @param {Object} loss - 损失对象 { type, count, description }
 * @param {boolean} airDefenseSufficient - 对空火力是否满足
 * @returns {Array} 被损失的卡牌ID数组
 */
export function calculateLosses(participatingCards, loss, airDefenseSufficient) {
  if (!loss || loss.count === 0 || participatingCards.length === 0) {
    return [];
  }

  // 对空火力不足时损失加倍
  let lossCount = loss.count;
  if (!airDefenseSufficient) {
    lossCount *= 2;
  }

  lossCount = Math.min(lossCount, participatingCards.length);

  // 将卡牌分为两组：有幸运能力的和没有的
  const vulnerableCards = []; // 没有幸运能力的卡牌（优先损失）
  const luckyCards = [];      // 有幸运能力的卡牌（最后损失）

  participatingCards.forEach(card => {
    if (hasProtectAbility(card)) {
      luckyCards.push(card);
    } else {
      vulnerableCards.push(card);
    }
  });

  const lostCards = [];

  // 第一阶段：优先从普通卡牌中随机选择
  const availableVulnerable = [...vulnerableCards];
  while (lostCards.length < lossCount && availableVulnerable.length > 0) {
    const randomIndex = Math.floor(Math.random() * availableVulnerable.length);
    const lostCard = availableVulnerable.splice(randomIndex, 1)[0];
    lostCards.push(lostCard.instanceId);
  }

  // 第二阶段：如果还需要更多损失，从幸运卡牌中选择
  const availableLucky = [...luckyCards];
  while (lostCards.length < lossCount && availableLucky.length > 0) {
    const randomIndex = Math.floor(Math.random() * availableLucky.length);
    const lostCard = availableLucky.splice(randomIndex, 1)[0];
    lostCards.push(lostCard.instanceId);
  }

  return lostCards;
}

/**
 * 战斗结算 - 完整的战斗流程
 * @param {Array} selectedCards - 选中参战的卡牌
 * @param {Object} mission - 当前任务
 * @param {Object} gameState - 当前游戏状态
 * @returns {Object} 战斗结果 { victory, attackPowers, requiredPowers, rewards, lostCardIds, lostCards, airDefenseSufficient, airSuperiorityAchieved }
 */
export function resolveCombat(selectedCards, mission, gameState) {
  // 计算己方火力（包括combat_boost能力）
  const attackPowers = calculateAllFirePowers(selectedCards, { state: gameState });
  const requiredPowers = {
    groundPower: mission.requiredGroundPower || 0,
    seaPower: mission.requiredSeaPower || 0,
    airDefense: mission.requiredAirDefense || mission.requiredAirPower || 0,
    airSuperiority: mission.requiredAirSuperiority || mission.requiredAirPower || 0
  };

  // 判断胜负
  const victory = isVictorious(attackPowers, mission);

  // 检查防空火力是否满足（影响损失加倍）
  const airDefenseSufficient = isAirDefenseSufficient(attackPowers, mission);

  // 检查制空火力是否满足（影响返航能力）
  const airSuperiorityAchieved = isAirSuperiorityAchieved(attackPowers, mission);

  // 应用奖励（仅在胜利时）
  const rewards = victory ? applyReward(mission.reward, gameState) : { supply: 0, maxSupply: 0, victory: false };

  // 计算损失（无论胜负都会有损失，防空不足时加倍）
  const lostCardIds = calculateLosses(selectedCards, mission.loss, airDefenseSufficient);

  // 获取损失的卡牌对象（用于显示具体卡牌名称）
  const lostCards = selectedCards.filter(card => lostCardIds.includes(card.instanceId));

  return {
    victory,
    attackPowers,
    requiredPowers,
    rewards,
    lostCardIds,
    lostCards,
    airDefenseSufficient,
    airSuperiorityAchieved
  };
}

/**
 * 获取战斗结果摘要文本
 * @param {Object} combatResult - 战斗结果
 * @returns {string} 摘要文本
 */
export function getCombatSummary(combatResult) {
  const { victory, attackPowers, requiredPowers, rewards, lostCards, airDefenseSufficient } = combatResult;

  let summary = victory ? '🎉 战斗胜利！\n\n' : '❌ 战斗失败...\n\n';

  summary += '己方火力:\n';
  summary += `  对地: ${attackPowers.groundPower} / ${requiredPowers.groundPower}\n`;
  summary += `  对海: ${attackPowers.seaPower} / ${requiredPowers.seaPower}\n`;
  summary += `  对空: ${attackPowers.airPower} / ${requiredPowers.airPower}`;

  if (!airDefenseSufficient && requiredPowers.airPower > 0) {
    summary += ' ⚠️ 不足！损失加倍\n';
  } else {
    summary += '\n';
  }

  if (victory) {
    summary += '\n获得奖励:\n';
    if (rewards.supply > 0) summary += `- 补给 +${rewards.supply}\n`;
    if (rewards.maxSupply > 0) summary += `- 最大补给保留 +${rewards.maxSupply}\n`;
    if (rewards.victory) summary += '- 完成最终任务！\n';
  }

  if (lostCards && lostCards.length > 0) {
    summary += `\n损失卡牌 (${lostCards.length}张):\n`;
    lostCards.forEach(card => {
      summary += `  - ${card.name}\n`;
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
    return { canFight: false, reason: '选中的卡牌中有已横置的卡牌' };
  }

  return { canFight: true, reason: '' };
}

// 为了向后兼容，保留旧的函数名
export function calculateCombatPower(cards) {
  const powers = calculateAllFirePowers(cards);
  return powers.groundPower + powers.seaPower + powers.airPower;
}
