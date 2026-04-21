# 调试步骤

## 问题：点击"初级补给"卡没有反应

### 步骤1：重启浏览器
1. 完全关闭浏览器（不是只关标签页）
2. 重新打开浏览器
3. 访问：http://localhost:5173/agent_test_playground/
4. **重要**：按 `Ctrl+Shift+R` (Windows) 或 `Cmd+Shift+R` (Mac) 进行硬刷新

### 步骤2：打开浏览器控制台
1. 按 `F12` 打开开发者工具
2. 切换到 "Console" 标签
3. 清空控制台（点击垃圾桶图标）

### 步骤3：开始游戏并测试
1. 游戏会自动进入**行动阶段**（看顶部状态栏：阶段显示"行动阶段"）
2. 你应该看到5张"初级补给"卡在手牌区
3. 点击其中一张"初级补给"卡

### 步骤4：查看控制台输出

**如果点击生效**，你会看到：
```
🎴 Card clicked: 初级补给 starter_supply_starter_0
📍 Current phase: action
✋ Hand cards: ['初级补给', '初级补给', '初级补给', '初级补给', '初级补给']
🔍 isInHand: true isInDeployed: false
✅ Playing card: starter_supply_starter_0
```

**预期结果**：
- ✨ 补给数字变为 1 并有脉冲动画
- ✨ 显示 "+1" 浮动提示
- ✅ 卡牌从手牌消失
- ✅ 弃牌堆显示这张卡

**如果没有任何输出**：
- 点击事件没有被触发
- 可能的原因：
  1. 浏览器缓存问题（需要硬刷新）
  2. React HMR 失效（需要完全刷新）
  3. CSS 层级问题（其他元素覆盖了卡牌）

### 步骤5：手动测试点击检测

在浏览器控制台中运行：
```javascript
// 检查卡牌元素是否存在
document.querySelectorAll('.card').length
// 应该返回 5（5张手牌）

// 检查第一张卡牌的信息
document.querySelector('.card').textContent
// 应该包含 "初级补给"

// 手动触发点击
document.querySelector('.card').click()
// 应该触发点击事件并看到控制台日志
```

### 步骤6：检查是否在正确的阶段

在控制台运行：
```javascript
// 这会触发错误，但可以看到 React 组件状态
document.querySelector('.phase').textContent
// 应该显示 "行动阶段"
```

## 常见问题排查

### 问题A：点击没有任何反应，控制台没有输出

**解决方案**：
1. 硬刷新页面 (Ctrl+Shift+R)
2. 如果还不行，重启开发服务器：
   ```bash
   pkill -f vite
   npm run dev
   ```
3. 再次硬刷新页面

### 问题B：控制台显示 "isInHand: false"

**说明**：卡牌 ID 不匹配

**检查**：在控制台运行：
```javascript
// 显示手牌的 instanceId
console.log('Hand:', window.__REACT_DEVTOOLS_GLOBAL_HOOK__)
```

### 问题C：补给数字没有变化

**说明**：GameState 的 PLAY_CARD action 没有执行

**检查**：在 src/core/GameState.jsx 的第145行添加：
```javascript
console.log('💰 Adding supply:', effects.supply);
```

### 问题D：卡牌没有移动到弃牌堆

**说明**：卡牌移动逻辑有问题

**检查**：卡牌是否满足条件（combat === 0 && redeployCost === 0）

## 最终测试清单

- [ ] 硬刷新页面 (Ctrl+Shift+R)
- [ ] 打开浏览器控制台 (F12)
- [ ] 游戏进入行动阶段
- [ ] 点击"初级补给"卡
- [ ] 看到控制台日志
- [ ] 看到补给数字动画
- [ ] 看到 "+1" 浮动提示
- [ ] 卡牌移动到弃牌堆

## 需要反馈的信息

如果仍然有问题，请提供：
1. 浏览器版本（Chrome/Firefox/Safari）
2. 控制台的完整输出（截图或复制文本）
3. 点击时是否在"行动阶段"
4. 是否有任何错误消息（红色文本）
5. Network 标签显示的文件是否都加载成功
