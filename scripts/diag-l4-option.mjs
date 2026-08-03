// l4 层诊断：块2/块3 形状 + optionSet 保权选项（为什么环让2被接受）
import { createBoard, placeEdge, setBoardSize } from '../src/engine/board.js'
import { getBoard } from '../src/engine/l4/l4-board.js'
import L4Value from '../src/engine/l4/l4-value.js'
import { stateToMask } from '../src/engine/l4/l4-bridge.js'
import L4Outcome from '../src/engine/l4/l4-outcome.js'

setBoardSize('s6')
const seq = 'H-0-1,V-0-2,V-1-3,H-1-3,H-1-4,V-1-5,V-2-4,V-3-4,V-2-5,V-3-5,V-4-5,V-5-5,H-6-4,H-6-3,H-5-3,V-4-4,V-5-2,H-5-1,V-4-2,V-3-2,H-6-2,V-2-3,H-2-2,H-2-1,V-2-1,V-1-1,V-3-1,H-4-0,V-4-0,H-0-3,V-5-0,H-4-2,H-6-0,H-6-5,V-4-6,H-0-4,V-3-6,H-0-5,V-2-6,H-1-0,V-1-6,H-0-2,V-0-6,V-2-0'.split(',')
const state = createBoard()
for (let i = 0; i < seq.length; i++) {
  const [dir, r, c] = seq[i].split('-')
  placeEdge(state, dir, Number(r), Number(c), i % 2 === 0 ? 0 : 1)
}
const board = getBoard(6)
const mask = stateToMask(state)
const pred = L4Outcome.outcome(board, mask, 1)
console.log('=== 块形状 ===')
pred.blocks.forEach((b, i) => {
  const cols = 6
  const grid = []
  for (let r = 0; r < 6; r++) { grid[r] = []; for (let c = 0; c < 6; c++) grid[r][c] = '.' }
  b.boxes.forEach(box => { const r = Math.floor(box / cols); const c = box % cols; grid[r][c] = '#' })
  console.log(`块${i} 值${b.value} [${b.controlCode}] handout=${b.handoutEdge ?? '无'}`)
  console.log(grid.map(row => row.join(' ')).join('\n'))
})
// optionSet：块2 的保权选项（gift 2/4）
console.log('=== 块2 optionSet（保权选项）===')
const b2 = pred.blocks.find((b, i) => i === 1) // 值8的块？——打印所有块的 optionSet
pred.blocks.forEach((b, i) => {
  if (b.controlCode === 'GAME_END') return
  console.log(`块${i} 值${b.value} [${b.controlCode}] optionSet:`, b.optionSet ? b.optionSet.map(o => `take=${o.take} gift=${o.gift} code=${o.code} handout=${o.handoutEdge ?? '无'}`).join(' | ') : '无')
})
// 找块2（值12 KEEP_BY_2）的保权选项——gift=2 的 handout 边——closure 验证
const b12 = pred.blocks.find(b => b.value === 12 && b.controlCode === 'KEEP_BY_2')
console.log('=== 块2（值12 KEEP_BY_2）的保权细节 ===')
console.log('handoutEdge:', b12.handoutEdge)
if (b12.handoutEdge != null) {
  // 下 handout 边后 closure 吃多少（在 44 步前沿）
  const m2 = L4Value.create(board, mask).mask // 占位——直接手算：handout 边邻接的格子
  console.log('（用 board.boxes 查 handout 边邻接格）')
  const edgeBoxes = board.boxes.filter((bx, i) => i === b12.handoutEdge) // 边索引→格子？
  console.log('handout 边邻接格（l4-board box 索引）:', b12.handoutEdge, '→', board.edges[b12.handoutEdge])
}
