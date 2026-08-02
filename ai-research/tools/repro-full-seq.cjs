// 复现调试包 2 的全盘价值块序列
const Board = require('../src/board.js')
const ValueBot = require('../src/value-bot.js')
const Protocol = require('../src/protocol.js')

const code = 'D63V1.1s9cwvrwna300sdjs3y3r0jewcan.1doqxe.e.6-7-w-1y-8-u-1h-17-a-y-c-n-1b-1m'
const dec = Protocol.decodeValueCode(code)
const state = ValueBot.create(dec.frontier, { handoutNodeLimit: 30000 })
while (!state.complete) ValueBot.next(state)
console.log('总块数:', state.blocks.length)
state.blocks.forEach((block, i) => {
  const keep = block.controlCode.startsWith('KEEP') ? `保权(净吃${block.controlTake})` : '不保权'
  console.log(`${String(i + 1).padStart(2)} ${block.label} 值${block.value} 让${block.handout} ${block.controlCode} ${keep} | ${Board.edgeText(block.openingEdge).split('|')[0]}`)
})
