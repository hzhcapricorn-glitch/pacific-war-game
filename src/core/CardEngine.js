/**
 * CardEngine - 负责卡牌的抽取、洗牌、移动等核心逻辑
 */

/**
 * Fisher-Yates 洗牌算法
 * @param {Array} array - 要洗牌的数组
 * @returns {Array} 洗牌后的新数组
 */
export function shuffleDeck(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * 从牌堆抽取指定数量的卡牌
 * 如果牌堆不足，会自动将弃牌堆洗牌后补充到牌堆
 * @param {Array} deck - 当前抽牌堆
 * @param {Array} discard - 弃牌堆
 * @param {number} count - 要抽取的卡牌数量
 * @returns {Object} { drawnCards, newDeck, newDiscard }
 */
export function drawCards(deck, discard, count) {
  let newDeck = [...deck];
  let newDiscard = [...discard];
  const drawnCards = [];

  for (let i = 0; i < count; i++) {
    // 如果抽牌堆为空，将弃牌堆洗牌后放入抽牌堆
    if (newDeck.length === 0 && newDiscard.length > 0) {
      newDeck = shuffleDeck(newDiscard);
      newDiscard = [];
    }

    // 如果还有牌可抽，抽一张
    if (newDeck.length > 0) {
      drawnCards.push(newDeck.pop());
    } else {
      // 两个牌堆都空了，停止抽牌
      break;
    }
  }

  return {
    drawnCards,
    newDeck,
    newDiscard
  };
}

/**
 * 将卡牌从一个区域移动到另一个区域
 * @param {string} cardId - 卡牌ID或instanceId
 * @param {Array} fromZone - 源区域的卡牌数组
 * @param {Array} toZone - 目标区域的卡牌数组
 * @returns {Object} { newFromZone, newToZone, movedCard } 或 null（如果卡牌不存在）
 */
export function moveCard(cardId, fromZone, toZone) {
  // 先尝试通过 instanceId 查找
  let cardIndex = fromZone.findIndex(card => card.instanceId === cardId);

  // 如果没找到，尝试通过 id 查找
  if (cardIndex === -1) {
    cardIndex = fromZone.findIndex(card => card.id === cardId);
  }

  if (cardIndex === -1) {
    return null; // 卡牌不存在
  }

  const newFromZone = [...fromZone];
  const movedCard = newFromZone.splice(cardIndex, 1)[0];
  const newToZone = [...toZone, movedCard];

  return {
    newFromZone,
    newToZone,
    movedCard
  };
}

/**
 * 移动多张卡牌到目标区域
 * @param {Array} cardIds - 要移动的卡牌ID数组
 * @param {Array} fromZone - 源区域
 * @param {Array} toZone - 目标区域
 * @returns {Object} { newFromZone, newToZone, movedCards }
 */
export function moveMultipleCards(cardIds, fromZone, toZone) {
  let newFromZone = [...fromZone];
  const newToZone = [...toZone];
  const movedCards = [];

  cardIds.forEach(cardId => {
    const cardIndex = newFromZone.findIndex(card => card.id === cardId);
    if (cardIndex !== -1) {
      const card = newFromZone.splice(cardIndex, 1)[0];
      newToZone.push(card);
      movedCards.push(card);
    }
  });

  return {
    newFromZone,
    newToZone,
    movedCards
  };
}

/**
 * 创建初始牌库
 * @param {Array} cardDefinitions - 卡牌定义数组
 * @param {number} copies - 每种卡牌的数量
 * @returns {Array} 包含所有卡牌实例的数组
 */
export function createDeck(cardDefinitions, copies = 1) {
  const deck = [];
  let cardInstanceId = 0;

  cardDefinitions.forEach(cardDef => {
    for (let i = 0; i < copies; i++) {
      deck.push({
        ...cardDef,
        instanceId: `${cardDef.id}_${cardInstanceId++}`, // 每张卡牌实例的唯一ID
        status: 'ready' // 初始状态为ready
      });
    }
  });

  return deck;
}

/**
 * 将卡牌状态设置为横置(tapped)或重置(ready)
 * @param {string} cardId - 卡牌ID或实例ID
 * @param {Array} zone - 卡牌所在区域
 * @param {string} status - 'tapped' 或 'ready'
 * @returns {Array} 更新后的区域
 */
export function setCardStatus(cardId, zone, status) {
  return zone.map(card =>
    (card.id === cardId || card.instanceId === cardId)
      ? { ...card, status }
      : card
  );
}

/**
 * 获取区域中所有未横置的卡牌
 * @param {Array} zone - 卡牌区域
 * @returns {Array} 未横置的卡牌数组
 */
export function getReadyCards(zone) {
  return zone.filter(card => card.status === 'ready');
}

/**
 * 获取区域中所有横置的卡牌
 * @param {Array} zone - 卡牌区域
 * @returns {Array} 横置的卡牌数组
 */
export function getTappedCards(zone) {
  return zone.filter(card => card.status === 'tapped');
}
