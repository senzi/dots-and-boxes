// L4 vs L2 策略：验证碾压（node scripts/l4-vs-l2.mjs [局数]）
import { createBoard, placeEdge, isGameOver, scores } from '../src/engine/board.js'
import { aiMoveLevel2, aiMoveLevel4, l3ControlAfterMove } from '../src/engine/ai.js'

const games = Number(process.argv[2] || 10)
let wins = 0
for (let g = 0; g < games; g++) {
  const state = createBoard()
  const l4Seat = g % 2
  let player = 0
  let lastMove = null
  let controlOwner = 1
  while (!isGameOver(state)) {
    const move = player === l4Seat ? aiMoveLevel4(state, player, lastMove, controlOwner) : aiMoveLevel2(state, player)
    controlOwner = l3ControlAfterMove(state, move, player, controlOwner)
    const result = placeEdge(state, move.dir, move.r, move.c, player)
    lastMove = { ...move, player }
    if (!result.gained) player = 1 - player
  }
  const result = scores(state)
  const mine = result[l4Seat]
  const theirs = result[1 - l4Seat]
  if (mine > theirs) wins++
  console.log(`${g + 1}: L4 seat ${l4Seat}, ${mine}:${theirs}`)
}
console.log(`L4 vs L2: ${wins}/${games} 胜`)
