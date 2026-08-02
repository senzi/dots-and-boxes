// 验证安全阶段杠杆随进度变化：不同"已填边数"水平的候选边胜率极差
// 若早期（已填20）极差小、晚期（已填55）极差大 → 剩~20安全边再精算是好策略
// node scripts/verify-leverage-by-stage.mjs [每水平局面数]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ARBoard = require('../ai-research/src/board.js')
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const perStage = Number(process.argv[2] || 40)
const seedBase = Number(process.argv[3] || 90000)

function growPartial(seed, target) {
  const rng = Frontier.mulberry32(seed)
  let mask = 0n
  let lastMove = null
  while (ARBoard.bitCount(mask) < target) {
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

// 某水平的候选边胜率极差
function spreadAt(target, sims) {
  let spreads = []
  for (let i = 0; i < perStage; i++) {
    const mask = growPartial(seedBase + i, target)
    const safe = ARBoard.legal(mask).filter(e => ARBoard.danger(mask, e) === 0)
    if (safe.length < 3) continue
    const step = Math.max(1, Math.floor(safe.length / 6))
    const candidates = safe.filter((_, idx) => idx % step === 0).slice(0, 6)
    const rates = []
    for (const e of candidates) {
      const mask1 = ARBoard.put(mask, e)
      let wins = 0
      for (let g = 0; g < sims; g++) {
        const frontier = growFull(mask1, target * 7919 + i * 104729 + g * 31)
        const pred = Outcome.outcome(frontier, 1)
        if (pred.score[0] > pred.score[1]) wins++
      }
      rates.push(wins / sims)
    }
    spreads.push(Math.max(...rates) - Math.min(...rates))
  }
  return spreads.reduce((s, v) => s + v, 0) / spreads.length
}

console.log(`=== 安全阶段杠杆随进度变化（每水平 ${perStage} 局面 · sims 8） ===`)
console.log('已填边数(剩安全边) | 候选边胜率极差')
for (const target of [45, 50, 55, 58, 60]) {
  const remaining = 142 - target
  const spread = spreadAt(target, 8)
  console.log(`  已填${String(target).padStart(2)}（剩~${remaining}） | ${(spread * 100).toFixed(1)}%`)
}
