// 关键验证：M 消解前（步 13 前），开 N 田字开边 H-7-3 (edge=58) 的闭包吃几格？
const Board = require('../src/board.js')
const ValueBot = require('../src/value-bot.js')
const Protocol = require('../src/protocol.js')

const code = 'D63V1.1s9cwvrwna300sdjs3y3r0jewcan.1doqxe.e.6-7-w-1y-8-u-1h-17-a-y-c-n-1b-1m'
const dec = Protocol.decodeValueCode(code)

// 重放到步 13 前（前 12 块消解）
const before13 = ValueBot.snapshotAt(dec.frontier, (() => {
  const s = ValueBot.create(dec.frontier)
  const blocks = []
  while (blocks.length < 12) blocks.push(ValueBot.next(s))
  return blocks
})(), 12)
const mask13 = before13.mask
console.log('步13前剩余可开边:', Board.legal(mask13).length)

// 枚举所有价值组
const groups = ValueBot.enumerateValueBlocks(mask13)
console.log('候选组数:', groups.length)
groups.forEach(g => {
  console.log(`  值${g.value} 格子[${g.boxes.map(b => Board.boxes[b].label).join(',')}] 开边[${g.openings.map(o => o.edge + ':' + Board.edges[o.edge].id).join(',')}]`)
})

// 直接试：开 H-7-3 (edge=58) 的闭包
const edge58 = Board.edges.findIndex(e => e.id === 'H-7-3')
console.log('--- 试开 H-7-3 (edge ' + edge58 + ') ---')
const trial = ValueBot.openingAnalysis(mask13, edge58)
console.log('闭包吃格:', trial.boxes.map(b => Board.boxes[b].label).join(','), '| 价值:', trial.value)
console.log('吃边:', trial.captureMoves.map(e => Board.edges[e].id).join(','))
