# Dots and Boxes 63 · L3 大师 AI 接口规范

> 面向算法专家的对接文档：请据此提供 L3 的伪代码或参考实现（JavaScript/TypeScript 均可），
> 由析染负责合入 `src/engine/ai.js` 并跑通自测。

---

## 1. 背景

- 游戏：8×8 点阵双人策略游戏，去掉一个角落点，可得分格子 **63** 个。
- 当前状态：L1（休闲）、L2（策略）已上线；**L3（大师）已禁用**，旧实现单步搜索可达 7s+、完整对局超 120s，不满足交互要求。
- 目标：L3 在浏览器内（非 Worker）普通单步尽量 ≤ 2s；复杂安全前沿允许最多约 10s，优先保证策略质量。
- 技术栈：纯前端 Vue 3 + Vite，AI 为纯 JS 模块（ESM），无后端。

## 2. 棋盘模型（数据结构）

```ts
type Dir = 'H' | 'V'
interface EdgeId = string          // 形如 "H-3-5" / "V-2-7"
interface EdgeMove { dir: Dir; r: number; c: number }

// 棋盘状态（纯数据，可 JSON 序列化）
interface BoardState {
  edges: Record<string, number | null>  // EdgeId -> 0 | 1 | null（null=未放置）
  boxes: Record<string, number | null>  // "r-c" -> 0 | 1 | null（null=未完成）
}
```

坐标约定：
- 点阵 9×9，行 r、列 c 均从 0 开始。**左上角点 (0,0) 被移除**。
- 水平边 `H(r,c)`：连接点 (r,c) 与 (r,c+1)。合法范围 r∈[0,9)，c∈[0,8)。`H(0,0)` 不合法。
- 垂直边 `V(r,c)`：连接点 (r,c) 与 (r+1,c)。合法范围 r∈[0,8)，c∈[0,9)。`V(0,0)` 不合法。
- 总可用边 **142** 条。
- 方格 `(r,c)` 位于 r∈[0,8)，c∈[0,8)，**方格 (0,0) 不可得分**（缺两条边，永不闭合）。
- 方格 (r,c) 的四条边：上 `H(r,c)`、下 `H(r+1,c)`、左 `V(r,c)`、右 `V(r,c+1)`。
- 玩家编号：`0` / `1`。

## 3. 引擎 API（专家可直接调用的工具函数）

来源：`src/engine/board.js`（全部导出，纯函数）。

| 函数 | 签名 | 说明 |
|---|---|---|
| `edgeId` | `(dir, r, c) => string` | 边 id 编码 |
| `isEdgeUsable` | `(dir, r, c) => boolean` | 边是否合法（含角点移除） |
| `boxEdges` | `(r, c) => string[]` | 方格 4 条边的 id（上/下/左/右） |
| `edgeBoxes` | `(dir, r, c) => {r,c}[]` | 一条边邻接的方格（已剔除 (0,0)） |
| `createBoard` | `() => BoardState` | 生成初始棋盘 |
| `placeEdge` | `(state, dir, r, c, player) => {ok, gained, completed}` | 放置边；返回是否完成格子及完成的方格列表 |
| `legalMoves` | `(state) => EdgeMove[]` | 所有合法落子 |
| `isGameOver` | `(state) => boolean` | 是否终局 |
| `scores` | `(state) => [number, number]` | 双方已得格数 |
| `cloneState` | `(state) => BoardState` | 深拷贝（AI 搜索必用，勿原地修改） |
| `remainingEdges` | `(state) => number` | 剩余空边数 |
| `boxFilledCount` | `(state, r, c) => number` | 方格已填充边数（0~4） |

**热路径查表（搜索性能关键，已预计算，模块加载即初始化）**：

| 常量/函数 | 说明 |
|---|---|
| `EDGE_BOXES` | `EdgeId -> {r,c}[]`，边→邻接方格 |
| `BOX_EDGE_IDS` | `"r-c" -> string[4]`，方格→4 边 id |
| `boxFilledCountFast(state, r, c)` | 查表版已填充边数 |
| `immediateGainFast(state, edgeId)` | 查表版：放这条边能立即完成几个格子 |

> 注意：`placeEdge` 会**原地修改** state（且会自动标记完成的格子），搜索时务必先 `cloneState`。

## 4. L3 接口契约

### 4.1 必须实现

