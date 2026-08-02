// 检查每一步选择时：实际选择的块 vs 当时所有候选块的最小值
const Board = require('../src/board.js')
const ValueBot = require('../src/value-bot.js')
const Protocol = require('../src/protocol.js')

const code = 'D63V1.1s9cwvrwna300sdjs3y3r0jewcan.1doqxe.e.6-7-w-1y-8-u-1h-17-a-y-c-n-1b-1m'
const dec = Protocol.decodeValueCode(code)
const state = ValueBot.create(dec.frontier, { handoutNodeLimit: 30000 })

let guard = 0
while (!state.complete && guard++ < 63) {
  const before = state.mask
  // 手动枚举当前所有候选块
  const groups = ValueBot.enumerateValueBlocks(before)
  const minValue = groups.length ? groups[0].value : null
  const chosen = ValueBot.next(state)
  if (!chosen) break
  const minGroups = groups.filter(g => g.value === groups[0].value)
  const chosenGroupIsMin = groups.findIndex(g => g.openings.some(o => o.edge === chosen.openingEdge)) === 0
  const flag = !chosenGroupIsMin ? '  <-- 未选最小价值组!' : ''
  console.log(`步${String(state.blocks.length).padStart(2)} 选 ${chosen.label} 值${chosen.value} | 当时最小候选值=${minValue} (共${groups.length}组)${flag}`)
}
