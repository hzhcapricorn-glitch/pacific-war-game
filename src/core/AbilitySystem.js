/**
 * AbilitySystem - 数据驱动的卡牌能力处理引擎
 *
 * 核心功能：
 * 1. 根据触发时机执行卡牌能力
 * 2. 验证能力约束条件
 * 3. 确定卡牌目标位置
 * 4. 处理交互式能力
 */

// ============= 能力处理器注册表 =============

/**
 * 供给能力 - 提供补给点数
 */
function handleSupplyAbility(ability, card, context) {
  return {
    type: 'state_update',
    updates: {
      supply: (context.state.supply || 0) + ability.value
    },
    log: `获得 ${ability.value} 点补给`
  };
}

/**
 * 抽卡能力 - 从牌堆抽取卡牌
 */
function handleDrawAbility(ability, card, context) {
  return {
    type: 'action',
    action: 'DRAW_CARDS',
    payload: { count: ability.value },
    log: `抽取 ${ability.value} 张卡牌`
  };
}

/**
 * 最大补给能力 - 增加补给上限
 */
function handleMaxSupplyAbility(ability, card, context) {
  return {
    type: 'state_update',
    updates: {
      maxSupplyRetention: (context.state.maxSupplyRetention || 0) + ability.value
    },
    log: `最大补给保留 +${ability.value}`
  };
}

/**
 * 进入弃牌堆能力 - 卡牌使用后直接进弃牌堆
 */
function handleGoesToDiscardAbility(ability, card, context) {
  return {
    type: 'destination_modifier',
    destination: 'discard',
    log: null  // 不需要日志
  };
}

/**
 * 战斗增益能力 - 增加战斗火力
 */
function handleCombatBoostAbility(ability, card, context) {
  // 支持新的effect格式（如哈尔西的特殊目标）
  if (ability.effect) {
    return {
      type: 'combat_modifier',
      modifier: {
        target: ability.effect.target,
        stat: ability.effect.stat,
        value: ability.effect.value,
        cards: context.cards // 传递参战卡牌列表用于目标筛选
      },
      log: null // 日志将在应用时生成
    };
  }

  // 兼容旧的格式
  return {
    type: 'combat_modifier',
    modifier: {
      powerType: ability.powerType || 'all',
      value: ability.value,
      scope: ability.scope || 'all_participating'
    },
    log: `战斗力 +${ability.value}`
  };
}

/**
 * 退役能力 - 从弃牌堆移除卡牌
 */
function handleRetireAbility(ability, card, context) {
  return {
    type: 'interactive',
    interaction: ability.ui?.interaction || 'select_from_zone',
    data: {
      zone: ability.ui?.zone || 'discard',
      title: ability.ui?.title || '选择要退役的卡牌',
      excludeCardId: card.instanceId, // 排除触发能力的卡牌自身
      onSelect: (selectedCard) => ({
        action: 'RETIRE_CARD',
        payload: { cardId: selectedCard.instanceId }
      })
    },
    log: null  // 退役时会在action中记录日志
  };
}

/**
 * 快速响应能力 - 将整备中的卡牌转为已就绪
 */
function handleQuickResponseAbility(ability, card, context) {
  return {
    type: 'interactive',
    interaction: ability.ui?.interaction || 'select_from_zone',
    data: {
      zone: ability.ui?.zone || 'deployed',
      filter: ability.ui?.filter || 'tapped',
      title: ability.ui?.title || '选择要激活的卡牌',
      excludeCardId: card.instanceId, // 排除触发能力的卡牌自身
      onSelect: (selectedCard) => ({
        action: 'UNTAP_CARD',
        payload: { cardId: selectedCard.instanceId }
      })
    },
    log: null  // 激活时会在action中记录日志
  };
}

/**
 * 不能参战能力 - 阻止卡牌参加战斗
 */
function handleCannotParticipateInCombatAbility(ability, card, context) {
  return {
    type: 'combat_restriction',
    restriction: 'cannot_participate',
    message: ability.ui?.blockMessage || '该卡牌不能参加战斗',
    log: null
  };
}

/**
 * 侦查能力 - 点击部署区已就绪卡牌时抽取X张卡牌
 * 触发时机：on_tap（部署后点击已就绪单位）
 * 受侦查上限限制
 */
function handleScoutAbility(ability, card, context) {
  // 检查侦查上限
  const scoutUsed = context.state.scoutUsed || 0;
  const scoutLimit = context.state.scoutLimit || 1;

  if (scoutUsed >= scoutLimit) {
    return {
      type: 'blocked',
      reason: `已达到侦查上限（${scoutUsed}/${scoutLimit}）`,
      log: null
    };
  }

  return {
    type: 'action',
    action: 'SCOUT_AND_TAP',
    payload: {
      count: ability.value,
      cardInstanceId: card.instanceId
    },
    log: `侦查：抽取 ${ability.value} 张卡牌`
  };
}

