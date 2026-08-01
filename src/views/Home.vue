<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { MODES, useGameStore } from '../stores/game.js'
import { useSettingsStore } from '../stores/settings.js'
import { AI_LEVELS } from '../engine/ai.js'
import AvatarNamePicker from '../components/AvatarNamePicker.vue'

const router = useRouter()
const game = useGameStore()
const settings = useSettingsStore()

const mode = ref('face')
const aiLevel = ref(settings.defaultAiLevel)
const p1 = ref({ name: settings.defaultName1, avatar: settings.defaultAvatar1 })
const p2 = ref({ name: settings.defaultName2, avatar: settings.defaultAvatar2 })

const isAi = computed(() => mode.value === 'ai')

function start() {
  let players
  if (mode.value === 'ai') {
    players = [
      { id: 'p1', name: p1.value.name.trim() || '玩家', avatar: p1.value.avatar },
      { id: 'ai', name: settings.defaultAiName, avatar: settings.defaultAiAvatar }
    ]
  } else {
    players = [
      { id: 'p1', name: p1.value.name.trim() || '玩家 1', avatar: p1.value.avatar },
      { id: 'p2', name: p2.value.name.trim() || '玩家 2', avatar: p2.value.avatar }
    ]
  }
  game.start(mode.value, players, mode.value === 'ai' ? aiLevel.value : 1)
  router.push('/game')
}
</script>

<template>
  <div class="page fade-up">
    <div class="hero">
      <div class="caption">63 · a pencil &amp; paper classic</div>
      <h1 class="display display-mega mt-8">Dots and Boxes</h1>
      <p class="body-md muted mt-8" style="max-width: 520px">
        8×8 点阵，去掉一个角落，63 个格子。轮流连边，围成方格即得分，多者为胜。
      </p>
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

    <!-- AI 难度 -->
    <div v-if="isAi" class="mt-24 fade-up">
      <div class="caption">AI 难度</div>
      <div class="row gap-12 mt-16">
        <button
          v-for="lv in AI_LEVELS" :key="lv.id"
          class="level-pill"
          :class="{ active: aiLevel === lv.id }"
          @click="aiLevel = lv.id"
        >{{ lv.name }} · {{ lv.desc }}</button>
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

@media (max-width: 640px) {
  .hero { padding-top: 16px; }
}
</style>
