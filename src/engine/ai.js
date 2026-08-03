// 三档 AI —— Dots and Boxes 63
// Level 1 休闲：随机 + 避坑
// Level 2 策略：局面评分 + 安全边 + 链感知
// Level 3 大师：安全前沿 + 残余分块 + 严格 handout + 有界吃子搜索
import {
  placeEdge, legalMoves, cloneState, edgeId,
  buildTables, EDGE_BOXES, BOX_EDGE_IDS, immediateGainFast, boxFilledCountFast
} from './board.js'
import L4Bridge from './l4/l4-bridge.js'

// L5 安全阶段前瞻选边器（剩 ≤30 安全边时启发式搜索，其余回退贴边）
const L5_SAFE_CHOOSER = (state, safe, player, lastMove) => L4Bridge.l5SafeChooser(state, safe, player, lastMove)

// L6 长考版安全阶段选边器（全局频率启发 + 动态参数，不贴上一手）
const L6_SAFE_CHOOSER = (state, safe, player, lastMove) => L4Bridge.l6SafeChooser(state, safe, player, lastMove)

buildTables()

// L4 跨步计划缓存：开块时（安全前沿）用全局预测确定当前块的保权/翻转决策，
// 后续吃格阶段按计划执行。key 为游戏层的 state 对象（落子原地修改，引用稳定）。
const l4Plans = new WeakMap()

// L5 接块方保权计划（跨步）：state → { remaining: 剩余可吃格数, handoutMove: 让块边 }
const receiveKeepPlans = new WeakMap()

// L5 前沿块结构缓存（单槽——每局顺序对弈）：安全阶段最后一条安全边时预存
let frontierPlan = null // { blocks, boxBlock }

// 格子相邻判定（8邻域：平移1个单位或公共端点）
function boxesAdjacent(a, b) {
  return Math.abs(a.r - b.r) <= 1 && Math.abs(a.c - b.c) <= 1
}
// 格子共享边（4邻域——日字/链的"连续"）
function boxesShareEdge(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1
}

// 枚举完整吃路径（DFS）：尽可能连续吃（完成的格与上一步相邻），
// 无法连续就换边吃（不相邻的可吃也吃）——总能吃到自然停（换手）为止。
// 路径不会太多（连续优先——不会来回跳两个方向）；换边点分支有限。
function enumerateFullPaths(state, startMove, player) {
  const paths = []
  const sim = cloneState(state)
  const r0 = placeEdge(sim, startMove.dir, startMove.r, startMove.c, player)
  if (!r0.gained) return paths
  const startPath = [{ dir: startMove.dir, r: startMove.r, c: startMove.c }]
  let explored = 0
  function dfs(simState, path, lastBoxes) {
    if (++explored > 128) return // 路径爆炸保护
    const legal = legalMoves(simState)
    const continuous = []
    const others = []
    for (const x of legal) {
      if (immediateGainFast(simState, moveKey(x)) === 0) continue
      const test = cloneState(simState)
      const tr = placeEdge(test, x.dir, x.r, x.c, player)
      if (!tr.gained || !tr.completed) continue
      if (tr.completed.some(b => lastBoxes.some(cb => boxesAdjacent(b, cb)))) continuous.push(x)
      else others.push(x)
    }
    // 尽可能连续；无连续才换边吃
    const cand = continuous.length ? continuous : others
    if (!cand.length) { paths.push(path); return } // 自然停（换手）
    for (const x of cand) {
      const ns = cloneState(simState)
      const nr = placeEdge(ns, x.dir, x.r, x.c, player)
      dfs(ns, [...path, { dir: x.dir, r: x.r, c: x.c }], nr.completed || [])
    }
  }
  dfs(sim, startPath, r0.completed || [])
  return paths
}

// 尝试找保权起始吃法（用户算法：枚举完整吃路径 → 回溯 V-2/V-4 留尾巴）
// 尾巴（回溯的 keep 手）必须连续（日字/4格）；满足则存完整路径，执行到 stopAt 停
function findKeepStart(state, captures, player, keep = 2) {
  let best = null
  for (const m of captures) {
    const paths = enumerateFullPaths(state, m, player)
    for (const path of paths) {
      if (path.length <= keep) continue
      // 回溯 keep 手：尾巴必须连续（两两共享边——日字/4格链）
      const tail = path.slice(-keep)
      let tailOk = true
      for (let i = 1; i < tail.length; i++) {
        const ga = EDGE_BOXES[edgeId(tail[i - 1].dir, tail[i - 1].r, tail[i - 1].c)]
        const gb = EDGE_BOXES[edgeId(tail[i].dir, tail[i].r, tail[i].c)]
        if (!ga || !gb) { tailOk = false; break }
        if (!ga.some(a => gb.some(b => boxesShareEdge(a, b)))) { tailOk = false; break }
      }
      if (!tailOk) continue // 尾巴不连续 → 换路径
      // 保权：吃到 (路径长-keep) 停——留尾巴 keep 格；停时局面找让块边（补上留的一根）
      const stopAt = path.length - keep
      const simStop = cloneState(state)
      for (let i = 0; i < stopAt; i++) placeEdge(simStop, path[i].dir, path[i].r, path[i].c, player)
      let handoutMove = null
      const sm = legalMoves(simStop)
      const sd = unclaimedDegrees(simStop)
      const sh = handoutMoves(simStop, sm, sd)
      if (sh.length) {
        const smallestGift = Math.min(...sh.map(item => item.gift))
        const h = sh.filter(item => item.gift === smallestGift)[0]
        handoutMove = h.move
      }
      if (!best || stopAt > best.stopAt) {
        best = { startMove: m, path, stopAt, gift: keep, handoutMove }
      }
    }
  }
  return best
}

// L4 统计（研究用）：监控 L3 兜底是否触发（用户预判：永不触发）
export const l4Stats = {
  fallbackCount: 0,
  fallbackCaptures: 0,
  fallbackOpening: 0
}

export const AI_LEVELS = [
  { id: 1, name: '新兵', title: '休闲', desc: '初出茅庐，落子随缘，偶尔上头' },
  { id: 2, name: '老兵', title: '策略', desc: '身经百战，会吃格、懂避坑，稳扎稳打' },
  { id: 3, name: '王牌', title: '大师', desc: '端局 Loony + 主动权控制，沙场老将' },
  { id: 4, name: '疯狂的算师', title: '宗师', desc: '价值块全局演算，算尽终盘每一子' },
  { id: 5, name: '算无遗策', title: '神算', desc: '安全阶段前瞻演算，预判终盘每一手' }
]

// ---------- 工具 ----------

// 统计所有格子填充边数分布（查表版）
function boxStats(state) {
  const filled = [0, 0, 0, 0, 0] // index = 填充边数
  for (const key of Object.keys(state.boxes)) {
    const [r, c] = key.split('-').map(Number)
    if (state.boxes[key] !== null) continue
    filled[boxFilledCountFast(state, r, c)]++
  }
  return filled
}

