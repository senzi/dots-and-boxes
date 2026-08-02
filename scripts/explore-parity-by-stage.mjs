// 奇偶可控性随进度变化：翻转边数量 vs 已填边数
// 若临近前沿（已填55-60）翻转边骤减 → 最后几步定奇偶（单翻点模型成立）
// 若始终很多 → 奇偶每步全可控（博弈到最后一步）
// node scripts/explore-parity-by-stage.mjs [每水平局面数]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ARBoard = require('../ai-research/src/board.js')
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const perStage = Number(process.argv[2] || 10)
const seedBase = Number(process.argv[3] || 210000)

function growPartial(seed, tgt) {
  const rng = Frontier.mulberry32(seed)
  let mask = 0n
  let lastMove = null
  while (ARBoard.bitCount(mask) < tgt) {
    const safe = ARBoard.legal(mask).filter(i => ARBoard.danger(mask, i) === 0)
    if (!safe.length) break
    let choices = safe
    if (lastMove != null) {
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
  }
  return mask
}
function growFull(mask, rngSeed) {
  const rng = Frontier.mulberry32(rngSeed)
  let lastMove = null
  while (true) {
    const safe = ARBoard.legal(mask).filter(i => ARBoard.danger(mask, i) === 0)
    if (!safe.length) return mask
    let choices = safe
    if (lastMove != null) {
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
  }
}
function parityOf(mask, seedBase2) {
  let odd = 0
  for (let g = 0; g < 3; g++) {
    const f = growFull(mask, seedBase2 * 7919 + g * 104729)
    const pred = Outcome.outcome(f, 1)
    let v12 = 0
    for (const b of pred.blocks) if (b.value === 1 || b.value === 2) v12++
    if (v12 % 2 === 1) odd++
  }
  return odd > 1.5 ? 1 : 0
}

let simCounter = 6000000
console.log(`=== 奇偶可控性随进度（每水平 ${perStage} 局面） ===`)
console.log('已填边数 | 平均翻转边 | 平均安全边 | 翻转边占比')
for (const target of [35, 45, 55, 60]) {
  let flipSum = 0, safeSum = 0, n = 0
  for (let i = 0; i < perStage; i++) {
    const mask = growPartial(seedBase + i, target)
    const safe = ARBoard.legal(mask).filter(e => ARBoard.danger(mask, e) === 0)
    if (safe.length < 3) continue
    n++
    safeSum += safe.length
    const base = parityOf(mask, seedBase + i)
    let flip = 0
    for (const ei of safe) {
      const p = parityOf(ARBoard.put(mask, ei), simCounter++)
      if (p !== base) flip++
    }
    flipSum += flip
  }
  console.log(`  已填${String(target).padStart(2)} | ${(flipSum / n).toFixed(1)} | ${(safeSum / n).toFixed(1)} | ${(flipSum / safeSum * 100).toFixed(0)}%`)
}
