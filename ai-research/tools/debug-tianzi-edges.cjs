// 步 13 时，N 田字 (D7,E7,D8,E8) 所有边的开边闭包（最小闭包）
const Board = require('../src/board.js')
const ValueBot = require('../src/value-bot.js')
const Protocol = require('../src/protocol.js')

const code = 'D63V1.1s9cwvrwna300sdjs3y3r0jewcan.1doqxe.e.6-7-w-1y-8-u-1h-17-a-y-c-n-1b-1m'
const dec = Protocol.decodeValueCode(code)
const blocks = []
{
  const s = ValueBot.create(dec.frontier)
  while (blocks.length < 12) blocks.push(ValueBot.next(s))
}
const mask = ValueBot.snapshotAt(dec.frontier, blocks, 12).mask
const tianzi = ['D7', 'E7', 'D8', 'E8'].map(label => Board.boxes.findIndex(b => b.label === label))
const edges = new Set(tianzi.flatMap(b => Board.boxes[b].edges))
console.log('--- 各边状态与开边最小闭包 ---')
for (const e of [...edges].sort((a, b) => a - b)) {
  const filled = Board.has(mask, e)
  if (filled) { console.log(`${Board.edges[e].id} (edge=${e}) 已填`); continue }
  const a = ValueBot.openingAnalysis(mask, e)
  console.log(`${Board.edges[e].id} (edge=${e}) -> 闭包价值 ${a.value} [${a.boxes.map(b => Board.boxes[b].label).join(',')}]`)
}
