import { getCardFirePower } from '../models/Card';

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
 * 计算所有类型的火力
 * @param {Array} cards - 参战卡牌数组
 * @returns {Object} { groundPower, seaPower, airPower }
 */
export function calculateAllFirePowers(cards) {
  return {
    groundPower: calculateFirePower(cards, 'ground'),
    seaPower: calculateFirePower(cards, 'sea'),
    airPower: calculateFirePower(cards, 'air')
  };
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
 * 检查对空火力是否满足（用于判断损失是否加倍）
 * @param {Object} attackPowers - 己方火力
 * @param {Object} mission - 任务对象
 * @returns {boolean} 对空火力是否满足
 */
export function isAirDefenseSufficient(attackPowers, mission) {
  return attackPowers.airPower >= (mission.requiredAirPower || 0);
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
  const lostCards = [];

  // 随机选择要损失的卡牌
  const availableCards = [...participatingCards];
  for (let i = 0; i < lossCount; i++) {
    const randomIndex = Math.floor(Math.random() * availableCards.length);
    const lostCard = availableCards.splice(randomIndex, 1)[0];
    lostCards.push(lostCard.instanceId);
  }

  return lostCards;
}

/**
 * 战斗结算 - 完整的战斗流程
 * @param {Array} selectedCards - 选中参战的卡牌
 * @param {Object} mission - 当前任务
 * @param {Object} gameState - 当前游戏状态
 * @returns {Object} 战斗结果 { victory, attackPowers, requiredPowers, rewards, lostCardIds, airDefenseSufficient }
 */
export function resolveCombat(selectedCards, mission, gameState) {
  // 计算己方火力
  const attackPowers = calculateAllFirePowers(selectedCards);
  const requiredPowers = {
    groundPower: mission.requiredGroundPower || 0,
    seaPower: mission.requiredSeaPower || 0,
    airPower: mission.requiredAirPower || 0
  };

  // 判断胜负
  const victory = isVictorious(attackPowers, mission);

  // 检查对空火力是否满足
  const airDefenseSufficient = isAirDefenseSufficient(attackPowers, mission);

  // 应用奖励（仅在胜利时）
  const rewards = victory ? applyReward(mission.reward, gameState) : { supply: 0, maxSupply: 0, victory: false };

  // 计算损失（无论胜负都会有损失，对空不足时加倍）
  const lostCardIds = calculateLosses(selectedCards, mission.loss, airDefenseSufficient);

  return {
    victory,
    attackPowers,
    requiredPowers,
    rewards,
    lostCardIds,
    airDefenseSufficient
  };
}

/**
 * 获取战斗结果摘要文本
 * @param {Object} combatResult - 战斗结果
 * @returns {string} 摘要文本
 */
export function getCombatSummary(combatResult) {
  const { victory, attackPowers, requiredPowers, rewards, lostCardIds, airDefenseSufficient } = combatResult;

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

  if (lostCardIds.length > 0) {
    summary += `\n损失卡牌: ${lostCardIds.length}张`;
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
