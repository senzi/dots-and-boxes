<script setup>
import { ref, computed } from 'vue'
import { useSettingsStore } from '../stores/settings.js'
import { AI_LEVELS } from '../engine/ai.js'

const settings = useSettingsStore()
const AVATARS = ['🐱', '🦊', '🐼', '🐸', '🐙', '🦉', '🐯', '🐰', '🦄', '🐻', '🐧', '🦖']

const saved = ref(false)
function save() {
  settings.save()
  saved.value = true
  setTimeout(() => { saved.value = false }, 1500)
}
</script>

<template>
  <div class="page fade-up" style="max-width: 640px">
    <router-link to="/" class="btn btn-text">← 返回</router-link>
    <h1 class="display display-lg mt-16">设置</h1>

    <!-- 玩家 1 默认 -->
    <div class="card-soft mt-24">
      <div class="caption">玩家 1 默认</div>
      <input v-model="settings.defaultName1" class="input mt-16" maxlength="10" placeholder="默认昵称" />
      <div class="avatar-row mt-16">
        <button
          v-for="a in AVATARS" :key="a"
          class="avatar-opt" :class="{ on: settings.defaultAvatar1 === a }"
          @click="settings.defaultAvatar1 = a"
        >{{ a }}</button>
      </div>
    </div>

    <!-- 玩家 2 默认 -->
    <div class="card-soft mt-24">
      <div class="caption">玩家 2 默认</div>
      <input v-model="settings.defaultName2" class="input mt-16" maxlength="10" placeholder="默认昵称" />
      <div class="avatar-row mt-16">
        <button
          v-for="a in AVATARS" :key="a"
          class="avatar-opt" :class="{ on: settings.defaultAvatar2 === a }"
          @click="settings.defaultAvatar2 = a"
        >{{ a }}</button>
      </div>
    </div>

    <!-- AI 默认 -->
    <div class="card-soft mt-24">
      <div class="caption">AI 默认</div>
      <div class="row gap-16 mt-16">
        <input v-model="settings.defaultAiName" class="input" maxlength="10" placeholder="AI 昵称" />
        <div class="avatar" style="flex-shrink: 0">{{ settings.defaultAiAvatar }}</div>
      </div>
      <div class="avatar-row mt-16">
        <button
          v-for="a in AVATARS" :key="a"
          class="avatar-opt" :class="{ on: settings.defaultAiAvatar === a }"
          @click="settings.defaultAiAvatar = a"
        >{{ a }}</button>
      </div>
      <div class="caption mt-24">AI 默认难度</div>
      <div class="row gap-12 mt-16" style="flex-wrap: wrap">
        <button
          v-for="lv in AI_LEVELS" :key="lv.id"
          class="level-pill" :class="{ active: settings.defaultAiLevel === lv.id }"
          @click="settings.defaultAiLevel = lv.id"
        >{{ lv.name }}</button>
      </div>
    </div>

    <div class="mt-32 row gap-16">
      <button class="btn btn-primary btn-lg flex-1" @click="save">保存设置</button>
      <span v-if="saved" class="body-sm muted">已保存 ✓</span>
    </div>
  </div>
</template>

<style scoped>
.avatar-row { display: flex; flex-wrap: wrap; gap: 6px; }
.avatar-opt {
  border: 1px solid var(--hairline);
  background: var(--canvas-soft);
  border-radius: 12px;
  font-size: 20px;
  padding: 6px 8px;
  cursor: pointer;
  transition: all 0.12s ease;
  line-height: 1;
}
.avatar-opt:hover { border-color: var(--ink); }
.avatar-opt.on { border-color: var(--ink); background: var(--ink); }
</style>
