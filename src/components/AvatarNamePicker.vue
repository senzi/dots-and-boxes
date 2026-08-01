<script>
// 头像 → 默认昵称映射
export const AVATARS = [
  { emoji: '🐱', name: '小猫' },
  { emoji: '🦊', name: '狐狸' },
  { emoji: '🐼', name: '熊猫' },
  { emoji: '🐸', name: '青蛙' },
  { emoji: '🐙', name: '章鱼' },
  { emoji: '🦉', name: '猫头鹰' },
  { emoji: '🐯', name: '老虎' },
  { emoji: '🐰', name: '兔子' },
  { emoji: '🦄', name: '独角兽' },
  { emoji: '🐻', name: '小熊' },
  { emoji: '🐧', name: '企鹅' },
  { emoji: '🦖', name: '恐龙' }
]
</script>

<script setup>
// 头像选择 + 昵称联动
// 规则：点头像自动换成该头像的默认昵称；
//       一旦用户手动输入过昵称，之后点头像不再换昵称。
import { ref } from 'vue'

const props = defineProps({
  avatar: { type: String, default: '' },
  name: { type: String, default: '' },
  placeholder: { type: String, default: '昵称' }
})
const emit = defineEmits(['update:avatar', 'update:name'])

// 用户是否手动输入过昵称（初始：昵称 ≠ 当前头像默认名 → 视为自定义过）
const nameEdited = ref(false)
{
  const cur = AVATARS.find(a => a.emoji === props.avatar)
  if (cur && props.name && props.name.trim() !== '' && props.name !== cur.name) {
    nameEdited.value = true
  }
}

function onInput(e) {
  nameEdited.value = true
  emit('update:name', e.target.value)
}

function pick(emoji) {
  emit('update:avatar', emoji)
  if (!nameEdited.value) {
    const a = AVATARS.find(x => x.emoji === emoji)
    if (a) emit('update:name', a.name)
  }
}
</script>

<template>
  <div class="col">
    <input
      :value="name"
      class="input"
      maxlength="10"
      :placeholder="placeholder"
      @input="onInput"
    />
    <div class="avatar-grid mt-16">
      <button
        v-for="a in AVATARS" :key="a.emoji"
        class="avatar-opt" :class="{ on: avatar === a.emoji }"
        :title="a.name"
        @click="pick(a.emoji)"
      >{{ a.emoji }}</button>
    </div>
  </div>
</template>

<style scoped>
.avatar-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}
.avatar-opt {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--hairline);
  background: var(--canvas-soft);
  border-radius: 12px;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  transition: all 0.12s ease;
}
.avatar-opt:hover { border-color: var(--ink); }
.avatar-opt.on { border-color: var(--ink); background: var(--ink); }

@media (max-width: 400px) {
  .avatar-opt { font-size: 17px; }
}
</style>
