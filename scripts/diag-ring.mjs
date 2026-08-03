// 诊断：块2（值12 handout=81）的形状 + 81号边让2的closure验证
import { createBoard, placeEdge, setBoardSize } from '../src/engine/board.js'
import L4Bridge from '../src/engine/l4/l4-bridge.js'
import { getBoard } from '../src/engine/l4/l4-board.js'
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
const b2 = pred.blocks.find(b => b.value === 12 && b.handoutEdge !== null && b.controlCode === 'KEEP_BY_2')
console.log('=== 块2 格子（值12 KEEP_BY_2 handout=81）===')
const cols = 6
const grid = []
for (let r = 0; r < 6; r++) { grid[r] = []; for (let c = 0; c < 6; c++) grid[r][c] = '.' }
b2.boxes.forEach(box => { const r = Math.floor(box / cols); const c = box % cols; grid[r][c] = '#' })
console.log(grid.map(row => row.join(' ')).join('\n'))
// 81 号边是什么
const e81 = L4Bridge.edgeIndexToMove ? L4Bridge.edgeIndexToMove(81) : null
console.log('81 号边:', e81)
// 下 81 号边后 closure 吃多少
const sim = createBoard()
Object.entries(state.edges).forEach(([k, v]) => { sim.edges[k] = v })
Object.entries(state.boxes).forEach(([k, v]) => { sim.boxes[k] = v })
if (e81) {
  const r2 = placeEdge(sim, e81.dir, e81.r, e81.c, 0)
  console.log('下 81 号边后 gained:', r2.gained, 'completed:', r2.completed)
  // 对手（1）继续吃（closure）
  let opp = 0, guard = 0
  while (guard++ < 12) {
    const oc = Object.keys(sim.edges).filter(k => sim.edges[k] === null)
    let ate = false
    for (const k of oc) {
      const m = { dir: k[0], r: Number(k.split('-')[1]), c: Number(k.split('-')[2]) }
      const test = JSON.parse(JSON.stringify(sim))
      const tr = placeEdge(test, m.dir, m.r, m.c, 1)
      if (tr.gained > 0) { placeEdge(sim, m.dir, m.r, m.c, 1); opp += tr.gained; ate = true; break }
    }
    if (!ate) break
  }
  console.log('对手（P0）连击吃:', opp, '格')
}
// 块的形状判断（环？）：格子邻接图——检查是否有"孔"（中间空格被块环绕）
console.log('块2 格子数:', b2.boxes.length, '· 是否含中间空格被环绕（环特征）: 看上方形状')
