#!/bin/bash
cd /d/My_Project/dots-and-boxes
for b in 0 2 5 10; do
  echo "=== BONUS=$b ==="
  node scripts/l6-takeover.mjs 40 20 3 230000 10 $b 2>&1 | grep -E "总耗时|翻盘|比分改善"
done
echo "=== DONE ==="
