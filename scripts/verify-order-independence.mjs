// 验证：判决器对"同价值序列"结果是否一致（顺序无关性）
// 乱序方式：非终局块随机重排（终局块保持最后）——结果应一致
// 对照组：终局块也移动（换到别的位置）——结果可能不同
// node scripts/verify-order-independence.mjs [前沿数]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const count = Number(process.argv[2] || 40)
const seedBase = Number(process.argv[3] || 310000)

function shuffle(arr, seed) {
  const rng = (() => { let v = seed >>> 0; return () => { v = v + 0x6D2B79F5 | 0; let t = Math.imul(v ^ v >>> 15, 1 | v); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } })()
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

let same = 0, total = 0, diffFinal = 0, diffWhenMoveLast = 0, movedLastTested = 0
const samples = []
for (let i = 0; i < count; i++) {
  const mask = Frontier.generate(seedBase + i)
  const pred = Outcome.outcome(mask, 1)
  const blocks = pred.blocks
  if (blocks.length < 3) continue
  total++
  const last = blocks[blocks.length - 1] // 终局块（最后一块）
  const rest = blocks.slice(0, -1)
  // 乱序：非终局块重排（终局块保持最后）
  const shuffled = [...shuffle(rest, 12345 + i * 7), last]
  const r1 = Outcome.solveFromBlocks(shuffled, 1)
  const sameScore = r1.score[0] === pred.score[0] && r1.score[1] === pred.score[1]
  if (sameScore) same++
  // 对照组：终局块也移动（插到中间）—— 结果可能变
  movedLastTested++
  const moved = [...shuffle(rest, 54321 + i * 13)]
  moved.splice(Math.floor(moved.length / 2), 0, last)
  const r2 = Outcome.solveFromBlocks(moved, 1)
  if (r2.score[0] !== pred.score[0] || r2.score[1] !== pred.score[1]) diffWhenMoveLast++
  // 终局块归属差异
  const ctrl0 = (s, f) => {
    let c = 1, node = f.tree
    for (let k = 0; k < f.blocks.length; k++) {
      const choice = node ? node.choice : ''
      if (choice.includes('翻转')) { c = 1 - c; node = node && node.sub } else { node = node && node.sub }
    }
    return c
  }
  if (ctrl0(0, r1) !== ctrl0(0, pred)) diffFinal++
  if (samples.length < 5) samples.push({ seed: seedBase + i, blocks: blocks.length, orig: `${pred.score[0]}:${pred.score[1]}`, shuffled: `${r1.score[0]}:${r1.score[1]}`, movedLast: `${r2.score[0]}:${r2.score[1]}` })
}
console.log(`=== 顺序无关性验证（${total} 前沿） ===`)
console.log(`非终局块乱序（终局块保持最后）: 比分一致 ${same}/${total}（${(same / total * 100).toFixed(1)}%）`)
console.log(`终局块移到中间: 比分变化 ${diffWhenMoveLast}/${movedLastTested}`)
console.log(`样例:`)
for (const s of samples) console.log(`  seed ${s.seed} ${s.blocks}块: 原序 ${s.orig} · 乱序 ${s.shuffled} · 终局块移位 ${s.movedLast}`)
