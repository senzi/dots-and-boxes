// 棋盘规则引擎 —— Dots and Boxes 63
// 通用尺寸：grid×grid 单位方格，点阵 (grid+1)×(grid+1)，去掉左上角点 (0,0)
// 可用边：水平 H(r,c) r∈[0,grid+1) c∈[0,grid) ；垂直 V(r,c) r∈[0,grid) c∈[0,grid+1)
// 去掉 (0,0) 后 H(0,0)/V(0,0) 不可用；左上角方格 (0,0) 永不闭合
// 可得分格子数 = grid*grid - 1

// 可选棋盘尺寸
export const SIZES = [
  { id: 's6', label: '6×6 · 35 格', grid: 6 },
  { id: 's8', label: '8×8 · 63 格', grid: 8 }
]
export const DEFAULT_SIZE = 's6'
export const REMOVED = { r: 0, c: 0 } // 被移除的角点（左上角）

// 当前棋盘尺寸（全局单例；开局时由 game store 调用 setBoardSize 设定）
let curGrid = 8
export function gridSize() { return curGrid }
export function pointCount() { return curGrid + 1 }
export function totalBoxes() { return curGrid * curGrid - 1 }

// 边 id 编码：H/r/c → 字符串 "H-r-c"，V 同理
export function edgeId(dir, r, c) {
  return `${dir}-${r}-${c}`
}

export function isEdgeUsable(dir, r, c) {
  const G = gridSize(), P = pointCount()
  if (dir === 'H') {
    if (r < 0 || r >= P || c < 0 || c >= G) return false
    // H(0,0) 连接被移除角点
    if (r === 0 && c === 0) return false
    return true
  }
  // V
  if (r < 0 || r >= G || c < 0 || c >= P) return false
  if (r === 0 && c === 0) return false
  return true
}

// 一条边邻接的方格（最多 2 个，边界 1 个）
export function edgeBoxes(dir, r, c) {
  const G = gridSize()
  const boxes = []
  if (dir === 'H') {
    // 水平边是方格 (r-1,c) 的下边、(r,c) 的上边
    if (r - 1 >= 0) boxes.push({ r: r - 1, c })
    if (r < G) boxes.push({ r, c })
  } else {
    // 垂直边是方格 (r,c-1) 的右边、(r,c) 的左边
    if (c - 1 >= 0) boxes.push({ r, c: c - 1 })
    if (c < G) boxes.push({ r, c })
  }
  // 被移除角点相关的方格 (0,0) 不可得分，剔除
  return boxes.filter(b => !(b.r === 0 && b.c === 0))
}

// 一个方格的四条边 id
export function boxEdges(r, c) {
  return [
    edgeId('H', r, c),       // 上
    edgeId('H', r + 1, c),   // 下
    edgeId('V', r, c),       // 左
    edgeId('V', r, c + 1)    // 右
  ]
}

export function createBoard() {
  const G = gridSize(), P = pointCount()
  const edges = {}
  for (let r = 0; r < P; r++) {
    for (let c = 0; c < G; c++) {
      if (isEdgeUsable('H', r, c)) edges[edgeId('H', r, c)] = null
    }
  }
  for (let r = 0; r < G; r++) {
    for (let c = 0; c < P; c++) {
      if (isEdgeUsable('V', r, c)) edges[edgeId('V', r, c)] = null
    }
  }
  const boxes = {}
  for (let r = 0; r < G; r++) {
    for (let c = 0; c < G; c++) {
      if (r === 0 && c === 0) continue // 被移除角点的格子不可得分
      boxes[`${r}-${c}`] = null
    }
  }
  return { edges, boxes }
}

