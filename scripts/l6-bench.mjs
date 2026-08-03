// L6（长考版）vs L4 完整对局验证（L6 自带休息随机 → 每局不同路径）
// node scripts/l6-bench.mjs [局数]
import { createBoard, placeEdge, isGameOver, scores, setBoardSize } from '../src/engine/board.js'
import { aiMoveLevel4, aiMoveLevel6, l3ControlAfterMove } from '../src/engine/ai.js'

setBoardSize('s8')
const games = Number(process.argv[2] || 12)
let l6Wins = 0, l4Wins = 0, draws = 0
const t0 = Date.now()
let totalWorst = 0
for (let g = 0; g < games; g++) {
  const state = createBoard()
  const l6Seat = g % 2
  let player = 0, lastMove = null, controlOwner = 1
  let worstMs = 0
  while (!isGameOver(state)) {
    const t = Date.now()
    const move = player === l6Seat
      ? aiMoveLevel6(state, player, lastMove, controlOwner)
      : aiMoveLevel4(state, player, lastMove, controlOwner)
    const dt = Date.now() - t
    if (dt > worstMs) worstMs = dt
    if (!move) break
    controlOwner = l3ControlAfterMove(state, move, player, controlOwner)
    const result = placeEdge(state, move.dir, move.r, move.c, player)
    lastMove = { ...move, player }
    if (!result.gained) player = 1 - player
  }
  if (worstMs > totalWorst) totalWorst = worstMs
  const s = scores(state)
  const l6Win = l6Seat === 0 ? s[0] > s[1] : s[1] > s[0]
  if (l6Win) l6Wins++
  else if (s[0] === s[1]) draws++
  else l4Wins++
  console.log(`局 ${String(g + 1).padStart(2)}: L6${l6Seat === 0 ? '(先)' : '(后)'} ${s[0]}:${s[1]} ${l6Win ? 'L6胜' : s[0] === s[1] ? '平' : 'L4胜'} · 最慢${(worstMs / 1000).toFixed(1)}s`)
}
console.log(`\n=== L6（长考）vs L4（${games} 局） ===`)
console.log(`L6 胜 ${l6Wins}（${(l6Wins / games * 100).toFixed(0)}%）· L4 胜 ${l4Wins} · 平 ${draws} · 总 ${((Date.now() - t0) / 1000).toFixed(0)}s`)
console.log(`最慢单步 ${(totalWorst / 1000).toFixed(1)}s · 对照 L5 vs L4: 58%`)
