// L5 一直保权实验版 vs L4 / L5 正常
// node scripts/l5keep-bench.mjs [局数] [对手:4|5]
import { createBoard, placeEdge, isGameOver, scores, setBoardSize } from '../src/engine/board.js'
import { aiMoveLevel4, aiMoveLevel5, aiMoveLevel5Keep, l3ControlAfterMove } from '../src/engine/ai.js'

setBoardSize('s8')
const games = Number(process.argv[2] || 12)
const opponent = Number(process.argv[3] || 4) // 4=L4 对手, 5=L5 对手
const oppFn = opponent === 5 ? aiMoveLevel5 : aiMoveLevel4
const oppName = opponent === 5 ? 'L5' : 'L4'
let keepWins = 0, oppWins = 0, draws = 0
const t0 = Date.now()
for (let g = 0; g < games; g++) {
  const state = createBoard()
  const keepSeat = g % 2
  let player = 0, lastMove = null, controlOwner = 1
  while (!isGameOver(state)) {
    const t = Date.now()
    const move = player === keepSeat
      ? aiMoveLevel5Keep(state, player, lastMove, controlOwner)
      : oppFn(state, player, lastMove, controlOwner)
    if (!move) break
    controlOwner = l3ControlAfterMove(state, move, player, controlOwner)
    const result = placeEdge(state, move.dir, move.r, move.c, player)
    lastMove = { ...move, player }
    if (!result.gained) player = 1 - player
  }
  const s = scores(state)
  const keepWin = keepSeat === 0 ? s[0] > s[1] : s[1] > s[0]
  if (keepWin) keepWins++
  else if (s[0] === s[1]) draws++
  else oppWins++
  console.log(`局 ${String(g + 1).padStart(2)}: L5Keep${keepSeat === 0 ? '(先)' : '(后)'} ${s[0]}:${s[1]} ${keepWin ? 'L5Keep胜' : s[0] === s[1] ? '平' : `${oppName}胜`}`)
}
console.log(`\n=== L5Keep（一直保权）vs ${oppName}（${games} 局） ===`)
console.log(`L5Keep 胜 ${keepWins}（${(keepWins / games * 100).toFixed(0)}%）· ${oppName} 胜 ${oppWins} · 平 ${draws} · 总 ${((Date.now() - t0) / 1000).toFixed(0)}s`)