// 一条边放置后对手能立即吃到的格子数（危险度）—— 查表版
function moveDanger(state, dir, r, c, player) {
  let danger = 0
  const boxes = EDGE_BOXES[edgeId(dir, r, c)]
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i]
    const key = `${b.r}-${b.c}`
    if (state.boxes[key] !== null) continue
    let n = 0
    const es = BOX_EDGE_IDS[key]
    for (let j = 0; j < 4; j++) {
      if (state.edges[es[j]] !== null) n++
    }
    // 本条边放置后 → n+1；若 n+1 === 3，则对手下一步可吃
    if (n + 1 === 3) danger++
  }
  return danger
}

// 若某条边能立即完成格子，返回收益格子数 —— 查表版
function immediateGain(state, dir, r, c) {
  return immediateGainFast(state, edgeId(dir, r, c))
}

// 吃格链模拟：假设轮到某玩家，他只吃能吃的格子，
// 返回 (本回合总吃格数, 结束时局面)
function eatChain(state, player, gained) {
  // 递归吃格：放置所有能完成格子的边
  const st = cloneState(state)
  let total = gained
  let changed = true
  while (changed) {
    changed = false
    for (const m of legalMoves(st)) {
      const g = immediateGain(st, m.dir, m.r, m.c)
      if (g > 0) {
        placeEdge(st, m.dir, m.r, m.c, player)
        total += g
        changed = true
        break // 重新扫描（一条边可能连锁完成多个格子）
      }
    }
  }
  return { total, st }
}

// ---------- Level 1 休闲 ----------
// 1) 有能吃的先吃
// 2) 否则避免落子到制造三边格的位置（不送格）
// 3) 随机
export function aiMoveLevel1(state, player) {
  const moves = legalMoves(state)
  // 立即吃格
  const gains = moves.filter(m => immediateGain(state, m.dir, m.r, m.c) > 0)
  if (gains.length) return gains[Math.floor(Math.random() * gains.length)]
  // 避免送格：不落子到会让格子变 3 边且这些格子会白送
  const safe = moves.filter(m => moveDanger(state, m.dir, m.r, m.c, player) === 0)
  const pool = safe.length ? safe : moves
  return pool[Math.floor(Math.random() * pool.length)]
}

// ---------- Level 2 策略 ----------
// 启发式评分 + 安全边 + 链控制
function evaluate(state, me, opp) {
  const s = boxStats(state)
  // 3 边格是对手的食物：扣分
  // 2 边格是潜在链：轻度加分（自己的潜在食物）
  // 0/1 边格：中性
  let score = 0
  // 已有分数
  const mine = Object.values(state.boxes).filter(v => v === me).length
  const theirs = Object.values(state.boxes).filter(v => v === opp).length
  score += (mine - theirs) * 2
  // 3 边格：对手下一步可能吃到 → 重罚（尤其孤立的三边格）
  score -= s[3] * 6
  // 2 边格：潜在链资源，轻微加分
  score += s[2] * 0.5
  return score
}

export function aiMoveLevel2(state, player) {
  const opp = 1 - player
  const moves = legalMoves(state)
  // 1) 立即吃格（含连锁）
  const gains = moves.filter(m => immediateGain(state, m.dir, m.r, m.c) > 0)
  if (gains.length) {
    // 贪心：吃最多的
    gains.sort((a, b) => immediateGain(state, b.dir, b.r, b.c) - immediateGain(state, a.dir, a.r, a.c))
    return gains[0]
  }
  // 2) 避免送格，且对局面评分
  let best = null
  let bestScore = -Infinity
  for (const m of moves) {
    const danger = moveDanger(state, m.dir, m.r, m.c, player)
    // 模拟自己落子后对手的吃格收益
    const sim = cloneState(state)
    placeEdge(sim, m.dir, m.r, m.c, player)
    const oppGain = eatChain(sim, opp, 0).total
    const sc = evaluate(sim, player, opp) - oppGain * 4 - danger * 3
    if (sc > bestScore) {
      bestScore = sc
      best = m
    }
  }
  return best
}

// ---------- Level 3 大师 ----------
// 设计目标：浏览器同步调用稳定低延迟。安全阶段不展开宽 minimax；进入
// 安全前沿后按残余连通块开最小块；强制吃格阶段用有界递归选择吃子顺序。

function moveKey(move) {
  return edgeId(move.dir, move.r, move.c)
}

// 同一局面稳定一致，但安全边之间保留类似随机开局的分散性。
function stateHash(state) {
  let hash = 2166136261 >>> 0
  for (const [id, owner] of Object.entries(state.edges)) {
    if (owner === null) continue
    for (let i = 0; i < id.length; i++) {
      hash ^= id.charCodeAt(i)
      hash = Math.imul(hash, 16777619) >>> 0
    }
    hash ^= owner + 1
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash >>> 0
}

function stableMoveHash(seed, move) {
  const id = moveKey(move)
  let hash = seed ^ 0x9e3779b9
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  hash ^= hash >>> 16
  return hash >>> 0
}

function unclaimedDegrees(state) {
  const degrees = {}
  for (const key of Object.keys(state.boxes)) {
    if (state.boxes[key] === null) {
      const [r, c] = key.split('-').map(Number)
      degrees[key] = boxFilledCountFast(state, r, c)
    }
  }
  return degrees
}

// 未填内部边连接未完成格子；边界不作为公共节点，避免把所有块错误连在一起。
function residualComponents(state, degrees) {
  const adjacency = {}
  for (const key of Object.keys(degrees)) adjacency[key] = []
  for (const [id, boxes] of Object.entries(EDGE_BOXES)) {
    if (state.edges[id] !== null || boxes.length !== 2) continue
    const a = `${boxes[0].r}-${boxes[0].c}`
    const b = `${boxes[1].r}-${boxes[1].c}`
    if (!(a in degrees) || !(b in degrees)) continue
    adjacency[a].push(b)
    adjacency[b].push(a)
  }
  const sizeByBox = {}
  const idByBox = {}
  const branchesById = {}
  const boxesById = {}
  const unseen = new Set(Object.keys(adjacency))
  let count = 0
  while (unseen.size) {
    count++
    const first = unseen.values().next().value
    const stack = [first]
    const found = []
    unseen.delete(first)
    while (stack.length) {
      const key = stack.pop()
      found.push(key)
      for (const next of adjacency[key]) {
        if (!unseen.has(next)) continue
        unseen.delete(next)
        stack.push(next)
      }
    }
    for (const key of found) sizeByBox[key] = found.length
    for (const key of found) idByBox[key] = count
    branchesById[count] = found.filter(key => degrees[key] < 2).length
    boxesById[count] = found
  }
  return { count, sizeByBox, idByBox, branchesById, boxesById }
}

function componentSizeForMove(move, components) {
  const boxes = EDGE_BOXES[moveKey(move)]
  let size = 999
  for (const box of boxes) {
    const value = components.sizeByBox[`${box.r}-${box.c}`]
    if (value !== undefined && value < size) size = value
  }
  return size
}

function residualLoonyParts(state) {
  const degrees = unclaimedDegrees(state)
  const active = new Set(Object.keys(degrees))
  const adjacency = new Map([...active].map(key => [key, new Set()]))
  const exits = new Map([...active].map(key => [key, 0]))
  for (const [id, adjacentBoxes] of Object.entries(EDGE_BOXES)) {
    if (state.edges[id] !== null) continue
    const adjacent = adjacentBoxes.map(box => `${box.r}-${box.c}`).filter(key => active.has(key))
    if (adjacent.length === 2) {
      adjacency.get(adjacent[0]).add(adjacent[1])
      adjacency.get(adjacent[1]).add(adjacent[0])
    } else if (adjacent.length === 1) {
      exits.set(adjacent[0], exits.get(adjacent[0]) + 1)
    }
  }
  const parts = []
  while (active.size) {
    const start = active.values().next().value
    const stack = [start]
    const found = new Set()
    while (stack.length) {
      const key = stack.pop()
      if (found.has(key)) continue
      found.add(key)
      for (const next of adjacency.get(key)) if (!found.has(next)) stack.push(next)
    }
    for (const key of found) active.delete(key)
    const size = found.size
    let internal = 0
    let boundary = 0
    let degreeTwo = true
    for (const key of found) {
      internal += [...adjacency.get(key)].filter(next => found.has(next)).length
      boundary += exits.get(key)
      if (4 - degrees[key] !== 2) degreeTwo = false
    }
    const kind = degreeTwo && internal / 2 === size && boundary === 0 ? 'loop' : 'chain'
    parts.push([kind, size])
  }
  return parts.sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1])
}

