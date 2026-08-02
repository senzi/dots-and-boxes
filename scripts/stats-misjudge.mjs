// 判断器的乐观/悲观偏差统计
// 正常局（判断正确）：主视角胜率
// 例外局（判断错误）：乐观（预测赢实际输）vs 悲观（预测输实际赢）比例
import fs from 'node:fs'
import path from 'node:path'

const file = process.argv[2] || path.resolve('ai-research/explore/data/losing-batch.jsonl')
const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))

function finalCtrl(r) {
  let c = 1
  for (const s of r.valueSeq) {
    const choice = s.split('/')[1] || ''
    if (choice.includes('翻转')) c = 1 - c
  }
  return c
}

let correct = 0, optimistic = 0, pessimistic = 0
let correctWin = 0, correctLose = 0
for (const r of rows) {
  const fc = finalCtrl(r)
  const predWin = fc === 0
  const actualWin = r.result === 'win'
  if (predWin === actualWin) {
    correct++
    if (actualWin) correctWin++
    else correctLose++
  } else {
    if (predWin && !actualWin) optimistic++ // 判断器说赢，实际输
    else pessimistic++ // 判断器说输，实际赢
  }
}

console.log(`=== 判断器偏差统计（${rows.length} 局） ===`)
console.log(`判断正确 ${correct}（${(correct / rows.length * 100).toFixed(1)}%）· 其中主视角胜率 ${(correctWin / correct * 100).toFixed(1)}%（${correctWin}胜/${correctLose}负）`)
console.log(`判断错误 ${optimistic + pessimistic}（${((optimistic + pessimistic) / rows.length * 100).toFixed(2)}%）`)
console.log(`  乐观（判断赢·实际输）: ${optimistic} 局（${(optimistic / (optimistic + pessimistic) * 100).toFixed(1)}%）`)
console.log(`  悲观（判断输·实际赢）: ${pessimistic} 局（${(pessimistic / (optimistic + pessimistic) * 100).toFixed(1)}%）`)
console.log(`  净偏差：判断器整体偏${optimistic > pessimistic ? '乐观（爱说你会赢）' : '悲观（爱说你会输）'}`)
