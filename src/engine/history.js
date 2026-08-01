// 历史战绩 —— LocalStorage 持久化
const KEY = 'dnb63_records_v1'

export function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}

export function saveRecord(rec) {
  const all = loadRecords()
  all.push(rec)
  localStorage.setItem(KEY, JSON.stringify(all))
  return all
}

export function clearRecords() {
  localStorage.removeItem(KEY)
}

// 按玩家聚合统计
export function playerStats() {
  const records = loadRecords()
  const map = {}
  for (const rec of records) {
    for (const p of rec.players) {
      if (!map[p.id]) map[p.id] = { id: p.id, name: p.name, avatar: p.avatar, wins: 0, losses: 0, games: 0 }
      const st = map[p.id]
      st.games++
      if (rec.result === 'win' && rec.winnerId === p.id) st.wins++
      if (rec.result === 'loss' && rec.winnerId !== p.id) st.losses++
      if (rec.result === 'draw') st.wins += 0.5
    }
  }
  return Object.values(map).sort((a, b) => b.games - a.games)
}
