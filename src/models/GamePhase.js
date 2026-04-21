/**
 * 游戏阶段枚举
 */
export const GamePhase = {
  PREPARE: 'prepare',     // 准备阶段
  DRAW: 'draw',           // 抽卡阶段
  ACTION: 'action',       // 行动阶段（使用卡牌）
  COMBAT: 'combat',       // 战斗阶段
  SHOP: 'shop',           // 商店阶段
  DISCARD: 'discard',     // 弃牌阶段
  GAME_OVER: 'game_over'  // 游戏结束
};

/**
 * 获取下一个游戏阶段
 * @param {string} currentPhase - 当前阶段
 * @returns {string} 下一个阶段
 */
export function getNextPhase(currentPhase) {
  const phaseOrder = [
    GamePhase.PREPARE,
    GamePhase.DRAW,
    GamePhase.ACTION,
    GamePhase.COMBAT,
    GamePhase.SHOP,
    GamePhase.DISCARD
  ];

  const currentIndex = phaseOrder.indexOf(currentPhase);
  if (currentIndex === -1 || currentIndex === phaseOrder.length - 1) {
    return GamePhase.PREPARE; // 回到准备阶段（新回合）
  }

  return phaseOrder[currentIndex + 1];
}

/**
 * 阶段显示名称
 */
export const PhaseDisplayName = {
  [GamePhase.PREPARE]: '准备阶段',
  [GamePhase.DRAW]: '抽卡阶段',
  [GamePhase.ACTION]: '行动阶段',
  [GamePhase.COMBAT]: '战斗阶段',
  [GamePhase.SHOP]: '购买阶段',
  [GamePhase.DISCARD]: '弃牌阶段',
  [GamePhase.GAME_OVER]: '游戏结束'
};