function loonyEstimate(parts, memo) {
  if (!parts.length) return 0
  const key = parts.map(part => part.join(':')).join('|')
  const cached = memo.get(key)
  if (cached !== undefined) return cached
  let best = -Infinity
  for (let index = 0; index < parts.length; index++) {
    const [kind, size] = parts[index]
    const rest = parts.slice(0, index).concat(parts.slice(index + 1))
    const future = loonyEstimate(rest, memo)
    const responses = [-size - future]
    if (kind === 'chain' && size >= 3) responses.push(4 - size + future)
    if (kind === 'loop' && size >= 4) responses.push(8 - size + future)
    best = Math.max(best, Math.min(...responses))
  }
  memo.set(key, best)
  return best
}

function emptyEdgeSignature(state) {
  let signature = ''
  let byte = 0
  let bit = 0
  for (const owner of Object.values(state.edges)) {
    if (owner === null) byte |= 1 << bit
    bit++
    if (bit === 6) {
      signature += String.fromCharCode(48 + byte)
      byte = 0
      bit = 0
    }
  }
  if (bit) signature += String.fromCharCode(48 + byte)
  return signature
}

// 估算若选择继续吃，本轮最多能取得多少格。真正决策前仍会先检查主动弃吃
// 的双十字落点；因此这不是“强制吃完”的规则。
function bestCaptureRun(state, player, budget, memo) {
  if (--budget.left <= 0) return 0
  const key = emptyEdgeSignature(state)
  const cached = memo.get(key)
  if (cached !== undefined) return cached
  const captures = []
  for (const move of legalMoves(state)) {
    const gain = immediateGainFast(state, moveKey(move))
    if (gain > 0) captures.push({ move, gain })
  }
  if (!captures.length) {
    memo.set(key, 0)
    return 0
  }
  let best = 0
  for (const candidate of captures) {
    const sim = cloneState(state)
    placeEdge(sim, candidate.move.dir, candidate.move.r, candidate.move.c, player)
    const value = candidate.gain + bestCaptureRun(sim, player, budget, memo)
    if (value > best) best = value
    if (budget.left <= 0) break
  }
  memo.set(key, best)
  return best
}

function chooseCapture(state, player, captures) {
  const budget = { left: 12000 }
  const memo = new Map()
  const seed = stateHash(state)
  let best = null
  let bestValue = -1
  let bestTie = -1
  for (const move of captures) {
    const gain = immediateGainFast(state, moveKey(move))
    const sim = cloneState(state)
    placeEdge(sim, move.dir, move.r, move.c, player)
    const value = gain + bestCaptureRun(sim, player, budget, memo)
    const tie = stableMoveHash(seed, move)
    if (value > bestValue || (value === bestValue && tie > bestTie)) {
      best = move
      bestValue = value
      bestTie = tie
    }
    if (budget.left <= 0) break
  }
  return best || captures[0]
}

// ---------- 安全前沿：价值 1/2 等值开块局部 minimax ----------
//
// 只在多个“当前最小让分”候选同为 1 或 2 时启动。搜索在所有价值 1/2
// 短块消失时停止，先比较最终控制方，再比较短块阶段分差。这样不会把宽
// minimax 带回安全阶段，也不会影响价值 >= 3 的既有链/环策略。
const SHORT_SEARCH_ABORT = Symbol('short-search-abort')

function useShortBudget(context) {
  context.nodes++
  if (context.nodes > context.nodeLimit || Date.now() > context.deadline) throw SHORT_SEARCH_ABORT
}

function cappedShortCaptureCost(state, context) {
  const key = emptyEdgeSignature(state)
  const cached = context.costMemo.get(key)
  if (cached !== undefined) return cached
  useShortBudget(context)
  const captures = []
  for (const move of legalMoves(state)) {
    const gain = immediateGainFast(state, moveKey(move))
    if (gain > 0) captures.push({ move, gain })
  }
  if (!captures.length) {
    context.costMemo.set(key, 0)
    return 0
  }
  let best = 0
  for (const candidate of captures) {
    const sim = cloneState(state)
    placeEdge(sim, candidate.move.dir, candidate.move.r, candidate.move.c, 0)
    best = Math.max(best, Math.min(3, candidate.gain + cappedShortCaptureCost(sim, context)))
    if (best >= 3) break
  }
  context.costMemo.set(key, best)
  return best
}

function shortCaptureOutcomes(state, receiver, context) {
  const key = emptyEdgeSignature(state)
  const cached = context.captureMemo.get(key)
  if (cached !== undefined) return cached
  useShortBudget(context)
  const value = cappedShortCaptureCost(state, context)
  if (value === 0) {
    const terminal = [state]
    context.captureMemo.set(key, terminal)
    return terminal
  }
  const terminals = new Map()
  for (const move of legalMoves(state)) {
    const gain = immediateGainFast(state, moveKey(move))
    if (!gain) continue
    const sim = cloneState(state)
    placeEdge(sim, move.dir, move.r, move.c, receiver)
    if (gain + cappedShortCaptureCost(sim, context) !== value) continue
    for (const terminal of shortCaptureOutcomes(sim, receiver, context)) {
      terminals.set(emptyEdgeSignature(terminal), terminal)
    }
  }
  const result = [...terminals.values()]
  context.captureMemo.set(key, result)
  return result
}

