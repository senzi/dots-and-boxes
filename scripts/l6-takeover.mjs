// L6 研究版：L4 + 奇偶控制（无前瞻判决器）
// 接管：倒回局面 → L6 每步选"目标奇偶"的边（v1+v2 奇偶）vs 对手贴边 → 判别翻盘率
// 目标奇偶：v1+v2 奇数 → 玩家0 控制终局（83.4%）→ L6 坐玩家0 想要奇数
// node scripts/l6-takeover.mjs [局数] [阈值] [sims] [seedBase]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ARBoard = require('../ai-research/src/board.js')
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const count = Number(process.argv[2] || 40)
const THRESHOLD = Number(process.argv[3] || 20)
const sims = Number(process.argv[4] || 3)
const seedBase = Number(process.argv[5] || 230000)
const EXPLORE = Number(process.argv[6] || 10)

let simCounter = 8000000

function growFull(mask, rngSeed) {
  const rng = Frontier.mulberry32(rngSeed)
  let lastMove = null
  let step = 0
  while (true) {
    const safe = ARBoard.legal(mask).filter(i => ARBoard.danger(mask, i) === 0)
    if (!safe.length) return mask
    let choices = safe
    if (step < EXPLORE && lastMove != null) {
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
    if (safe.length >= target) return { mask, safeCount: safe.length }
    const filled = ARBoard.edges.map(e => e.index).filter(i => ARBoard.has(mask, i))
    if (!filled.length) return { mask, safeCount: safe.length }
    mask &= ~(1n << BigInt(filled[Math.floor(rng() * filled.length)]))
  }
}
function stickChoice(mask, safe) {
  const endpoints = e => e.dir === 'H' ? [[e.c, e.r], [e.c + 1, e.r]] : [[e.c, e.r], [e.c, e.r + 1]]
  let best = safe[0], bestContact = -1
  for (const ei of safe) {
    const pts = endpoints(ARBoard.edges[ei])
    let contact = 0
    for (let j = 0; j < ARBoard.edges.length; j++) {
      if (ARBoard.has(mask, j)) {
        const ops = endpoints(ARBoard.edges[j])
        if (pts.some(a => ops.some(b => a[0] === b[0] && a[1] === b[1]))) contact++
      }
    }
    if (contact > bestContact) { bestContact = contact; best = ei }
  }
  return best
}
// 目标奇偶命中率：候选边生长后 v1+v2 奇偶 == target 的比例
function l6Choose(mask, safe, target) {
  const nCand = Math.max(5, Math.ceil(safe.length * 0.5))
  const step = Math.max(1, Math.floor(safe.length / nCand))
  const candidates = safe.filter((_, i) => i % step === 0).slice(0, nCand)
  let best = candidates[0], bestScore = -Infinity
  for (const ei of candidates) {
    const mask1 = ARBoard.put(mask, ei)
    let hit = 0
    for (let g = 0; g < sims; g++) {
      const f = growFull(mask1, 9000000 + simCounter++ * 7919)
      const pred = Outcome.outcome(f, 1)
      let v12 = 0
      for (const b of pred.blocks) if (b.value === 1 || b.value === 2) v12++
      if (v12 % 2 === target) hit++
    }
    if (hit / sims > bestScore) { bestScore = hit / sims; best = ei }
  }
  return best
}
// L6 接管：L6（主视角玩家0，目标奇偶=1）vs 对手贴边，交替到前沿
function takeover(rewindMask, seed) {
  let mask = rewindMask
  let player = 0
  let guard = 0
  while (guard++ < 40) {
    const safe = ARBoard.legal(mask).filter(i => ARBoard.danger(mask, i) === 0)
    if (!safe.length) break
    if (safe.length > THRESHOLD) {
      // 前期贴边（L4 行为）
      mask = ARBoard.put(mask, stickChoice(mask, safe))
    } else {
      // 临前沿：奇偶控制
      const pick = player === 0 ? l6Choose(mask, safe, 1) : stickChoice(mask, safe)
      mask = ARBoard.put(mask, pick)
    }
    player = 1 - player
  }
  return mask
}

let total = 0, flipped = 0, improved = 0
const t0 = Date.now()
const samples = []
for (let i = 0; i < count; i++) {
  const seed = seedBase + i
  const frontier = Frontier.generate(seed)
  const pred0 = Outcome.outcome(frontier, 1)
  if (pred0.score[0] >= pred0.score[1]) continue
  total++
  const rewinded = rewind(frontier, THRESHOLD, seed * 31)
  const newFrontier = takeover(rewinded.mask, seed)
  const pred1 = Outcome.outcome(newFrontier, 1)
  if (pred1.score[0] > pred1.score[1]) flipped++
  if (pred1.score[0] - pred1.score[1] > pred0.score[0] - pred0.score[1]) improved++
  if (samples.length < 6) samples.push({ seed, before: `${pred0.score[0]}:${pred0.score[1]}`, after: `${pred1.score[0]}:${pred1.score[1]}`, flip: pred1.score[0] > pred1.score[1] })
}
console.log(`=== L6（纯奇偶控制）接管翻盘率（${count} 生成 · ${total} 败局 · 阈值${THRESHOLD}） ===`)
console.log(`总耗时 ${((Date.now() - t0) / 1000).toFixed(0)}s · 每败局 ${total ? ((Date.now() - t0) / 1000 / total).toFixed(1) : 0}s`)
console.log(`翻盘: ${flipped}/${total}（${(flipped / total * 100).toFixed(1)}%）`)
console.log(`比分改善: ${improved}/${total}（${(improved / total * 100).toFixed(1)}%）`)
for (const s of samples) console.log(`  seed ${s.seed} ${s.before} → ${s.after} ${s.flip ? '✅' : ''}`)
console.log(`\n对照：贴边基线 73.3% · L5（前瞻）85.7%`)
