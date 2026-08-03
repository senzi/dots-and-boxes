<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { MODES, useGameStore } from '../stores/game.js'
import { useSettingsStore } from '../stores/settings.js'
import { AI_LEVELS } from '../engine/ai.js'
import { SIZES, DEFAULT_SIZE } from '../engine/board.js'
import AvatarNamePicker from '../components/AvatarNamePicker.vue'

const router = useRouter()
const game = useGameStore()
const settings = useSettingsStore()

const mode = ref('face')
const aiLevel = ref(settings.defaultAiLevel)
const size = ref(DEFAULT_SIZE)
const p1 = ref({ name: settings.defaultName1, avatar: settings.defaultAvatar1 })
const p2 = ref({ name: settings.defaultName2, avatar: settings.defaultAvatar2 })

const isAi = computed(() => mode.value === 'ai')

// 当前所选尺寸的信息（hero 文案动态化）
const curSize = computed(() => SIZES.find(s => s.id === size.value) || SIZES[0])
const boxesNum = computed(() => curSize.value.grid * curSize.value.grid - 1)

// 未完成对局（退出后缓存保留，主页可继续或放弃）
const hasSave = ref(false)
onMounted(() => { hasSave.value = game.hasSnapshot() })
function resumeGame() {
  const snap = game.loadSnapshot()
  if (snap && game.restore(snap)) router.push('/game')
}
function discardSave() {
  game.clearSnapshot()
  hasSave.value = false
}