function shortResultBetter(candidate, current, chooser) {
  if (!current) return true
  const candidateControls = candidate.controller === chooser
  const currentControls = current.controller === chooser
  if (candidateControls !== currentControls) return candidateControls
  if (candidate.scoreDelta !== current.scoreDelta) {
    return chooser === 0
      ? candidate.scoreDelta > current.scoreDelta
      : candidate.scoreDelta < current.scoreDelta
  }
  const candidateKey = candidate.move ? moveKey(candidate.move) : candidate.terminalKey
  const currentKey = current.move ? moveKey(current.move) : current.terminalKey
  return candidateKey < currentKey
}

function chooseShortResult(results, chooser) {
  let best = null
  for (const result of results) {
    if (shortResultBetter(result, best, chooser)) best = result
  }
  return best
}

function solveShortPhase(state, player, controller, context) {
  const signature = emptyEdgeSignature(state)
  const key = `${signature}:${player}:${controller}`
  const cached = context.searchMemo.get(key)
  if (cached !== undefined) return cached
  useShortBudget(context)
  if (player === controller) controller = 1 - player

  const candidates = []
  for (const move of legalMoves(state)) {
    const sim = cloneState(state)
    placeEdge(sim, move.dir, move.r, move.c, player)
    const value = cappedShortCaptureCost(sim, context)
    if (value === 1 || value === 2) candidates.push({ move, state: sim, value })
  }
  if (!candidates.length) {
    const terminal = { controller, scoreDelta: 0, shortCount: 0, move: null, terminalKey: signature }
    context.searchMemo.set(key, terminal)
    return terminal
  }

  const minimum = Math.min(...candidates.map(candidate => candidate.value))
  const receiver = 1 - player
  const scoreGain = receiver === 0 ? minimum : -minimum
  const openingResults = []
  for (const candidate of candidates) {
    if (candidate.value !== minimum) continue
    const captureResults = []
    for (const terminal of shortCaptureOutcomes(candidate.state, receiver, context)) {
      const continuation = solveShortPhase(terminal, receiver, controller, context)
      captureResults.push({
        controller: continuation.controller,
        scoreDelta: scoreGain + continuation.scoreDelta,
        shortCount: 1 + continuation.shortCount,
        move: candidate.move,
        terminalKey: continuation.terminalKey
      })
    }
    openingResults.push(chooseShortResult(captureResults, receiver))
  }
  const result = chooseShortResult(openingResults, player)
  context.searchMemo.set(key, result)
  return result
}

function chooseEqualShortOpening(state, player, controller, moves, context) {
  try {
    const candidates = []
    for (const move of moves) {
      const sim = cloneState(state)
      placeEdge(sim, move.dir, move.r, move.c, player)
      candidates.push({ move, value: cappedShortCaptureCost(sim, context) })
    }
    const minimum = Math.min(...candidates.map(candidate => candidate.value))
    const tied = candidates.filter(candidate => candidate.value === minimum)
    if (!(minimum === 1 || minimum === 2) || tied.length < 2) return null
    // 在开块边界，当前行动方是 opener，控制方是另一方。
    return solveShortPhase(state, player, controller, context).move
  } catch (error) {
    if (error !== SHORT_SEARCH_ABORT) throw error
    return null
  }
}

function createL3Analysis() {
  return {
    nodes: 0,
    nodeLimit: 300000,
    deadline: Date.now() + 9500,
    costMemo: new Map(),
    captureMemo: new Map(),
    searchMemo: new Map(),
    forcedCostMemo: new Map(),
    forcedProfilesMemo: new Map(),
    controlPlanMemo: new Map(),
    partsMemo: new Map(),
    loonyMemo: new Map(),
    forecastMemo: new Map()
  }
}

function forcedCaptureCostExact(state, context) {
  const key = emptyEdgeSignature(state)
  const cached = context.forcedCostMemo.get(key)
  if (cached !== undefined) return cached
  useShortBudget(context)
  const captures = legalMoves(state).filter(move => immediateGainFast(state, moveKey(move)) > 0)
  if (!captures.length) {
    context.forcedCostMemo.set(key, 0)
    return 0
  }
  let best = 0
  for (const move of captures) {
    const gain = immediateGainFast(state, moveKey(move))
    const sim = cloneState(state)
    placeEdge(sim, move.dir, move.r, move.c, 0)
    best = Math.max(best, gain + forcedCaptureCostExact(sim, context))
  }
  context.forcedCostMemo.set(key, best)
  return best
}

function forcedCaptureProfilesExact(state, receiver, context) {
  const key = emptyEdgeSignature(state)
  const cached = context.forcedProfilesMemo.get(key)
  if (cached !== undefined) return cached
  useShortBudget(context)
  const captures = legalMoves(state).filter(move => immediateGainFast(state, moveKey(move)) > 0)
  if (!captures.length) {
    const terminal = [{ state, gift: 0 }]
    context.forcedProfilesMemo.set(key, terminal)
    return terminal
  }
  const terminals = new Map()
  for (const move of captures) {
    const gain = immediateGainFast(state, moveKey(move))
    const sim = cloneState(state)
    placeEdge(sim, move.dir, move.r, move.c, receiver)
    for (const child of forcedCaptureProfilesExact(sim, receiver, context)) {
      const gift = gain + child.gift
      const signature = emptyEdgeSignature(child.state)
      const old = terminals.get(signature)
      if (!old || gift > old.gift) terminals.set(signature, { state: child.state, gift })
    }
  }
  const result = [...terminals.values()]
  context.forcedProfilesMemo.set(key, result)
  return result
}

// 严格识别 handout：模拟一条非得分边后，所有当前可吃格必须一起落入一个
// 与其余棋盘隔离、无分叉、大小恰为 2（长链）或 4（环）的赠送块。
function handoutMoves(state, moves, degrees) {
  const activeBoxes = Object.keys(degrees).filter(key => degrees[key] === 3)
  if (!activeBoxes.length) return []
  const result = []
  for (const move of moves) {
    if (immediateGainFast(state, moveKey(move)) > 0) continue
    const sim = cloneState(state)
    placeEdge(sim, move.dir, move.r, move.c, 0)
    const nextDegrees = unclaimedDegrees(sim)
    const nextComponents = residualComponents(sim, nextDegrees)
    const componentIds = new Set(activeBoxes.map(key => nextComponents.idByBox[key]).filter(id => id !== undefined))
    if (componentIds.size !== 1) continue
    const componentId = componentIds.values().next().value
    const giftBoxes = nextComponents.boxesById[componentId]
    if (!(giftBoxes.length === 2 || giftBoxes.length === 4)) continue
    if (nextComponents.branchesById[componentId] !== 0) continue
    // 不能在赠送块之外留下其他立即可吃格，否则对方会连同别的块一起拿走。
    const allThreeSided = Object.keys(nextDegrees).filter(key => nextDegrees[key] === 3)
    if (allThreeSided.some(key => nextComponents.idByBox[key] !== componentId)) continue
    if (giftBoxes.length === Object.keys(nextDegrees).length) continue // 已是最后一块，无需留
    result.push({ move, gift: giftBoxes.length })
  }
  return result
}

