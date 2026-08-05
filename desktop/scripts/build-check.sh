#!/bin/bash
# 构建 + 自动验证 cssHashMatch,失败自动重构建(最多 3 次)
# 背景:2026-08-06 排查发现构建产物偶发不完整(部分组件 scoped 样式/属性丢失,cssHashMatch false),
#       与内存压力相关(16GB 内存构建时仅剩 ~4GB);本脚本把"发现→重构建"自动化,保证构建通过=产物可用。
# 用法: bash scripts/build-check.sh
set -u
cd /d/SystemFiles/Documents/Project/English_Learner/desktop || exit 1

for i in 1 2 3; do
  echo "=== 第 $i 次构建 ==="
  npm run build:web > /tmp/build-check.log 2>&1
  if [ $? -ne 0 ]; then
    echo "✗ 构建失败(exit=$?)"
    tail -10 /tmp/build-check.log
    exit 1
  fi
  # 清 debug-search 的 Electron 磁盘缓存,避免误命中旧产物
  rm -rf "$LOCALAPPDATA/Temp/english-learner-debug-search" 2>/dev/null
  result=$(env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron scripts/debug-search.js 2>&1 | grep -o '"cssHashMatch": [a-z]*')
  if echo "$result" | grep -q '"cssHashMatch": true'; then
    echo "✅ 构建 + cssHashMatch 验证通过(第 $i 次尝试)"
    exit 0
  fi
  echo "⚠ cssHashMatch 未通过($result),自动重新构建..."
  sleep 2
done

echo "✗ 连续 3 次构建均未通过验证,请人工排查(内存压力/构建日志 /tmp/build-check.log)"
exit 1
