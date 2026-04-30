# 侦查能力修复文档

## 问题描述

在行动阶段打出SBD无畏式俯冲轰炸机、F6F地狱猫战斗机等带有侦查能力的卡牌时，侦查能力没有触发，无法抽取额外卡牌。

## 问题原因

侦查能力的触发时机是 `on_play`（打出卡牌时），在 `handleScoutAbility` 中返回 `pendingAction`：

```javascript
function handleScoutAbility(ability, card, context) {
  return {
    type: 'action',
    action: 'SCOUT_AND_TAP',  // 返回待执行的action
    payload: {
      count: ability.value,
      cardInstanceId: card.instanceId
    },
    log: `侦查：抽取 ${ability.value} 张卡牌`
  };
}
```

但是在 `PLAY_CARD` action 的处理中，`pendingActions` 只处理了 `DRAW_CARDS`，没有处理 `SCOUT_AND_TAP`：

```javascript
// 旧代码（有问题）
if (newState.pendingActions && newState.pendingActions.length > 0) {
  newState.pendingActions.forEach(({ action: actionType, payload }) => {
    if (actionType === 'DRAW_CARDS') {
      // 处理抽卡
    }
    // ❌ 没有处理 SCOUT_AND_TAP
  });
}
```

## 解决方案

在 `PLAY_CARD` action 中添加 `SCOUT_AND_TAP` 的处理逻辑：

```javascript
// 修复后的代码
if (newState.pendingActions && newState.pendingActions.length > 0) {
  newState.pendingActions.forEach(({ action: actionType, payload }) => {
    if (actionType === 'DRAW_CARDS') {
      // 处理抽卡
      const drawResult = drawCards(newState.zones.deck, newState.zones.discard, payload.count);
      newState.zones = {
        ...newState.zones,
        deck: drawResult.newDeck,
        hand: [...newState.zones.hand, ...drawResult.drawnCards],
        discard: drawResult.newDiscard
      };
    } else if (actionType === 'SCOUT_AND_TAP') {
      // ✅ 处理侦查能力：抽牌然后整备
      const drawResult = drawCards(newState.zones.deck, newState.zones.discard, payload.count);
      newState.zones = {
        ...newState.zones,
        deck: drawResult.newDeck,
        hand: [...newState.zones.hand, ...drawResult.drawnCards],
        discard: drawResult.newDiscard,
        deployed: newState.zones.deployed
      };
    }
  });
  delete newState.pendingActions;
}
```

## 侦查能力机制

### 触发时机
- **on_play**：从手牌打出卡牌时触发
- 卡牌会进入部署区并处于**整备中状态**

### 效果
1. 抽取 X 张卡牌
2. 卡牌自动进入整备中状态（已经是 tapped）

### 与其他能力的区别

| 能力类型 | 触发时机 | 是否需要点击 | 部署后状态 |
|---------|---------|-------------|-----------|
| 侦查 | on_play | ❌ 自动触发 | 整备中 |
| 快速整备 | on_tap | ✅ 需要点击 | 整备中（使用后）|
| 返航 | on_combat_loss | ❌ 自动触发 | - |
| 补给 | on_play | ❌ 自动触发 | - |

## 拥有侦查能力的卡牌

当前游戏中有侦查能力的卡牌：

1. **SBD无畏式俯冲轰炸机** (R)
   - 侦查1：抽1张卡
   - 返航能力
   - 💣1 🌊2

2. **F6F地狱猫战斗机** (R)
   - 侦查1：抽1张卡
   - 返航能力
   - 💣1 ✈️3

3. **猫鲨级潜艇** (N)
   - 侦查1：抽1张卡
   - 🌊1

## 测试步骤

### 测试1：基础侦查测试
1. 开始游戏
2. 手牌中有SBD无畏式或F6F地狱猫
3. 在行动阶段打出该卡牌
4. **预期结果**：
   - ✅ 自动抽1张卡
   - ✅ 战场简讯显示"侦查：抽取 1 张卡牌"
   - ✅ 卡牌进入部署区并处于整备中状态
   - ✅ 手牌数量增加1

### 测试2：抽牌堆不足测试
1. 确保抽牌堆只剩少量卡牌
2. 打出侦查卡牌
3. **预期结果**：
   - ✅ 弃牌堆洗牌补充抽牌堆
   - ✅ 正常抽取卡牌

### 测试3：多个侦查能力
1. 连续打出多张带侦查的卡牌
2. **预期结果**：
   - ✅ 每张卡都正确触发侦查
   - ✅ 手牌持续增加

## 代码变更

### 修改文件
- **src/core/GameState.jsx** (line ~290-305)

### 修改内容
在 `PLAY_CARD` action 的 `pendingActions` 处理中添加 `SCOUT_AND_TAP` 分支。

### 影响范围
- ✅ 侦查能力现在可以正常工作
- ✅ 不影响其他能力
- ✅ 向后兼容（已有的独立 SCOUT_AND_TAP action 仍然保留）

## 相关能力系统

### 能力触发流程

```
1. 用户打出卡牌
   ↓
2. PLAY_CARD action
   ↓
3. processAbilities(card, 'on_play', context)
   ↓
4. handleScoutAbility 返回 pendingAction
   ↓
5. applyAbilityResults 将 action 存储到 state.pendingActions
   ↓
6. PLAY_CARD 处理 pendingActions（新增：处理 SCOUT_AND_TAP）
   ↓
7. 执行抽卡逻辑
   ↓
8. 卡牌进入部署区（整备中）
```

## 注意事项

1. **侦查卡牌部署后无法再次使用侦查**
   - 侦查是 on_play 触发，只在打出时生效一次
   - 部署后点击卡牌不会触发侦查

2. **与 on_tap 能力的区别**
   - 侦查（on_play）：打出时自动触发
   - 快速整备（on_tap）：部署后点击触发

3. **侦查后卡牌状态**
   - 侦查卡牌打出后会自动整备中
   - 需要在购买阶段支付整备费用才能恢复
   - 或等到下回合准备阶段（整备机制可能还未实现自动恢复）

## 其他 pendingAction 类型

当前系统支持的 pendingAction：

| Action 类型 | 用途 | 触发能力 |
|-----------|------|---------|
| DRAW_CARDS | 抽取卡牌 | 抽卡能力 |
| SCOUT_AND_TAP | 侦查并整备 | 侦查能力 |

未来可能需要的 pendingAction：
- RETIRE_CARD（退役）
- UNTAP_CARD（快速整备）
- ADD_SUPPLY（补给）

---

修复时间：2026年4月29日  
测试状态：待测试  
相关卡牌：SBD无畏式、F6F地狱猫、猫鲨级潜艇
