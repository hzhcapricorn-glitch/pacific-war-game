# 重甲能力实现文档

## 概述

实现了"重甲X"能力，允许单位在战斗损失时具有更强的生存能力。

## 能力机制

### 基本规则
- **重甲X**：该单位在战斗损失阶段视为X+1个单位
- 只有被随机选中X+1次才会真正损失（返回商店）
- 被选中少于X+1次时，返回弃牌堆而非商店

### 示例场景

**场景1：3个普通单位 + 1个重甲1单位，损失=3**

可能的结果：
1. 损失3个普通单位（重甲单位未被选中）
2. 损失2个普通单位 + 重甲1单位返回弃牌堆（被选中1次，不足2次）
3. 损失1个普通单位 + 重甲1单位被真正损失（被选中2次）

**场景2：防空不足，损失加倍=6**

原本损失3，防空不足加倍为6。重甲单位有更高概率被多次选中。

## 代码实现

### 1. JSON数据（combat.json）

为战列舰添加重甲能力：

```json
{
  "id": "basic_battleship",
  "name": "北卡罗来纳级战列舰",
  "abilities": [
    {
      "type": "heavy_armor",
      "value": 1,
      "trigger": "during_combat_loss"
    }
  ]
}
```

### 2. 能力系统（AbilitySystem.js）

添加辅助函数：

```javascript
/**
 * 获取卡牌的重甲值
 * @param {Object} card - 卡牌对象
 * @returns {number} 重甲值，0表示无重甲
 */
export function getHeavyArmorValue(card) {
  if (!card.abilities) return 0;
  const armorAbility = card.abilities.find(ability => ability.type === 'heavy_armor');
  return armorAbility ? (armorAbility.value || 0) : 0;
}
```

### 3. 战斗系统（CombatSystem.js）

修改 `calculateLosses` 函数：

**核心逻辑：**
1. 构建卡牌池：重甲X的卡牌复制X+1份
2. 将卡牌池分为普通池和幸运池
3. 随机选择损失，跟踪每张卡被选中次数
4. 只有被选中次数 ≥ 重甲值+1 才真正损失

```javascript
export function calculateLosses(participatingCards, loss, airDefenseSufficient) {
  // 构建卡牌池：重甲X的卡牌算作X+1个单位
  const cardPool = [];
  participatingCards.forEach(card => {
    const armorValue = getHeavyArmorValue(card);
    const copies = armorValue + 1; // 重甲X需要被选中X+1次
    for (let i = 0; i < copies; i++) {
      cardPool.push({
        card,
        isLucky: hasProtectAbility(card),
        hitCount: 0
      });
    }
  });

  // 随机选择并跟踪命中次数
  const hitTracker = new Map(); // instanceId -> 被选中次数
  
  // ... 随机选择逻辑 ...
  
  // 检查是否达到损失条件
  const requiredHits = armorValue + 1;
  if (currentHits >= requiredHits) {
    // 真正损失
    lostCards.push(cardId);
  }
  // 否则返回弃牌堆
}
```

### 4. 卡牌组件（Card.jsx）

添加显示支持：

**简略视图：**
```javascript
} else if (ability.type === 'heavy_armor') {
  names.push('重甲');
}
```

**详细视图：**
```javascript
} else if (ability.type === 'heavy_armor') {
  descriptions.push(`重甲${ability.value}：战斗损失时需被选中${ability.value + 1}次才损失🛡️`);
}
```

### 5. 分析脚本（analyze_cards.py）

添加能力价值计算：

```python
ABILITY_VALUES = {
    # ...
    'heavy_armor': lambda v: v * 3,  # 重甲值 * 3
    # ...
}

def get_ability_description(ability):
    # ...
    elif ability_type == 'heavy_armor':
        return f"重甲{value}"
```

## 已应用重甲的卡牌

| 卡牌 | 重甲值 | 需要被选中次数 | 稀有度 | 价格 | 火力 |
|------|-------|---------------|--------|------|------|
| 北卡罗来纳级战列舰 | 1 | 2次 | R | 💰5 🛠️2 | 💣4 🌊4 ✈️3 |
| 衣阿华级战列舰 | 1 | 2次 | SR | 💰6 🛠️2 | 💣6 🌊6 ✈️4 |

## 游戏规则更新

已在 GAME_RULES.md 中添加：

1. **能力描述区域**
   - 重甲X：战斗损失时需被选中X+1次才损失🛡️

2. **图标速查**
   - 🛡️ 重甲

3. **战斗奖励与损失规则**
   - 详细说明重甲能力的计算机制
   - 示例场景说明

4. **常见问题**
   - Q: "重甲"能力是什么？如何工作？
   - A: 包含详细的机制说明和示例

## 测试建议

### 测试场景1：基础重甲测试
1. 部署1个北卡罗来纳级战列舰 + 2个驱逐舰
2. 执行损失=2的任务
3. 预期：战列舰有较高概率只被选中1次，返回弃牌堆

### 测试场景2：防空不足加倍测试
1. 部署1个衣阿华级战列舰 + 2个陆战队
2. 执行防空要求高的任务（触发损失加倍）
3. 损失从1加倍为2
4. 预期：战列舰可能被选中2次真正损失

### 测试场景3：重甲+幸运组合
1. 部署1个战列舰（重甲1） + 1个企业号（幸运） + 2个驱逐舰
2. 执行损失=3的任务
3. 预期：
   - 优先从驱逐舰中选择
   - 战列舰需被选中2次才损失
   - 企业号最后才被选择

### 测试场景4：多个重甲单位
1. 部署2个战列舰 + 1个驱逐舰
2. 执行损失=3的任务
3. 预期：驱逐舰优先损失，战列舰需多次被选中

## 卡牌性价比变化

添加重甲能力后，战列舰的总价值显著提升：

| 卡牌 | 火力总值 | 能力值 | 总价值（旧） | 总价值（新） | 变化 |
|------|---------|--------|-------------|-------------|------|
| 北卡罗来纳 | 11 | 0 → 3 | 11 | 14 | +27% |
| 衣阿华 | 16 | 0 → 3 | 16 | 19 | +19% |

**新性价比排行：**
1. 企业号航空母舰 - 4.75 (幸运5 + 航空12 = 17)
2. SBD无畏式俯冲轰炸机 - 3.75
3. 衣阿华级战列舰 - 3.17 (火力16 + 重甲3 = 19)
4. F6F地狱猫战斗机 - 2.83
5. 北卡罗来纳级战列舰 - 2.80 (火力11 + 重甲3 = 14)

## 开发服务器

已启动：http://localhost:5178/pacific-war-game/

建议在浏览器中打开并测试以下场景：
1. 查看战列舰详细信息，确认显示"重甲1"能力
2. 执行包含战列舰的战斗，观察损失计算
3. 多次战斗验证概率分布是否合理

## 注意事项

1. **随机性**：重甲能力基于随机选择，单次测试可能看不出效果，需要多次战斗观察
2. **与幸运能力的交互**：重甲和幸运可以叠加，拥有两种能力的单位生存能力极强
3. **防空不足影响**：损失加倍会增加重甲单位被多次选中的概率
4. **返回弃牌堆**：被选中但不足X+1次的重甲单位会返回弃牌堆，这是重要特性

## 未来扩展

可以考虑添加：
1. **重甲2或更高**：给超重型单位（如大和级）
2. **动态重甲**：根据战斗条件改变重甲值
3. **重甲损坏**：被选中后降低重甲值
4. **修复能力**：恢复受损的重甲值

---

实现完成时间：2026年4月29日
