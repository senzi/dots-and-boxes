// L4 价值分析棋盘（ESM 移植自 ai-research/src/board.js）
// 8×8 缺角 · 142 边 · 63 格 · BigInt mask 表示
const N = 8
const edges = []
const edgeById = new Map()

function addEdge(dir, r, c) {
  if (r === 0 && c === 0) return
  const edge = { index: edges.length, id: `${dir}-${r}-${c}`, dir, r, c, boxes: [] }
  edges.push(edge)
  edgeById.set(edge.id, edge)
}

for (let r = 0; r <= N; r++) for (let c = 0; c < N; c++) addEdge('H', r, c)
for (let r = 0; r < N; r++) for (let c = 0; c <= N; c++) addEdge('V', r, c)

const boxes = []
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
  if (r === 0 && c === 0) continue
  const ids = [`H-${r}-${c}`, `H-${r + 1}-${c}`, `V-${r}-${c}`, `V-${r}-${c + 1}`]
  const edgeIndices = ids.map(id => edgeById.get(id).index)
  const box = {
    index: boxes.length,
    r,
    c,
    label: `${String.fromCharCode(65 + c)}${r + 1}`,
    edges: edgeIndices,
    mask: edgeIndices.reduce((value, index) => value | (1n << BigInt(index)), 0n)
  }
  boxes.push(box)
  for (const edgeIndex of edgeIndices) edges[edgeIndex].boxes.push(box.index)
}

const FULL_MASK = (1n << BigInt(edges.length)) - 1n
const has = (mask, edge) => (mask & (1n << BigInt(edge))) !== 0n
const put = (mask, edge) => mask | (1n << BigInt(edge))
const bitCount = value => {
  let count = 0
  while (value) { value &= value - 1n; count++ }
  return count
}
const boxComplete = (mask, box) => (mask & boxes[box].mask) === boxes[box].mask
const degrees = mask => boxes.map(box => bitCount(mask & box.mask))
const legal = mask => edges.filter(edge => !has(mask, edge.index)).map(edge => edge.index)
const gain = (mask, edge) => edges[edge].boxes.filter(box => !boxComplete(mask, box) && boxComplete(put(mask, edge), box)).length
const claimedBy = (mask, edge) => edges[edge].boxes.filter(box => !boxComplete(mask, box) && boxComplete(put(mask, edge), box))
const danger = (mask, edge) => {
  const d = degrees(mask)
  return edges[edge].boxes.filter(box => d[box] === 2).length
}

function connectedBoxes(boxSet) {
  // 格子集合是否通过共享边连通（相邻关系与边是否已填无关）
  if (!boxSet.size) return true
  const seen = new Set()
  const stack = [boxSet.values().next().value]
  while (stack.length) {
    const box = stack.pop()
    if (seen.has(box)) continue
    seen.add(box)
    for (const edgeIndex of boxes[box].edges) {
      const edge = edges[edgeIndex]
      if (edge.boxes.length !== 2) continue
      const other = edge.boxes[0] === box ? edge.boxes[1] : edge.boxes[0]
      if (boxSet.has(other) && !seen.has(other)) stack.push(other)
    }
  }
  return seen.size === boxSet.size
}

export default { N, edges, boxes, edgeById, FULL_MASK, has, put, bitCount, boxComplete, degrees, legal, gain, claimedBy, danger, connectedBoxes }
