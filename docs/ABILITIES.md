# 卡牌能力参考文档 (Card Abilities Reference)

## 概述 (Overview)

本游戏采用数据驱动的卡牌能力系统，所有卡牌行为都通过 JSON 配置文件定义。设计师可以通过修改 JSON 文件来添加、修改或删除卡牌能力，无需修改代码。

**核心理念**：
- **数据驱动**：所有卡牌行为由 JSON 配置定义
- **模块化**：每个能力类型独立实现，易于扩展
- **约束系统**：通过约束条件控制能力使用时机和频率
- **触发机制**：能力在特定时机自动触发执行

## 能力属性 (Ability Attributes)

每个能力对象包含以下属性：

```json
{
  "type": "string",           // 能力类型标识（必需）
  "value": number,            // 效果数值（可选，根据能力类型）
  "trigger": "string",        // 触发时机（必需）
  "constraints": ["string"],  // 约束条件数组（可选）
  "ui": {                     // UI交互配置（可选，交互式能力需要）
    "interaction": "string",
    "zone": "string",
    "title": "string",
    "blockMessage": "string"
  }
}
```

### 属性说明

| 属性 | 类型 | 说明 | 示例 |
|-----|------|------|------|
| `type` | string | 能力类型标识，决定执行哪个处理器 | `"supply"`, `"draw"`, `"retire"` |
| `value` | number | 效果数值，如补给点数、抽卡数量等 | `1`, `2`, `3` |
| `trigger` | string | 能力触发时机 | `"on_play"`, `"on_tap"`, `"during_combat"` |
| `constraints` | array | 约束条件列表，如"每回合一次" | `["once_per_turn"]` |
| `ui` | object | UI交互配置，用于交互式能力 | 见下文交互能力示例 |

## 触发时机 (Triggers)

能力在特定的游戏事件时触发执行：

| Trigger | 触发时机 | 常见用途 |
|---------|---------|----------|
| `on_play` | 从手牌打出时 | 提供资源（supply, draw, max_supply） |
| `after_play` | 打出后，卡牌移动前 | 改变卡牌目标位置（goes_to_discard） |
| `on_tap` | 卡牌被横置激活时 | 交互式能力（retire） |
| `during_combat` | 战斗火力计算时 | 战斗增益（combat_boost）、参战限制（cannot_participate_in_combat） |
| `start_of_turn` | 回合开始时 | （未来扩展）持续效果、触发能力 |
| `end_of_turn` | 回合结束时 | （未来扩展）清理效果 |

## 约束条件 (Constraints)

约束条件限制能力的使用：

| Constraint | 说明 | 验证逻辑 |
|-----------|------|---------|
| `once_per_turn` | 每回合只能使用一次 | 检查 `state.usedAbilitiesThisTurn` |
| `requires_discard_pile` | 需要弃牌堆中有卡牌 | 检查 `state.zones.discard.length > 0` |
| `requires_supply` | 需要足够的补给点数 | 检查 `state.supply >= ability.requiresSupply` |

## 能力类型详解

### 1. 资源能力 (Resource Abilities)

#### `supply` - 提供补给

提供补给点数，用于购买卡牌或重置横置的卡牌。

**配置示例**：
```json
{
  "type": "supply",
  "value": 1,
  "trigger": "on_play"
}
```

**属性**：
- `value`: 提供的补给点数（必需）
- `trigger`: 通常为 `"on_play"`

**效果**：
- 增加 `state.supply`
- 显示日志：`"获得 {value} 点补给"`

**示例卡牌**：
- 基础补给：提供 1 点补给
- 补给舰：提供 3 点补给
- 衣阿华级战列舰：提供 2 点补给

---

#### `draw` - 抽卡

从牌堆抽取指定数量的卡牌到手牌。

**配置示例**：
```json
{
  "type": "draw",
  "value": 1,
  "trigger": "on_play"
}
```

**属性**：
- `value`: 抽取的卡牌数量（必需）
- `trigger`: 通常为 `"on_play"`

**效果**：
- 从牌堆抽取 `value` 张卡牌
- 如果牌堆不足，会自动洗牌弃牌堆
- 显示日志：`"抽取 {value} 张卡牌"`