// 放置一条边。返回 { ok, gained: number, completed: [{r,c}] }
// 若完成格子，调用方保持同一玩家继续行动
export function placeEdge(state, dir, r, c, player) {
  const id = edgeId(dir, r, c)
  if (!(id in state.edges) || state.edges[id] !== null) {
    return { ok: false, gained: 0, completed: [] }
  }
  state.edges[id] = player
  const completed = []
  for (const b of edgeBoxes(dir, r, c)) {
    const key = `${b.r}-${b.c}`
    if (state.boxes[key] !== null) continue
    const es = boxEdges(b.r, b.c)
    if (es.every(e => state.edges[e] !== null)) {
      state.boxes[key] = player
      completed.push({ r: b.r, c: b.c })
    }
  }
  return { ok: true, gained: completed.length, completed }
}

export function legalMoves(state) {
  const moves = []
  for (const [id, owner] of Object.entries(state.edges)) {
    if (owner === null) {
      const [dir, r, c] = id.split('-')
      moves.push({ dir, r: +r, c: +c })
    }
  }
  return moves
}

export function isGameOver(state) {
  return Object.values(state.edges).every(v => v !== null)
}

export function scores(state) {
  const s = [0, 0]
  for (const owner of Object.values(state.boxes)) {
    if (owner !== null) s[owner]++
  }
  return s
}

// 深拷贝状态（AI 搜索用）
export function cloneState(state) {
  return {
    edges: { ...state.edges },
    boxes: { ...state.boxes }
  }
}

// 待填充边数
export function remainingEdges(state) {
  let n = 0
  for (const v of Object.values(state.edges)) if (v === null) n++
  return n
}

// 一个格子当前已填充边数（3 = 危险格，会被吃）
export function boxFilledCount(state, r, c) {
  let n = 0
  for (const e of boxEdges(r, c)) {
    if (state.edges[e] !== null) n++
  }
  return n
}

/* ---------- 静态预计算表（AI 搜索热路径用，避免每次动态算邻接） ---------- */
// 注意：保持对象引用不变（ai.js 持有引用），切换尺寸时原地清空重填
export const EDGE_BOXES = {}  // edgeId -> [{r,c}, ...]（不含被移除格子）
export const BOX_EDGE_IDS = {} // "r-c" -> [上,下,左,右]

// 切换棋盘尺寸并重建查表（开局前调用）
export function setBoardSize(sizeId) {
  const found = SIZES.find(s => s.id === sizeId)
  curGrid = found ? found.grid : 8
  buildTables()
}

export function buildTables() {
  const G = gridSize(), P = pointCount()
  for (const k of Object.keys(EDGE_BOXES)) delete EDGE_BOXES[k]
  for (const k of Object.keys(BOX_EDGE_IDS)) delete BOX_EDGE_IDS[k]
  for (let r = 0; r < P; r++) {
    for (let c = 0; c < G; c++) {
      if (isEdgeUsable('H', r, c)) EDGE_BOXES[edgeId('H', r, c)] = edgeBoxes('H', r, c)
    }
  }
  for (let r = 0; r < G; r++) {
    for (let c = 0; c < P; c++) {
      if (isEdgeUsable('V', r, c)) EDGE_BOXES[edgeId('V', r, c)] = edgeBoxes('V', r, c)
    }
  }
  for (let r = 0; r < G; r++) {
    for (let c = 0; c < G; c++) {
      if (r === 0 && c === 0) continue
      BOX_EDGE_IDS[`${r}-${c}`] = boxEdges(r, c)
    }
  }
}

// 查表版：格子已填充边数
export function boxFilledCountFast(state, r, c) {
  let n = 0
  for (const e of BOX_EDGE_IDS[`${r}-${c}`]) {
    if (state.edges[e] !== null) n++
  }
  return n
}

// 查表版：某边放置后能立即完成的格子数
export function immediateGainFast(state, edgeIdStr) {
  let gain = 0
  const boxes = EDGE_BOXES[edgeIdStr]
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i]
    const key = `${b.r}-${b.c}`
    if (state.boxes[key] !== null) continue
    let n = 0
    const es = BOX_EDGE_IDS[key]
    for (let j = 0; j < 4; j++) {
      if (state.edges[es[j]] !== null) n++
    }
    if (n + 1 === 4) gain++
  }
  return gain
}
