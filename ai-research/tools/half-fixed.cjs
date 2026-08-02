// 半固定策略验证：我方（先手）固定策略 vs 对手（后手）最优
// node tools/half-fixed.cjs <D63F1...> [first]
const Board = require('../src/board.js')
const Protocol = require('../src/protocol.js')
const Outcome = require('../src/outcome.js')

const code = process.argv[2]
if (!code) { console.error('用法: node tools/half-fixed.cjs <D63F1...>'); process.exit(1) }
const frontier = code.startsWith('D63F1.') ? Protocol.parseBase36(code.slice(6)) : BigInt(code)
const first = Number(process.argv[3] || 0)
const blocks = Outcome.decompose(frontier)
const n = blocks.length

// 我方（first）固定策略；对手自由最优
function halfFixed(myMode) {
  const memo = new Map()
  function rec(i, c) {
    if (i >= n) return [0, 0]
    const key = i + ':' + c
    if (memo.has(key)) return memo.get(key)
    const block = blocks[i]
    const isMine = c === first
    let opts
    if (block.controlCode === 'GAME_END') opts = [{ take: block.value, give: 0, next: c, label: '终局' }]
    else if (block.controlCode === 'KEEP_BY_2' || block.controlCode === 'KEEP_BY_4') {
      if (isMine) opts = myMode === 'keep'
        ? [{ take: block.controlTake, give: block.handout, next: c, label: '保权' }]
        : [{ take: block.value, give: 0, next: 1 - c, label: '全吃翻转' }]
      else opts = [
        { take: block.controlTake, give: block.handout, next: c, label: '保权' },
        { take: block.value, give: 0, next: 1 - c, label: '全吃翻转' }
      ]
    } else if (block.controlCode === 'CHALLENGE_2') {
      if (isMine) opts = myMode === 'keep'
        ? [{ take: 0, give: block.value, next: c, label: '让2保权' }]
        : [{ take: block.value, give: 0, next: 1 - c, label: '吃2翻转' }]
      else opts = [
        { take: block.value, give: 0, next: 1 - c, label: '吃2翻转' },
        { take: 0, give: block.value, next: c, label: '让2保权' }
      ]
    } else opts = [{ take: block.value, give: 0, next: 1 - c, label: '吃光翻转' }]

    let best = null
    for (const opt of opts) {
      const sub = rec(i + 1, opt.next)
      const cTotal = opt.take + (opt.next === c ? sub[0] : sub[1])
      const oppTotal = opt.give + (opt.next === c ? sub[1] : sub[0])
      if (!best || cTotal > best[0]) best = [cTotal, oppTotal]
    }
    memo.set(key, best)
    return best
  }
  return rec(0, first)
}

const names = ['先手', '后手']
console.log(`价值序列: ${blocks.map(b => b.value).join(',')}`)
for (const mode of ['keep', 'flip']) {
  const [a, b] = halfFixed(mode)
  console.log(`我恒${mode === 'keep' ? '保权' : '翻转'} vs 对手最优: ${names[0]} ${a} : ${b} ${names[1]} ${a > b ? '先手胜' : a < b ? '后手胜' : '平'}`)
}
const dp = Outcome.outcome(frontier, first)
console.log(`DP 双方最优:              ${names[0]} ${dp.score[0]} : ${dp.score[1]} ${names[1]} ${dp.winner === -1 ? '平' : dp.winner === first ? '先手胜' : '后手胜'}`)
