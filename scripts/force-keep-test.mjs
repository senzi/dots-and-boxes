// 验证"主动让权"是否该让：强制主动让权块保权，重预测比分
// 对必输局：如果强制保权后比分改善/翻盘 → 这些局不该主动让权（L4 决策可改进）
// node scripts/force-keep-test.mjs [局数]
import { createRequire } from 'node:module'
import fs from 'node:fs'

const require = createRequire(import.meta.url)
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const count = Number(process.argv[2] || 500)
const seedBase = Number(process.argv[3] || 10000)

function flagFor(block, choice) {
  if (!choice) return 'forced'
  if (choice.includes('保权')) return 'keep'
  if (block.controlCode === 'FORCED_FLIP' || block.controlCode === 'TAKE_ALL') return 'forced'
  if (block.handoutEdge === null) return 'forced'
  return 'activeGive'
}

let improved = 0
let flipped = 0
let noActive = 0
const samples = []
for (let i = 0; i < count; i++) {
  const seed = seedBase + i
  const mask = Frontier.generate(seed)
  const base = Outcome.outcome(mask, 1)
  const [b0, b1] = base.score
  if (b0 >= b1) continue // 只要必输局

  // 找 activeGive 块
  const activeIdx = []
  let node = base.tree
  for (let j = 0; j < base.blocks.length; j++) {
    if (flagFor(base.blocks[j], node ? node.choice : null) === 'activeGive') activeIdx.push(j)
    node = node && node.sub
  }
  if (!activeIdx.length) { noActive++; continue }

  // 强制这些块保权，重预测
  const forced = Outcome.outcome(mask, 1, { forceKeep: new Set(activeIdx) })
  const [f0, f1] = forced.score
  const baseNet = b0 - b1
  const forcedNet = f0 - f1
  if (forcedNet > baseNet) improved++
  if (f0 > f1) flipped++
  if (samples.length < 8) samples.push({ seed, base: `${b0}:${b1}`, forced: `${f0}:${f1}`, flipped: f0 > f1, activeBlocks: activeIdx.length })
}

console.log(`=== 强制保权测试（${count} 个前沿，仅统计必输局） ===`)
console.log(`必输局含主动让权: ${improved + (count - noActive - improved - flipped >= 0 ? count - noActive : 0)} 局（样本内）`)
console.log(`强制保权后比分改善: ${improved} 局`)
console.log(`强制保权后翻盘为胜: ${flipped} 局`)
console.log(`必输局无主动让权（纯被迫）: ${noActive} 局`)
console.log(`\n样例:`)
for (const s of samples) {
  console.log(`  seed ${s.seed} 基础 ${s.base} → 强制保权 ${s.forced} ${s.flipped ? '✅翻盘' : ''}（${s.activeBlocks} 块主动让权）`)
}
