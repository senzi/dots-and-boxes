// 测判决器耗时构成：分解（价值块+handout搜索）vs 求解（DP）
// 若求解占比高 → blocks 键缓存有效；若分解占大头 → 缓存收益小
// node scripts/measure-outcome-split.mjs [局数]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ARBoard = require('../ai-research/src/board.js')
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const count = Number(process.argv[2] || 30)
const seedBase = Number(process.argv[3] || 150000)

let total = 0, decomposeMs = 0, solveMs = 0
for (let i = 0; i < count; i++) {
  const mask = Frontier.generate(seedBase + i)
  // 分解计时（通过 Outcome 内部接口——先看 outcome.js 暴露了什么）
  const t0 = process.hrtime.bigint()
  const pred = Outcome.outcome(mask, 1)
  const dt = Number(process.hrtime.bigint() - t0) / 1e6
  total += dt
}
console.log(`outcome 单次平均 ${(total / count).toFixed(1)}ms（${count} 次）`)
console.log(`\n（如需分解/求解拆分，需 outcome.js 暴露 decompose；先看返回结构）`)
const pred = Outcome.outcome(Frontier.generate(seedBase), 1)
console.log(`outcome 返回键: ${Object.keys(pred).join(', ')}`)
