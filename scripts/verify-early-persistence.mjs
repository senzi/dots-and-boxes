// 验证"开局选择是否被淹没"：早期（已填20）选最优/最差边 → 各自后续生长 → 最终预测
// 若 A/B 路径最终净胜差 ≈ 0 → 早期选择被后续淹没（开局不重要，用户假设成立）
// 若差大 → 早期选择持久影响胜负（开局重要）
// node scripts/verify-early-persistence.mjs [局面数]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ARBoard = require('../ai-research/src/board.js')
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const count = Number(process.argv[2] || 30)
const seedBase = Number(process.argv[3] || 95000)

function growPartial(seed, target, startMask = 0n) {
  const rng = Frontier.mulberry32(seed)
  let mask = startMask
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

// 一条边的"即时评估"（选边用）：填后生长 sims 次 → 玩家0 净胜均值
function evalEdge(mask, e, sims, seedBase2) {
  const mask1 = ARBoard.put(mask, e)
  let net = 0
  for (let g = 0; g < sims; g++) {
    const f = growFull(mask1, seedBase2 * 7919 + g * 104729)
    const pred = Outcome.outcome(f, 1)
    net += pred.score[0] - pred.score[1]
  }
  return net / sims
}

let persistenct = 0, submerged = 0
const diffs = []
for (let i = 0; i < count; i++) {
  const seed = seedBase + i
  const mask20 = growPartial(seed, 20)
  const safe = ARBoard.legal(mask20).filter(e => ARBoard.danger(mask20, e) === 0)
  if (safe.length < 3) continue
  const step = Math.max(1, Math.floor(safe.length / 6))
  const candidates = safe.filter((_, idx) => idx % step === 0).slice(0, 6)
  // 选最优/最差边
  const scores = candidates.map(e => ({ e, v: evalEdge(mask20, e, 4, 500000 + i) }))
  scores.sort((a, b) => b.v - a.v)
  const best = scores[0], worst = scores[scores.length - 1]
  // 各自后续：随机生长 20 步（到已填40）→ 再生长到前沿 ×6 → 预测净胜
  const evalPath = edge => {
    const maskA = ARBoard.put(mask20, edge)
    const mask40 = growPartial(seed * 31 + 7, 40, maskA)
    let net = 0
    for (let g = 0; g < 6; g++) {
      const f = growFull(mask40, seed * 131 + g * 977)
      const pred = Outcome.outcome(f, 1)
      net += pred.score[0] - pred.score[1]
    }
    return net / 6
  }
  const bestFinal = evalPath(best.e)
  const worstFinal = evalPath(worst.e)
  const diff = bestFinal - worstFinal
  diffs.push(diff)
  if (diff > 1.5) persistenct++
  else submerged++
}
const avgDiff = diffs.reduce((s, v) => s + v, 0) / diffs.length
console.log(`=== 早期选择持久性（${count} 局面 · 已填20选边 → 生长到前沿） ===`)
console.log(`最优边 vs 最差边的最终净胜差：均值 ${avgDiff.toFixed(2)} 分`)
console.log(`持久（差>1.5分）: ${persistenct} · 淹没（差≤1.5）: ${submerged}`)
console.log(`结论：${avgDiff > 1.5 ? '✅ 早期选择持久影响胜负（开局重要）' : '⚠️ 早期选择被后续淹没（开局不重要，剩20边再精算可行）'}`)
