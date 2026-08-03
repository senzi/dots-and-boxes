<script setup>
// 复盘实验室：粘贴复盘落子序列 → 自动重放到安全前沿 → 继续交互（人/AI）
import { ref, computed, onMounted } from 'vue'
import Board from '../components/Board.vue'
import { createBoard, placeEdge, scores, setBoardSize, legalMoves } from '../engine/board.js'
import { getAiMove, l3ControlAfterMove } from '../engine/ai.js'
import { stateToMask } from '../engine/l4/l4-bridge.js'
import { getBoard } from '../engine/l4/l4-board.js'

const inputText = ref('')
const size = ref('s6')
const state = ref(null)
const moves = ref([])          // 已加载的落子序列 [{player,dir,r,c}]
const current = ref(0)
const lastMove = ref(null)
const controlOwner = ref(1)
const over = ref(false)
const aiThinking = ref(false)
const frontierMsg = ref('')
const codeText = ref('')
const toast = ref('')

const gridSize = computed(() => size.value === 's6' ? 6 : size.value === 's10' ? 10 : 8)
const boardLabel = computed(() => `${gridSize.value}×${gridSize.value} · ${gridSize.value * gridSize.value - 1} 格`)
const scoreText = computed(() => {
  if (!state.value) return ''
  const [a, b] = scores(state.value)
  return `${a} : ${b}`
})
const statusText = computed(() => {
  if (!state.value) return '未加载'
  if (over.value) return '已结束'
  const p = current.value === 0 ? '玩家0' : '玩家1'
  return `第 ${moves.value.length} 步 · 轮到 ${p}${frontierMsg.value}`
})

// 安全边数（L4 mask）
function safeCount() {
  const board = getBoard(gridSize.value)
  const mask = stateToMask(state.value)
  return board.legal(mask).filter(e => board.danger(mask, e) === 0).length
}

// 解析复盘文本：P0 H-1-2 / P1 V-3-4 行
function parseSequence(text) {
  const out = []
  for (const line of text.split('\n')) {
    const m = line.match(/(P[01])\s+([HV])-(\d+)-(\d+)/)
    if (m) out.push({ player: m[1] === 'P0' ? 0 : 1, dir: m[2], r: Number(m[3]), c: Number(m[4]) })
  }
  return out
}

function load() {
  const seq = parseSequence(inputText.value)
  if (!seq.length) { toast.value = '未解析到落子序列（格式：P0 H-1-2）'; return }
  setBoardSize(size.value)
  const st = createBoard()
  const mv = []
  let cur = seq[0].player
  let last = null
  let ctrl = 1
  let frontierAt = -1
  for (const m of seq) {
    // 每步前检测：已到安全前沿（无安全边）→ 停止重放，留给交互
    const board = getBoard(gridSize.value)
    const mask = stateToMask(st)
    const safe = board.legal(mask).filter(e => board.danger(mask, e) === 0)
    if (safe.length === 0) {
      frontierAt = mv.length
      break
    }
    const res = placeEdge(st, m.dir, m.r, m.c, m.player)
    if (!res.ok) { toast.value = `第 ${mv.length + 1} 步非法（${m.dir}-${m.r}-${m.c}）`; break }
    ctrl = l3ControlAfterMove(st, { dir: m.dir, r: m.r, c: m.c }, m.player, ctrl)
    mv.push(m)
    last = { dir: m.dir, r: m.r, c: m.c, player: m.player }
    cur = res.gained ? m.player : 1 - m.player
  }
  state.value = st
  moves.value = mv
  current.value = cur
  lastMove.value = last
  controlOwner.value = ctrl
  over.value = false
  frontierMsg.value = frontierAt > 0 ? `（安全前沿在第 ${frontierAt} 步）` : ''
  toast.value = `已加载 ${mv.length} 步${frontierAt > 0 ? ` · 前沿 ${frontierAt}` : ''}`
  updateCode()
}

// 落子（用户点击 / AI）
function apply(dir, r, c, player) {
  if (!state.value || over.value || aiThinking.value) return
  const res = placeEdge(state.value, dir, r, c, player)
  if (!res.ok) return
  controlOwner.value = l3ControlAfterMove(state.value, { dir, r, c }, player, controlOwner.value)
  moves.value.push({ player, dir, r, c })
  lastMove.value = { dir, r, c, player }
  current.value = res.gained ? player : 1 - player
  if (isGameOverLocal()) over.value = true
  updateCode()
}
function isGameOverLocal() {
  const [a, b] = scores(state.value)
  return legalMoves(state.value).length === 0
}
function onBoardPlace(move) {
  // 用户手动落子：只能在自己的回合（P0 默认用户）
  if (current.value !== 0) { toast.value = '现在是 AI/玩家1 的回合'; return }
  apply(move.dir, move.r, move.c, 0)
  // 若轮到 AI，自动/手动触发
  if (!over.value && current.value === 1) toast.value = '轮到 AI（点 L4/L5 按钮）'
}
function aiMove(level) {
  if (!state.value || over.value || aiThinking.value) return
  if (current.value !== 1) { toast.value = '现在不是 AI 回合'; return }
  aiThinking.value = true
  setTimeout(() => {
    try {
      const move = getAiMove(level, state.value, 1, lastMove.value, controlOwner.value)
      if (move) apply(move.dir, move.r, move.c, 1)
      else toast.value = 'AI 无子可下'
    } catch (e) {
      toast.value = 'AI 异常: ' + e.message
    } finally {
      aiThinking.value = false
    }
  }, 50)
}

