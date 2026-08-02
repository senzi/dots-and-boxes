(function (root, factory) {
  const api = factory(root.D63 && root.D63.Board)
  if (typeof module === 'object' && module.exports) module.exports = api
  root.D63 = root.D63 || {}
  root.D63.Protocol = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Board) {
  'use strict'
  if (!Board && typeof require === 'function') Board = require('./board.js')

  function parseBase36(value) {
    if (!value) throw new Error('缺少 base36 字段')
    let result = 0n
    for (const char of value.toLowerCase()) {
      const digit = parseInt(char, 36)
      if (!Number.isInteger(digit) || digit < 0 || digit >= 36) throw new Error('非法 base36 字符')
      result = result * 36n + BigInt(digit)
    }
    return result
  }

  const frontierCode = mask => `D63F1.${mask.toString(36)}`

  function valueCode(state, seed, displayStep) {
    const openings = state.blocks.slice(0, displayStep).map(block => block.openingEdge.toString(36)).join('-') || '_'
    return `D63V1.${state.frontier.toString(36)}.${(seed >>> 0).toString(36)}.${displayStep.toString(36)}.${openings}`
  }

  function decodeValueCode(code) {
    const parts = code.trim().split('.')
    if (parts[0] !== 'D63V1' || parts.length !== 5) throw new Error('需要 D63V1 回放码')
    const frontier = parseBase36(parts[1])
    const seed = Number(parseBase36(parts[2]))
    const step = Number(parseBase36(parts[3]))
    const openings = parts[4] === '_' ? [] : parts[4].split('-').map(token => Number(parseBase36(token)))
    if (frontier < 0n || frontier > Board.FULL_MASK) throw new Error('前沿 mask 越界')
    if (openings.length !== step) throw new Error('步骤数与开块序列长度不一致')
    if (openings.some(edge => edge < 0 || edge >= Board.edges.length)) throw new Error('开块边越界')
    return { frontier, seed, step, openings }
  }

  function debugBundle(state, seed, displayStep) {
    const shown = state.blocks[displayStep - 1] || null
    const visible = state.blocks.slice(0, displayStep)
    const mask = visible.flatMap(block => block.moves).reduce((value, edge) => Board.put(value, edge), state.frontier)
    const seqCode = { FORCED_FLIP: 'F', TAKE_ALL: 'T', CHALLENGE_2: 'C', KEEP_BY_2: 'K2', KEEP_BY_4: 'K4' }
    const lines = [
      'D63 VALUE DEBUG v1',
      `protocol=${valueCode(state, seed, displayStep)}`,
      `frontier=${frontierCode(state.frontier)}`,
      `display_block=${displayStep}; computed_blocks=${state.blocks.length}; occupied_edges=${Board.bitCount(mask)}`,
      `parity=forced_value1:${visible.filter(block => block.value === 1).length}; challenge_value2:${visible.filter(block => block.value === 2).length}; handout0:${visible.filter(block => block.handout === 0).length}`,
      `control_seq=${visible.map(block => `${block.label}:${seqCode[block.controlCode] || '?'}`).join(',')}`
    ]
    if (shown) {
      lines.push(`block=${shown.label}; value=${shown.value}; short=${shown.short ? 1 : 0}; handout=${shown.handout}; control_take=${shown.controlTake}; control=${shown.controlCode}`)
      lines.push(`opening=${Board.edgeText(shown.openingEdge)}`)
      lines.push(`boxes=${shown.boxes.map(box => Board.boxes[box].label).join(',')}`)
      lines.push(`capture_edges=${shown.captureMoves.map(edge => Board.edges[edge].id).join(',') || 'none'}`)
      lines.push(`handout_edge=${shown.handoutEdge == null ? 'none' : Board.edgeText(shown.handoutEdge)}`)
      lines.push(`analysis=exact:${shown.handoutExact ? 1 : 0}; nodes:${shown.searchNodes}; equivalent_minimum:${shown.equivalentMinimumBlocks}; candidate_blocks:${shown.candidateBlockCount}; compute_ms:${shown.computeMs}`)
    } else lines.push('block=none')
    return lines.join('\n')
  }

  return { parseBase36, frontierCode, valueCode, decodeValueCode, debugBundle }
})
