# -*- coding: utf-8 -*-
"""
词库压缩后修复列表配置:public/dicts/list/*.json 中,本地内嵌词库(以 /dicts/ 开头)
若指向已不存在的 .json 且存在同名 .json.z,则把 url 改为 .json.z。
用法: python scripts/fix-dict-list-z.py
"""
import json
import os
import sys

if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIST_DIR = os.path.join(ROOT, "frontend", "apps", "nuxt", "public", "dicts", "list")
WORD_DIR = os.path.join(ROOT, "frontend", "apps", "nuxt", "public", "dicts", "en", "word")

changed = 0
for fname in os.listdir(LIST_DIR):
    if not fname.endswith(".json"):
        continue
    path = os.path.join(LIST_DIR, fname)
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    for item in data:
        url = item.get("url") or ""
        if not (url.startswith("/dicts/en/word/") and url.endswith(".json") and not url.endswith(".json.z")):
            continue
        z_path = os.path.join(WORD_DIR, os.path.basename(url) + ".z")
        if os.path.exists(z_path):
            item["url"] = url + ".z"
            changed += 1
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"{fname} 处理完成")

print(f"共修正 {changed} 个词库 url -> .z")
