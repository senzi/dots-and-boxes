<script setup>
import { ref } from 'vue'
import { useSettingsStore } from '../stores/settings.js'
import { AI_LEVELS } from '../engine/ai.js'
import AvatarNamePicker from '../components/AvatarNamePicker.vue'

const settings = useSettingsStore()

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
      <div class="mt-16">
        <AvatarNamePicker
          v-model:avatar="settings.defaultAvatar1"
          v-model:name="settings.defaultName1"
          placeholder="默认昵称"
        />
      </div>
    </div>

    <!-- 玩家 2 默认 -->
    <div class="card-soft mt-24">
      <div class="caption">玩家 2 默认</div>
      <div class="mt-16">
        <AvatarNamePicker
          v-model:avatar="settings.defaultAvatar2"
          v-model:name="settings.defaultName2"
          placeholder="默认昵称"
        />
      </div>
    </div>

    <!-- AI 默认 -->
    <div class="card-soft mt-24">
      <div class="caption">AI 默认</div>
      <div class="mt-16">
        <AvatarNamePicker
          v-model:avatar="settings.defaultAiAvatar"
          v-model:name="settings.defaultAiName"
          placeholder="AI 昵称"
        />
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
</style>
