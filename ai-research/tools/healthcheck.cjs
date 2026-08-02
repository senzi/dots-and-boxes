// 多 seed 体检：价值块标记稳定性 + exact=0 检查 + 性能
// 用法：node tools/healthcheck.cjs [seedCount]
const Board = require('../src/board.js')
const Frontier = require('../src/frontier.js')
const ValueBot = require('../src/value-bot.js')
const Protocol = require('../src/protocol.js')

const count = Number(process.argv[2] || 10)
let exact0Blocks = 0
let totalBlocks = 0
let totalMs = 0
let worstMs = 0
let handoutHistogram = { 0: 0, 2: 0, 4: 0 }
let controlHistogram = {}
const failures = []

for (let seed = 1; seed <= count; seed++) {
  const frontier = Frontier.generate(seed)
  const valid = Frontier.validate(frontier)
  if (!valid.ok) { failures.push(`seed ${seed}: frontier invalid ${valid.error}`); continue }
  const state = ValueBot.create(frontier, { handoutNodeLimit: 30000 })
  let guard = 0
  while (!state.complete && guard++ < 63) ValueBot.next(state)
  if (!state.complete) { failures.push(`seed ${seed}: bot did not finish`); continue }
  if (state.mask !== Board.FULL_MASK) { failures.push(`seed ${seed}: mask incomplete`); continue }
  for (const block of state.blocks) {
    totalBlocks++
    totalMs += block.computeMs
    worstMs = Math.max(worstMs, block.computeMs)
    handoutHistogram[block.handout] = (handoutHistogram[block.handout] || 0) + 1
    controlHistogram[block.controlCode] = (controlHistogram[block.controlCode] || 0) + 1
    if (!block.handoutExact) exact0Blocks++
  }
}

console.log(JSON.stringify({
  seeds: count,
  failures,
  totalBlocks,
  avgMs: (totalMs / totalBlocks).toFixed(1),
  worstMs,
  exact0Blocks,
  handoutHistogram,
  controlHistogram
}, null, 2))
