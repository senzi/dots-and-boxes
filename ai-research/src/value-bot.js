(function (root, factory) {
  const api = factory(root.D63 && root.D63.Board)
  if (typeof module === 'object' && module.exports) module.exports = api
  root.D63 = root.D63 || {}
  root.D63.ValueBot = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Board) {
  'use strict'
  if (!Board && typeof require === 'function') Board = require('./board.js')

  function captureClosure(startMask, allowedBoxes) {
    // 机械闭包：开边后反复吃掉所有可得分边，直到无可得分边。
    // 价值判断的"试下"指不同开边之间取最小（2026-08-01 用户确认）；
    // 吃边顺序分支不做最小化（例如田字内边被开，连锁吞并邻块就是闭包结果）。
    let mask = startMask
    const moves = []
    const claimed = new Set()
    const allowed = allowedBoxes || null
    while (true) {
      const scoring = Board.legal(mask)
        .map(edge => ({ edge, boxes: Board.claimedBy(mask, edge) }))
        .filter(item => item.boxes.length && (!allowed || item.boxes.every(box => allowed.has(box))))
        .sort((a, b) => b.boxes.length - a.boxes.length || a.edge - b.edge)
      if (!scoring.length) break
      const choice = scoring[0]
      mask = Board.put(mask, choice.edge)
      moves.push(choice.edge)
      for (const box of choice.boxes) claimed.add(box)
    }
    return { mask, moves, claimed: [...claimed].sort((a, b) => a - b) }
  }

  function openingAnalysis(mask, edge) {
    const start = Board.put(mask, edge)
    const closure = captureClosure(start)
    const claimed = closure.claimed.filter(box => !Board.boxComplete(mask, box))
    return {
      edge,
      startMask: start,
      endMask: closure.mask,
      captureMoves: closure.moves,
      boxes: claimed,
      signature: claimed.join(','),
      value: claimed.length
    }
  }

  function enumerateValueBlocks(mask) {
    const groups = new Map()
    for (const edge of Board.legal(mask)) {
      const row = openingAnalysis(mask, edge)
      const key = row.signature || `empty:${edge}`
      if (!groups.has(key)) groups.set(key, { signature: key, value: row.value, boxes: row.boxes, openings: [] })
      groups.get(key).openings.push(row)
    }
    return [...groups.values()].sort((a, b) => a.value - b.value || a.boxes[0] - b.boxes[0] || a.openings[0].edge - b.openings[0].edge)
  }

  function betterHandout(a, b) {
    if (!a) return b
    if (!b) return a
    const rankA = [a.take - a.gift, -a.gift, a.take, -a.edge]
    const rankB = [b.take - b.gift, -b.gift, b.take, -b.edge]
    for (let i = 0; i < rankA.length; i++) {
      if (rankA[i] !== rankB[i]) return rankA[i] > rankB[i] ? a : b
    }
    return a
  }

  function findStandardHandout(startMask, targetBoxes, nodeLimit) {
    const target = new Set(targetBoxes)
    const relevantEdges = new Set(targetBoxes.flatMap(box => Board.boxes[box].edges))
    const memo = new Map()
    let nodes = 0
    let truncated = false

    function search(mask) {
      const key = mask.toString(36)
      if (memo.has(key)) return memo.get(key)
      nodes++
      if (nodes > nodeLimit) { truncated = true; return null }

      const remaining = targetBoxes.filter(box => !Board.boxComplete(mask, box))
      if (!remaining.length) { memo.set(key, null); return null }
      const active = new Set(remaining.filter(box => Board.bitCount(mask & Board.boxes[box].mask) === 3))
      let best = null

      for (const edge of relevantEdges) {
        if (Board.has(mask, edge) || Board.gain(mask, edge)) continue
        const closure = captureClosure(Board.put(mask, edge), target)
        const gift = closure.claimed.filter(box => remaining.includes(box))
        const giftSet = new Set(gift)
        // 允许让出整个块（gift == remaining）：田字让 4 / 短链让 2 都是
        // 合法的 KEEP_BY_4 / KEEP_BY_2，控制方保持主动权。
        if (![2, 4].includes(gift.length)) continue
        if ([...active].some(box => !giftSet.has(box))) continue
        if (!Board.connectedBoxes(giftSet, mask)) continue
        best = betterHandout(best, { edge, gift: gift.length, take: 0, giftBoxes: gift, path: [], exact: true })
      }

      const scoring = [...relevantEdges]
        .filter(edge => !Board.has(mask, edge))
        .map(edge => ({ edge, claimed: Board.claimedBy(mask, edge).filter(box => target.has(box)) }))
        .filter(item => item.claimed.length)
        .sort((a, b) => b.claimed.length - a.claimed.length || a.edge - b.edge)

      for (const item of scoring) {
        const future = search(Board.put(mask, item.edge))
        if (!future) continue
        best = betterHandout(best, {
          ...future,
          take: future.take + item.claimed.length,
          path: [item.edge, ...future.path]
        })
      }
      memo.set(key, best)
      return best
    }

    // 候选 0：开边后不额外放边，直接换手，对手闭包恰好吃 2/4 格。
    // 这是田字/短链"开边即让"的标准让块（handoutEdge 为 null）。
    const remaining0 = targetBoxes.filter(box => !Board.boxComplete(startMask, box))
    const direct = captureClosure(startMask, target)
    const directGift = direct.claimed.filter(box => remaining0.includes(box))
    const directSet = new Set(directGift)
    let best = null
    if ([2, 4].includes(directGift.length)) {
      const active0 = new Set(remaining0.filter(box => Board.bitCount(startMask & Board.boxes[box].mask) === 3))
      if (![...active0].some(box => !directSet.has(box)) && Board.connectedBoxes(directSet, startMask)) {
        best = betterHandout(best, { edge: null, gift: directGift.length, take: 0, giftBoxes: directGift, path: [], exact: true })
      }
    }

    const result = search(startMask)
    const final = betterHandout(best, result ? { ...result, exact: !truncated, nodes } : null)
    return final
      ? { ...final, nodes: final.nodes || 0, exact: final.exact && !truncated }
      : { edge: null, gift: 0, take: targetBoxes.length, giftBoxes: [], path: [], exact: !truncated, nodes }
  }

  function controlMeaning(value, gift) {
    if (value === 1) return { code: 'FORCED_FLIP', label: '强制翻转', parity: 1 }
    if (value === 2) return { code: 'CHALLENGE_2', label: '争权2', parity: 1 }
    if (gift === 2) return { code: 'KEEP_BY_2', label: '保权·让2', parity: 0 }
    if (gift === 4) return { code: 'KEEP_BY_4', label: '保权·让4', parity: 0 }
    return { code: 'TAKE_ALL', label: '全吃开块', parity: 1 }
  }

  function create(frontier, options) {
    return {
      format: 'D63V1',
      frontier,
      mask: frontier,
      blocks: [],
      edgeOwners: new Map(),
      boxBlock: Array(Board.boxes.length).fill(-1),
      complete: frontier === Board.FULL_MASK,
      options: { handoutNodeLimit: 30000, ...(options || {}) },
      parity: { forcedFlips: 0, challengeTwos: 0, takeAll: 0 }
    }
  }

  function next(state) {
    if (state.complete) return null
    if (Board.legal(state.mask).some(edge => Board.gain(state.mask, edge))) throw new Error('价值 Bot 的步间状态必须没有待吃边')
    const started = Date.now()
    const groups = enumerateValueBlocks(state.mask)
    if (!groups.length) { state.complete = true; return null }
    const minimum = groups[0].value
    const equivalent = groups.filter(group => group.value === minimum)
    // 以价值优先：等价组不因让多让少改变先后（2026-08-01 用户确认，让多少不参与排序）
    const chosenGroup = equivalent[0]
    const chosen = chosenGroup.openings.slice().sort((a, b) => a.edge - b.edge)[0]
    const anotherBlockRemains = chosen.endMask !== Board.FULL_MASK
    const handout = anotherBlockRemains
      ? findStandardHandout(chosen.startMask, chosen.boxes, state.options.handoutNodeLimit)
      : { edge: null, gift: 0, take: chosen.value, giftBoxes: [], path: [], exact: true, nodes: 0 }
    // 最后一块是终局：吃光即游戏结束，不存在"转移主动权"，不计控制事件（2026-08-01）
    const meaning = anotherBlockRemains
      ? controlMeaning(chosen.value, handout.gift)
      : { code: 'GAME_END', label: '终局', parity: 0 }
    const blockIndex = state.blocks.length
    const allMoves = [chosen.edge, ...chosen.captureMoves]
    for (const edge of allMoves) state.edgeOwners.set(edge, blockIndex)
    for (const box of chosen.boxes) state.boxBlock[box] = blockIndex
    state.mask = chosen.endMask
    if (meaning.code !== 'GAME_END') {
      state.parity.forcedFlips += meaning.code === 'FORCED_FLIP' ? 1 : 0
      state.parity.challengeTwos += meaning.code === 'CHALLENGE_2' ? 1 : 0
      state.parity.takeAll += meaning.code === 'TAKE_ALL' ? 1 : 0
    }
    const block = {
      index: blockIndex,
      label: String.fromCharCode(65 + blockIndex % 26) + (blockIndex >= 26 ? Math.floor(blockIndex / 26) + 1 : ''),
      openingEdge: chosen.edge,
      captureMoves: chosen.captureMoves,
      moves: allMoves,
      boxes: chosen.boxes,
      value: chosen.value,
      short: chosen.value <= 2,
      handout: handout.gift,
      controlTake: Math.max(0, chosen.value - handout.gift),
      handoutEdge: handout.edge,
      handoutPath: handout.path,
      handoutBoxes: handout.giftBoxes,
      handoutExact: handout.exact,
      searchNodes: handout.nodes,
      controlCode: meaning.code,
      controlLabel: meaning.label,
      parityDelta: meaning.parity,
      equivalentMinimumBlocks: equivalent.length,
      candidateBlockCount: groups.length,
      remainingEdges: Board.legal(state.mask).length,
      computeMs: Date.now() - started
    }
    state.blocks.push(block)
    state.complete = state.mask === Board.FULL_MASK
    return block
  }

  function snapshotAt(frontier, blocks, count) {
    const state = create(frontier)
    for (const block of blocks.slice(0, count)) {
      state.mask = block.moves.reduce((mask, edge) => Board.put(mask, edge), state.mask)
      for (const edge of block.moves) state.edgeOwners.set(edge, block.index)
      for (const box of block.boxes) state.boxBlock[box] = block.index
      state.blocks.push(block)
      state.parity.forcedFlips += block.controlCode === 'FORCED_FLIP' ? 1 : 0
      state.parity.challengeTwos += block.controlCode === 'CHALLENGE_2' ? 1 : 0
      state.parity.takeAll += block.controlCode === 'TAKE_ALL' ? 1 : 0
    }
    state.complete = state.mask === Board.FULL_MASK
    return state
  }

  return { captureClosure, openingAnalysis, enumerateValueBlocks, findStandardHandout, controlMeaning, create, next, snapshotAt }
})