// 能力类型 -> 处理器函数映射表
const ABILITY_HANDLERS = {
  supply: handleSupplyAbility,
  draw: handleDrawAbility,
  max_supply: handleMaxSupplyAbility,
  goes_to_discard: handleGoesToDiscardAbility,
  combat_boost: handleCombatBoostAbility,
  retire: handleRetireAbility,
  cannot_participate_in_combat: handleCannotParticipateInCombatAbility,
  scout: handleScoutAbility,
  quick_response: handleQuickResponseAbility
};

// ============= 约束验证器 =============

/**
 * 验证"每回合一次"约束
 */
function validateOncePerTurn(ability, context) {
  const key = `${context.card.instanceId}_${ability.type}`;
  const usedThisTurn = context.state.usedAbilitiesThisTurn || {};

  if (usedThisTurn[key]) {
    return {
      valid: false,
      reason: '该能力本回合已使用过'
    };
  }

  return { valid: true };
}

/**
 * 验证"需要弃牌堆"约束
 */
function validateRequiresDiscardPile(ability, context) {
  const discardPile = context.state.zones?.discard || [];

  if (discardPile.length === 0) {
    return {
      valid: false,
      reason: '弃牌堆中没有卡牌'
    };
  }

  return { valid: true };
}

/**
 * 验证"需要补给"约束
 */
function validateRequiresSupply(ability, context) {
  const required = ability.requiresSupply || 0;
  const current = context.state.supply || 0;

  if (current < required) {
    return {
      valid: false,
      reason: `补给不足（需要${required}点）`
    };
  }

  return { valid: true };
}

// 约束类型 -> 验证器函数映射表
const CONSTRAINT_VALIDATORS = {
  once_per_turn: validateOncePerTurn,
  requires_discard_pile: validateRequiresDiscardPile,
  requires_supply: validateRequiresSupply
};

// ============= 核心API函数 =============

/**
 * 处理卡牌能力
 * @param {Object} card - 卡牌对象
 * @param {string} trigger - 触发时机 (on_play, after_play, on_tap, during_combat等)
 * @param {Object} context - 上下文 { state, card, phase, cards? }
 * @returns {Array} 能力执行结果数组
 */
export function processAbilities(card, trigger, context) {
  if (!card.abilities || card.abilities.length === 0) {
    return [];
  }

  // 筛选符合触发时机的能力
  const applicableAbilities = card.abilities.filter(ability => {
    // 如果没有指定trigger，默认为on_play
    const abilityTrigger = ability.trigger || 'on_play';

    // 直接匹配
    if (abilityTrigger === trigger) {
      return true;
    }

    // 对于multi类型能力（如submarine_boost），检查effects数组中是否有匹配的子效果
    if (abilityTrigger === 'multi' && ability.effects) {
      return ability.effects.some(effect => effect.trigger === trigger);
    }

    return false;
  });

  const results = [];

  for (const ability of applicableAbilities) {
    // 验证约束条件
    if (ability.constraints) {
      const validation = validateConstraints(ability, context);
      if (!validation.valid) {
        // 约束不满足，跳过此能力
        continue;
      }
    }

    // 处理multi类型能力（如submarine_boost）
    if (ability.trigger === 'multi' && ability.effects) {
      // 只处理匹配当前trigger的子效果
      const matchingEffects = ability.effects.filter(effect => effect.trigger === trigger);

      for (const effect of matchingEffects) {
        // 对于combat_boost类型的子效果，直接返回combat_modifier格式
        if (effect.type === 'combat_boost') {
          results.push({
            type: 'combat_modifier',
            modifier: {
              target: effect.target,
              stat: effect.stat,
              value: effect.value
            }
          });
        }
      }
      continue;
    }

    // 执行能力处理器
    const handler = ABILITY_HANDLERS[ability.type];
    if (handler) {
      const result = handler(ability, card, context);
      if (result) {
        results.push(result);
      }
    } else {
      console.warn(`Unknown ability type: ${ability.type}`);
    }
  }

  return results;
}

/**
 * 验证能力约束条件
 * @param {Object} ability - 能力对象
 * @param {Object} context - 上下文
 * @returns {Object} { valid: boolean, reason?: string }
 */
export function validateConstraints(ability, context) {
  if (!ability.constraints || ability.constraints.length === 0) {
    return { valid: true };
  }

  for (const constraint of ability.constraints) {
    const validator = CONSTRAINT_VALIDATORS[constraint];
    if (validator) {
      const result = validator(ability, context);
      if (!result.valid) {
        return result;
      }
    } else {
      console.warn(`Unknown constraint type: ${constraint}`);
    }
  }

  return { valid: true };
}

/**
 * 验证单个能力的约束（用于UI检查）
 * @param {Object} ability - 能力对象
 * @param {Object} state - 游戏状态
 * @param {Object} card - 可选的卡牌对象（用于once_per_turn等需要卡牌信息的约束）
 * @returns {Object} { valid: boolean, reason?: string }
 */
export function validateAbilityConstraints(ability, state, card = null) {
  const context = {
    state,
    card: card || { instanceId: 'temp' }
  };
  return validateConstraints(ability, context);
}