**示例卡牌**：
- 埃塞克斯级航空母舰：抽 1 张卡牌

---

#### `max_supply` - 增加补给上限

增加回合结束时可以保留的补给上限。

**配置示例**：
```json
{
  "type": "max_supply",
  "value": 2,
  "trigger": "on_play"
}
```

**属性**：
- `value`: 增加的上限值（必需）
- `trigger`: 通常为 `"on_play"`

**效果**：
- 增加 `state.maxSupplyRetention`
- 允许玩家在回合结束时保留更多补给
- 显示日志：`"最大补给保留 +{value}"`

**示例卡牌**：
- 补给舰：增加 2 点最大补给保留

---

### 2. 战斗能力 (Combat Abilities)

#### `combat_boost` - 战斗力加成

在战斗时增加特定类型的火力。

**配置示例**：
```json
{
  "type": "combat_boost",
  "value": 2,
  "trigger": "during_combat",
  "powerType": "groundPower",
  "scope": "all_participating"
}
```

**属性**：
- `value`: 增加的火力值（必需）
- `trigger`: 必须为 `"during_combat"`
- `powerType`: 火力类型（可选，默认 `"all"`）
  - `"groundPower"` / `"ground"`: 对地火力
  - `"seaPower"` / `"sea"`: 对海火力
  - `"airPower"` / `"air"`: 对空火力
  - `"all"`: 所有类型火力
- `scope`: 增益范围（可选，默认 `"all_participating"`）
  - `"self"`: 仅对自身
  - `"all_participating"`: 所有参战卡牌
  - `"all_deployed"`: 所有部署区卡牌

**效果**：
- 在战斗火力计算时应用加成
- 显示日志：`"战斗力 +{value}"`

**未来扩展示例**：
```json
// 指挥官卡：增加所有参战单位的对海火力
{
  "type": "combat_boost",
  "value": 2,
  "trigger": "during_combat",
  "powerType": "seaPower",
  "scope": "all_participating"
}
```

---

#### `cannot_participate_in_combat` - 不能参战

阻止卡牌参加战斗，通常用于后勤卡。

**配置示例**：
```json
{
  "type": "cannot_participate_in_combat",
  "trigger": "during_combat",
  "ui": {
    "blockMessage": "后勤卡不能参加战斗"
  }
}
```

**属性**：
- `trigger`: 必须为 `"during_combat"`
- `ui.blockMessage`: 玩家尝试选择此卡时显示的提示信息

**效果**：
- 在战斗阶段点击卡牌时显示提示
- 阻止卡牌被选中参战

**示例卡牌**：
- 补给舰：后勤支援舰，不能参战
- 退役：后勤卡，不能参战

---

### 3. 行为能力 (Behavior Abilities)

#### `goes_to_discard` - 使用后进入弃牌堆

使卡牌使用后直接进入弃牌堆，而不是部署区。

**配置示例**：
```json
{
  "type": "goes_to_discard",
  "trigger": "after_play"
}
```

**属性**：
- `trigger`: 必须为 `"after_play"`
- 无需 `value` 属性

**效果**：
- 改变卡牌目标位置为弃牌堆
- 卡牌打出后直接进入弃牌堆
- 不记录日志（行为隐式执行）

**示例卡牌**：
- 基础补给：提供补给后直接进弃牌堆

**设计目的**：
- 补给类卡牌不应占用部署区空间
- 简化游戏流程，避免过多的清理操作

---

### 4. 交互能力 (Interactive Abilities)

#### `retire` - 退役卡牌

从弃牌堆中选择一张卡牌，将其从游戏中移除。

**配置示例**：
```json
{
  "type": "retire",
  "value": 1,
  "trigger": "on_tap",
  "constraints": ["once_per_turn", "requires_discard_pile"],
  "ui": {
    "interaction": "select_from_zone",
    "zone": "discard",
    "title": "选择要退役的卡牌"
  }
}
```

