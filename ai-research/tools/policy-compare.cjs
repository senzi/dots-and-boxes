// 策略对比：恒保权 vs DP 最优
// node tools/policy-compare.cjs <D63F1...> [first]
const Board = require('../src/board.js')
const Protocol = require('../src/protocol.js')
const Outcome = require('../src/outcome.js')

const code = process.argv[2]
if (!code) { console.error('用法: node tools/policy-compare.cjs <D63F1...> [first]'); process.exit(1) }
const frontier = code.startsWith('D63F1.') ? Protocol.parseBase36(code.slice(6)) : BigInt(code)
const first = Number(process.argv[3] || 0)

const blocks = Outcome.decompose(frontier)
const names = ['先手', '后手']

function fixedOutcome(mode) {
  let control = first
  const score = [0, 0]
  const choices = []
  for (const block of blocks) {
    if (block.controlCode === 'GAME_END') { score[control] += block.value; choices.push(`${block.label}终局`); break }
    if (block.controlCode === 'KEEP_BY_2' || block.controlCode === 'KEEP_BY_4') {
      if (mode === 'keep') { score[control] += block.controlTake; score[1 - control] += block.handout; choices.push(`${block.label}保权`) }
      else { score[control] += block.value; control = 1 - control; choices.push(`${block.label}全吃翻转`) }
    } else if (block.controlCode === 'CHALLENGE_2') {
      if (mode === 'keep') { score[1 - control] += block.value; choices.push(`${block.label}让2保权`) }
      else { score[control] += block.value; control = 1 - control; choices.push(`${block.label}吃2翻转`) }
    } else { score[control] += block.value; control = 1 - control; choices.push(`${block.label}吃光翻转`) }
  }
  return { score, choices }
}

const dp = Outcome.outcome(frontier, first)
const keep = fixedOutcome('keep')
const flip = fixedOutcome('flip')

console.log(`价值序列: ${blocks.map(b => b.value).join(',')}`)
console.log(`DP 最优:    ${names[0]} ${dp.score[0]} : ${dp.score[1]} ${names[1]} ${dp.winner === -1 ? '平' : (dp.winner === first ? '→ 先手胜' : '→ 后手胜')}`)
console.log(`恒保权策略: ${names[0]} ${keep.score[0]} : ${keep.score[1]} ${names[1]} ${keep.score[0] > keep.score[1] ? '→ 先手胜' : '→ 后手胜'}`)
console.log(`恒翻转策略: ${names[0]} ${flip.score[0]} : ${flip.score[1]} ${names[1]} ${flip.score[0] > flip.score[1] ? '→ 先手胜' : '→ 后手胜'}`)