function strictHandoutMovesFull(state, moves, receiver, context) {
  const degrees = unclaimedDegrees(state)
  const active = Object.keys(degrees).filter(key => degrees[key] === 3)
  if (!active.length) return []
  const remaining = Object.keys(degrees).length
  const result = []
  for (const move of moves) {
    if (immediateGainFast(state, moveKey(move)) > 0) continue
    const sim = cloneState(state)
    placeEdge(sim, move.dir, move.r, move.c, 1 - receiver)
    const quickGift = forcedCaptureCostExact(sim, context)
    if (!(quickGift === 2 || quickGift === 4)) continue
    const profiles = forcedCaptureProfilesExact(sim, receiver, context)
    const gifts = new Set(profiles.map(profile => profile.gift))
    if (gifts.size !== 1 || !gifts.has(quickGift) || quickGift === remaining) continue
    let valid = true
    for (const profile of profiles) {
      const claimed = new Set(Object.keys(state.boxes).filter(key => state.boxes[key] === null && profile.state.boxes[key] !== null))
      if (claimed.size !== quickGift || active.some(key => !claimed.has(key))) { valid = false; break }
      const first = claimed.values().next().value
      const seen = new Set()
      const stack = [first]
      while (stack.length) {
        const key = stack.pop()
        if (seen.has(key)) continue
        seen.add(key)
        for (const [id, adjacentBoxes] of Object.entries(EDGE_BOXES)) {
          if (state.edges[id] !== null || adjacentBoxes.length !== 2) continue
          const keys = adjacentBoxes.map(box => `${box.r}-${box.c}`)
          if (!keys.includes(key)) continue
          const other = keys[0] === key ? keys[1] : keys[0]
          if (claimed.has(other) && !seen.has(other)) stack.push(other)
        }
      }
      if (seen.size !== claimed.size) { valid = false; break }
    }
    if (valid) result.push({ move, gift: quickGift })
  }
  return result
}

function bestControlPlanFull(state, player, context) {
  const key = `${emptyEdgeSignature(state)}:${player}`
  if (context.controlPlanMemo.has(key)) return context.controlPlanMemo.get(key)
  useShortBudget(context)
  const moves = legalMoves(state)
  const captures = moves.filter(move => immediateGainFast(state, moveKey(move)) > 0)
  if (!captures.length) {
    context.controlPlanMemo.set(key, null)
    return null
  }
  const candidates = []
  for (const handout of strictHandoutMovesFull(state, moves, 1 - player, context)) {
    candidates.push({ move: handout.move, handout: true, take: 0, gift: handout.gift, utility: -handout.gift })
  }
  for (const move of captures) {
    const gain = immediateGainFast(state, moveKey(move))
    const sim = cloneState(state)
    placeEdge(sim, move.dir, move.r, move.c, player)
    const future = bestControlPlanFull(sim, player, context)
    if (future) candidates.push({ move, handout: false, take: gain + future.take, gift: future.gift, utility: gain + future.utility })
  }
  if (!candidates.length) {
    context.controlPlanMemo.set(key, null)
    return null
  }
  candidates.sort((a, b) => b.utility - a.utility || a.gift - b.gift || b.take - a.take || moveKey(a.move).localeCompare(moveKey(b.move)))
  const result = candidates[0]
  context.controlPlanMemo.set(key, result)
  return result
}

function openingForecastFull(state, move, receiver, context) {
  const key = `${emptyEdgeSignature(state)}:${moveKey(move)}:${receiver}`
  const cached = context.forecastMemo.get(key)
  if (cached !== undefined) return cached
  const sim = cloneState(state)
  placeEdge(sim, move.dir, move.r, move.c, 1 - receiver)
  const profiles = forcedCaptureProfilesExact(sim, receiver, context)
  const gift = Math.max(...profiles.map(profile => profile.gift))
  let receiverMargin = -Infinity
  let residualUnits = 0
  for (const profile of profiles) {
    if (profile.gift !== gift) continue
    const signature = emptyEdgeSignature(profile.state)
    let parts = context.partsMemo.get(signature)
    if (!parts) {
      parts = residualLoonyParts(profile.state)
      context.partsMemo.set(signature, parts)
    }
    const margin = profile.gift + loonyEstimate(parts, context.loonyMemo)
    if (margin > receiverMargin) {
      receiverMargin = margin
      residualUnits = parts.length
    }
  }
  const result = { gift, receiverMargin, residualUnits }
  context.forecastMemo.set(key, result)
  return result
}

function chooseStableRandom(state, moves) {
  const seed = stateHash(state)
  let best = moves[0]
  let bestHash = -1
  for (const move of moves) {
    const hash = stableMoveHash(seed, move)
    if (hash > bestHash) {
      best = move
      bestHash = hash
    }
  }
  return best
}

function moveEndpoints(move) {
  if (move.dir === 'H') return [`${move.r}-${move.c}`, `${move.r}-${move.c + 1}`]
  return [`${move.r}-${move.c}`, `${move.r + 1}-${move.c}`]
}

function sharesEndpoint(a, b) {
  const endpoints = new Set(moveEndpoints(a))
  return moveEndpoints(b).some(point => endpoints.has(point))
}

// 安全边不再完全随机：优先贴住对方上一手的端点；没有上一手上下文时，
// 优先贴住棋盘上已有的对方边。等价候选才使用确定性哈希打散。
function chooseStrategicSafe(state, moves, player, lastMove) {
  let candidates = moves
  if (lastMove && lastMove.player !== player) {
    const adjacentToLast = moves.filter(move => sharesEndpoint(move, lastMove))
    if (adjacentToLast.length) candidates = adjacentToLast
  }
  if (candidates === moves) {
    const opponentEdges = []
    for (const [id, owner] of Object.entries(state.edges)) {
      if (owner !== 1 - player) continue
      const [dir, r, c] = id.split('-')
      opponentEdges.push({ dir, r: Number(r), c: Number(c) })
    }
    let bestContact = -1
    const ranked = []
    for (const move of moves) {
      let contact = 0
      for (const opponentMove of opponentEdges) {
        if (sharesEndpoint(move, opponentMove)) contact++
      }
      if (contact > bestContact) {
        bestContact = contact
        ranked.length = 0
        ranked.push(move)
      } else if (contact === bestContact) {
        ranked.push(move)
      }
    }
    if (ranked.length) candidates = ranked
  }
  return chooseStableRandom(state, candidates)
}

function rankLess(candidate, current) {
  if (!current) return true
  for (let index = 0; index < candidate.length; index++) {
    if (candidate[index] !== current[index]) return candidate[index] < current[index]
  }
  return false
}

