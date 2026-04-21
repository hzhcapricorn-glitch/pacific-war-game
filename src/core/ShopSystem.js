/**
 * ShopSystem - 处理商店相关的逻辑
 */

/**
 * 检查是否有足够的补给购买卡牌
 * @param {number} currentSupply - 当前补给
 * @param {number} cardCost - 卡牌价格
 * @returns {boolean}
 */
export function canAffordCard(currentSupply, cardCost) {
  return currentSupply >= cardCost;
}

/**
 * 计算实际购买价格（考虑折扣等效果）
 * @param {Object} card - 卡牌对象
 * @param {number} costReduction - 费用减免
 * @returns {number} 实际价格
 */
export function calculatePurchasePrice(card, costReduction = 0) {
  return Math.max(0, card.cost - costReduction);
}

/**
 * 从商店移除已购买的卡牌
 * @param {Array} shopCards - 商店卡牌数组
 * @param {string} cardId - 购买的卡牌ID
 * @returns {Array} 更新后的商店卡牌数组
 */
export function removeFromShop(shopCards, cardId) {
  return shopCards.filter(card => card.instanceId !== cardId && card.id !== cardId);
}

/**
 * 将商店卡牌按类型分组堆叠
 * @param {Array} shopCards - 商店卡牌数组
 * @returns {Array} 分组后的堆叠数组 [{cardDef, cards: [...], count: n}]
 */
export function groupShopCards(shopCards) {
  const grouped = {};

  shopCards.forEach(card => {
    const cardId = card.id;
    if (!grouped[cardId]) {
      grouped[cardId] = {
        cardDef: card,
        cards: [],
        count: 0
      };
    }
    grouped[cardId].cards.push(card);
    grouped[cardId].count++;
  });

  return Object.values(grouped);
}

/**
 * 从堆叠中取一张卡牌
 * @param {Array} shopStacks - 商店堆叠数组
 * @param {string} cardId - 卡牌种类ID
 * @returns {Object} { card, newStacks }
 */
export function takeCardFromStack(shopStacks, cardId) {
  const stackIndex = shopStacks.findIndex(stack => stack.cardDef.id === cardId);

  if (stackIndex === -1 || shopStacks[stackIndex].cards.length === 0) {
    return null;
  }

  const newStacks = [...shopStacks];
  const card = newStacks[stackIndex].cards.pop();
  newStacks[stackIndex].count--;

  // 如果堆空了，移除这个堆
  if (newStacks[stackIndex].count === 0) {
    newStacks.splice(stackIndex, 1);
  }

  return { card, newStacks };
}

/**
 * 生成商店 - 从卡牌池中随机选择卡牌
 * @param {Array} cardPool - 可用卡牌池
 * @param {number} shopSize - 商店大小（显示的卡牌种类数）
 * @returns {Array} 商店卡牌数组
 */
export function generateShop(cardPool, shopSize = 6) {
  if (cardPool.length === 0) return [];

  // 获取不同的卡牌种类
  const uniqueCardTypes = {};
  cardPool.forEach(card => {
    const cardId = card.id;
    if (!uniqueCardTypes[cardId]) {
      uniqueCardTypes[cardId] = [];
    }
    uniqueCardTypes[cardId].push(card);
  });

  // 从每种卡牌中选择一张放入商店
  const uniqueCards = Object.values(uniqueCardTypes);
  const shopCards = [];

  for (let i = 0; i < Math.min(shopSize, uniqueCards.length); i++) {
    if (uniqueCards[i] && uniqueCards[i].length > 0) {
      // 从每组中取第一张
      shopCards.push(uniqueCards[i][0]);
    }
  }

  return shopCards;
}

/**
 * 检查商店是否为空
 * @param {Array} shopCards - 商店卡牌数组
 * @returns {boolean}
 */
export function isShopEmpty(shopCards) {
  return shopCards.length === 0;
}

/**
 * 获取商店中特定卡牌的数量
 * @param {Array} shopCards - 商店卡牌数组
 * @param {string} cardId - 卡牌ID
 * @returns {number} 数量
 */
export function getCardCountInShop(shopCards, cardId) {
  return shopCards.filter(card => card.id === cardId).length;
}

/**
 * 获取商店统计信息
 * @param {Array} shopCards - 商店卡牌数组
 * @returns {Object} { totalCards, uniqueTypes }
 */
export function getShopStats(shopCards) {
  const uniqueTypes = new Set(shopCards.map(card => card.id)).size;

  return {
    totalCards: shopCards.length,
    uniqueTypes
  };
}
