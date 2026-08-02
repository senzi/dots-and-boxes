// L6 奇偶控制探索：开放局面 → 当前奇偶 → 候选边产生的 v1+v2 奇偶 → 决策空间
// node scripts/explore-parity-control.mjs [局面数] [已填边数] [每候选生长次数]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ARBoard = require('../ai-research/src/board.js')
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const count = Number(process.argv[2] || 15)
const target = Number(process.argv[3] || 45)
const sims = Number(process.argv[4] || 3)
const seedBase = Number(process.argv[5] || 190000)

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
// 前沿的 v1+v2 奇偶（多数投票 sims 次）
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

let simCounter = 4000000
let canFlip = 0, total = 0
const samples = []
for (let i = 0; i < count; i++) {
  const mask = growPartial(seedBase + i, target)
  const safe = ARBoard.legal(mask).filter(e => ARBoard.danger(mask, e) === 0)
  if (safe.length < 5) continue
  total++
  // 基线奇偶：随机填一条安全边后的趋势（当前局面继续的默认奇偶）
  const baseParity = parityOf(mask, seedBase + i)
  // 候选边奇偶分布
  const step = Math.max(1, Math.floor(safe.length / 12))
  const candidates = safe.filter((_, idx) => idx % step === 0).slice(0, 12)
  let oddCount = 0
  const edgeParities = []
  for (const ei of candidates) {
    const p = parityOf(ARBoard.put(mask, ei), simCounter++)
    if (p === 1) oddCount++
    edgeParities.push(p)
  }
  const flipPossible = baseParity === 0 ? oddCount > 0 : oddCount < candidates.length
  if (flipPossible) canFlip++
  if (samples.length < 8) samples.push({ seed: seedBase + i, base: baseParity, odd: `${oddCount}/${candidates.length}`, flip: flipPossible, edgeParities: edgeParities.join('') })
}
console.log(`=== L6 奇偶决策空间（${count} 局面 · 已填${target} · sims${sims}） ===`)
console.log(`能翻转奇偶的局面: ${canFlip}/${total}（${(canFlip / total * 100).toFixed(1)}%）`)
console.log(`样例（base=基线奇偶 1奇0偶 · odd=候选边产生奇数的比例 · edgeParities=各边奇偶串）:`)
for (const s of samples) console.log(`  seed ${s.seed} base=${s.base} 奇数边 ${s.odd} 可翻=${s.flip} [${s.edgeParities}]`)