/**
 * 获取卡牌的目标位置
 * @param {Object} card - 卡牌对象
 * @returns {string} 'deployed' | 'discard' | 'removed'
 */
export function getCardDestination(card) {
  if (!card.abilities) {
    return 'deployed';
  }

  // 查找带destination的能力
  const destinationAbility = card.abilities.find(ability => {
    if (ability.type === 'goes_to_discard') {
      return true;
    }
    if (ability.destination) {
      return true;
    }
    return false;
  });

  if (destinationAbility) {
    if (destinationAbility.type === 'goes_to_discard') {
      return 'discard';
    }
    return destinationAbility.destination;
  }

  return 'deployed';
}

/**
 * 获取需要交互的能力
 * @param {Object} card - 卡牌对象
 * @param {string} trigger - 触发时机
 * @returns {Array} 交互式能力数组
 */
export function getInteractiveAbilities(card, trigger) {
  if (!card.abilities) {
    return [];
  }

  return card.abilities.filter(ability => {
    const abilityTrigger = ability.trigger || 'on_play';
    return (
      abilityTrigger === trigger &&
      ability.ui &&
      ability.ui.interaction
    );
  });
}

/**
 * 应用能力结果到游戏状态
 * @param {Object} state - 当前游戏状态
 * @param {Array} results - 能力执行结果数组
 * @param {Object} newZones - 更新后的zones
 * @returns {Object} 更新后的状态
 */
export function applyAbilityResults(state, results, newZones) {
  let updatedState = {
    ...state,
    zones: newZones
  };

  const stateUpdates = {};
  const actions = [];
  const logs = [];

  // 收集所有结果
  results.forEach(result => {
    if (result.type === 'state_update') {
      Object.assign(stateUpdates, result.updates);
      if (result.log) logs.push(result.log);
    } else if (result.type === 'action') {
      actions.push({ action: result.action, payload: result.payload });
      if (result.log) logs.push(result.log);
    } else if (result.type === 'interactive') {
      // 交互式能力需要特殊处理，存储到pendingInteraction
      updatedState.pendingInteraction = {
        ...result.data,
        ability: result
      };
    }
  });

  // 应用状态更新
  updatedState = {
    ...updatedState,
    ...stateUpdates
  };

  // 存储待执行的actions（draw等需要dispatch）
  if (actions.length > 0) {
    updatedState.pendingActions = actions;
  }

  // 合并日志
  if (logs.length > 0) {
    updatedState.abilityLogs = logs;
  }

  return updatedState;
}

/**
 * 检查卡牌是否有特定能力
 * @param {Object} card - 卡牌对象
 * @param {string} abilityType - 能力类型
 * @returns {boolean}
 */
export function hasAbility(card, abilityType) {
  if (!card.abilities) return false;
  return card.abilities.some(ability => ability.type === abilityType);
}

/**
 * 检查卡牌是否有幸运能力（战斗损失时优先损失其他卡牌）
 * @param {Object} card - 卡牌对象
 * @returns {boolean}
 */
export function hasProtectAbility(card) {
  return hasAbility(card, 'protect');
}

/**
 * 获取卡牌的重甲值（战斗损失时需被选中X+1次才损失）
 * @param {Object} card - 卡牌对象
 * @returns {number} 重甲值，0表示无重甲
 */
export function getHeavyArmorValue(card) {
  if (!card.abilities) return 0;
  const armorAbility = card.abilities.find(ability => ability.type === 'heavy_armor');
  return armorAbility ? (armorAbility.value || 0) : 0;
}

/**
 * 检查卡牌是否有返航能力（制空充足时损失后进入弃牌堆）
 * @param {Object} card - 卡牌对象
 * @returns {boolean}
 */
export function hasReturnToBaseAbility(card) {
  return hasAbility(card, 'return_to_base');
}

/**
 * 检查卡牌是否可以参加战斗
 * @param {Object} card - 卡牌对象
 * @returns {Object} { canParticipate: boolean, reason?: string }
 */
export function canParticipateInCombat(card, missionConstraints = []) {
  // 检查卡牌自身的能力限制
  if (card.abilities) {
    const restriction = card.abilities.find(
      ability => ability.type === 'cannot_participate_in_combat'
    );

    if (restriction) {
      return {
        canParticipate: false,
        reason: restriction.ui?.blockMessage || '该卡牌不能参加战斗'
      };
    }
  }

  // 检查任务约束：禁止某种单位类型（可能有多个约束）
  const unitTypeRestrictions = missionConstraints.filter(
    constraint => constraint.type === 'restrict_unit_type'
  );

  for (const restriction of unitTypeRestrictions) {
    const restrictedTypes = restriction.unitTypes || [];
    if (restrictedTypes.includes(card.unitType)) {
      return {
        canParticipate: false,
        reason: restriction.message || `该任务不允许${card.unitType === 'army' ? '陆军' : card.unitType === 'navy' ? '海军' : '空军'}参战`
      };
    }
  }

  return { canParticipate: true };
}
