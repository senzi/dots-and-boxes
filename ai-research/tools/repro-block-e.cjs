// 复现 block E 田字留 4 问题
// 用法：node tools/repro-block-e.mjs
const Board = require('../src/board.js')
const ValueBot = require('../src/value-bot.js')
const Protocol = require('../src/protocol.js')

const code = 'D63V1.1s9cwvrwna300sdjs3y3r0jewcan.1doqxe.5.6-7-w-1y-8'
const dec = Protocol.decodeValueCode(code)
const state = ValueBot.create(dec.frontier, { handoutNodeLimit: 30000 })
for (let i = 0; i < dec.step; i++) ValueBot.next(state)
const block = state.blocks[dec.step - 1]
console.log('step:', dec.step, 'block:', block.label, 'value:', block.value, 'handout:', block.handout, 'control:', block.controlCode)
console.log('boxes:', block.boxes.map(b => Board.boxes[b].label).join(','))
console.log('opening:', Board.edgeText(block.openingEdge))

// 开边后的状态（不含块内自动吃边）
const startMask = Board.put(dec.frontier, block.openingEdge)
const startDegrees = Board.degrees(startMask)
console.log('--- 开边后 3 边格（active）---')
const active = block.boxes.filter(b => startDegrees[b] === 3).map(b => Board.boxes[b].label)
console.log('active:', active.join(',') || '(none)')

// 从 startMask 直接闭包（不额外放边，模拟"开边后换手对手吃"）
const closure = ValueBot.captureClosure(startMask)
console.log('--- 开边后直接闭包 ---')
console.log('claimed:', closure.claimed.map(b => Board.boxes[b].label).join(','), 'count:', closure.claimed.length)
console.log('capture moves:', closure.moves.map(e => Board.edges[e].id).join(','))

// 检查所有相关边：放一条非得分边后闭包吃几格
console.log('--- 块内非得分边 → 闭包 gift ---')
const target = new Set(block.boxes)
for (const edge of block.boxes.flatMap(b => Board.boxes[b].edges)) {
  if (Board.has(startMask, edge)) continue
  const g = Board.gain(startMask, edge)
  if (g > 0) continue // 可得分边（属于吃边路径）
  const c = ValueBot.captureClosure(Board.put(startMask, edge))
  const gift = c.claimed.filter(b => target.has(b))
  console.log(`${Board.edgeText(edge)} | gift=${gift.length} [${gift.map(b => Board.boxes[b].label).join(',')}]`)
}
