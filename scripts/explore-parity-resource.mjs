// L6 翻转边资源探索：开放局面的"翻转边"（改变 v1+v2 奇偶的边）数量
// 翻转边 = 与基线奇偶不同的候选边——谁控制最后一条翻转边 = 谁定最终奇偶
// 另测"破坏"：下掉翻转边（消耗资源）
// node scripts/explore-parity-resource.mjs [局面数] [已填边数] [sims]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ARBoard = require('../ai-research/src/board.js')
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const count = Number(process.argv[2] || 15)
const target = Number(process.argv[3] || 45)
const sims = Number(process.argv[4] || 3)
const seedBase = Number(process.argv[5] || 200000)

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
  for (let g = 0; g < sims; g++) {
    const f = growFull(mask, seedBase2 * 7919 + g * 104729)
    const pred = Outcome.outcome(f, 1)
    let v12 = 0
    for (const b of pred.blocks) if (b.value === 1 || b.value === 2) v12++
    if (v12 % 2 === 1) odd++
  }
  return odd > sims / 2 ? 1 : 0
}

let simCounter = 5000000
const stats = { total: 0, r0: 0, r1: 0, r2: 0, r3: 0, r4plus: 0 }
const samples = []
for (let i = 0; i < count; i++) {
  const mask = growPartial(seedBase + i, target)
  const safe = ARBoard.legal(mask).filter(e => ARBoard.danger(mask, e) === 0)
  if (safe.length < 5) continue
  stats.total++
  const base = parityOf(mask, seedBase + i)
  let flipEdges = 0
  for (const ei of safe) {
    const p = parityOf(ARBoard.put(mask, ei), simCounter++)
    if (p !== base) flipEdges++
  }
  if (flipEdges === 0) stats.r0++
  else if (flipEdges === 1) stats.r1++
  else if (flipEdges === 2) stats.r2++
  else if (flipEdges === 3) stats.r3++
  else stats.r4plus++
  if (samples.length < 8) samples.push({ seed: seedBase + i, base, flip: flipEdges })
}
console.log(`=== L6 翻转边资源（${count} 局面 · 已填${target} · sims${sims}） ===`)
console.log('基线奇偶 = 当前趋势；翻转边 = 改变奇偶的候选安全边')
console.log(`  翻转边=0（无法翻）: ${stats.r0} 局`)
console.log(`  翻转边=1（单翻点）: ${stats.r1} 局`)
console.log(`  翻转边=2: ${stats.r2} 局`)
console.log(`  翻转边=3: ${stats.r3} 局`)
console.log(`  翻转边≥4: ${stats.r4plus} 局`)
console.log(`\n样例:`)
for (const s of samples) console.log(`  seed ${s.seed} 基线=${s.base}(1奇0偶) 翻转边=${s.flip}`)
console.log(`\n解读：翻转边是'攻防资源'——自己翻+破坏对手的翻；`)
console.log(`翻转边=1 时：谁先下它谁定奇偶（最后翻转权）；可被对手'破坏'（提前下掉）`)
