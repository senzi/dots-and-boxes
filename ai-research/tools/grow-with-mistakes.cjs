// 从任意局面生长到极大安全前沿 + 注入对手失误（概率模型）
// 失误模型（用户）：每步失误概率递减，一局累计 5 次 ≤1% —— 用泊松 λ=0.5 近似
// 失误动作：下一条"制造三边格"的危险边 → 对方连锁吃完（级联吃格）→ 回到安全局面
// node tools/grow-with-mistakes.cjs [局数] [lambda] [起始seed]
const Board = require('../src/board.js')
const Frontier = require('../src/frontier.js')
const Outcome = require('../src/outcome.js')

const count = Number(process.argv[2] || 2000)
const lambda = Number(process.argv[3] || 0.5)
const seedBase = Number(process.argv[4] || 50000)

// 泊松分布采样（每局失误次数）
function poisson(rng, lam) {
  const L = Math.exp(-lam)
  let k = 0, p = 1
  do { k++; p *= rng() } while (p > L)
  return k - 1
}

// 连锁吃完：循环填三边格的第 4 边，score[current] 累计
function eatCascade(mask, score, current) {
  let loop = 0
  while (loop < 100) {
    loop++
    let ate = false
    for (const box of Board.boxes) {
      if (Board.degrees(mask)[box.index] === 3) {
        const missing = box.edges.find(i => !Board.has(mask, i))
        if (missing === undefined) continue
        mask = Board.put(mask, missing)
        score[current] += 1
        ate = true
        break
      }
    }
    if (!ate) break
  }
  return mask
}

function grow(seed, N, startMask = 0n) {
  const rng = Frontier.mulberry32(seed ^ 0x9e3779b9)
  let mask = startMask
  const score = [0, 0]
  let current = 0
  let mistakes = 0
  let steps = 0
  while (true) {
    const legal = Board.legal(mask)
    const safe = legal.filter(i => Board.danger(mask, i) === 0 && Board.gain(mask, i) === 0)
    if (!safe.length) break
    // 失误机会：还有配额 + 有危险边（制造三边格）
    const dangerEdges = legal.filter(i => Board.danger(mask, i) > 0 && Board.gain(mask, i) === 0)
    if (mistakes < N && dangerEdges.length) {
      picked = dangerEdges[Math.floor(rng() * dangerEdges.length)]
      mask = Board.put(mask, picked)
      mask = eatCascade(mask, score, 1 - current) // 对方连锁吃完
      mistakes++
      steps++
      current = 1 - current
      continue
    }
    picked = safe[Math.floor(rng() * safe.length)]
    mask = Board.put(mask, picked)
    steps++
    current = 1 - current
  }
  return { mask, score, steps, mistakes }
}

console.log(`=== 失误概率生长（${count} 局 · 泊松 λ=${lambda}） ===`)
const dist = {}
let totalSteps = 0, totalBenefit = 0
for (let i = 0; i < count; i++) {
  const seed = seedBase + i
  const N = poisson(Frontier.mulberry32(seed), lambda)
  const r = grow(seed, N)
  const key = r.mistakes > 5 ? '5+' : String(r.mistakes)
  if (!dist[key]) dist[key] = { n: 0, steps: 0, benefit: 0, lose: 0, win: 0 }
  dist[key].n++
  dist[key].steps += r.steps
  dist[key].benefit += r.score[0] + r.score[1]
  const pred = Outcome.outcome(r.mask, 1)
  if (pred.score[0] > pred.score[1]) dist[key].win++
  else dist[key].lose++
  totalSteps += r.steps
  totalBenefit += r.score[0] + r.score[1]
}
console.log(`平均步数: ${(totalSteps / count).toFixed(1)} · 失误总受益 ${totalBenefit} 格（均值 ${(totalBenefit / count).toFixed(2)}）`)
console.log(`\n失误次数分布 → 主视角(先开块)胜率:`)
console.log('  失误 | 局数 | 占比 | 平均步数 | 失误受益/局 | 主视角胜率')
for (const [k, v] of Object.entries(dist)) {
  console.log(`  ${k.padEnd(4)} | ${String(v.n).padStart(5)} | ${(v.n / count * 100).toFixed(1)}% | ${(v.steps / v.n).toFixed(1)} | ${(v.benefit / v.n).toFixed(2)} | ${(v.win / v.n * 100).toFixed(1)}%`)
}
