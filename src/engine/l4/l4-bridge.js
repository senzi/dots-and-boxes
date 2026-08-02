// L4 桥接层：主项目 state ↔ 价值分析 mask + 决策接口（任意尺寸）
// 主项目边 ID 与 L4 一致（`${dir}-${r}-${c}`），索引不同 → 按尺寸映射
import { getBoard, gridFromEdgeCount } from './l4-board.js'
import L4Value from './l4-value.js'
import L4Outcome from './l4-outcome.js'

// 按边数取 board 实例（缓存）
function boardForState(state) {
  return getBoard(gridFromEdgeCount(Object.keys(state.edges).length))
}

// 边 id → mask 位（按尺寸缓存）
const EDGE_BITS = new Map() // N → { id → bit }
function edgeBits(board) {
  let map = EDGE_BITS.get(board.N)
  if (!map) {
    map = {}
    for (const e of board.edges) map[e.id] = 1n << BigInt(e.index)
    EDGE_BITS.set(board.N, map)
  }
  return map
}

// 主项目 state → L4 mask
export function stateToMask(state) {
  const board = boardForState(state)
  const bits = edgeBits(board)
  let mask = 0n
  for (const [id, owner] of Object.entries(state.edges)) {
    if (owner !== null) {
      const bit = bits[id]
      if (bit !== undefined) mask |= bit
    }
  }
  return mask
}

// L4 边索引 → 主项目 move
export function edgeIndexToMove(board, index) {
  const e = board.edges[index]
  return { dir: e.dir, r: e.r, c: e.c }
}

// 按当前棋盘尺寸把 ai-research 边索引转主项目 move
export function l4MoveFromEdge(state, edgeIndex) {
  const board = boardForState(state)
  return edgeIndexToMove(board, edgeIndex)
}

// 安全前沿开边决策：分解当前局面，返回最小价值块（该开什么）
// 附带当前块的标准让块（handout）与控制事件（留不留/保不保权）
export function l4Opening(state) {
  const board = boardForState(state)
  const mask = stateToMask(state)
  const groups = L4Value.enumerateValueBlocks(board, mask)
  if (!groups.length) return null
  const first = groups[0]
  const chosen = first.openings.slice().sort((a, b) => a.edge - b.edge)[0]
  const anotherBlockRemains = chosen.endMask !== board.FULL_MASK
  const handout = anotherBlockRemains
    ? L4Value.findStandardHandout(board, chosen.startMask, first.boxes, 30000)
    : { gift: 0 }
  const meaning = anotherBlockRemains
    ? L4Value.controlMeaning(first.value, handout.gift)
    : { code: 'GAME_END' }
  return {
    value: first.value,
    boxes: first.boxes.map(i => board.boxes[i].label),
    openings: first.openings.map(o => edgeIndexToMove(board, o.edge)),
    handout: handout.gift,
    controlCode: meaning.code
  }
}

// 完整终盘预测（outcome DP）
export function l4Predict(state, firstPlayer) {
  const board = boardForState(state)
  return L4Outcome.outcome(board, stateToMask(state), firstPlayer)
}

export default { stateToMask, edgeIndexToMove, l4MoveFromEdge, l4Opening, l4Predict }
