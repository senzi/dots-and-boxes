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
          @click="mode = m.id"
        >
          <span class="display-sm">{{ m.label }}</span>
          <span class="body-sm muted">{{ m.desc }}</span>
        </button>
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
</style>
