// 诊断：44步前沿 + 用户开 H-2-0 后的棋盘结构（3边格/连击/块归属）
import { createBoard, placeEdge, legalMoves, setBoardSize } from '../src/engine/board.js'
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
// 44步前沿块分解
const board = getBoard(6)
const mask = stateToMask(state)
const pred = L4Outcome.outcome(board, mask, 1)
console.log('=== 44 步前沿块分解 ===')
pred.blocks.forEach((b, i) => {
  console.log(`块${i} 值${b.value} [${b.controlCode}] handout=${b.handoutEdge ?? '无'} 格子=${b.boxes.join(',')}`)
})
// 用户开 H-2-0
placeEdge(state, 'H', 2, 0, 0)
console.log('\n=== 用户开 H-2-0 后 ===')
// H-2-0 的格子
const hBoxes = board.claimedBy(mask, 48) // H-2-0 的 edge id？用 edges 查找
// 打印 H-2-0 相关的格子（手动：水平边 r2 c0 → 格(2,0) 的下边或 (2,1) 的下边？看 board 的边定义）
console.log('H-2-0 是格 (2,0) 与 (2,1) 之间的边（看 claimedBy）')
// 3边格
const threeSided = []
for (const [key, owner] of Object.entries(state.boxes)) {
  if (owner !== null) continue
  const [r, c] = key.split('-').map(Number)
  const edges = [`H-${r}-${c}`, `H-${r}-${c + 1}`, `V-${r}-${c}`, `V-${r + 1}-${c}`]
  const filled = edges.filter(e => state.edges[e] !== null).length
  if (filled === 3) threeSided.push({ key: `格(${r},${c})`, missing: edges.filter(e => state.edges[e] === null)[0] })
}
console.log('3边格（可吃）:', threeSided.map(t => `${t.key} 缺口${t.missing}`).join(' | '))
// 连击：吃每个缺口后的下一个3边格
for (const t of threeSided) {
  const [dir, r, c] = t.missing.split('-').map((x, i) => i === 0 ? x : Number(x))
  const sim = createBoard()
  Object.entries(state.edges).forEach(([k, v]) => { sim.edges[k] = v })
  Object.entries(state.boxes).forEach(([k, v]) => { sim.boxes[k] = v })
  placeEdge(sim, dir, r, c, 1)
  const next3 = []
  for (const [key, owner] of Object.entries(sim.boxes)) {
    if (owner !== null) continue
    const [rr, cc] = key.split('-').map(Number)
    const edges = [`H-${rr}-${cc}`, `H-${rr}-${cc + 1}`, `V-${rr}-${cc}`, `V-${rr + 1}-${cc}`]
    const filled = edges.filter(e => sim.edges[e] !== null).length
    if (filled === 3) next3.push(`格(${rr},${cc})缺${edges.filter(e => sim.edges[e] === null)[0]}`)
  }
  console.log(`吃 ${t.missing}（${t.key}）→ 下一个3边格: ${next3.join(' ; ') || '无（自然停）'}`)
}
