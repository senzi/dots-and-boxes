// 验证：44步前沿 → 用户开 H-2-0 → 对比两条吃格路径
// A) L5 原路径（H-3-0 开始吃 4 格放手） B) 用户保权路径（V-1-0 开始吃 2 格放手）
import { createBoard, placeEdge, legalMoves, setBoardSize } from '../src/engine/board.js'
import { getAiMove, l3ControlAfterMove } from '../src/engine/ai.js'
import { getBoard } from '../src/engine/l4/l4-board.js'
import { stateToMask } from '../src/engine/l4/l4-bridge.js'
import L4Outcome from '../src/engine/l4/l4-outcome.js'

setBoardSize('s6')
const seq = [
  ['P0','H-0-1'],['P1','V-0-2'],['P0','V-1-3'],['P1','H-1-3'],['P0','H-1-4'],['P1','V-1-5'],
  ['P0','V-2-4'],['P1','V-3-4'],['P0','V-2-5'],['P1','V-3-5'],['P0','V-4-5'],['P1','V-5-5'],
  ['P0','H-6-4'],['P1','H-6-3'],['P0','H-5-3'],['P1','V-4-4'],['P0','V-5-2'],['P1','H-5-1'],
  ['P0','V-4-2'],['P1','V-3-2'],['P0','H-6-2'],['P1','V-2-3'],['P0','H-2-2'],['P1','H-2-1'],
  ['P0','V-2-1'],['P1','V-1-1'],['P0','V-3-1'],['P1','H-4-0'],['P0','V-4-0'],['P1','H-0-3'],
  ['P0','V-5-0'],['P1','H-4-2'],['P0','H-6-0'],['P1','H-6-5'],['P0','V-4-6'],['P1','H-0-4'],
  ['P0','V-3-6'],['P1','H-0-5'],['P0','V-2-6'],['P1','H-1-0'],['P0','V-1-6'],['P1','H-0-2'],
  ['P0','V-0-6'],['P1','V-2-0']
]
function buildState() {
  const state = createBoard()
  let ctrl = 1
  for (let i = 0; i < seq.length; i++) {
    const [p, id] = seq[i]
    const [dir, r, c] = id.split('-')
    const player = p === 'P0' ? 0 : 1
    ctrl = l3ControlAfterMove(state, { dir, r: Number(r), c: Number(c) }, player, ctrl)
    placeEdge(state, dir, Number(r), Number(c), player)
  }
  placeEdge(state, 'H', 2, 0, 0) // 用户开块
  return state
}
// 从 state 模拟吃格连击（player 视角）：吃格直到放手，返回 { eaten, state }
function eatChain(state, player) {
  let eaten = 0
  const st = state
  while (true) {
    const moves = legalMoves(st)
    const caps = moves.filter(m => {
      // 立即吃格检测
      const boxes = st.boxes
      const edges = [`H-${m.r}-${m.c}`, `H-${m.r}-${m.c + 1}`, `V-${m.r}-${m.c}`, `V-${m.r + 1}-${m.c}`]
      return edges.some(e => {
        const [ed, er, ec] = e.split('-').map((x, i) => i === 0 ? x : Number(x))
        return st.edges[e] === null && edges.filter(x => st.edges[x] !== null).length === 3
      })
    })
    if (!caps.length) break
    const m = caps[0]
    const res = placeEdge(st, m.dir, m.r, m.c, player)
    eaten += res.gained
    if (!res.gained) break // 理论上吃格边必 gain
  }
  return eaten
}
const board = getBoard(6)
// 路径 A：L5 原（H-3-0）
const sA = buildState()
const resA = placeEdge(sA, 'H', 3, 0, 1)
const eatA = eatChain(sA, 1)
// 路径 B：用户保权（V-1-0）
const sB = buildState()
const resB = placeEdge(sB, 'V', 1, 0, 1)
const eatB = eatChain(sB, 1)
console.log(`=== 两条吃格路径对比 ===`)
console.log(`A) H-3-0 起始: 吃 ${eatA} 格后放手`)
console.log(`B) V-1-0 起始: 吃 ${eatB} 格后放手`)
// 路径 B 的手动（用户：V-1-0 + V-3-0）
const sC = buildState()
placeEdge(sC, 'V', 1, 0, 1)
placeEdge(sC, 'V', 3, 0, 1)
console.log(`C) 用户路径（V-1-0+V-3-0）: 吃完后轮到?`)
// 各路径终局预测（补全到前沿再 DP——近似：直接看当前吃完后的结构）
for (const [name, s] of [['A', sA], ['B', sB], ['C', sC]]) {
  try {
    const mask = stateToMask(s)
    const pred = L4Outcome.outcome(board, mask, 1)
    console.log(`  ${name} 路径当前结构 DP: ${pred.score[0]}:${pred.score[1]}（P0:P1）· ${pred.blocks.length} 块`)
  } catch (e) { console.log(`  ${name} 路径 DP 失败（非前沿）`) }
}