// 局面码：落子序列文本（可读可回贴）+ 状态 JSON（精确恢复）
function updateCode() {
  if (!state.value) { codeText.value = ''; return }
  const seq = moves.value.map(m => `P${m.player} ${m.dir}-${m.r}-${m.c}`).join('\n')
  codeText.value = `${boardLabel.value}\n${seq}\n（当前轮：P${current.value}）`
}
async function copyCode() {
  try {
    await navigator.clipboard.writeText(codeText.value)
    toast.value = '已复制局面码'
  } catch { toast.value = '复制失败' }
}
function copyJson() {
  try {
    const payload = { size: size.value, moves: moves.value.map(m => ({ ...m })) }
    navigator.clipboard.writeText(JSON.stringify(payload))
    toast.value = '已复制 JSON（含尺寸+序列）'
  } catch { toast.value = '复制失败' }
}
function undo() {
  if (!state.value || !moves.value.length) return
  toast.value = '撤销需重放：请编辑序列后重新加载'
}

onMounted(() => setBoardSize(size.value))
</script>

<template>
  <div class="page fade-up">
    <div class="caption">调试工具 · 复盘实验室</div>
    <h1 class="display display-md mt-8">复盘实验室</h1>
    <p class="body-sm muted mt-8" style="max-width: 560px">
      粘贴复盘落子序列（控制台/管理员记录格式 <code>P0 H-1-2</code>），自动重放到安全前沿，之后可继续下（P0=你 · P1=AI）。
    </p>

    <div class="mt-24 row gap-12">
      <select v-model="size" class="lab-input" style="width: 100px">
        <option value="s6">6×6</option>
        <option value="s8">8×8</option>
        <option value="s10">10×10</option>
      </select>
      <button class="btn btn-outline" @click="load">加载序列</button>
      <button class="btn btn-outline" @click="aiMove(4)">L4 下</button>
      <button class="btn btn-outline" @click="aiMove(5)">L5 下</button>
    </div>

    <div class="mt-16">
      <textarea v-model="inputText" rows="6" class="lab-input mono" placeholder="P0 H-0-1&#10;P1 V-0-2&#10;...（复盘记录直接粘贴）" style="width: 100%"></textarea>
    </div>

    <div class="mt-16 row gap-16" style="align-items: flex-start">
      <div class="card-soft p-16" style="flex: 1">
        <div class="row gap-12 mb-8" style="align-items: center; justify-content: space-between">
          <span class="caption">{{ boardLabel }} · {{ statusText }} · 比分 {{ scoreText }}</span>
          <span class="body-sm muted">{{ toast || '就绪' }}</span>
        </div>
        <Board
          v-if="state"
          :board="state"
          :players="[{ avatar: '你' }, { avatar: 'AI' }]"
          :last-move="lastMove"
          :grid-size="gridSize"
          :interactive="true"
          :disabled="over || aiThinking || current !== 0"
          @place="onBoardPlace"
        />
        <div v-else class="lab-empty">加载序列后显示棋盘</div>
      </div>
      <div class="card-soft p-16" style="width: 300px">
        <div class="caption">局面码</div>
        <div class="row gap-8 mt-8">
          <button class="btn btn-outline btn-sm" @click="copyCode">复制序列</button>
          <button class="btn btn-outline btn-sm" @click="copyJson">复制 JSON</button>
        </div>
        <pre class="lab-code mono mt-8">{{ codeText }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lab-input {
  background: var(--card);
  border: 1px solid var(--hairline-strong);
  border-radius: 10px;
  color: var(--text);
  padding: 8px 12px;
  font-size: 14px;
}
.lab-empty {
  height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  border: 1px dashed var(--hairline-strong);
  border-radius: var(--r-xl);
}
.lab-code {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--hairline-strong);
  border-radius: 8px;
  padding: 10px;
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 360px;
  overflow: auto;
  color: var(--text);
}
.mono { font-family: var(--font-mono, ui-monospace, Consolas, monospace); }
.mb-8 { margin-bottom: 8px; }
</style>
