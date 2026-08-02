// 探索 1：安全前沿生成器评估（8×8）
//  - 生成 N 个随机安全前沿：边数分布、完成格占比
//  - 单局面存储空间估算
//  - 穷举安全前沿搜索空间数量级估计
// node tools/frontier-distribution.cjs [N]
const Board = require('../src/board.js')
const Frontier = require('../src/frontier.js')

const N = Number(process.argv[2] || 2000)
const filled = []
let completedBoxes = 0
let withCompleted = 0

for (let seed = 1; seed <= N; seed++) {
  const mask = Frontier.generate(seed)
  filled.push(Board.bitCount(mask))
  const degrees = Board.degrees(mask)
  const done = degrees.filter(d => d === 4).length
  completedBoxes += done
  if (done > 0) withCompleted++
}

filled.sort((a, b) => a - b)
const sum = filled.reduce((s, v) => s + v, 0)
const avg = sum / N
const min = filled[0]
const max = filled[N - 1]
const median = filled[Math.floor(N / 2)]

// 直方图（10 桶）
const bucketSize = Math.max(1, Math.ceil((max - min) / 10))
const buckets = new Map()
for (const v of filled) {
  const b = Math.floor((v - min) / bucketSize)
  buckets.set(b, (buckets.get(b) || 0) + 1)
}

console.log(`=== 安全前沿生成器评估（8×8，${N} 个随机前沿） ===`)
console.log(`\n已填边数分布：`)
console.log(`  min=${min}  median=${median}  avg=${avg.toFixed(1)}  max=${max}  (总边 142)`)
console.log(`  剩余边数: ${142 - max} ~ ${142 - min}`)
console.log(`直方图（每桶宽 ${bucketSize}）:`)
for (const [b, count] of [...buckets.entries()].sort((a, b2) => a[0] - b2[0])) {
  const bar = '#'.repeat(Math.round(count / N * 60))
  console.log(`  ${String(min + b * bucketSize).padStart(3)}-${String(min + (b + 1) * bucketSize - 1).padStart(3)}: ${String(count).padStart(4)} ${bar}`)
}

console.log(`\n完成格（4 边全填，属已得分）:`)
console.log(`  平均每局面 ${(completedBoxes / N).toFixed(2)} 个，含完成格局面占比 ${(withCompleted / N * 100).toFixed(1)}%`)

// 存储空间
console.log(`\n=== 单局面存储空间 ===`)
console.log(`  mask（BigInt）: 142 bit = ${(142 / 8).toFixed(1)} 字节`)
console.log(`  base36 码（D63F1.xxx）: ~${Math.ceil(142 / Math.log2(36))} 字符`)
console.log(`  边索引列表（0-141）: ${Math.ceil(avg)} × 1 字节 ≈ ${Math.ceil(avg)} 字节`)
console.log(`  100 万个前沿（mask 存储）≈ ${(1e6 * 18 / 1024 / 1024).toFixed(1)} MB`)

// 穷举空间估计
console.log(`\n=== 8×8 穷举安全前沿搜索空间估计 ===`)
console.log(`上界模型（每格独立选 2 of 4 边）: 6^63 ≈ 1e${(63 * Math.log10(6)).toFixed(0)}`)
console.log(`经验边数模型: 平均已填 ${avg.toFixed(0)} 边，剩余 ${(142 - avg).toFixed(0)} 边`)
const cUpper = 142 - avg
console.log(`  （粗略）剩余边自由组合: 2^${cUpper.toFixed(0)} ≈ 1e${(cUpper * Math.log10(2)).toFixed(1)} —— 未计约束`)
console.log(`结论: 安全前沿空间至少 1e20 量级（边共享约束下），远大于可枚举范围；`)
console.log(`     快速预测不能靠"查表穷举"，必须靠价值块分解 + DP（outcome.js 路线）`)
