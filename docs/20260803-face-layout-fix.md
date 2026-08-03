# 面对面布局修复：移动端竖屏玩家卡片 + toast 提示

日期：2026-08-03（三轮修正）

## 最终布局（竖屏设备，用户确认）

```
玩家0（小猫）卡片 —— 倒转 180°（朝向下端玩家）
棋盘          —— 垂直居中（精确）
玩家1（狐狸）卡片 —— 正着（朝向上端玩家）
toast「xx 围成 N 格」—— 跟随当前行动玩家，弹在其比分牌内侧（卡片与棋盘之间），与比分牌同旋转
```

## 修改（全部在 `src/views/Game.vue`，纯 CSS 计算样式 + 一个 computed）

### 1. 竖屏布局 + 棋盘精确垂直居中

```css
@media (max-width: 860px) and (orientation: portrait) {
  .game-page { padding: 56px 16px; }                 /* 上下 padding 对称 */
  .game-page > .row-between { position: absolute; top: 8px; left: 16px; right: 16px; }  /* 顶栏悬浮不占流 */
  .face-layout {
    flex-direction: column;
    gap: 8px;                                        /* 比分牌稍微靠近棋盘（上下等距） */
    justify-content: center;
    margin-top: 0;
  }
  .face-layout .side-panel { width: 100%; max-width: 620px; }
  .face-layout .rot90 { transform: rotate(180deg); }
  .face-layout .rot-90 { transform: rotate(0deg); }
}
```

**垂直居中原理**：`.page` 上下 padding 对称（56/56）+ 顶栏 absolute 不占文档流 → `face-layout`（flex: 1）精确撑满剩余高度，`justify-content: center` 使三元素整体居中，两卡片等高 → 棋盘中心 = 视口中心。实测 `delta = 0`（iframe 390×844 真实竖屏）。

### 2. 比分牌靠近棋盘

`gap: 12px → 8px`，flex gap 天然上下等距（实测 gapTop = gapBottom = 8）。

### 3. toast 跟随行动玩家（script + CSS）

```js
const toastPos = computed(() => {
  if (!isFace.value) return 'toast-board'
  const portrait = window.matchMedia('(max-width: 860px) and (orientation: portrait)').matches
  if (!portrait) return 'toast-board'
  return game.current === 0 ? 'toast-top' : 'toast-bottom'
})
```

```css
.toast-top    { transform: translateX(-50%) rotate(180deg); }   /* 玩家0：棋盘上方内侧，倒转 */
.toast-bottom { top: auto; bottom: -8px; transform: translateX(-50%) rotate(0deg); }  /* 玩家1：棋盘下方内侧，正着 */
```

## 顺带修复的两个隐藏 bug

1. **fadeUp 动画覆盖 transform**：`.toast { animation: fadeUp ... }` 的 keyframes 含 `transform: translateY(...)`，`both` 填充模式结束后仍覆盖 toast 的 `translateX(-50%)` —— **居中一直是被破坏的**（不止旋转，连水平居中都没了）。修复：toast 改用纯 opacity 动画 `toastFade`（`@keyframes toastFade { from { opacity: 0 } to { opacity: 1 } }`），transform 完全由类控制。
2. **transform 顺序**：`rotate(180deg) translateX(-50%)` 是先平移再绕原点旋转，toast 被甩到一侧（实测偏移 189px = 整个 toast 宽）。正确顺序 `translateX(-50%) rotate(180deg)`（先旋转再平移）。

## 验证（iframe 390×844 真实竖屏模拟）

- 棋盘中心 420 = 视口中心 420，**delta = 0** 精确垂直居中
- gapTop = gapBottom = **8px**（等距靠近）
- 玩家0 卡片 `rotate(180deg)`、玩家1 `rotate(0deg)`
- 狐狸围格 → toast-bottom，正着，棋盘下方内侧（中心 686 ≈ 棋盘底 696）
- 小猫围格 → toast-top，`matrix(-1,0,0,-1,-94.76,0)` = 倒转 180°，**centerDeltaX = 0** 水平居中，棋盘上方内侧（中心 154 ≈ 棋盘顶 144）
- `npm run build` 通过

## 修正记录

- 第一版：位置反了（棋盘被 order:-1 顶到最上）+ 朝向全归零 → 用户给示意图纠正
- 第二版：朝向做反（玩家0 正着/玩家1 倒转）→ 用户纠正座位模型（玩家0 坐下端、玩家1 坐上端）+ 要求棋盘垂直居中
- 第三版（本版）：toast 跟随玩家 + 旋转、gap 8px 等距、棋盘精确垂直居中；过程中发现并修复 fadeUp 覆盖 transform 与 transform 顺序两个隐藏 bug

## 感受

这轮最值的是揪出两个隐藏 bug：fadeUp 动画悄悄覆盖了 toast 的 transform（连居中都是坏的，用户之前说"位置不对"可能就有这部分），transform 顺序则是 CSS 常见坑——`rotate` 在后会把平移方向一起转。验证时"数边索引"很容易错，最后改用**坐标定位目标边**才稳定，教训是模拟点击优先用几何特征而非列表序号。
