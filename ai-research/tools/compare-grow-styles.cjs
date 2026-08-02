// 验证"贴上一手"（L4 策略）是否造大龙：贴边 vs 纯随机 → 前沿结构对比
// 指标：值4块数（田字/小团）、终局块大小、块总数
// node tools/compare-grow-styles.cjs [局数]
const Board = require('../src/board.js')
const Frontier = require('../src/frontier.js')
const Outcome = require('../src/outcome.js')

const count = Number(process.argv[2] || 500)
const seedBase = Number(process.argv[3] || 70000)

// 纯随机安全边生长
function growRandom(seed) {
  const rng = Frontier.mulberry32(seed)
  let mask = 0n
  while (true) {
    const safe = Board.legal(mask).filter(i => Board.danger(mask, i) === 0)
    if (!safe.length) return mask
    mask = Board.put(mask, safe[Math.floor(rng() * safe.length)])
  }
}

function analyze(mask) {
  const pred = Outcome.outcome(mask, 1)
  const values = pred.blocks.map(b => b.value)
  return {
    blocks: values.length,
    v1: values.filter(v => v === 1).length,
    v2: values.filter(v => v === 2).length,
    v4: values.filter(v => v === 4).length,
    bigs: values.filter(v => v > 4).length,
    terminal: values[values.length - 1],
    max: Math.max(...values)
  }
}

const styles = { 贴边: growRandom, 纯随机: growRandom }
// 贴边 = Frontier.generate（内置贴上一手）
const stick = []
const rand = []
for (let i = 0; i < count; i++) {
  const seed = seedBase + i
  stick.push(analyze(Frontier.generate(seed)))
  rand.push(analyze(growRandom(seed + 12345)))
}
const avg = arr => arr.reduce((s, v) => s + v, 0) / arr.length
console.log(`=== 贴上一手（L4）vs 纯随机生长（${count} 局） ===`)
console.log('指标 | 贴上一手 | 纯随机')
for (const key of ['blocks', 'v1', 'v2', 'v4', 'bigs', 'terminal', 'max']) {
  console.log(`  ${key.padEnd(9)} | ${avg(stick.map(a => a[key])).toFixed(2)} | ${avg(rand.map(a => a[key])).toFixed(2)}`)
}
console.log(`\n（v4=田字/小团块数，terminal=终局块大小，max=最大块）`)
