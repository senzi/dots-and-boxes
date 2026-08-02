# 安全前沿探索方向（safe-frontier）

目标：让 L4 拿到安全前沿局面就能**直接判断输赢与预期比分**，并评估这条路线的可行性。

## 结论速览（2026-08-02）

**带 DP 的预测最好**：
- 预测（outcome DP）= L4 实际 = **100% 一致**（比分差 0）
- 简化判断器（只看翻转奇偶→终局控制方）99.3%——够快但不够准
- 分级判断器（+终局块大小+让分）：96.8% 覆盖、99.68% 准确

## 三个探索点

1. **安全前沿生成器评估**（`tools/frontier-distribution.cjs`）
   - 边数分布：已填 65~76 边，中位 71；完成格 = 0（比分从 0:0 起）
   - 存储：mask 17.8B / base36 28 字符；100 万前沿 ≈ 17MB
   - 穷举空间 ≥ 1e20（8×8）——不可查表，必须价值块分解 + DP

2. **快速预测**（`src/outcome.js` → `tools/fast-predict.cjs`）
   - ~100ms 直接判断胜负与预期比分（价值序列 + 换权 DP）
   - **firstPlayer = 主动权方**（吃块决策者）；主视角先开块 → firstPlayer = 1

3. **预测 vs 实际自战**（`scripts/predict-vs-selfplay.mjs`，缓存 `explore/data/selfplay-cache.jsonl`）
   - 修正前 26%（firstPlayer 误用）→ 74%（语义修正）→ **100%**（handoutEdge 修正）

## 败局特征（10000 局大样本，`data/losing-batch.jsonl`）

| 特征 | 胜局 | 负局 |
|------|------|------|
| 主视角控制价值占比 v0Ratio | 0.74 | 0.25 |
| 对手最长连庄 maxRun | 1.01 | 3.09 |
| 终局块归属 | 归主视角 99.0% 胜 | 归对手 0.4% 胜 |

- **翻转奇偶 → 最终控制方：100%**（序列决定论）
- **最终控制方 → 胜负：99.3%**；例外 0.7%（终局块小 + 让分多 → 差 1 分惜败）
- 价值构成（1/2/4 块数）与胜负无关——主动权分布决定一切

## 分级判断器（`scripts/analyze-judge-improve.mjs`）

规则：不控制终局 → 输；控制终局且块≥10 → 赢；块<10 且让分≤4 → 赢；否则不确定。
参数 T=10, G=4：**96.8% 覆盖、99.68% 准确**（3.2% 不确定局实际胜率 87.2%）。

## 策略验证

- **保权 vs 翻转**（seed 1002 块 J，枚举 8 组合）：翻转严格占优（40:23 vs 23:40）——DP 最优
- **"拿到权不放手"（keep/L5）**：vs L4 13 胜 87 负——保权=每块让 handout，无条件保权=每块送分
- **悲观修正**：DP 比分 100% 准确（净胜>0 → 100% 赢），打折误杀必胜局（有害）
- **规则（强制保权）死结**：强制"DP 自选翻转"块保权 → L4 执行层找不到让法 → 落空；"预测说能保权但 L4 找不到"**不存在**（0 样本）

## 工具

| 脚本 | 用途 |
|------|------|
| `tools/frontier-distribution.cjs` | 生成器评估（边数/存储/穷举） |
| `tools/fast-predict.cjs` | 快速预测 CLI（~100ms） |
| `tools/find-giveup.cjs` | 扫"必须让权"盘面 |
| `scripts/collect-losing-batch.mjs` | 批量 DP 预测 + 败局收集（10000 局 ~15min） |
| `scripts/predict-vs-selfplay.mjs` | 预测 vs L4 自战对比（带缓存） |
| `scripts/seq-judge.mjs` | 双序列判断器（翻转奇偶→胜负 99.3%） |
| `scripts/analyze-losing.mjs` / `analyze-exceptions.mjs` / `analyze-layout-rule.mjs` | 败局特征分析 |
| `scripts/analyze-judge-improve.mjs` | 分级判断器（+终局块+让分） |
| `scripts/sim-policy.mjs` | 策略模拟（keep vs dp） |
| `scripts/enum-keep.mjs` | 枚举保权组合（块级） |
