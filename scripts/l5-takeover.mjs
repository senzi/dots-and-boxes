// L5 接管翻盘率（一次评估版，不逐手下棋）：
// 生成前沿 → 判别主视角输（=L4 败局）→ 倒回到安全边≥阈值 → L5 选最优边
// → 该边填后随机补全到前沿 → 判别 → 翻盘率
// node scripts/l5-takeover.mjs [局数] [阈值] [sims] [seedBase] [dynamic] [budget] [explore]
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ARBoard = require('../ai-research/src/board.js')
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

const count = Number(process.argv[2] || 40)
const THRESHOLD = Number(process.argv[3] || 20)
const sims = Number(process.argv[4] || 3)
const maxCandidates = 6
const seedBase = Number(process.argv[5] || 120000)
const DYNAMIC = Number(process.argv[6] || 1)
const BUDGET = Number(process.argv[7] || 28) // sims×候选数 上限（轻化：40→28）
const EXPLORE = Number(process.argv[8] || 10) // 探索步数：前 N 步贴边策略，之后终盘随机
const TAKE_STEPS = Number(process.argv[9] || 10) // 接管前瞻步数（1=一次评估，10=逐手）

let simCounter = 9000000

function growFull(mask, rngSeed) {
  const rng = Frontier.mulberry32(rngSeed)
  let lastMove = null
  let step = 0
  while (true) {
    const safe = ARBoard.legal(mask).filter(i => ARBoard.danger(mask, i) === 0)
    if (!safe.length) return mask
    let choices = safe
    // 探索阶段（前 EXPLORE 步）：贴边风格（模拟双方策略下子）；之后终盘随机
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

// 倒回：随机删已填边直到安全边数 ≥ target
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

// L5 选最优边：候选 × sims 判别（生成前沿 → 判决器，评估当前方 player 净胜）
function l5ChooseEdge(mask, safe, player) {
  if (safe.length > THRESHOLD) return stickChoice(mask, safe)
  const nCand = DYNAMIC ? Math.max(5, Math.ceil(safe.length * 0.5)) : maxCandidates
  const nSims = DYNAMIC ? Math.max(2, Math.floor(BUDGET / nCand)) : sims
  const step = Math.max(1, Math.floor(safe.length / nCand))
  const candidates = safe.filter((_, i) => i % step === 0).slice(0, nCand)
  let best = candidates[0], bestNet = -Infinity
  for (const ei of candidates) {
    const mask1 = ARBoard.put(mask, ei)
    let net = 0
    for (let g = 0; g < nSims; g++) {
      const f = growFull(mask1, 9000000 + simCounter++ * 7919)
      const pred = Outcome.outcome(f, 1)
      net += player === 0 ? pred.score[0] - pred.score[1] : pred.score[1] - pred.score[0]
    }
    const avgNet = net / nSims
    if (avgNet > bestNet) { bestNet = avgNet; best = ei }
  }
  return best
}

// L5 接管（N 步版）：L5 前瞻选边 × TAKE_STEPS 步（与对手贴边交替），之后随机补全
// TAKE_STEPS=1 一次评估（快但粗）；=10 逐手（贵但准）；中间值折中
function takeover(rewindMask, seed) {
  let mask = rewindMask
  for (let s = 0; s < TAKE_STEPS; s++) {
    const safe = ARBoard.legal(mask).filter(i => ARBoard.danger(mask, i) === 0)
    if (!safe.length) break
    const best = l5ChooseEdge(mask, safe, 0)
    mask = ARBoard.put(mask, best)
    const safe2 = ARBoard.legal(mask).filter(i => ARBoard.danger(mask, i) === 0)
    if (!safe2.length) break
    mask = ARBoard.put(mask, stickChoice(mask, safe2))
  }
  return growFull(mask, seed * 17 + 3)
}

let total = 0, flipped = 0, improved = 0
const samples = []
const t0 = Date.now()
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

console.log(`=== L5 接管翻盘率（${count} 生成 · ${total} 个 L4 败局 · 阈值${THRESHOLD} · 动态${DYNAMIC}预算${BUDGET} · 探索${EXPLORE}） ===`)
console.log(`总耗时 ${((Date.now() - t0) / 1000).toFixed(0)}s · 每败局 ${total ? ((Date.now() - t0) / 1000 / total).toFixed(1) : 0}s`)
console.log(`翻盘（败→胜）: ${flipped}/${total}（${(flipped / total * 100).toFixed(1)}%）`)
console.log(`比分改善: ${improved}/${total}（${(improved / total * 100).toFixed(1)}%）`)
console.log(`样例:`)
for (const s of samples) console.log(`  seed ${s.seed} 倒回安全边${s.rewind} 判别 ${s.before} → L5接管后 ${s.after} ${s.flip ? '✅翻盘' : ''}`)