```ts
// 文件：src/engine/ai.js
// 输入：当前棋盘状态 + AI 玩家编号
// 输出：一个合法落子；若没有合法落子可返回 null（正常不会发生）
export function aiMoveLevel3(
  state: BoardState,
  player: 0 | 1,
  lastMove?: EdgeMove & { player: 0 | 1 },
  controlOwner?: 0 | 1
): EdgeMove | null
```

`lastMove` 为向后兼容的可选提示，用于安全阶段优先贴近对方上一手布局；
`controlOwner` 是游戏层持续维护的推定主动权方，用于切换保权/争权策略。
二者未提供时 L3 仍可仅根据 `state` 正常决策。

### 4.2 规则语义（务必遵守）

1. **吃格不是强制动作**：若一步完成格子，当前玩家得分并继续行动；但即使存在可得分边，玩家仍可选择其他合法边。L3 必须支持主动弃吃，例如在长链尾部下双十字/“日字”，留下 2 格（环可留下 4 格）以保持后续控制权，不能无脑贪吃。
2. 输出必须是 `state.edges[id] === null` 的合法边。
3. 纯函数：**禁止修改传入的 state**，禁止模块级可变全局（搜索预算等可用参数传递或模块内临时量）。
4. 确定性：同局面应给出稳定一致的落子（除非刻意加随机性，如平手时随机）。

### 4.3 性能约束（硬性）

- 单步计算时间：普通局面目标 **≤ 2000ms**；复杂安全前沿硬截止约 **10000ms**。
- 内存：单步内临时分配可控（GC 停顿不明显）。
- 禁止 `Worker`、`WebAssembly`、网络请求、`localStorage`（暂时保持单线程同步实现，后续可再演进）。
- 建议自设**节点预算**兜底（旧实现用 20 万节点，仍偏慢，请结合查表优化后重新标定）。

### 4.4 集成方式

- 专家交付：`aiMoveLevel3` 的完整实现（或伪代码 + 关键数据结构说明）。
- 析染合入时：替换 `src/engine/ai.js` 中现有的 `aiMoveLevel3`（旧实现已加注释保留，可直接覆盖）。
- 合入后恢复 L3 在 `AI_LEVELS` 中的展示（当前数组只有 1、2 两档，注释掉了第 3 档），并恢复 `getAiMove` 中 `level === 3` 的分支（当前回退到 L2）。

### 4.5 验证方式

```bash
node scripts/self-test.mjs
# 期望：L3 完整对局（AI vs AI 模拟）在合理时间内结束（< 60s），且 63 格全部填满
```

另建议专家交付时附带：
- 复杂度说明（搜索深度/分支策略/何时转终局精确搜索）
- 已知弱点（如链/环处理、开局定式）
- 调参建议（若含启发式权重）

## 5. 旧实现的问题（供参考，避免重蹈覆辙）

旧 L3 = minimax + alpha-beta + 静态查表，问题：

1. **非吃格阶段分支爆炸**：开局可选边 ~130，即使 alpha-beta + 安全边裁剪（只搜 `moveDanger===0`）+ 随机抽样 14~16 条，单步仍 7s。
2. **吃格链递归不控深**：吃格阶段深度不减（必须走完连锁），终局大片三边格时分支指数膨胀；节点预算 20 万仍不够兜底。
3. **评估函数粗糙**：`evaluate` 只用 已得分差 + 三边格惩罚 + 二边格奖励，无真正的链/环结构分析（`chainAnalysis` 是占位实现）。
4. 没有 transposition 缓存、没有对称性剪枝、没有开局定式库。

**Dots and Boxes 理论背景**（专家大概率已知，列作备忘）：
- 局面本质由"链（chain）"与"环（loop）"结构驱动；先手/后手在开局有定式。
- 常见高效思路：链长奇偶性分析（"双十字"理论）、支配链/牺牲链、终局（剩余边少）用精确求解（DP/记忆化），中盘用结构启发式 + 浅层搜索。
- 8×8 去角点共 142 边，全状态空间不可枚举，必须结构分析 + 局部搜索结合。

## 6. 棋盘规模备忘

- 边总数 142；格子 63；开局先手 P0。
- 终局判定：所有 142 条边均非空。
- 得分：每完成 1 格 +1，最终 63 格全部分配，分数高者胜；理论平局 31.5:31.5 不可能（63 为奇数，必有胜负）。
