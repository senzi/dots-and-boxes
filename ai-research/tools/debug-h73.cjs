// 调试：步 13 前开 H-7-3 后，所有可得分边分支
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
const e58 = Board.edges.findIndex(e => e.id === 'H-7-3')
const after = Board.put(mask, e58)
console.log('开 H-7-3 后 3 边格:', Board.boxes.map((b, i) => ({ i, l: b.label, d: Board.bitCount(after & b.mask) })).filter(x => x.d === 3).map(x => x.l).join(',') || 'none')
console.log('--- 可得分边（放下去完成格子）---')
Board.legal(after).forEach(e => {
  const c = Board.claimedBy(after, e)
  if (c.length) console.log(`${Board.edges[e].id} (edge=${e}) 完成 [${c.map(b => Board.boxes[b].label).join(',')}]`)
})
