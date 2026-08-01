import { performance } from 'node:perf_hooks'
import { createBoard, placeEdge, isGameOver, scores } from '../src/engine/board.js'
import { aiMoveLevel2, aiMoveLevel3 } from '../src/engine/ai.js'

const games = Number(process.argv[2] || 20)
let wins = 0
let losses = 0
let scoreFor = 0
let scoreAgainst = 0
let worstMoveMs = 0
const started = performance.now()

for (let gameIndex = 0; gameIndex < games; gameIndex++) {
  const state = createBoard()
  const l3Seat = gameIndex % 2
  let player = 0
  while (!isGameOver(state)) {
    const before = performance.now()
    const move = player === l3Seat ? aiMoveLevel3(state, player) : aiMoveLevel2(state, player)
    worstMoveMs = Math.max(worstMoveMs, performance.now() - before)
    const result = placeEdge(state, move.dir, move.r, move.c, player)
    if (!result.gained) player = 1 - player
  }
  const result = scores(state)
  const mine = result[l3Seat]
  const theirs = result[1 - l3Seat]
  scoreFor += mine
  scoreAgainst += theirs
  if (mine > theirs) wins++
  else losses++
  console.log(`${gameIndex + 1}: L3 seat ${l3Seat}, ${mine}:${theirs}`)
}

console.log(JSON.stringify({
  games,
  l3Wins: wins,
  l3Losses: losses,
  totalScore: `${scoreFor}:${scoreAgainst}`,
  meanScore: `${(scoreFor / games).toFixed(2)}:${(scoreAgainst / games).toFixed(2)}`,
  worstMoveMs: Number(worstMoveMs.toFixed(2)),
  elapsedSeconds: Number(((performance.now() - started) / 1000).toFixed(2))
}, null, 2))
