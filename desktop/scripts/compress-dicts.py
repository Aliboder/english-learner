# -*- coding: utf-8 -*-
"""
压缩内嵌考试词库 JSON → .json.z(zlib level 9,与 ecdict/Wudao 同格式,前端 DecompressionStream 解压零改动),
压缩完成后删除明文 JSON,减小安装包体积(约省 60%)。

用法: python scripts/compress-dicts.py
输出: frontend/apps/nuxt/public/dicts/en/word/*.json → *.json.z(删明文)
之后必须重跑: python scripts/generate-dict-index.py(让索引指向 .z 文件名)
"""
import os
import sys
import zlib

# Windows 控制台默认 GBK,打印中文会报错,强制 UTF-8
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DICT_DIR = os.path.join(ROOT, "frontend", "apps", "nuxt", "public", "dicts", "en", "word")

total_saved = 0
for fname in sorted(os.listdir(DICT_DIR)):
    if not fname.endswith(".json") or fname.endswith(".json.z"):
        continue
    src = os.path.join(DICT_DIR, fname)
    with open(src, "rb") as f:
        raw = f.read()
    z = zlib.compress(raw, 9)
    dst = src + ".z"
    with open(dst, "wb") as f:
        f.write(z)
    saved = len(raw) - len(z)
    total_saved += saved
    print(f"  {fname}: {len(raw)//1024}KB -> {len(z)//1024}KB (省 {saved//1024}KB)")
    os.remove(src)

print(f"完成,共省 {total_saved//1024//1024}MB;请重跑 generate-dict-index.py 并删除 index.json 明文")
