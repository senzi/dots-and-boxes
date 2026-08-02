// 策略模拟：用户（L5 拿到权不放手）vs L4（DP 自由决策）
// 块级模拟：基于 outcome 块分解，双方按策略决策每块（保权/翻转），累计比分
// pol0 = 玩家0 策略：'keep'（能保权就保权）/ 'dp'（DP 自由）
// pol1 = 玩家1 策略：同上
// node scripts/sim-policy.mjs [局数] [pol0] [pol1] [起始seed]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const count = Number(process.argv[2] || 10)
const pol0 = process.argv[3] || 'keep' // 玩家0（主视角，先开块）策略
const pol1 = process.argv[4] || 'dp'   // 玩家1（对手）策略
const seedBase = Number(process.argv[5] || 10000)

// 单局模拟：返回 [玩家0, 玩家1] 比分
function simulate(mask, policy0, policy1) {
  const pred = Outcome.outcome(mask, 1) // 基线 DP（供 L4 自由决策用）
  let c = 1 // 主动权方 = 玩家1（主视角先开块无主动权）
  let s0 = 0, s1 = 0
  let node = pred.tree
  for (let i = 0; i < pred.blocks.length; i++) {
    const b = pred.blocks[i]
    const controller = c
    const policy = controller === 0 ? policy0 : policy1
    let keep
    if (policy === 'keep') keep = true
    else keep = !!(node && node.choice && node.choice.includes('保权'))
    let take, give, next
    if (keep && b.handoutEdge !== null) {
      take = b.controlTake; give = b.handout; next = c // 保权
    } else {
      take = b.value; give = 0; next = 1 - c // 翻转（吃光）
    }
    if (controller === 0) { s0 += take; s1 += give } else { s1 += take; s0 += give }
    c = next
    node = node && node.sub
  }
  return [s0, s1]
}

let w0 = 0, w1 = 0, d = 0
const samples = []
for (let i = 0; i < count; i++) {
  const mask = Frontier.generate(seedBase + i)
  const [s0, s1] = simulate(mask, pol0, pol1)
  if (s0 > s1) w0++; else if (s1 > s0) w1++; else d++
  if (samples.length < 8) samples.push({ seed: seedBase + i, score: `${s0}:${s1}`, win: s0 > s1 ? '玩家0' : s1 > s0 ? '玩家1' : '平' })
}
console.log(`策略对比：玩家0=${pol0}（主视角先开块） vs 玩家1=${pol1}`)
console.log(`玩家0 胜 ${w0} · 玩家1 胜 ${w1} · 平 ${d}（${count} 局）`)
console.log(`样例:`)
for (const s of samples) console.log(`  seed ${s.seed} ${s.score} ${s.win}`)
