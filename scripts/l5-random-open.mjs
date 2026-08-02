// L5（前 N 手随机）vs L4 完整对局胜率——随机开局多样性
// node scripts/l5-random-open.mjs [局数] [随机手数]
import { createBoard, placeEdge, isGameOver, scores, setBoardSize } from '../src/engine/board.js'
import { aiMoveLevel1, aiMoveLevel4, aiMoveLevel5, l3ControlAfterMove } from '../src/engine/ai.js'

setBoardSize('s8')
const games = Number(process.argv[2] || 20)
const randomPlies = Number(process.argv[3] || 5)
let l5Wins = 0, l4Wins = 0, draws = 0
const t0 = Date.now()
for (let g = 0; g < games; g++) {
  const state = createBoard()
  const l5Seat = g % 2
  let player = 0, lastMove = null, controlOwner = 1
  let l5Plies = 0 // L5 已走的步数（前 randomPlies 手随机）
  while (!isGameOver(state)) {
    let move
    if (player === l5Seat && l5Plies < randomPlies) {
      move = aiMoveLevel1(state, player) // 前 N 手随机（新兵）
      l5Plies++
    } else {
      move = player === l5Seat
        ? aiMoveLevel5(state, player, lastMove, controlOwner)
        : aiMoveLevel4(state, player, lastMove, controlOwner)
    }
    if (!move) break
    controlOwner = l3ControlAfterMove(state, move, player, controlOwner)
    const result = placeEdge(state, move.dir, move.r, move.c, player)
    lastMove = { ...move, player }
    if (!result.gained) player = 1 - player
  }
  const s = scores(state)
  const l5Win = l5Seat === 0 ? s[0] > s[1] : s[1] > s[0]
  if (l5Win) l5Wins++
  else if (s[0] === s[1]) draws++
  else l4Wins++
  console.log(`局 ${String(g + 1).padStart(2)}: L5${l5Seat === 0 ? '(先)' : '(后)'} ${s[0]}:${s[1]} ${l5Win ? 'L5胜' : s[0] === s[1] ? '平' : 'L4胜'}`)
}
console.log(`\n=== L5（前${randomPlies}手随机）vs L4（${games} 局） ===`)
console.log(`L5 胜 ${l5Wins}（${(l5Wins / games * 100).toFixed(0)}%）· L4 胜 ${l4Wins} · 平 ${draws} · 总 ${((Date.now() - t0) / 1000).toFixed(0)}s`)
