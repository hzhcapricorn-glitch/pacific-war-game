/**
 * 卡牌类型枚举
 */
export const CardType = {
  COMBAT: 'combat',           // 战斗卡牌
  MISSION: 'mission',         // 任务卡牌
  ENVIRONMENT: 'environment', // 环境卡牌（未来实现）
  CHARACTER: 'character'      // 角色卡牌（未来实现）
};

/**
 * 单位类型枚举
 */
export const UnitType = {
  AIR: 'air',       // 空军
  NAVY: 'navy',     // 海军
  ARMY: 'army'      // 陆军
};

/**
 * 卡牌类别枚举
 */
export const CardCategory = {
  SUPPLY: 'supply',       // 补给卡 - 使用后直接进弃牌堆
  SUPPORT: 'support',     // 支援卡 - 正常进入部署区
  LOGISTICS: 'logistics', // 后勤卡 - 不能参加战斗
  COMBAT: 'combat'        // 战斗卡 - 可以参加战斗
};

/**
 * 卡牌能力类型枚举
 */
export const AbilityType = {
  SUPPLY: 'supply',                   // 提供补给
  DRAW: 'draw',                       // 抽卡
  COMBAT_BOOST: 'combat_boost',       // 战斗力加成
  MAX_SUPPLY: 'max_supply',           // 增加最大补给保留
  REDUCE_COST: 'reduce_cost',         // 降低购买成本
  PROTECT: 'protect'                  // 保护卡牌不被损失
};

/**
 * 卡牌状态枚举
 */
export const CardStatus = {
  READY: 'ready',     // 准备状态（未横置）
  TAPPED: 'tapped'    // 横置状态
};

/**
 * 创建卡牌实例
 * @param {Object} cardData - 卡牌数据
 * @param {string} instanceId - 实例ID
 * @returns {Object} 卡牌实例
 */
export function createCard(cardData, instanceId) {
  return {
    id: cardData.id,
    instanceId: instanceId || `${cardData.id}_${Date.now()}_${Math.random()}`,
    type: cardData.type,
    name: cardData.name,
    cost: cardData.cost || 0,
    redeployCost: cardData.redeployCost || 0,
    // 火力属性
    groundPower: cardData.groundPower || 0,
    seaPower: cardData.seaPower || 0,
    airPower: cardData.airPower || 0,
    // 单位类型、航空槽位和卡牌类别
    unitType: cardData.unitType,
    airSlots: cardData.airSlots || 0,
    cardCategory: cardData.cardCategory || CardCategory.COMBAT,
    abilities: cardData.abilities || [],
    status: CardStatus.READY,
    description: cardData.description || '',
    flavor: cardData.flavor || '',
    // 任务卡特有属性
    requiredGroundPower: cardData.requiredGroundPower,
    requiredSeaPower: cardData.requiredSeaPower,
    requiredAirPower: cardData.requiredAirPower,
    reward: cardData.reward,
    loss: cardData.loss
  };
}

/**
 * 检查卡牌是否为战斗卡
 * @param {Object} card - 卡牌对象
 * @returns {boolean}
 */
export function isCombatCard(card) {
  return card.type === CardType.COMBAT;
}

/**
 * 检查卡牌是否为任务卡
 * @param {Object} card - 卡牌对象
 * @returns {boolean}
 */
export function isMissionCard(card) {
  return card.type === CardType.MISSION;
}

/**
 * 检查卡牌是否为补给卡（使用后直接进弃牌堆）
 * @param {Object} card - 卡牌对象
 * @returns {boolean}
 */
export function isSupplyCard(card) {
  return card.cardCategory === CardCategory.SUPPLY;
}

/**
 * 检查卡牌是否为后勤卡（不能参加战斗）
 * @param {Object} card - 卡牌对象
 * @returns {boolean}
 */
export function isLogisticsCard(card) {
  return card.cardCategory === CardCategory.LOGISTICS;
}

/**
 * 检查卡牌是否可以参加战斗
 * @param {Object} card - 卡牌对象
 * @returns {boolean}
 */
export function canParticipateInCombat(card) {
  return card.cardCategory === CardCategory.COMBAT || card.cardCategory === CardCategory.SUPPORT;
}

/**
 * 获取卡牌的火力（按类型）
 * @param {Object} card - 卡牌对象
 * @param {string} powerType - 火力类型: 'ground', 'sea', 'air'
 * @returns {number}
 */
export function getCardFirePower(card, powerType) {
  if (!isCombatCard(card)) return 0;

  switch (powerType) {
    case 'ground':
      return card.groundPower || 0;
    case 'sea':
      return card.seaPower || 0;
    case 'air':
      return card.airPower || 0;
    default:
      return 0;
  }
}

/**
 * 执行卡牌的能力效果
 * @param {Object} card - 卡牌对象
 * @returns {Object} 能力效果摘要 { supply, draw, maxSupply, ... }
 */
export function getCardAbilityEffects(card) {
  const effects = {
    supply: 0,
    draw: 0,
    maxSupply: 0,
    combatBoost: 0,
    costReduction: 0
  };

  card.abilities.forEach(ability => {
    switch (ability.type) {
      case AbilityType.SUPPLY:
        effects.supply += ability.value;
        break;
      case AbilityType.DRAW:
        effects.draw += ability.value;
        break;
      case AbilityType.MAX_SUPPLY:
        effects.maxSupply += ability.value;
        break;
      case AbilityType.COMBAT_BOOST:
        effects.combatBoost += ability.value;
        break;
      case AbilityType.REDUCE_COST:
        effects.costReduction += ability.value;
        break;
      default:
        break;
    }
  });

  return effects;
}
