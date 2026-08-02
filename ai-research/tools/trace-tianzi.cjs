// 打印每块 boxes + 追踪 N 田字 (D7,E7,D8,E8) 何时独立
const Board = require('../src/board.js')
const ValueBot = require('../src/value-bot.js')
const Protocol = require('../src/protocol.js')

const code = 'D63V1.1s9cwvrwna300sdjs3y3r0jewcan.1doqxe.e.6-7-w-1y-8-u-1h-17-a-y-c-n-1b-1m'
const dec = Protocol.decodeValueCode(code)
const state = ValueBot.create(dec.frontier, { handoutNodeLimit: 30000 })
const target = ['D7', 'E7', 'D8', 'E8'].map(label => Board.boxes.findIndex(b => b.label === label))

while (!state.complete) {
  const chosen = ValueBot.next(state)
  if (!chosen) break
  const boxesLabel = chosen.boxes.map(b => Board.boxes[b].label).join(',')
  const containsTarget = chosen.boxes.some(b => target.includes(b))
  console.log(`块${state.blocks.length} ${chosen.label} 值${chosen.value} 让${chosen.handout} [${boxesLabel}]${containsTarget ? ' <== 含目标田字格子' : ''}`)
}
// 最终目标格子归属
console.log('--- 目标格子最终归属 ---')
target.forEach(t => console.log(`${Board.boxes[t].label} -> 块${state.boxBlock[t]}`))
