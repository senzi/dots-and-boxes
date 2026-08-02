// 验证 L5 选边是否优于 L4 贴边（离线，不需实战对局）
// 每个开放局面：
//   L5 选边（前瞻：候选→生长→判决器比分→选最优）
//   L4 选边（贴上一手启发式）
//   两者各自独立生长 sims2 次 → 判决器平均净胜 → 对比改进量
// node scripts/verify-l5-choice.mjs [局面数] [候选数] [sims1] [sims2]
import { createRequire } from 'node:module'
import { createBoard, setBoardSize } from '../src/engine/board.js'

const require = createRequire(import.meta.url)
const ARBoard = require('../ai-research/src/board.js')
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

setBoardSize('s8')
const count = Number(process.argv[2] || 40)
const maxCandidates = Number(process.argv[3] || 6)
const sims1 = Number(process.argv[4] || 3) // 选边时评估
const sims2 = Number(process.argv[5] || 6) // 最终公平评估

function stateToMask(state) {
  let mask = 0n
  for (const [id, owner] of Object.entries(state.edges)) {
    if (owner === null || owner === undefined) continue
    const e = ARBoard.edgeById.get(id)
    if (e) mask |= 1n << BigInt(e.index)
  }
  return mask
}
const moveToEdge = move => {
  const e = ARBoard.edgeById.get(`${move.dir}-${move.r}-${move.c}`)
  return e ? e.index : null
}

// 从空棋盘生长到已填 target 边（开放局面）
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

// 生长到极大前沿（贴边风格，模拟 L4 铺边）
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

// 评估一条边：填后生长 sims 次 → 玩家0 平均净胜
function evaluateEdge(baseMask, edgeIndex, player, sims, seedBase) {
  const mask1 = ARBoard.put(baseMask, edgeIndex)
  let net = 0
  for (let g = 0; g < sims; g++) {
    const frontier = growFull(mask1, seedBase * 7919 + g * 104729)
    const pred = Outcome.outcome(frontier, 1)
    net += player === 0 ? pred.score[0] - pred.score[1] : pred.score[1] - pred.score[0]
  }
  return net / sims
}

let simCounter = 1000000
let l5Better = 0, l4Better = 0, tie = 0
let totalGain = 0
const samples = []
for (let i = 0; i < count; i++) {
  const seed = 80000 + i
  const mask = growPartial(seed, 40) // 安全阶段中段
  const safeEdges = ARBoard.legal(mask).filter(e => ARBoard.danger(mask, e) === 0)
  if (safeEdges.length < 3) continue

  // L5 选边：候选 → 评估 → 选最优
  const step = Math.max(1, Math.floor(safeEdges.length / maxCandidates))
  const candidates = safeEdges.filter((_, idx) => idx % step === 0).slice(0, maxCandidates)
  let l5Edge = candidates[0], l5Best = -Infinity
  for (const e of candidates) {
    const v = evaluateEdge(mask, e, 0, sims1, simCounter++)
    if (v > l5Best) { l5Best = v; l5Edge = e }
  }
  // L4 选边：贴边启发式（chooseStrategicSafe 风格）——选与已填边接触最多的安全边
  const contactOf = ei => {
    const edge = ARBoard.edges[ei]
    const endpoints = e => e.dir === 'H' ? [[e.c, e.r], [e.c + 1, e.r]] : [[e.c, e.r], [e.c, e.r + 1]]
    const pts = endpoints(edge)
    let contact = 0
    for (let j = 0; j < ARBoard.edges.length; j++) {
      if (ARBoard.has(mask, j)) {
        const other = ARBoard.edges[j]
        const ops = endpoints(other)
        if (pts.some(a => ops.some(b => a[0] === b[0] && a[1] === b[1]))) contact++
      }
    }
    return contact
  }
  let l4Edge = candidates[0], l4Contact = -1
  for (const e of candidates) {
    const c = contactOf(e)
    if (c > l4Contact) { l4Contact = c; l4Edge = e }
  }

  // 公平评估两条边（独立 sims2 次）
  const l5Score = evaluateEdge(mask, l5Edge, 0, sims2, 2000000 + i)
  const l4Score = evaluateEdge(mask, l4Edge, 0, sims2, 3000000 + i)
  const gain = l5Score - l4Score
  totalGain += gain
  if (gain > 0.5) l5Better++
  else if (gain < -0.5) l4Better++
  else tie++
  if (samples.length < 6) samples.push({ seed, l5Edge, l4Edge, l5: l5Score.toFixed(1), l4: l4Score.toFixed(1), gain: gain.toFixed(1) })
}

console.log(`=== L5 选边 vs L4 贴边（${count} 局面 · 候选${maxCandidates} · 选边sims${sims1} · 评估sims${sims2}） ===`)
console.log(`L5 更优 ${l5Better} · L4 更优 ${l4Better} · 接近 ${tie}`)
console.log(`平均净胜改进：${(totalGain / count).toFixed(2)} 分/局面`)
console.log(`样例:`)
for (const s of samples) console.log(`  seed ${s.seed} L5边${s.l5Edge}(${s.l5}) vs L4边${s.l4Edge}(${s.l4}) → 改进 ${s.gain}`)
