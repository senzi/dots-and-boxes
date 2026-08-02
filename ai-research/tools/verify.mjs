import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const Board = require('../src/board.js')
const Frontier = require('../src/frontier.js')
const ValueBot = require('../src/value-bot.js')
const Protocol = require('../src/protocol.js')

function assert(condition, message) { if (!condition) throw new Error(message) }

assert(Board.edges.length === 142, `edge count ${Board.edges.length}`)
assert(Board.boxes.length === 63, `box count ${Board.boxes.length}`)

const summaries = []
for (const seed of [1, 7, 20260806]) {
  const frontier = Frontier.generate(seed)
  const valid = Frontier.validate(frontier)
  assert(valid.ok, `seed ${seed}: ${valid.error}`)
  const state = ValueBot.create(frontier, { handoutNodeLimit: 30000 })
  let guard = 0
  while (!state.complete && guard++ < 63) ValueBot.next(state)
  assert(state.complete, `seed ${seed}: bot did not finish`)
  assert(state.mask === Board.FULL_MASK, `seed ${seed}: final mask incomplete`)
  assert(state.blocks.reduce((sum, block) => sum + block.value, 0) === 63, `seed ${seed}: values do not sum to 63`)
  assert(state.boxBlock.every(index => index >= 0), `seed ${seed}: unlabelled box`)
  assert(state.blocks.every(block => [0, 2, 4].includes(block.handout)), `seed ${seed}: illegal handout`)
  const code = Protocol.valueCode(state, seed, state.blocks.length)
  const decoded = Protocol.decodeValueCode(code)
  assert(decoded.frontier === frontier && decoded.openings.length === state.blocks.length, `seed ${seed}: protocol round trip`)
  summaries.push({ seed, frontierEdges: Board.bitCount(frontier), blocks: state.blocks.length, values: state.blocks.map(b => b.value), exact: state.blocks.every(b => b.handoutExact) })
}

// 回归样例：20260801 田字留 4（用户判错）
// 块 E 价值 4 田字 B1,C1,B2,C2：开边后不完成格子即换手，对手被迫吃整个 4 格闭环，
// 应标记 handout=4 / KEEP_BY_4（主动权不转移），而非旧算法的 TAKE_ALL。
{
  const code = 'D63V1.1s9cwvrwna300sdjs3y3r0jewcan.1doqxe.5.6-7-w-1y-8'
  const decoded = Protocol.decodeValueCode(code)
  const state = ValueBot.create(decoded.frontier, { handoutNodeLimit: 30000 })
  let guard = 0
  while (state.blocks.length < decoded.step && guard++ < 63) ValueBot.next(state)
  assert(state.blocks.length === decoded.step, 'tianzi fixture: bot did not reach block E')
  const block = state.blocks[decoded.step - 1]
  assert(block.value === 4, `tianzi fixture: expected value 4, got ${block.value}`)
  assert(block.handout === 4, `tianzi fixture: expected handout 4, got ${block.handout}`)
  assert(block.controlCode === 'KEEP_BY_4', `tianzi fixture: expected KEEP_BY_4, got ${block.controlCode}`)
  assert(block.controlTake === 0, `tianzi fixture: expected control_take 0, got ${block.controlTake}`)
}

console.log(JSON.stringify({ ok: true, board: { edges: Board.edges.length, boxes: Board.boxes.length }, summaries }, null, 2))