export function aiMoveLevel3(state, player, lastMove = null, controlOwner = null) {
  const moves = legalMoves(state)
  if (!moves.length) return null
  const analysis = createL3Analysis()

  const captures = moves.filter(move => immediateGainFast(state, moveKey(move)) > 0)
  const safe = moves.filter(move => immediateGainFast(state, moveKey(move)) === 0 && moveDanger(state, move.dir, move.r, move.c, player) === 0)
  let controller = controlOwner === 0 || controlOwner === 1 ? controlOwner : player
  // 控制方没有可吃格却必须开块时，主动权在落子前已经转给另一方。
  if (player === controller && !captures.length) controller = 1 - player
  const hasControl = player === controller

  // 1) 有安全边时先取得免费分；安全边耗尽后，控制方寻找严格日字，
  // 无权方则先接完对方的赠送。
  if (captures.length) {
    if (safe.length) return chooseCapture(state, player, captures)
    if (hasControl) {
      try {
        const plan = bestControlPlanFull(state, player, analysis)
        if (plan) return plan.move
      } catch (error) {
        if (error !== SHORT_SEARCH_ABORT) throw error
      }
      // 预算耗尽时保留原有的严格结构 handout 作为安全回退。
      const degrees = unclaimedDegrees(state)
      const handouts = handoutMoves(state, moves, degrees)
      if (handouts.length) {
        const smallestGift = Math.min(...handouts.map(item => item.gift))
        return chooseStableRandom(state, handouts.filter(item => item.gift === smallestGift).map(item => item.move))
      }
    }
    return chooseCapture(state, player, captures)
  }

  // 2) 安全阶段：绝不主动制造三边格；优先接在对方上一手的端点附近。
  if (safe.length) return chooseStrategicSafe(state, safe, player, lastMove)

  // 3) 安全前沿：先用短块 minimax 抢最终奇偶；其余局面按有权/无权
  // 两套开块策略分别估值。任一深层分析超出 10 秒预算即回退旧结构排序。
  const shortMove = chooseEqualShortOpening(state, player, controller, moves, analysis)
  if (shortMove) return shortMove
  const degrees = unclaimedDegrees(state)
  const components = residualComponents(state, degrees)
  try {
    if (!hasControl) {
      const rows = []
      for (const move of moves) {
        const sim = cloneState(state)
        placeEdge(sim, move.dir, move.r, move.c, player)
        rows.push({ move, openingValue: forcedCaptureCostExact(sim, analysis), state: sim })
      }
      const minimum = Math.min(...rows.map(row => row.openingValue))
      let best = null
      let bestRank = null
      for (const row of rows) {
        if (row.openingValue !== minimum) continue
        const plan = bestControlPlanFull(row.state, 1 - player, analysis)
        const controlBreak = plan ? 0 : 1
        const controllerUtility = plan ? plan.utility : row.openingValue
        const giftBack = plan ? plan.gift : 0
        const pressure = controllerUtility - (controlBreak ? 8 : 0)
        const rank = [pressure, -giftBack, controllerUtility, moveKey(row.move)]
        if (rankLess(rank, bestRank)) { best = row.move; bestRank = rank }
      }
      if (best) return best
    } else {
      const rows = []
      for (const move of moves) {
        const sim = cloneState(state)
        placeEdge(sim, move.dir, move.r, move.c, player)
        rows.push({ move, gift: forcedCaptureCostExact(sim, analysis) })
      }
      const minimum = Math.min(...rows.map(row => row.gift))
      let best = null
      let bestRank = null
      for (const row of rows) {
        if (row.gift !== minimum) continue
        const forecast = openingForecastFull(state, row.move, 1 - player, analysis)
        const size = componentSizeForMove(row.move, components)
        const danger = moveDanger(state, row.move.dir, row.move.r, row.move.c, player)
        const rank = [forecast.receiverMargin, forecast.residualUnits, size, danger, moveKey(row.move)]
        if (rankLess(rank, bestRank)) { best = row.move; bestRank = rank }
      }
      if (best) return best
    }
  } catch (error) {
    if (error !== SHORT_SEARCH_ABORT) throw error
  }

  // 最坏情况下的低成本确定性回退。
  const seed = stateHash(state)
  let best = null
  let bestRank = null
  for (const move of moves) {
    const size = componentSizeForMove(move, components)
    const danger = moveDanger(state, move.dir, move.r, move.c, player)
    const rank = [size, danger, stableMoveHash(seed, move)]
    if (
      bestRank === null || rank[0] < bestRank[0] ||
      (rank[0] === bestRank[0] && rank[1] < bestRank[1]) ||
      (rank[0] === bestRank[0] && rank[1] === bestRank[1] && rank[2] > bestRank[2])
    ) {
      best = move
      bestRank = rank
    }
  }
  return best
}

// ---------- Level 4 宗师 ----------
// 基于 L3，安全前沿局面用价值块估算决策（ai-research 固化算法）：
// 分解当前局面 → 先开价值最小的块（试下取最小），等价开边稳定选择。
// 吃格阶段沿用 L3 的严格 handout 控制计划（留 2/4 保权）。
export function aiMoveLevel4(state, player, lastMove = null, controlOwner = null) {
  return aiMoveLevel4With(state, player, lastMove, controlOwner, null)
}

