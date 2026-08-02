// L4 基准：L4 宗师 vs L3 大师（完整对局）
// node scripts/l4-benchmark.mjs [局数]
import { performance } from 'node:perf_hooks'
import { createBoard, placeEdge, isGameOver, scores } from '../src/engine/board.js'
import { aiMoveLevel3, aiMoveLevel4, l3ControlAfterMove } from '../src/engine/ai.js'

const games = Number(process.argv[2] || 20)
let wins = 0
let losses = 0
let scoreFor = 0
let scoreAgainst = 0
let worstMoveMs = 0
let l4OpeningCount = 0
const started = performance.now()

for (let gameIndex = 0; gameIndex < games; gameIndex++) {
  const state = createBoard()
  const l4Seat = gameIndex % 2
  let player = 0
  let lastMove = null
  let controlOwner = 1
  let inFrontier = false
  while (!isGameOver(state)) {
    const before = performance.now()
    const move = player === l4Seat ? aiMoveLevel4(state, player, lastMove, controlOwner) : aiMoveLevel3(state, player, lastMove, controlOwner)
    worstMoveMs = Math.max(worstMoveMs, performance.now() - before)
    controlOwner = l3ControlAfterMove(state, move, player, controlOwner)
    const result = placeEdge(state, move.dir, move.r, move.c, player)
    lastMove = { ...move, player }
    if (!result.gained) player = 1 - player
  }
  const result = scores(state)
  const mine = result[l4Seat]
  const theirs = result[1 - l4Seat]
  scoreFor += mine
  scoreAgainst += theirs
  if (mine > theirs) wins++
  else losses++
  console.log(`${gameIndex + 1}: L4 seat ${l4Seat}, ${mine}:${theirs}`)
}

console.log(JSON.stringify({
  games,
  l4Wins: wins,
  l4Losses: losses,
  totalScore: `${scoreFor}:${scoreAgainst}`,
  meanScore: `${(scoreFor / games).toFixed(2)}:${(scoreAgainst / games).toFixed(2)}`,
  worstMoveMs: Number(worstMoveMs.toFixed(2)),
  elapsedSeconds: Number(((performance.now() - started) / 1000).toFixed(2))
}, null, 2))
