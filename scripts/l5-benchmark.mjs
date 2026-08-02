// L5（安全阶段前瞻选边）vs L4（贴边）—— 研究版比拼
// L5 安全阶段：候选安全边 → 填 → 随机生长到前沿 → DP 预测 → 平均净胜 → 选最优
// 其余阶段（吃格/安全前沿开块）完全复用 L4（aiMoveLevel4With + safeChooser）
// node scripts/l5-benchmark.mjs [局数] [候选数] [sims]
import { createRequire } from 'node:module'
import { createBoard, placeEdge, isGameOver, scores, setBoardSize } from '../src/engine/board.js'
import { aiMoveLevel4, aiMoveLevel4With, l3ControlAfterMove } from '../src/engine/ai.js'

const require = createRequire(import.meta.url)
const ARBoard = require('../ai-research/src/board.js')
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

setBoardSize('s8')
const games = Number(process.argv[2] || 5)
const maxCandidates = Number(process.argv[3] || 6)
const sims = Number(process.argv[4] || 3)
const LOOKAHEAD_THRESHOLD = Number(process.argv[5] || 20) // 剩 ≤20 安全边才前瞻

// 主项目 state → ai-research mask（8×8）
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

// 生长到极大前沿：style='stick'（贴上一手，模拟 L4 对手）/ 'random'（纯随机）
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

let simCounter = 0
// L5 安全阶段决策器：剩 ≤LOOKAHEAD_THRESHOLD 条安全边才前瞻（前期贴边，实测早期选择被淹没）
// 前瞻：候选安全边 → 填 → 生长到前沿（贴边风格模拟 L4 对手）→ 判决器比分 → 选最优
function l5SafeChooser(state, safe, player, lastMove) {
  if (safe.length > LOOKAHEAD_THRESHOLD) return null // 早期：回退贴边（淹没，不值得算）
  const baseMask = stateToMask(state)
  const step = Math.max(1, Math.floor(safe.length / maxCandidates))
  const candidates = safe.filter((_, i) => i % step === 0).slice(0, maxCandidates)
  let best = null
  let bestNet = -Infinity
  for (const move of candidates) {
    const ei = moveToEdge(move)
    if (ei === null) continue
    const mask1 = ARBoard.put(baseMask, ei)
    let net = 0
    for (let g = 0; g < sims; g++) {
      const frontier = growFull(mask1, 9000000 + simCounter * 7919)
      const pred = Outcome.outcome(frontier, 1)
      // 当前方 player 的净胜（firstPlayer=1 统一基准，相对比较有效）
      net += player === 0 ? pred.score[0] - pred.score[1] : pred.score[1] - pred.score[0]
      simCounter++
    }
    const avgNet = net / sims
    if (avgNet > bestNet) { bestNet = avgNet; best = move }
  }
  return best || null
}

// 完整对局：L5 = 玩家0（安全阶段前瞻），L4 = 玩家1
function play(seed) {
  const state = createBoard()
  let player = 0
  let lastMove = null
  let controlOwner = 1
  let steps = 0
  let l5SafeSteps = 0
  while (!isGameOver(state) && steps < 400) {
    const move = player === 0
      ? aiMoveLevel4With(state, player, lastMove, controlOwner, l5SafeChooser)
      : aiMoveLevel4(state, player, lastMove, controlOwner)
    if (!move) break
    controlOwner = l3ControlAfterMove(state, move, player, controlOwner)
    const result = placeEdge(state, move.dir, move.r, move.c, player)
    lastMove = { ...move, player }
    if (!result.gained) player = 1 - player
    steps++
  }
  return scores(state)
}

let l5Wins = 0, l4Wins = 0, draws = 0
const t0 = Date.now()
for (let g = 0; g < games; g++) {
  const [s0, s1] = play(1000 + g)
  if (s0 > s1) l5Wins++
  else if (s1 > s0) l4Wins++
  else draws++
  const elapsed = ((Date.now() - t0) / 1000).toFixed(0)
  console.log(`局 ${g + 1}/${games} · L5(先手) ${s0}:${s1} ${s0 > s1 ? 'L5胜' : s1 > s0 ? 'L4胜' : '平'} · ${elapsed}s`)
}
console.log(`\n=== L5（安全阶段前瞻）vs L4（贴边）===${games} 局 ===`)
console.log(`L5 胜 ${l5Wins} · L4 胜 ${l4Wins} · 平 ${draws}`)
console.log(`总耗时 ${((Date.now() - t0) / 1000).toFixed(0)}s · 前瞻模拟 ${simCounter} 次`)