// L4 核心流程（L5/L6 研究版复用）：safeChooser 覆盖安全阶段决策
// forceKeepAll=true：终盘预测强制所有块保权（一直保权实验）
// （默认 chooseStrategicSafe 贴边；L5 传前瞻评估器）
export function aiMoveLevel4With(state, player, lastMove = null, controlOwner = null, safeChooser = null, forceKeepAll = false, keepOnReceive = false) {
  const moves = legalMoves(state)
  if (!moves.length) return null
  const analysis = createL3Analysis()

  const captures = moves.filter(move => immediateGainFast(state, moveKey(move)) > 0)
  const safe = moves.filter(move => immediateGainFast(state, moveKey(move)) === 0 && moveDanger(state, move.dir, move.r, move.c, player) === 0)
  let controller = controlOwner === 0 || controlOwner === 1 ? controlOwner : player
  if (player === controller && !captures.length) controller = 1 - player
  const hasControl = player === controller

  // 1) 有安全边时先取得免费分；无安全边的吃格阶段按开块时全局预测的计划执行。
  if (captures.length) {
    if (safe.length) return chooseCapture(state, player, captures)
    // keepOnReceive（L5）：接块保权——captures 无精确计划时先尝试保权（不管 hasControl）
    // 开块方无主动权，接块方（吃格决策者）是主动权方；有计划（L5 开块）走精确计划。
    // 行为对齐 DP 预测（保权留 2/4 必须做到）；做不到 → 兜底数格停（Flag 不亮）。
    const l4plan = l4Plans.get(state)
    if (keepOnReceive && !l4plan) {
      const kp = receiveKeepPlans.get(state)
      if (kp) {
        if (kp.step !== undefined && kp.step < kp.stopAt) {
          // 严格按路径执行（计划 = 执行——100% 兑现 DFS 完整路径）
          const pm = kp.path[kp.step]
          kp.step++
          const legalSet = new Set(moves.map(m => moveKey(m)))
          if (pm && legalSet.has(moveKey(pm))) return pm
          // 路径边异常（不应发生）→ 退化为继续吃
          return chooseCapture(state, player, captures)
        }
        if (kp.remaining !== undefined && kp.remaining > 0) {
          kp.remaining--
          return chooseCapture(state, player, captures) // 兜底：贪心吃到留几前
        }
        receiveKeepPlans.delete(state)
        // 停：补上留的一根——放让块边（让尾巴 2/4 可吃）；无让块边则下非吃格边
        if (kp.handoutMove) {
          const legalSet = new Set(moves.map(m => moveKey(m)))
          if (legalSet.has(moveKey(kp.handoutMove))) return kp.handoutMove
        }
        const nonCapture = moves.filter(m => immediateGainFast(state, moveKey(m)) === 0)
        if (nonCapture.length) return chooseStableRandom(state, nonCapture)
        return chooseCapture(state, player, captures)
      }
      // 无计划 → 找保权起始吃法（连续全吃路径 → 回溯 V-2/V-4 留尾巴）
      // keep 从 frontierPlan 块来（KEEP_BY_2→2、KEEP_BY_4→4）；查不到默认 2
      let keep = 2
      let blockInfo = null
      // 若 frontierPlan 未存（复盘场景 L5 未在安全阶段末决策）：
      // 尝试从"开块前"重建——撤销 lastMove（开块边非吃格）→ l4 前沿 → 分解
      if (!frontierPlan && lastMove && state.edges[edgeId(lastMove.dir, lastMove.r, lastMove.c)] !== null) {
        try {
          const pre = cloneState(state)
          pre.edges[edgeId(lastMove.dir, lastMove.r, lastMove.c)] = null
          const pred = L4Bridge.l4Predict(pre, 1 - player)
          const edgeCount = Object.keys(pre.edges).length
          const cols = edgeCount === 82 ? 6 : edgeCount === 142 ? 8 : 10
          const boxBlock = new Map()
          pred.blocks.forEach((b, bi) => b.boxes.forEach(box => boxBlock.set(`${Math.floor(box / cols)}-${box % cols}`, bi)))
          frontierPlan = { blocks: pred.blocks, boxBlock }
          console.log(`[L5] 从开块前重建块结构：${pred.blocks.map((b, i) => `块${i}值${b.value}[${b.controlCode}]`).join(' · ')}`)
        } catch (e) { console.warn('[L5] 重建块结构失败：' + e.message) }
      }
      if (frontierPlan && lastMove) {
        const edgeBoxes = EDGE_BOXES[edgeId(lastMove.dir, lastMove.r, lastMove.c)]
        if (edgeBoxes) {
          for (const b of edgeBoxes) {
            const bi = frontierPlan.boxBlock.get(`${b.r}-${b.c}`)
            if (bi !== undefined) {
              blockInfo = frontierPlan.blocks[bi]
              keep = blockInfo.controlCode === 'KEEP_BY_4' ? 4 : 2
              break
            }
          }
        }
      }
      if (blockInfo) {
        console.log(`[L5] DP 要求：这块值${blockInfo.value} [${blockInfo.controlCode}] → 保权留${keep}（handout=${blockInfo.handoutEdge ?? '无'}）`)
      } else {
        console.log(`[L5] DP 要求：frontierPlan 未命中（lastMove=${lastMove ? lastMove.dir + '-' + lastMove.r + '-' + lastMove.c : '?'}）→ 默认保权留2`)
      }
      const found = findKeepStart(state, captures, player, keep)
      if (found) {
        receiveKeepPlans.set(state, { path: found.path, step: 1, stopAt: found.stopAt, handoutMove: found.handoutMove || null })
        return found.startMove
      }
      // 兜底保权（Flag 不能亮）：连续路径失败 → 按块值数格停（吃 V-keep 留 keep——保权动作）
      // 吃格可能跨块（chooseCapture），但至少"吃部分停"而非吃光翻转——收益大于翻转
      if (blockInfo && blockInfo.controlCode !== 'GAME_END' && blockInfo.handoutEdge != null) {
        const eatCount = blockInfo.value - keep
        if (eatCount >= 1) {
          console.warn('[L5] 连续路径保权失败，兜底数格停：吃' + eatCount + '留' + keep + '（块值' + blockInfo.value + '）')
          receiveKeepPlans.set(state, { remaining: eatCount - 1, handoutMove: null })
          return captures[0]
        }
      }
      // flag 报警：接块方应能保权但找不到留尾巴吃法（执行 ≠ DP 预测）
      console.error('[L5][FLAG] 接块保权失败：找不到留尾巴吃法（captures=' + captures.map(m => m.dir + '-' + m.r + '-' + m.c).join(',') + '）——行为未对齐 DP，需调试')
    }
    if (hasControl) {
      const plan = l4Plans.get(state)
      if (plan) {
        if (plan.choice && plan.choice.includes('保权')) {
          // 该块应保权：严格 handout 计划（控制方吃 controlTake、让 handout）
          // 注：预测的 handoutEdge 暂不直接执行 —— L4 的保权执行判定
          // （bestControlPlanFull/handoutMoves）与预测（findStandardHandout）
          // 标准不一致，直接放边会跳过 controlTake 的吃（2026-08-02 实测）
          try {
            const hPlan = bestControlPlanFull(state, player, analysis)
            if (hPlan) return hPlan.move
          } catch (error) {
            if (error !== SHORT_SEARCH_ABORT) throw error
          }
          const degrees = unclaimedDegrees(state)
          const handouts = handoutMoves(state, moves, degrees)
          if (handouts.length) {
            const smallestGift = Math.min(...handouts.map(item => item.gift))
            return chooseStableRandom(state, handouts.filter(item => item.gift === smallestGift).map(item => item.move))
          }
        } else {
          // 翻转 / 终局：吃光当前块
          return chooseCapture(state, player, captures)
        }
      }
      // 无计划：L4 作为接块方（对手开块后吃格）—— 纯价值判断决策：
      // 能标准让块（handoutMoves 检测 2/4 连通让块）就保权，否则吃光。
      l4Stats.fallbackCount++
      l4Stats.fallbackCaptures++
      const degrees = unclaimedDegrees(state)
      const handouts = handoutMoves(state, moves, degrees)
      if (handouts.length) {
        const smallestGift = Math.min(...handouts.map(item => item.gift))
        return chooseStableRandom(state, handouts.filter(item => item.gift === smallestGift).map(item => item.move))
      }
      return chooseCapture(state, player, captures)
    }
    return chooseCapture(state, player, captures)
  }

  // 2) 安全阶段：绝不主动制造三边格。
  if (safe.length) {
    if (safeChooser) {
      const chosen = safeChooser(state, safe, player, lastMove)
      if (chosen) return chosen
    }
    return chooseStrategicSafe(state, safe, player, lastMove)
  }

  // 3) 安全前沿：价值块估算 → 开最小价值块（L4 核心，任意尺寸）。
  //    分解当前局面（试下取最小），第一块 = 该开什么；等价开边价值相同，
  //    稳定选择（edge 字典序）。同时用全局预测确定本块保权/翻转计划。
  try {
    const opening = L4Bridge.l4Opening(state)
    if (opening && opening.openings.length) {
      const candidates = opening.openings.filter(m => immediateGainFast(state, moveKey(m)) === 0)
      if (candidates.length) {
        try {
          // 安全前沿轮到 player 是开块方（无主动权，用户定义：开块瞬间即无主动权）。
          // 全局预测以主动权方（吃块决策者）= 1-player 为 firstPlayer。
          const prediction = L4Bridge.l4Predict(state, 1 - player, { forceKeepAll })
          if (prediction.tree) {
            l4Plans.set(state, {
              controlCode: prediction.blocks[0] ? prediction.blocks[0].controlCode : null,
              choice: prediction.tree.choice,
              handoutEdge: prediction.blocks[0] ? prediction.blocks[0].handoutEdge : null
            })
          }
        } catch (error) {
          // 预测失败不存计划，吃格阶段回退 L3
        }
        candidates.sort((a, b) => moveKey(a).localeCompare(moveKey(b)))
        return candidates[0]
      }
    }
  } catch (error) {
    // L4 价值估算异常时静默回退 L3
  }

  // 最小回退：安全前沿开块（实测 200 局 0 次触发；保留组件排序兜底防异常）
  l4Stats.fallbackCount++
  l4Stats.fallbackOpening++
  const degrees = unclaimedDegrees(state)
  const components = residualComponents(state, degrees)
  const seed = stateHash(state)
  let best = null
  let bestRank = null
  for (const move of moves) {
    const size = componentSizeForMove(move, components)
    const danger = moveDanger(state, move.dir, move.r, move.c, player)
    const rank = [size, danger, stableMoveHash(seed, move)]
    if (
      bestRank === null || rank[0] < bestRank[0] ||
      (rank[0] === bestRank[0] && rank[1] < bestRank[1]) ||
      (rank[0] === bestRank[0] && rank[1] === bestRank[1] && rank[2] > bestRank[2])
    ) {
      best = move
      bestRank = rank
    }
  }
  return best
}

