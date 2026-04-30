# 战斗简报链接功能

## 功能概述

战斗结束后，战场简讯不再显示"战斗损失 X 张卡牌，已返回商店"，而是显示可点击的链接"💔 战斗结束 → 查看战斗简报"，点击后弹出详细的战斗简报模态框。

## 实现方式

### 1. 数据存储

在游戏状态中添加战斗简报历史：

```javascript
// GameState.jsx
const initialState = {
  // ...
  combatReports: [], // 战斗简报历史（最多保留20场）
};
```

### 2. 战斗结算时保存简报

修改 `resolveCombat` action：

```javascript
// 保存完整战斗简报
const reportId = `combat_${state.turn}_${Date.now()}`;
const combatReport = {
  id: reportId,
  turn: state.turn,
  timestamp: new Date().toLocaleTimeString(),
  mission: state.currentMission,
  participatingCards,
  ...combatResult  // 包含所有战斗结果数据
};

// 最多保留20场战斗
const newReports = [combatReport, ...state.combatReports].slice(0, 20);
newState.combatReports = newReports;
```

### 3. 添加可点击日志

```javascript
// 添加可点击的损失日志
const lossLog = {
  message: `💔 战斗结束`,
  reportId, // 关联战斗简报ID
  isClickable: true
};
newState.battleLog = addLogEntry(newState, lossLog, 'combat_report');
```

### 4. 日志显示组件

修改 BattleLog 组件支持可点击日志：

```jsx
{log.isClickable && log.reportId ? (
  <span
    className="log-message log-clickable"
    onClick={() => onReportClick(log.reportId)}
  >
    {log.message} <span className="log-link">→ 查看战斗简报</span>
  </span>
) : (
  <span className="log-message">{log.message}</span>
)}
```

### 5. 战斗简报模态框

创建 `CombatReportModal.jsx` 组件：

```jsx
function CombatReportModal({ report, onClose }) {
  const summary = getCombatSummary(report);

  return (
    <div className="modal-overlay">
      <div className="combat-report-modal">
        {/* 显示回合、时间、任务信息 */}
        {/* 显示格式化的战斗简报 */}
        {/* 显示参战单位列表 */}
      </div>
    </div>
  );
}
```

## 功能特点

### 1. 日志条目样式

- **图标**：📋 (combat_report类型)
- **颜色**：紫色边框和背景
- **交互**：悬停时高亮，显示手型光标
- **链接文字**：紫色加粗下划线

### 2. 战斗简报内容

#### 基本信息
- 回合数
- 战斗时间
- 任务名称

#### 战斗结果
- 使用 `getCombatSummary()` 生成的完整报告
- 包含：
  - 胜利/失败状态
  - 火力对比
  - 防空/制空状态
  - 获得奖励
  - 战损情况（重甲、返航等详细描述）

#### 参战单位列表
- 单位图标（✈️空军、⚓海军、🎖️陆军）
- 单位名称（支持换行）
- 单位火力（💣对地、🌊对海、✈️对空）

### 3. 历史记录

- 最多保留最近20场战斗
- 按时间倒序排列
- 每场战斗有唯一ID

## 用户体验

### 改进前

```
⚔️ 战斗！派出 3 张卡牌 [地:8 海:10 空:6] 对抗「瓜岛争夺战」
💔 战斗损失 2 张卡牌，已返回商店
```

**问题：**
- ❌ 看不到战斗详情
- ❌ 不知道哪些卡牌受损
- ❌ 不知道是否有重甲/返航生效

### 改进后

```
⚔️ 战斗！派出 3 张卡牌 [地:8 海:10 空:6] 对抗「瓜岛争夺战」
📋 战斗结束 → 查看战斗简报
```

**点击链接后弹出模态框：**

```
╔═══════════════════════════════════════╗
║          📋 战斗简报                  ║
╠═══════════════════════════════════════╣
║ 回合 5              12:34:56          ║
║ 任务：瓜岛争夺战                      ║
╠═══════════════════════════════════════╣
║ 🎉 战斗胜利！                         ║
║                                       ║
║ 己方火力:                             ║
║   对地: 8 / 5                         ║
║   对海: 10 / 8                        ║
║   防空: 6 / 4 ✓                      ║
║   制空: 4 / 3 ✓ 空军可返航           ║
║                                       ║
║ 获得奖励:                             ║
║   - 补给 +3                           ║
║                                       ║
║ 战损情况:                             ║
║   - F6F地狱猫战斗机 被击中但成功返航 ✈️║
║   - 法拉格特级驱逐舰 损失             ║
╠═══════════════════════════════════════╣
║ 参战单位 (3)                          ║
║ ✈️ F6F地狱猫战斗机  💣1 ✈️3          ║
║ ⚓ 法拉格特级驱逐舰  💣1 🌊1          ║
║ ⚓ 亚特兰大级巡洋舰  💣1 🌊1 ✈️1     ║
╚═══════════════════════════════════════╝
```

