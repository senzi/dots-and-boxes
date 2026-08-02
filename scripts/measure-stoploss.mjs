// 止损猜想验证：多少局面"随机生长3次都稳定形成 >10 格大龙"（结构定型）
// 若触发率高 → 止损有效（跳过前瞻省时间）；再对比止损前后翻盘率
// node scripts/measure-stoploss.mjs [局面数]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ARBoard = require('../ai-research/src/board.js')
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const count = Number(process.argv[2] || 30)
const seedBase = Number(process.argv[3] || 140000)

function growFull(mask, rngSeed) {
  const rng = Frontier.mulberry32(rngSeed)
  let lastMove = null
  let step = 0
  while (true) {
    const safe = ARBoard.legal(mask).filter(i => ARBoard.danger(mask, i) === 0)
    if (!safe.length) return mask
    let choices = safe
    if (lastMove != null && step < 10) {
      const prior = ARBoard.edges[lastMove]
      const endpoints = e => e.dir === 'H' ? [[e.c, e.r], [e.c + 1, e.r]] : [[e.c, e.r], [e.c, e.r + 1]]
      const touches = safe.filter(index => {
        const edge = ARBoard.edges[index]
        return endpoints(edge).some(a => endpoints(prior).some(b => a[0] === b[0] && a[1] === b[1]))
      })
      if (touches.length) choices = touches
    }
    lastMove = choices[Math.floor(rng() * choices.length)]
    mask = ARBoard.put(mask, lastMove)
    step++
  }
}
function rewind(frontier, target, seed) {
  const rng = Frontier.mulberry32(seed)
  let mask = frontier
  while (true) {
    const safe = ARBoard.legal(mask).filter(i => ARBoard.danger(mask, i) === 0)
    if (safe.length >= target) return mask
    const filled = ARBoard.edges.map(e => e.index).filter(i => ARBoard.has(mask, i))
    if (!filled.length) return mask
    mask &= ~(1n << BigInt(filled[Math.floor(rng() * filled.length)]))
  }
}

// 稳定大龙检测：3 次生长都最大块 >10 → 结构定型
function stableBig(mask, seed) {
  const sizes = []
  for (let g = 0; g < 3; g++) {
    const f = growFull(mask, seed * 7919 + g * 104729)
    const pred = Outcome.outcome(f, 1)
    sizes.push(Math.max(...pred.blocks.map(b => b.value)))
  }
  return { stable: sizes.every(s => s > 10), sizes }
}

let total = 0, stable = 0
let stableFlip = 0, unstableFlip = 0, stableCount = 0, unstableCount = 0
for (let i = 0; i < count; i++) {
  const frontier = Frontier.generate(seedBase + i)
  const pred0 = Outcome.outcome(frontier, 1)
  if (pred0.score[0] >= pred0.score[1]) continue // 只测败局
  total++
  const mask = rewind(frontier, 20, seedBase + i)
  const { stable: st, sizes } = stableBig(mask, seedBase + i)
  if (st) stable++
  // 该局面用 L5 前瞻接管后是否翻盘（简化：用判决器判接管后的前沿）
  // 这里只统计"定型率" + 定型局的实际胜率（用判决器模拟接管：贴边填完）
  const safe = ARBoard.legal(mask).filter(e => ARBoard.danger(mask, e) === 0)
  if (safe.length) {
    const full = growFull(mask, seedBase * 31)
    const pred1 = Outcome.outcome(full, 1)
    const flip = pred1.score[0] > pred1.score[1]
    if (st) { stableCount++; if (flip) stableFlip++ }
    else { unstableCount++; if (flip) unstableFlip++ }
  }
}
console.log(`=== 止损猜想（${count} 生成 · ${total} 败局 · 阈值20） ===`)
console.log(`大龙定型（3次生长都>10格）: ${stable}/${total}（${(stable / total * 100).toFixed(1)}%）`)
console.log(`定型局贴边后翻盘: ${stableFlip}/${stableCount}（${stableCount ? (stableFlip / stableCount * 100).toFixed(1) : 0}%）`)
console.log(`非定型局贴边后翻盘: ${unstableFlip}/${unstableCount}（${unstableCount ? (unstableFlip / unstableCount * 100).toFixed(1) : 0}%）`)
console.log(`（对比：L5 前瞻接管翻盘率 85.7% —— 若定型局贴边翻盘率接近 85.7%，止损无损失）`)
