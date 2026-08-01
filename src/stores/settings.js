// 全局状态：设置 + 历史
import { defineStore } from 'pinia'
import { loadRecords, saveRecord, clearRecords, playerStats } from '../engine/history.js'

const SETTINGS_KEY = 'dnb63_settings_v1'

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}
  } catch {
    return {}
  }
}

const defaults = {
  defaultAvatar1: '🐱',
  defaultAvatar2: '🦊',
  defaultName1: '小猫',
  defaultName2: '狐狸',
  defaultAiLevel: 1,
  defaultAiAvatar: '🤖',
  defaultAiName: 'Robot'
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({ ...defaults, ...loadSettings() }),
  actions: {
    save() {
      const { defaultAvatar1, defaultAvatar2, defaultName1, defaultName2, defaultAiLevel, defaultAiAvatar, defaultAiName } = this
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ defaultAvatar1, defaultAvatar2, defaultName1, defaultName2, defaultAiLevel, defaultAiAvatar, defaultAiName }))
    }
  }
})

export const useHistoryStore = defineStore('history', {
  state: () => ({ records: loadRecords() }),
  getters: {
    stats: (s) => playerStats(),
    recent: (s) => [...s.records].reverse().slice(0, 30)
  },
  actions: {
    add(rec) {
      this.records = saveRecord(rec)
    },
    clear() {
      clearRecords()
      this.records = []
    }
  }
})