**优势：**
- ✅ 完整的战斗详情
- ✅ 清晰的损伤描述
- ✅ 参战单位一览
- ✅ 可随时回看
- ✅ 不打断游戏流程

## 技术实现

### 文件修改

1. **src/core/GameState.jsx**
   - 添加 `combatReports` 状态
   - 修改 `addLogEntry` 支持对象类型message
   - 修改 `RESOLVE_COMBAT` action 保存战斗简报
   - 修改 `resolveCombat` action creator 接收 combatResult

2. **src/components/GameBoard.jsx**
   - 导入 `CombatReportModal`
   - 添加 `showCombatReportModal` 和 `currentReport` 状态
   - 添加 `handleReportClick` 和 `handleCloseCombatReport` 函数
   - 修改 `actions.resolveCombat` 调用传递完整结果
   - 传递 `onReportClick` 给 BattleLog
   - 渲染 CombatReportModal

3. **src/components/BattleLog.jsx**
   - 接收 `onReportClick` prop
   - 添加 `combat_report` 类型处理
   - 渲染可点击日志链接

4. **src/components/CombatReportModal.jsx**
   - 新建模态框组件
   - 显示战斗简报详情
   - 显示参战单位列表

5. **src/styles/main.css**
   - 添加 `.log-combat-report` 样式
   - 添加 `.log-clickable` 和 `.log-link` 样式
   - 添加 `.combat-report-modal` 及相关样式

### 数据流

```
战斗开始
  ↓
resolveCombat(selectedCards, mission, state)
  ↓
生成 combatResult（包含完整战斗信息）
  ↓
actions.resolveCombat(victory, lostCardIds, combatResult)
  ↓
保存到 state.combatReports
  ↓
生成带 reportId 的日志条目
  ↓
用户点击日志链接
  ↓
handleReportClick(reportId)
  ↓
从 state.combatReports 查找报告
  ↓
显示 CombatReportModal
```

## CSS类名

### 日志相关
- `.log-combat-report` - 战斗简报类型日志
- `.log-clickable` - 可点击的日志消息
- `.log-link` - 链接文字样式

### 模态框相关
- `.combat-report-modal` - 模态框容器
- `.report-info` - 基本信息区域
- `.report-meta` - 元数据（回合、时间）
- `.report-mission` - 任务名称
- `.report-content` - 报告内容
- `.report-summary` - 格式化的战斗摘要
- `.report-cards` - 参战单位区域
- `.report-card-list` - 单位列表
- `.report-card-item` - 单个单位条目

## 键盘操作

- **ESC键**：关闭模态框
- **点击背景**：关闭模态框
- **点击关闭按钮**：关闭模态框

## 测试建议

### 场景1：基础功能测试
1. 开始游戏，进行一场战斗
2. 战斗后查看战场简讯
3. 点击"查看战斗简报"链接
4. 验证模态框正确显示

### 场景2：多场战斗测试
1. 连续进行多场战斗
2. 每场战斗后检查日志
3. 点击不同的战斗简报链接
4. 验证显示正确的战斗详情

### 场景3：重甲和返航测试
1. 使用战列舰（重甲）参战
2. 使用空军（返航）参战
3. 查看战斗简报
4. 验证特殊描述正确显示

### 场景4：历史记录测试
1. 进行超过20场战斗
2. 验证只保留最近20场
3. 旧的战斗简报应被移除

## 浏览器兼容性

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 未来优化

1. **导出功能**：允许导出战斗简报为文本
2. **统计面板**：汇总所有战斗数据的统计
3. **筛选功能**：按胜负、回合筛选战斗
4. **对比功能**：对比两场战斗的差异
5. **动画效果**：添加弹出动画

---

实现日期：2026年4月29日  
功能状态：已实现  
开发服务器：http://localhost:5178/pacific-war-game/
