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
let toastTimer = null
function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2500)
}

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
  const p = current.value === 0 ? 'P0(你)' : 'P1(AI)'
  return `第 ${moves.value.length} 步 · 轮到 ${p}${frontierMsg.value}`
})

function safeCount() {
  const board = getBoard(gridSize.value)
  const mask = stateToMask(state.value)
  return board.legal(mask).filter(e => board.danger(mask, e) === 0).length
}

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
  if (!seq.length) { showToast('未解析到落子序列（格式：P0 H-1-2）'); return }
  setBoardSize(size.value)
  const st = createBoard()
  const mv = []
  let cur = seq[0].player
  let last = null
  let ctrl = 1
  let frontierAt = -1
  for (const m of seq) {
    const board = getBoard(gridSize.value)
    const mask = stateToMask(st)
    const safe = board.legal(mask).filter(e => board.danger(mask, e) === 0)
    if (safe.length === 0) {
      frontierAt = mv.length
      break
    }
    const res = placeEdge(st, m.dir, m.r, m.c, m.player)
    if (!res.ok) { showToast(`第 ${mv.length + 1} 步非法（${m.dir}-${m.r}-${m.c}）`); break }
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
  frontierMsg.value = frontierAt > 0 ? ` · 安全前沿在第 ${frontierAt} 步` : ''
  showToast(`已加载 ${mv.length} 步${frontierAt > 0 ? `，停在安全前沿（轮到 P${cur}）` : ''}`)
  updateCode()
}

function apply(dir, r, c, player) {
  if (!state.value || over.value || aiThinking.value) return false
  const res = placeEdge(state.value, dir, r, c, player)
  if (!res.ok) return false
  controlOwner.value = l3ControlAfterMove(state.value, { dir, r, c }, player, controlOwner.value)
  moves.value.push({ player, dir, r, c })
  lastMove.value = { dir, r, c, player }
  current.value = res.gained ? player : 1 - player
  if (legalMoves(state.value).length === 0) over.value = true
  updateCode()
  return true
}
function onBoardPlace(move) {
  if (current.value !== 0) { showToast('现在是 P1(AI) 回合，点右侧 L4/L5 按钮'); return }
  if (apply(move.dir, move.r, move.c, 0)) {
    if (current.value === 0) showToast('吃格连击，继续你的回合')
    else showToast('轮到 P1(AI) —— 点右侧按钮')
  }
}
function aiMove(level) {
  if (!state.value || over.value) { showToast('先加载序列'); return }
  if (aiThinking.value) { showToast('AI 思考中…'); return }
  if (current.value !== 1) { showToast(`现在不是 AI 回合（轮到 P${current.value}）——先下你的子`); return }
  aiThinking.value = true
  showToast(`L${level} 思考中…`)
  setTimeout(() => {
    try {
      const move = getAiMove(level, state.value, 1, lastMove.value, controlOwner.value)
      if (move) {
        apply(move.dir, move.r, move.c, 1)
        showToast(`L${level} 下了 ${move.dir}-${move.r}-${move.c}${current.value === 1 ? '，连击继续' : '，轮到你'}`)
      } else showToast('AI 无子可下')
    } catch (e) {
      showToast('AI 异常: ' + e.message)
      console.error('aiMove error', e)
    } finally {
      aiThinking.value = false
    }
  }, 30)
}

function updateCode() {
  if (!state.value) { codeText.value = ''; return }
  const seq = moves.value.map(m => `P${m.player} ${m.dir}-${m.r}-${m.c}`).join('\n')
  codeText.value = `${boardLabel.value}\n${seq}\n（当前轮：P${current.value}）`
}
async function copyCode() {
  try {
    await navigator.clipboard.writeText(codeText.value)
    showToast('已复制局面码')
  } catch { showToast('复制失败') }
}
function copyJson() {
  try {
    const payload = { size: size.value, moves: moves.value.map(m => ({ ...m })) }
    navigator.clipboard.writeText(JSON.stringify(payload))
    showToast('已复制 JSON（尺寸+序列）')
  } catch { showToast('复制失败') }
}

onMounted(() => setBoardSize(size.value))
</script>

<template>
  <div class="page fade-up">
    <div class="caption">调试工具 · 复盘实验室</div>
    <h1 class="display display-md mt-8">复盘实验室</h1>
    <p class="body-sm muted mt-8" style="max-width: 560px">
      粘贴复盘序列 → 自动停在安全前沿 → 右侧继续下（P0=你点击 · P1=L4/L5）。
    </p>

    <div class="lab-layout mt-24">
      <!-- 左：棋盘 -->
      <div class="card-soft p-16 lab-board-col">
        <div class="row gap-12 mb-8" style="align-items: center; justify-content: space-between">
          <span class="caption">{{ boardLabel }} · {{ statusText }}</span>
          <span class="caption">比分 {{ scoreText }}</span>
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

      <!-- 右：控制栏 -->
      <div class="card-soft p-16 lab-side">
        <div class="caption">控制</div>
        <div class="mt-8 row gap-8">
          <select v-model="size" class="lab-input">
            <option value="s6">6×6</option>
            <option value="s8">8×8</option>
            <option value="s10">10×10</option>
          </select>
          <button class="btn btn-primary btn-sm" @click="load">加载序列</button>
        </div>

        <div class="caption mt-16">序列输入（粘贴复盘）</div>
        <textarea v-model="inputText" rows="7" class="lab-input mono mt-8" placeholder="P0 H-0-1&#10;P1 V-0-2&#10;..."></textarea>

        <div class="caption mt-16">AI 行动（P1 回合）</div>
        <div class="row gap-8 mt-8">
          <button class="btn btn-outline btn-sm" :disabled="aiThinking" @click="aiMove(4)">L4 下</button>
          <button class="btn btn-outline btn-sm" :disabled="aiThinking" @click="aiMove(5)">L5 下</button>
        </div>

        <div class="caption mt-16">局面码</div>
        <div class="row gap-8 mt-8">
          <button class="btn btn-outline btn-sm" @click="copyCode">复制序列</button>
          <button class="btn btn-outline btn-sm" @click="copyJson">复制 JSON</button>
        </div>
        <pre class="lab-code mono mt-8">{{ codeText }}</pre>

        <div class="body-sm mt-12 lab-toast" :class="{ 'lab-toast-on': toast }">{{ toast || '就绪' }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lab-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.lab-board-col { flex: 1; min-width: 0; }
.lab-side { width: 340px; flex-shrink: 0; }
.lab-input {
  background: var(--card);
  border: 1px solid var(--hairline-strong);
  border-radius: 10px;
  color: var(--text);
  padding: 8px 12px;
  font-size: 14px;
  width: 100%;
  box-sizing: border-box;
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
  max-height: 220px;
  overflow: auto;
  color: var(--text);
}
.lab-toast {
  min-height: 20px;
  color: var(--muted);
}
.lab-toast-on {
  color: #f59e0b;
  font-weight: 600;
}
.mono { font-family: var(--font-mono, ui-monospace, Consolas, monospace); }
.mb-8 { margin-bottom: 8px; }
.btn-sm { padding: 4px 12px; font-size: 12px; border-radius: 8px; }

@media (max-width: 900px) {
  .lab-layout { flex-direction: column; }
  .lab-side { width: 100%; }
}
</style>
