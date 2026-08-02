// 主项目 L5（算无遗策）vs L4 完整对局验证
// node scripts/l5-main-bench.mjs [局数]
import { createBoard, placeEdge, isGameOver, scores, setBoardSize } from '../src/engine/board.js'
import { aiMoveLevel4, aiMoveLevel5, l3ControlAfterMove } from '../src/engine/ai.js'

setBoardSize('s8')
const games = Number(process.argv[2] || 3)
let l5Wins = 0, l4Wins = 0
const t0 = Date.now()
for (let g = 0; g < games; g++) {
  const state = createBoard()
  const l5Seat = g % 2
  let player = 0, lastMove = null, controlOwner = 1
  let worstMs = 0
  while (!isGameOver(state)) {
    const t = Date.now()
    const move = player === l5Seat
      ? aiMoveLevel5(state, player, lastMove, controlOwner)
      : aiMoveLevel4(state, player, lastMove, controlOwner)
    const dt = Date.now() - t
    if (dt > worstMs) worstMs = dt
    controlOwner = l3ControlAfterMove(state, move, player, controlOwner)
    const result = placeEdge(state, move.dir, move.r, move.c, player)
    lastMove = { ...move, player }
    if (!result.gained) player = 1 - player
  }
  const s = scores(state)
  const l5Win = l5Seat === 0 ? s[0] > s[1] : s[1] > s[0]
  if (l5Win) l5Wins++; else l4Wins++
  console.log(`局 ${g + 1}: L5${l5Seat === 0 ? '(先)' : '(后)'} ${s[0]}:${s[1]} · 最慢单步 ${(worstMs / 1000).toFixed(1)}s`)
}
console.log(`\nL5 ${l5Wins}胜 · L4 ${l4Wins}胜 · 总 ${((Date.now() - t0) / 1000).toFixed(0)}s`)