**属性**：
- `value`: 可退役的卡牌数量（当前版本始终为 1）
- `trigger`: 必须为 `"on_tap"`（横置激活）
- `constraints`: 约束条件
  - `"once_per_turn"`: 每回合只能使用一次
  - `"requires_discard_pile"`: 需要弃牌堆中有卡牌
- `ui.interaction`: 交互类型，必须为 `"select_from_zone"`
- `ui.zone`: 选择来源区域，必须为 `"discard"`
- `ui.title`: 弹窗标题

**效果**：
- 打开选择弹窗，显示弃牌堆中的所有卡牌
- 玩家选择一张卡牌后：
  - 该卡牌从弃牌堆移动到 `removed` 区（永久移除）
  - 使用能力的卡牌被横置
  - 标记能力已使用（本回合不可再用）
- 显示日志：`"退役了「{卡牌名}」，该卡牌已移除游戏"`

**示例卡牌**：
- 退役：后勤卡，可以退役弃牌堆中的卡牌

**设计目的**：
- 允许玩家移除弱卡，优化牌组
- 战略性地削减牌组规模
- 每回合限制使用防止过度削减

---

## 添加新能力

要添加新的能力类型，需要以下步骤：

### 1. 定义能力处理器 (Handler)

在 `src/core/AbilitySystem.js` 中添加处理函数：

```javascript
/**
 * 新能力处理器示例
 */
function handleNewAbility(ability, card, context) {
  return {
    type: 'state_update',  // 或 'action', 'interactive', 'combat_modifier' 等
    updates: {
      // 状态更新
    },
    log: '能力日志文本'
  };
}
```

### 2. 注册到处理器映射表

```javascript
const ABILITY_HANDLERS = {
  // ... 现有handlers
  new_ability: handleNewAbility
};
```

### 3. 在卡牌 JSON 中使用

```json
{
  "abilities": [
    {
      "type": "new_ability",
      "value": 1,
      "trigger": "on_play"
    }
  ]
}
```

### 4. 结果类型说明

能力处理器可以返回以下类型的结果：

| 结果类型 | 说明 | 用途 |
|---------|------|------|
| `state_update` | 直接更新游戏状态 | supply, max_supply |
| `action` | 排队执行的action | draw (执行DRAW_CARDS action) |
| `interactive` | 需要玩家交互 | retire (打开选择弹窗) |
| `combat_modifier` | 战斗修正 | combat_boost |
| `combat_restriction` | 战斗限制 | cannot_participate_in_combat |
| `destination_modifier` | 改变卡牌目标位置 | goes_to_discard |

---

## 完整示例

### 示例 1：基础补给卡

```json
{
  "id": "starter_supply",
  "name": "基础补给",
  "cost": 0,
  "abilities": [
    {
      "type": "supply",
      "value": 1,
      "trigger": "on_play"
    },
    {
      "type": "goes_to_discard",
      "trigger": "after_play"
    }
  ],
  "description": "提供1点补给"
}
```

**执行流程**：
1. 玩家打出卡牌
2. 触发 `on_play`：提供 1 点补给
3. 触发 `after_play`：卡牌进入弃牌堆（而非部署区）

---

### 示例 2：补给舰

```json
{
  "id": "supply_ship",
  "name": "补给舰",
  "cost": 4,
  "abilities": [
    {
      "type": "supply",
      "value": 3,
      "trigger": "on_play"
    },
    {
      "type": "max_supply",
      "value": 2,
      "trigger": "on_play"
    },
    {
      "type": "cannot_participate_in_combat",
      "trigger": "during_combat",
      "ui": {
        "blockMessage": "后勤卡不能参加战斗"
      }
    }
  ],
  "description": "后勤支援舰，提供3点补给，增加2点最大补给保留"
}
```

**执行流程**：
1. 玩家打出卡牌
2. 触发 `on_play`：
   - 提供 3 点补给
   - 增加 2 点最大补给保留
3. 卡牌进入部署区
4. 战斗阶段：
   - 玩家点击卡牌时触发 `during_combat` 检查
   - 显示提示："后勤卡不能参加战斗"

---

### 示例 3：退役卡

