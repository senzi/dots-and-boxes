// 复盘：用户 vs L5 6×6 对局（24:11）——检查 DP 让权是否错误
// 重建对局 → 找安全前沿 → 分解 → 每块决策（保权/翻转）→ 反事实验证
import { createBoard, placeEdge, setBoardSize } from '../src/engine/board.js'
import { getBoard } from '../src/engine/l4/l4-board.js'
import L4Outcome from '../src/engine/l4/l4-outcome.js'
import L4Bridge from '../src/engine/l4/l4-bridge.js'

setBoardSize('s6')
// 用户落子序列（P0=用户 P1=L5）
const moves = [
  ['P0', 'H-0-1'], ['P1', 'V-0-2'], ['P0', 'V-1-3'], ['P1', 'H-1-3'], ['P0', 'H-1-4'], ['P1', 'V-1-5'],
  ['P0', 'V-2-4'], ['P1', 'V-3-4'], ['P0', 'V-2-5'], ['P1', 'V-3-5'], ['P0', 'V-4-5'], ['P1', 'V-5-5'],
  ['P0', 'H-6-4'], ['P1', 'H-6-3'], ['P0', 'H-5-3'], ['P1', 'V-4-4'], ['P0', 'V-5-2'], ['P1', 'H-5-1'],
  ['P0', 'V-4-2'], ['P1', 'V-3-2'], ['P0', 'H-6-2'], ['P1', 'V-2-3'], ['P0', 'H-2-2'], ['P1', 'H-2-1'],
  ['P0', 'V-2-1'], ['P1', 'V-1-1'], ['P0', 'V-3-1'], ['P1', 'H-4-0'], ['P0', 'V-4-0'], ['P1', 'H-0-3'],
  ['P0', 'V-5-0'], ['P1', 'H-4-2'], ['P0', 'H-6-0'], ['P1', 'H-6-5'], ['P0', 'V-4-6'], ['P1', 'H-0-4'],
  ['P0', 'V-3-6'], ['P1', 'H-0-5'], ['P0', 'V-2-6'], ['P1', 'H-1-0'], ['P0', 'V-1-6'], ['P1', 'H-0-2'],
  ['P0', 'V-0-6'], ['P1', 'V-2-0'], ['P0', 'H-3-0'], ['P1', 'V-3-0'], ['P1', 'V-1-0'], ['P0', 'H-2-0'],
  ['P0', 'V-2-2'], ['P1', 'H-3-2'], ['P1', 'V-3-3'], ['P1', 'H-3-1'], ['P1', 'H-4-1'], ['P1', 'H-6-1'],
  ['P0', 'H-5-0'], ['P1', 'V-4-1'], ['P1', 'V-5-1'], ['P1', 'H-1-1'], ['P0', 'V-0-1'], ['P0', 'V-1-2'],
  ['P0', 'H-1-2'], ['P0', 'V-0-3'], ['P0', 'V-0-4'], ['P0', 'V-0-5'], ['P0', 'H-1-5'], ['P0', 'H-2-5'],
  ['P0', 'H-3-5'], ['P0', 'H-4-5'], ['P0', 'V-5-6'], ['P1', 'H-5-5'], ['P1', 'H-2-3'], ['P0', 'V-1-4'],
  ['P0', 'H-2-4'], ['P0', 'H-3-4'], ['P0', 'H-4-4'], ['P0', 'H-5-4'], ['P0', 'V-5-4'], ['P0', 'V-5-3'],
  ['P0', 'H-5-2'], ['P0', 'V-4-3'], ['P0', 'H-4-3'], ['P0', 'H-3-3']
]

const board6 = getBoard(6)
const state = createBoard()
let frontierStep = -1
let frontierMask = 0n
for (let i = 0; i < moves.length; i++) {
  const [p, id] = moves[i]
  const [dir, r, c] = id.split('-')
  const player = p === 'P0' ? 0 : 1
  placeEdge(state, dir, Number(r), Number(c), player)
  // 检查安全边数（l4 mask）
  const mask = L4Bridge.stateToMask(state)
  const safe = board6.legal(mask).filter(e => board6.danger(mask, e) === 0)
  if (safe.length === 0 && frontierStep < 0) {
    frontierStep = i + 1
    frontierMask = mask
  }
}
console.log(`总步数 ${moves.length} · 安全前沿在第 ${frontierStep} 步（已填 ${frontierStep} 边）`)
console.log(`之后进入终盘（吃格/开块）`)

// 前沿分解
const pred = L4Outcome.outcome(board6, frontierMask, 1)
console.log(`\n=== 前沿分解（firstPlayer=1：玩家1 为主动权方） ===`)
console.log(`DP 判决比分 ${pred.score[0]}:${pred.score[1]}（玩家0:玩家1）· ${pred.blocks.length} 块`)
pred.blocks.forEach((b, i) => {
  const labels = b.boxes.map(x => board6.boxes[x].label).join(' ')
  console.log(`块${i} 值${b.value} [${b.controlCode}] handout=${b.handoutEdge ?? '无'} 盒子: ${labels}`)
})

// 终盘实际归属核对
const actual = [0, 0]
const perBlock = pred.blocks.map(b => ({ value: b.value, p0: 0, p1: 0, owner: {} }))
for (let bi = 0; bi < pred.blocks.length; bi++) {
  for (const bx of pred.blocks[bi].boxes) {
    const box = board6.boxes[bx]
    const owner = state.boxes[`${box.r}-${box.c}`]
    if (owner === 0 || owner === 1) {
      actual[owner]++
      perBlock[bi][owner === 0 ? 'p0' : 'p1']++
      const lbl = board6.boxes[bx].label
      perBlock[bi].owner[lbl] = owner
    } else {
      perBlock[bi].owner['?' + board6.boxes[bx].label] = owner
    }
  }
}
console.log(`\n=== 终盘实际归属（${actual[0]}:${actual[1]} 玩家0:玩家1） ===`)
pred.blocks.forEach((b, i) => {
  const pb = perBlock[i]
  const mismatch = pb.value !== pb.p0 + pb.p1 ? ' ⚠️格子未闭合!' : ''
  console.log(`块${i} 值${b.value}: 玩家0 得 ${pb.p0} · 玩家1 得 ${pb.p1}${mismatch}`)
  if (mismatch) console.log(`  归属明细: ${JSON.stringify(pb.owner)}`)
})
console.log(`\nDP 说玩家1 该拿 ${pred.score[1]}，实际玩家1 只拿 ${actual[1]} —— 差 ${pred.score[1] - actual[1]} 分`)

// 对照：firstPlayer=0（若实际先开块是玩家0）
const pred0 = L4Outcome.outcome(board6, frontierMask, 0)
console.log(`\n=== 对照 firstPlayer=0（玩家0 先开块视角） ===`)
console.log(`DP 判决比分 ${pred0.score[0]}:${pred0.score[1]}（玩家0:玩家1）· 实际 ${actual[0]}:${actual[1]}`)
console.log(`差异：玩家0 ${pred0.score[0] - actual[0]} · 玩家1 ${pred0.score[1] - actual[1]}`)