// ---- 管理员模式（暗号：连点 10 次"人机对战"） ----
const ADMIN_KEY = 'dnb63_admin_v1'
const DEBUG_KEY = 'dnb63_debug_v1'
const admin = ref(false)
const adminClicks = ref(0)
const debugRecords = ref([])
const copied = ref(false)
onMounted(() => {
  admin.value = localStorage.getItem(ADMIN_KEY) === '1'
  if (admin.value) loadDebug()
})
// 模式卡点击：仅"人机对战"计入暗号计数
function clickMode(id) {
  mode.value = id
  if (id !== 'ai') return
  adminClicks.value++
  if (!admin.value && adminClicks.value >= 10) {
    admin.value = true
    try { localStorage.setItem(ADMIN_KEY, '1') } catch (e) { /* ignore */ }
    loadDebug()
  }
}
function loadDebug() {
  try {
    debugRecords.value = JSON.parse(localStorage.getItem(DEBUG_KEY) || '[]')
  } catch { debugRecords.value = [] }
}
// 组装复盘文本（与 Game.vue 控制台格式一致）
function replayText(rec) {
  const lines = []
  lines.push('==============================================')
  lines.push(`复盘 · 你赢了 ${rec.aiName} L${rec.level}`)
  lines.push(`${rec.boardLabel} · 你 ${rec.score[0]} : AI ${rec.score[1]}`)
  lines.push('落子序列（P0=你 P1=AI，可空棋盘按序重走）:')
  rec.moves.forEach((m, i) => {
    const n = String(i + 1).padStart(3, '0')
    lines.push(`  ${n}. P${m.player} ${m.dir}-${m.r}-${m.c}`)
  })
  lines.push('==============================================')
  return lines.join('\n')
}
async function copyRecord(rec) {
  try {
    await navigator.clipboard.writeText(replayText(rec))
    copied.value = rec.time
    setTimeout(() => { copied.value = false }, 1200)
  } catch (e) { /* 剪贴板不可用 */ }
}
async function copyAll() {
  try {
    const text = debugRecords.value.map((r, i) => `【记录 ${i + 1}】\n${replayText(r)}`).join('\n\n')
    await navigator.clipboard.writeText(text)
    copied.value = 'all'
    setTimeout(() => { copied.value = false }, 1200)
  } catch (e) { /* 剪贴板不可用 */ }
}
function fmtTime(t) {
  const d = new Date(t)
  const p = n => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function start() {
  let players
  if (mode.value === 'ai') {
    const ai = AI_LEVELS.find(l => l.id === aiLevel.value) || AI_LEVELS[0]
    players = [
      { id: 'p1', name: p1.value.name.trim() || '玩家', avatar: p1.value.avatar },
      { id: 'ai', name: ai.name, avatar: settings.defaultAiAvatar }
    ]
  } else {
    players = [
      { id: 'p1', name: p1.value.name.trim() || '玩家 1', avatar: p1.value.avatar },
      { id: 'p2', name: p2.value.name.trim() || '玩家 2', avatar: p2.value.avatar }
    ]
  }
  game.start(mode.value, players, mode.value === 'ai' ? aiLevel.value : 1, size.value)
  router.push('/game')
}
</script>

<template>
  <div class="page fade-up">
    <div class="hero">
      <div class="caption">{{ boxesNum }} · a pencil &amp; paper classic</div>
      <h1 class="display display-mega mt-8">Dots and Boxes</h1>
      <p class="body-md muted mt-8" style="max-width: 520px">
        {{ curSize.grid }}×{{ curSize.grid }} 方格，去掉一个角落，{{ boxesNum }} 个格子。轮流连边，围成方格即得分，多者为胜。
      </p>
    </div>

    <!-- 未完成对局恢复条 -->
    <div v-if="hasSave" class="resume-bar fade-up">
      <div class="col flex-1">
        <span class="body-sm">有一局未完成的对局</span>
        <span class="caption muted" style="text-transform: none; letter-spacing: 0">刷新或退出本局时已自动保存</span>
      </div>
      <button class="btn btn-primary" @click="resumeGame">继续</button>
      <button class="btn btn-text muted" @click="discardSave">放弃</button>
    </div>

    <!-- 模式选择 -->
    <div class="mt-32">
      <div class="caption">选择模式</div>
      <div class="mode-grid mt-16">
        <button
          v-for="m in MODES" :key="m.id"
          class="mode-card"
          :class="{ active: mode === m.id }"
          @click="clickMode(m.id)"
        >
          <span class="display-sm">{{ m.label }}</span>
          <span class="body-sm muted">{{ m.desc }}</span>
        </button>
      </div>
    </div>

    <!-- 管理员模式：调试记录 -->
    <div v-if="admin" class="admin-panel mt-32 fade-up">
      <div class="caption">调试记录（管理员）</div>
      <div class="row gap-12 mt-8" style="justify-content: space-between">
        <span class="body-sm muted">{{ debugRecords.length }} 条 · 自动缓存最近 20 条 · 仅 L4/L5 人类胜</span>
        <button v-if="debugRecords.length" class="btn btn-outline btn-sm" @click="copyAll">
          {{ copied === 'all' ? '已复制' : '全部复制' }}
        </button>
      </div>
      <div v-if="!debugRecords.length" class="card-soft mt-12 p-16">
        <span class="body-sm muted">暂无记录 —— 去赢一局 L4 或 L5，复盘会自动缓存到这里。</span>
      </div>
      <div v-else class="debug-list mt-12">
        <div v-for="rec in debugRecords" :key="rec.time" class="card-soft debug-item">
          <div class="row gap-12" style="align-items: center">
            <span class="body-sm mono">{{ fmtTime(rec.time) }}</span>
            <span class="badge">{{ rec.aiName }} L{{ rec.level }}</span>
            <span class="body-sm muted flex-1">{{ rec.boardLabel }} · 你 {{ rec.score[0] }} : AI {{ rec.score[1] }}</span>
            <button class="btn btn-outline btn-sm" @click="copyRecord(rec)">
              {{ copied === rec.time ? '已复制' : '复制' }}
            </button>
          </div>
          <div class="body-xs mono muted mt-8 debug-moves">{{ rec.moves.map(m => `P${m.player} ${m.dir}-${m.r}-${m.c}`).join(' · ') }}</div>
        </div>
      </div>
    </div>

    <!-- 棋盘尺寸 -->
    <div class="mt-24">
      <div class="caption">棋盘尺寸</div>
      <div class="row gap-12 mt-16">
        <button
          v-for="s in SIZES" :key="s.id"
          class="level-pill"
          :class="{ active: size === s.id }"
          @click="size = s.id"
        >{{ s.label }}</button>
      </div>
      <div v-if="size === 's10'" class="inline-hint mt-8">⚠ 10×10 棋盘较大，AI 思考可能很慢，一局耗时较久。</div>
    </div>

    <!-- 玩家设置 -->
    <div class="mt-32">
      <div class="caption">玩家</div>
      <div class="player-setup mt-16">
        <div class="card-soft player-card">
          <div class="row gap-16">
            <div class="avatar big">{{ p1.avatar }}</div>
            <span class="body-sm muted">点头像换名，或自己输入</span>
          </div>
          <div class="mt-16">
            <AvatarNamePicker v-model:avatar="p1.avatar" v-model:name="p1.name" placeholder="玩家 1 昵称" />
          </div>
        </div>

        <div class="card-soft player-card">
          <div class="row gap-16">
            <div class="avatar big">{{ isAi ? settings.defaultAiAvatar : p2.avatar }}</div>
            <span v-if="!isAi" class="body-sm muted">点头像换名，或自己输入</span>
            <span v-else class="body-sm muted">对手由 AI 扮演，可在设置中修改。</span>
          </div>
          <div v-if="!isAi" class="mt-16">
            <AvatarNamePicker v-model:avatar="p2.avatar" v-model:name="p2.name" placeholder="玩家 2 昵称" />
          </div>
          <div v-else class="mt-16">
            <div class="caption">AI 对手</div>
            <div class="ai-list mt-8">
              <button
                v-for="lv in AI_LEVELS" :key="lv.id"
                class="ai-item"
                :class="{ active: aiLevel === lv.id }"
                @click="aiLevel = lv.id"
              >
                <span class="ai-name">{{ lv.name }}</span>
                <span class="ai-desc">{{ lv.desc }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-32 row gap-16">
      <button class="btn btn-primary btn-lg flex-1" @click="start">开始游戏</button>
      <router-link to="/history" class="btn btn-outline btn-lg">历史</router-link>
      <router-link to="/settings" class="btn btn-outline btn-lg">设置</router-link>
      <router-link to="/lab" class="btn btn-outline btn-lg">实验室</router-link>
    </div>
  </div>
</template>

<style scoped>
.hero { padding-top: 48px; }
.mode-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}
.player-setup {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}
.avatar.big { width: 52px; height: 52px; font-size: 26px; }

/* AI 对手列表（魔兽争霸风格命名 + 战力副标题） */
.ai-list { display: flex; flex-direction: column; gap: 8px; }
.ai-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 10px 14px;
  border: 1px solid var(--hairline-strong);
  border-radius: var(--r-xl);
  background: var(--card);
  text-align: left;
  cursor: pointer;
  transition: border-color .15s, background .15s;
}
.ai-item:hover { border-color: var(--p2); }
.ai-item.active { border-color: var(--p2); background: var(--p2-fill); }
.ai-name { font-weight: 700; font-size: 14px; color: var(--text); }
.ai-desc { font-size: 12px; color: var(--muted); line-height: 1.4; }

/* 内联提示（10×10 慢棋警告） */
.inline-hint {
  font-size: 12px;
  color: #b45309;
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: var(--r-xl);
  padding: 8px 12px;
}

/* 未完成对局恢复条 */
.resume-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
  background: var(--card);
  border: 1px solid var(--hairline-strong);
  border-left: 3px solid var(--p2);
  border-radius: var(--r-xl);
  padding: 14px 18px;
}

@media (max-width: 640px) {
  .hero { padding-top: 16px; }
}

/* 管理员模式：调试记录 */
.admin-panel {
  border: 1px dashed var(--hairline-strong);
  border-radius: var(--r-xl);
  padding: 16px;
  background: rgba(255, 255, 255, 0.02);
}
.debug-item { padding: 12px 14px; }
.debug-moves {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.mono { font-family: var(--font-mono, ui-monospace, Consolas, monospace); }
.flex-1 { flex: 1; min-width: 0; }
.p-16 { padding: 16px; }
.btn-sm { padding: 4px 12px; font-size: 12px; border-radius: 8px; }
</style>
