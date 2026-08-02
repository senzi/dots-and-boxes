// 测判决器缓存命中率：随机生长后不同前沿的"块结构序列"重复率
// 块结构序列 = value + controlCode 拼接（判决器输出完全由它决定）
// node scripts/measure-cache-hit.mjs [局面数] [每候选sims]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ARBoard = require('../ai-research/src/board.js')
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const count = Number(process.argv[2] || 15)
const sims = Number(process.argv[3] || 3)
const seedBase = Number(process.argv[4] || 130000)

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

const structures = new Map()
let total = 0
let simCounter = 3000000
for (let i = 0; i < count; i++) {
  const frontier = Frontier.generate(seedBase + i)
  const mask = rewind(frontier, 20, seedBase + i)
  const safe = ARBoard.legal(mask).filter(e => ARBoard.danger(mask, e) === 0)
  const step = Math.max(1, Math.floor(safe.length / 6))
  const candidates = safe.filter((_, idx) => idx % step === 0).slice(0, 6)
  for (const ei of candidates) {
    const mask1 = ARBoard.put(mask, ei)
    for (let g = 0; g < sims; g++) {
      const f = growFull(mask1, simCounter++ * 7919)
      const pred = Outcome.outcome(f, 1)
      const key = pred.blocks.map(b => `${b.value}:${b.controlCode}`).join('|')
      structures.set(key, (structures.get(key) || 0) + 1)
      total++
    }
  }
}
const unique = structures.size
console.log(`=== 判决器缓存命中率（${count} 局面 × 候选6 × sims${sims} = ${total} 次生长） ===`)
console.log(`唯一块结构: ${unique} · 重复: ${total - unique}`)
console.log(`命中率: ${((total - unique) / total * 100).toFixed(1)}%（1 = 完全重复，0 = 全不重复）`)
const top = [...structures.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
console.log(`\n最高频结构（前5）:`)
for (const [k, v] of top) console.log(`  ×${v}  ${k.slice(0, 80)}`)
