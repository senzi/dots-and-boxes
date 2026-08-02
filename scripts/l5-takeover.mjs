// L5 接管翻盘率：生成前沿 → 判别主视角输（=L4 败局）→ 倒回到安全边≥20 → L5 接管构造前沿 → 判别
// node scripts/l5-takeover.mjs [局数] [接管前瞻阈值] [sims]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ARBoard = require('../ai-research/src/board.js')
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const count = Number(process.argv[2] || 20)
const THRESHOLD = Number(process.argv[3] || 20)
const sims = Number(process.argv[4] || 3)
const maxCandidates = 6
const seedBase = Number(process.argv[5] || 110000)

function growFull(mask, rngSeed, style = 'stick') {
  const rng = Frontier.mulberry32(rngSeed)
  let lastMove = null
  while (true) {
    const safe = ARBoard.legal(mask).filter(i => ARBoard.danger(mask, i) === 0)
    if (!safe.length) return mask
    let choices = safe
    if (style === 'stick' && lastMove != null) {
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

// 倒回：随机删已填边直到安全边数 ≥ target
function rewind(frontier, target, seed) {
  const rng = Frontier.mulberry32(seed)
  let mask = frontier
  while (true) {
    const safe = ARBoard.legal(mask).filter(i => ARBoard.danger(mask, i) === 0)
    if (safe.length >= target) return { mask, safeCount: safe.length }
    const filled = ARBoard.edges.map(e => e.index).filter(i => ARBoard.has(mask, i))
    if (!filled.length) return { mask, safeCount: safe.length }
    const pick = filled[Math.floor(rng() * filled.length)]
    // 删边：只删"不破坏已得分格"的边（简单：直接删，安全前沿无完成格）
    mask &= ~(1n << BigInt(pick))
  }
}

// 对手贴边选边（L4 风格：接触已填边最多）
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

let simCounter = 2000000
// L5 接管安全阶段：剩 ≤THRESHOLD 安全边前瞻选边；否则贴边
function l5TakeoverStep(mask, safe, player) {
  if (safe.length > THRESHOLD) return stickChoice(mask, safe)
  const step = Math.max(1, Math.floor(safe.length / maxCandidates))
  const candidates = safe.filter((_, i) => i % step === 0).slice(0, maxCandidates)
  let best = candidates[0], bestNet = -Infinity
  for (const ei of candidates) {
    const mask1 = ARBoard.put(mask, ei)
    let net = 0
    for (let g = 0; g < sims; g++) {
      const f = growFull(mask1, 9000000 + simCounter++ * 7919)
      const pred = Outcome.outcome(f, 1)
      net += player === 0 ? pred.score[0] - pred.score[1] : pred.score[1] - pred.score[0]
    }
    const avgNet = net / sims
    if (avgNet > bestNet) { bestNet = avgNet; best = ei }
  }
  return best
}

// L5 接管：从倒回局面交替填安全边到前沿（L5=主视角玩家0 前瞻，对手=贴边）
function takeover(rewindMask, seed) {
  let mask = rewindMask
  let player = 0 // 主视角（L5 接管方）先下
  let guard = 0
  while (guard++ < 100) {
    const safe = ARBoard.legal(mask).filter(i => ARBoard.danger(mask, i) === 0)
    if (!safe.length) break
    const pick = player === 0 ? l5TakeoverStep(mask, safe, 0) : stickChoice(mask, safe)
    mask = ARBoard.put(mask, pick)
    player = 1 - player
  }
  return mask
}

let total = 0, flipped = 0, improved = 0
const samples = []
for (let i = 0; i < count; i++) {
  const seed = seedBase + i
  const frontier = Frontier.generate(seed)
  const pred0 = Outcome.outcome(frontier, 1)
  if (pred0.score[0] >= pred0.score[1]) continue // 只测主视角输（=L4 败局）
  total++
  const rewinded = rewind(frontier, THRESHOLD, seed * 31)
  const newFrontier = takeover(rewinded.mask, seed)
  const pred1 = Outcome.outcome(newFrontier, 1)
  if (pred1.score[0] > pred1.score[1]) flipped++
  if (pred1.score[0] - pred1.score[1] > pred0.score[0] - pred0.score[1]) improved++
  if (samples.length < 8) samples.push({ seed, before: `${pred0.score[0]}:${pred0.score[1]}`, after: `${pred1.score[0]}:${pred1.score[1]}`, flip: pred1.score[0] > pred1.score[1], rewind: rewinded.safeCount })
}

console.log(`=== L5 接管翻盘率（${count} 生成 · ${total} 个 L4 败局 · 阈值${THRESHOLD} · sims${sims}） ===`)
console.log(`翻盘（败→胜）: ${flipped}/${total}（${(flipped / total * 100).toFixed(1)}%）`)
console.log(`比分改善: ${improved}/${total}（${(improved / total * 100).toFixed(1)}%）`)
console.log(`样例:`)
for (const s of samples) console.log(`  seed ${s.seed} 倒回安全边${s.rewind} 判别 ${s.before} → L5接管后 ${s.after} ${s.flip ? '✅翻盘' : ''}`)
