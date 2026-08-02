#!/bin/bash
# L5 参数扫描：阈值 × 固定/动态参数 → 翻盘率对比（同一批 seed 120000）
cd /d/My_Project/dots-and-boxes
echo "=== A 固定(阈值20·6x3) ==="
node scripts/l5-takeover.mjs 30 20 3 120000 0 2>&1 | grep -E "翻盘|比分改善"
echo "=== B 动态(阈值10·50%·40) ==="
node scripts/l5-takeover.mjs 30 10 3 120000 1 40 2>&1 | grep -E "翻盘|比分改善"
echo "=== C 动态(阈值15·50%·40) ==="
node scripts/l5-takeover.mjs 30 15 3 120000 1 40 2>&1 | grep -E "翻盘|比分改善"
echo "=== D 动态(阈值20·50%·40) ==="
node scripts/l5-takeover.mjs 30 20 3 120000 1 40 2>&1 | grep -E "翻盘|比分改善"
echo "=== E 动态(阈值10·50%·60) ==="
node scripts/l5-takeover.mjs 30 10 3 120000 1 60 2>&1 | grep -E "翻盘|比分改善"
echo "=== DONE ==="