// 游戏层在落子前调用，用于维护策略所需的“主动权归属”。它不修改 state。
export function l3ControlAfterMove(state, move, player, controlOwner = null) {
  const moves = legalMoves(state)
  const captures = moves.filter(candidate => immediateGainFast(state, moveKey(candidate)) > 0)
  let controller = controlOwner === 0 || controlOwner === 1 ? controlOwner : player
  if (player === controller && !captures.length) controller = 1 - player
  if (immediateGainFast(state, moveKey(move)) > 0) return controller
  if (captures.length) {
    const degrees = unclaimedDegrees(state)
    const handout = handoutMoves(state, moves, degrees).some(candidate => moveKey(candidate.move) === moveKey(move))
    if (handout) return player
  }
  return 1 - player
}

export function getAiMove(level, state, player, lastMove = null, controlOwner = null) {
  if (level === 1) return aiMoveLevel1(state, player)
  if (level === 3) return aiMoveLevel3(state, player, lastMove, controlOwner)
  if (level === 4) return aiMoveLevel4(state, player, lastMove, controlOwner)
  if (level === 5) return aiMoveLevel5(state, player, lastMove, controlOwner)
  return aiMoveLevel2(state, player)
}

// L5 神算：L4 核心 + 安全阶段前瞻选边（剩 ≤30 安全边时启发式搜索）
// keepOnReceive=true：接块方（对手开块）保权吃法搜索（从一头吃、留尾巴、补让块边）
export function aiMoveLevel5(state, player, lastMove = null, controlOwner = null) {
  const moves = legalMoves(state)
  if (!moves.length) return null
  const analysis = createL3Analysis()
  const captures = moves.filter(move => immediateGainFast(state, moveKey(move)) > 0)
  const safe = moves.filter(move => immediateGainFast(state, moveKey(move)) === 0 && moveDanger(state, move.dir, move.r, move.c, player) === 0)
  // 安全阶段临近前沿时预存前沿块结构（每局一次，接块保权用）
  // 条件：安全边 ≤3；模拟下每条安全边，若下完即前沿（safe=0）→ 分解存
  if (safe.length > 0 && safe.length <= 3 && !frontierPlan) {
    try {
      for (const s of safe) {
        const sim = cloneState(state)
        placeEdge(sim, s.dir, s.r, s.c, player)
        const simSafe = legalMoves(sim).filter(m => immediateGainFast(sim, moveKey(m)) === 0 && moveDanger(sim, m.dir, m.r, m.c, player) === 0)
        if (simSafe.length === 0) {
          const pred = L4Bridge.l4Predict(sim, 1 - player)
          const edgeCount = Object.keys(state.edges).length
          const cols = edgeCount === 82 ? 6 : edgeCount === 142 ? 8 : 10
          const boxBlock = new Map()
          pred.blocks.forEach((b, bi) => b.boxes.forEach(box => boxBlock.set(`${Math.floor(box / cols)}-${box % cols}`, bi)))
          frontierPlan = { blocks: pred.blocks, boxBlock }
          console.log(`[L5] 前沿块结构已存：${pred.blocks.map((b, i) => `块${i}值${b.value}[${b.controlCode}]handout=${b.handoutEdge ?? '无'}`).join(' · ')}`)
          break
        }
      }
    } catch (e) { frontierPlan = null }
  }
  const controller = controlOwner === 0 || controlOwner === 1 ? controlOwner : player
  const hasControl = player === controller
  console.log(`[L5] 我的回合 P${player} · 控制权P${controller} · 安全边${safe.length} · 可吃${captures.length}条(${captures.slice(0,4).map(m => m.dir + '-' + m.r + '-' + m.c).join(',')})`)
  return aiMoveLevel4With(state, player, lastMove, controlOwner, L5_SAFE_CHOOSER, false, true)
}

// L6 长考：L4 核心 + 全局频率启发（早期休息2手/中期休息1手/后期必定，不贴上一手）
export function aiMoveLevel6(state, player, lastMove = null, controlOwner = null) {
  return aiMoveLevel4With(state, player, lastMove, controlOwner, L6_SAFE_CHOOSER)
}

// L5 一直保权实验版：L4 核心 + L5 前瞻 + 终盘强制所有块保权
export function aiMoveLevel5Keep(state, player, lastMove = null, controlOwner = null) {
  return aiMoveLevel4With(state, player, lastMove, controlOwner, L5_SAFE_CHOOSER, true)
}

export function aiMoveDelay(level) {
  if (level === 4) return 120
  if (level === 5) return 350
  return level === 3 ? 220 : 350
}
