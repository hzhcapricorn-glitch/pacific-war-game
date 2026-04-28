# 商店背景图处理方案

## 当前使用方案（推荐）：组合方案
- **背景透明度**: 15% (`opacity: 0.15`)
- **白色覆盖层**: 5% (`rgba(255, 255, 255, 0.05)`)
- **模糊效果**: 2px (`backdrop-filter: blur(2px)`)

这个组合确保背景图不会干扰卡牌显示，同时保留一些视觉细节。

---

## 其他可选方案

### 方案 1: 纯透明度降低（最简单）
```css
.shop-section-left::before {
  background-image: url('/pacific-war-game/img/Background_shop1.png');
  opacity: 0.2; /* 调整 0.1-0.3 之间 */
}
```
**优点**: 最简单，性能最好
**缺点**: 颜色可能还是偏亮

---

### 方案 2: 深色覆盖层
```css
.shop-section-left::before {
  background-image: url('/pacific-war-game/img/Background_shop1.png');
  opacity: 0.3;
}

.shop-section-left::after {
  background-color: rgba(0, 0, 0, 0.4); /* 深色覆盖 */
}
```
**优点**: 压暗背景，突出前景卡牌
**缺点**: 整体偏暗

---

### 方案 3: 去色 + 模糊（柔和）
```css
.shop-section-left::before {
  background-image: url('/pacific-war-game/img/Background_shop1.png');
  opacity: 0.25;
  filter: grayscale(50%) blur(3px); /* 半去色 + 模糊 */
}
```
**优点**: 柔和不抢眼，有质感
**缺点**: filter 性能开销稍大

---

### 方案 4: 过曝效果
```css
.shop-section-left::before {
  background-image: url('/pacific-war-game/img/Background_shop1.png');
  opacity: 0.3;
  filter: brightness(1.5) contrast(0.7); /* 提亮 + 降对比 */
}
```
**优点**: 营造明亮氛围
**缺点**: 可能太亮

---

### 方案 5: 渐变遮罩
```css
.shop-section-left::before {
  background-image: url('/pacific-war-game/img/Background_shop1.png');
  opacity: 0.25;
}

.shop-section-left::after {
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.1),
    rgba(0, 0, 0, 0.2)
  );
}
```
**优点**: 上亮下暗，层次感好
**缺点**: 稍复杂

---

## 调整参数建议

当前方案中可调整的参数：

```css
/* cards.css 第830行附近 */

.shop-section-left::before {
  opacity: 0.15; /* 推荐范围: 0.1 - 0.3 */
}

.shop-section-left::after {
  background-color: rgba(255, 255, 255, 0.05); /* 推荐范围: 0.03 - 0.1 */
  backdrop-filter: blur(2px); /* 推荐范围: 1px - 4px */
}
```

**测试建议**：
1. 先调整 `::before` 的 `opacity`（主要控制背景显眼程度）
2. 再调整 `::after` 的 `background-color` alpha 值（微调柔和度）
3. 最后调整 `blur` 值（控制清晰度）

---

## 如何切换方案

在 `src/styles/cards.css` 修改相应区域的 `::before` 和 `::after` 的样式即可。

---

## 已添加背景的区域

### 1. 必要卡牌区 (`.shop-section-left`)
- 背景图: `Background_shop1.png`
- 位置: ~第830行

### 2. 随机卡牌区 (`.shop-section-right`)
- 背景图: `Background_shop2.png`
- 位置: ~第870行

### 3. 部署区 (`.deployed-zone`)
- 背景图: `Background_deploy.png`
- 位置: ~第620行

### 4. 手牌区 (`.hand-zone`)
- 背景图: `Background_hand.png`
- 位置: ~第580行

**所有区域使用相同的处理方案：**
- 背景透明度: 15%
- 白色覆盖层: 5%
- 模糊效果: 2px

---

## 统一调整所有背景

如果想统一调整所有区域的背景效果，可以批量修改：

```bash
# 在 cards.css 中搜索并替换
opacity: 0.15  →  opacity: 0.2  (调整背景显眼度)
rgba(255, 255, 255, 0.05)  →  rgba(255, 255, 255, 0.08)  (调整柔和度)
blur(2px)  →  blur(3px)  (调整模糊度)
```
