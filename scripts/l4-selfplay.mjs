// L4 自战：验证对称性与多样性
// node scripts/l4-selfplay.mjs [局数]
import { createBoard, placeEdge, isGameOver, scores } from '../src/engine/board.js'
import { aiMoveLevel4, l3ControlAfterMove } from '../src/engine/ai.js'

const games = Number(process.argv[2] || 10)
const results = []
for (let g = 0; g < games; g++) {
  const state = createBoard()
  let player = 0
  let lastMove = null
  let controlOwner = 1
  while (!isGameOver(state)) {
    const move = aiMoveLevel4(state, player, lastMove, controlOwner)
    controlOwner = l3ControlAfterMove(state, move, player, controlOwner)
    const result = placeEdge(state, move.dir, move.r, move.c, player)
    lastMove = { ...move, player }
    if (!result.gained) player = 1 - player
  }
  const result = scores(state)
  results.push(`${result[0]}:${result[1]}`)
}
console.log('L4 自战比分（玩家0:玩家1）:')
results.forEach((r, i) => console.log(`${i + 1}: ${r}`))
const uniq = new Set(results)
console.log('不同比分组合数:', uniq.size)