```json
{
  "id": "retirement_office",
  "name": "退役",
  "cost": 3,
  "abilities": [
    {
      "type": "retire",
      "value": 1,
      "trigger": "on_tap",
      "constraints": ["once_per_turn", "requires_discard_pile"],
      "ui": {
        "interaction": "select_from_zone",
        "zone": "discard",
        "title": "选择要退役的卡牌"
      }
    },
    {
      "type": "cannot_participate_in_combat",
      "trigger": "during_combat",
      "ui": {
        "blockMessage": "后勤卡不能参加战斗"
      }
    }
  ],
  "description": "从弃牌堆中选择一张卡牌移除游戏，每回合只能使用一次"
}
```

**执行流程**：
1. 玩家打出卡牌，进入部署区
2. 行动阶段：玩家点击退役卡
3. 触发 `on_tap`：
   - 验证约束：
     - 检查本回合是否已使用过（`once_per_turn`）
     - 检查弃牌堆是否有卡（`requires_discard_pile`）
   - 如果验证失败，显示提示并中断
   - 如果验证通过，打开选择弹窗
4. 玩家选择一张弃牌堆中的卡牌
5. 执行退役：
   - 选中的卡牌从弃牌堆移动到 `removed` 区
   - 退役卡被横置
   - 标记能力已使用

---

## 未来能力扩展 (Future Extensions)

以下是系统架构已支持，但尚未实现的高级能力类型：

### 条件能力 (Conditional Abilities)

```json
{
  "type": "conditional_boost",
  "condition": {
    "phase": "combat",
    "hasUnitType": "air"
  },
  "effect": {
    "type": "combat_boost",
    "value": 2
  }
}
```

### 触发响应能力 (Triggered Abilities)

```json
{
  "type": "on_card_played",
  "trigger": "when_ally_played",
  "filter": {
    "unitType": "navy"
  },
  "effect": {
    "type": "draw",
    "value": 1
  }
}
```

### 光环效果 (Aura Effects)

```json
{
  "type": "aura",
  "trigger": "while_deployed",
  "scope": "all_deployed",
  "effect": {
    "type": "reduce_cost",
    "value": 1
  }
}
```

### 多阶段能力 (Multi-Stage Abilities)

```json
{
  "type": "multi_stage",
  "stages": [
    {
      "trigger": "on_play",
      "effect": { "type": "supply", "value": 1 }
    },
    {
      "trigger": "on_deploy",
      "effect": { "type": "draw", "value": 1 }
    }
  ]
}
```

---

## 常见问题 (FAQ)

### Q: 如何修改现有能力的数值？
A: 直接在 JSON 文件中修改 `value` 字段即可，无需修改代码。

### Q: 能否给一张卡添加多个能力？
A: 可以，`abilities` 是一个数组，可以包含任意数量的能力对象。

### Q: 如何让能力在不同时机触发？
A: 修改 `trigger` 字段为相应的触发时机。

### Q: 约束条件可以组合使用吗？
A: 可以，`constraints` 是一个数组，可以包含多个约束条件，所有条件必须同时满足。

### Q: 如何调试能力是否正常工作？
A: 
1. 检查浏览器控制台是否有警告信息
2. 查看战场日志（右侧面板）确认能力是否执行
3. 使用 Debug 面板测试能力效果

---

## 版本历史

- **v1.0** (2026-04-22): 初始版本
  - 实现基础资源能力（supply, draw, max_supply）
  - 实现行为能力（goes_to_discard, cannot_participate_in_combat）
  - 实现交互能力（retire）
  - 实现约束系统（once_per_turn, requires_discard_pile）
  - 实现触发机制（on_play, after_play, on_tap, during_combat）

---

## 贡献指南

如需添加新的能力类型或改进现有能力，请遵循以下步骤：

1. 在 `AbilitySystem.js` 中实现能力处理器
2. 注册到 `ABILITY_HANDLERS` 映射表
3. 如有新约束条件，实现验证器并注册到 `CONSTRAINT_VALIDATORS`
4. 在本文档中添加能力说明和示例
5. 在测试卡牌中验证功能
6. 提交时包含能力说明和配置示例

---

**文档维护**: 本文档应与代码保持同步，任何能力系统的修改都应更新此文档。
