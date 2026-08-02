// L5 vs L4 基准（L5：恒保权 + 安全步远离；L4：全局最优）
// node scripts/l5-benchmark.mjs [局数]
import { performance } from 'node:perf_hooks'
import { createBoard, placeEdge, isGameOver, scores, setBoardSize } from '../src/engine/board.js'
import { aiMoveLevel4, aiMoveLevel5, l3ControlAfterMove } from '../src/engine/ai.js'

setBoardSize('s8')
const games = Number(process.argv[2] || 20)
let l4Wins = 0
let l5Wins = 0
let l4Score = 0
let l5Score = 0
let worstMoveMs = 0
const started = performance.now()

for (let g = 0; g < games; g++) {
  const state = createBoard()
  const l4Seat = g % 2
  let player = 0
  let lastMove = null
  let controlOwner = 1
  while (!isGameOver(state)) {
    const before = performance.now()
    const move = player === l4Seat ? aiMoveLevel4(state, player, lastMove, controlOwner) : aiMoveLevel5(state, player, lastMove, controlOwner)
    worstMoveMs = Math.max(worstMoveMs, performance.now() - before)
    controlOwner = l3ControlAfterMove(state, move, player, controlOwner)
    const result = placeEdge(state, move.dir, move.r, move.c, player)
    lastMove = { ...move, player }
    if (!result.gained) player = 1 - player
  }
  const result = scores(state)
  const m4 = result[l4Seat]
  const m5 = result[1 - l4Seat]
  l4Score += m4
  l5Score += m5
  if (m4 > m5) l4Wins++
  else if (m5 > m4) l5Wins++
  console.log(`${g + 1}: L4 seat ${l4Seat}, L4 ${m4}:${m5} L5`)
}

console.log(JSON.stringify({
  games,
  l4Wins,
  l5Wins,
  l4Score: `${l4Score}:${l5Score}`,
  meanScore: `${(l4Score / games).toFixed(2)}:${(l5Score / games).toFixed(2)}`,
  worstMoveMs: Number(worstMoveMs.toFixed(2)),
  elapsedSeconds: Number(((performance.now() - started) / 1000).toFixed(2))
}, null, 2))
