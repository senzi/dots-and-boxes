// 查新盘面 block F（值2 CHALLENGE_2）的 handout 搜索
const Board = require('../src/board.js')
const ValueBot = require('../src/value-bot.js')
const Protocol = require('../src/protocol.js')

const code = 'D63V1.3juxpwvsxcihyqr2bilhlpg87kat.1h16g19.6.8-1-6-x-4-m'
const dec = Protocol.decodeValueCode(code)
const state = ValueBot.create(dec.frontier, { handoutNodeLimit: 30000 })
while (state.blocks.length < dec.step) ValueBot.next(state)
const block = state.blocks[dec.step - 1]
console.log('block:', block.label, 'value:', block.value, 'handout:', block.handout, 'control:', block.controlCode)
console.log('boxes:', block.boxes.map(b => Board.boxes[b].label).join(','))

// 手动跑 findStandardHandout
const startMask = Board.put(dec.frontier, block.openingEdge)
const h = ValueBot.findStandardHandout(startMask, block.boxes, 30000)
console.log('findStandardHandout → gift:', h.gift, 'edge:', h.edge == null ? 'null(开边即让)' : Board.edges[h.edge].id, 'exact:', h.exact)

// 开边后 3 边格（active）与直接闭包
const degrees = Board.degrees(startMask)
const active = block.boxes.filter(b => degrees[b] === 3)
console.log('开边后 active(3边格):', active.map(b => Board.boxes[b].label).join(',') || 'none')
const direct = ValueBot.captureClosure(startMask)
console.log('直接闭包:', direct.claimed.map(b => Board.boxes[b].label).join(','), 'count:', direct.claimed.length)
