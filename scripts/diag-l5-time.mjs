// 诊断 L5 vs L4 对局的耗时构成：步数 / 前瞻触发 / 每步耗时 / 单次预测耗时
// node scripts/diag-l5-time.mjs [局数]
import { createRequire } from 'node:module'
import { createBoard, placeEdge, isGameOver, scores, setBoardSize } from '../src/engine/board.js'
import { aiMoveLevel4, aiMoveLevel4With, l3ControlAfterMove } from '../src/engine/ai.js'

const require = createRequire(import.meta.url)
const ARBoard = require('../ai-research/src/board.js')
const Frontier = require('../ai-research/src/frontier.js')
const Outcome = require('../ai-research/src/outcome.js')

setBoardSize('s8')
const games = Number(process.argv[2] || 2)
const maxCandidates = 6
const sims = 3
const THRESHOLD = 20

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

let simCounter = 0
let outcomeTotal = 0, outcomeCount = 0, growTotal = 0, growCount = 0
let lookaheadSteps = 0, plainSteps = 0
let lookaheadMs = 0, plainMs = 0

function l5SafeChooser(state, safe, player, lastMove) {
  if (safe.length > THRESHOLD) return null
  lookaheadSteps++
  const t0 = Date.now()
  const baseMask = stateToMask(state)
  const step = Math.max(1, Math.floor(safe.length / maxCandidates))
  const candidates = safe.filter((_, i) => i % step === 0).slice(0, maxCandidates)
  let best = null, bestNet = -Infinity
  for (const move of candidates) {
    const ei = moveToEdge(move)
    if (ei === null) continue
    const mask1 = ARBoard.put(baseMask, ei)
    let net = 0
    for (let g = 0; g < sims; g++) {
      let t = Date.now()
      const frontier = growFull(mask1, 9000000 + simCounter * 7919)
      growTotal += Date.now() - t; growCount++
      t = Date.now()
      const pred = Outcome.outcome(frontier, 1)
      outcomeTotal += Date.now() - t; outcomeCount++
      net += player === 0 ? pred.score[0] - pred.score[1] : pred.score[1] - pred.score[0]
      simCounter++
    }
    const avgNet = net / sims
    if (avgNet > bestNet) { bestNet = avgNet; best = move }
  }
  lookaheadMs += Date.now() - t0
  return best || null
}

function play(seed) {
  const state = createBoard()
  let player = 0, lastMove = null, controlOwner = 1, steps = 0
  while (!isGameOver(state) && steps < 400) {
    const t = Date.now()
    const move = player === 0
      ? aiMoveLevel4With(state, player, lastMove, controlOwner, l5SafeChooser)
      : aiMoveLevel4(state, player, lastMove, controlOwner)
    const dt = Date.now() - t
    if (player === 0) {
      if (dt > 50) lookaheadMs += dt; else plainMs += dt
    }
    if (!move) break
    controlOwner = l3ControlAfterMove(state, move, player, controlOwner)
    const result = placeEdge(state, move.dir, move.r, move.c, player)
    lastMove = { ...move, player }
    if (!result.gained) player = 1 - player
    steps++
  }
  return { score: scores(state), steps }
}

for (let g = 0; g < games; g++) {
  lookaheadSteps = 0; lookaheadMs = 0; plainMs = 0
  const t0 = Date.now()
  const { score, steps } = play(1000 + g)
  console.log(`局 ${g + 1}: ${score[0]}:${score[1]} · ${steps} 步 · 总 ${((Date.now() - t0) / 1000).toFixed(1)}s · L5前瞻步 ${lookaheadSteps}（${(lookaheadMs / 1000).toFixed(1)}s）· 贴边步 ${(plainMs / 1000).toFixed(1)}s`)
}
console.log(`\n单次生长平均 ${(growTotal / growCount).toFixed(1)}ms（${growCount} 次）`)
console.log(`单次判决器（outcome）平均 ${(outcomeTotal / outcomeCount).toFixed(1)}ms（${outcomeCount} 次）`)
console.log(`每前瞻步 ≈ ${maxCandidates * sims} 次生长+判决器 → ${((maxCandidates * sims) * (growTotal / growCount + outcomeTotal / outcomeCount) / 1000).toFixed(2)}s/步`)
