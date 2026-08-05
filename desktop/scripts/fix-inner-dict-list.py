# -*- coding: utf-8 -*-
"""
新内置词库的列表配置更新:把 public/dicts/list/*.json 中 url 为裸文件名(远程)且
已本地化(.json.z 存在)的词库,改为本地路径 /dicts/en/word/<name>.json.z。
用法: python scripts/fix-inner-dict-list.py(在 fetch-inner-dicts.py 之后运行)
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
        # 只处理远程裸文件名(不含 / 与 .z);本地 .z 已存在的才改
        if "/" in url or url.endswith(".z"):
            continue
        z_path = os.path.join(WORD_DIR, url + ".z")
        if os.path.exists(z_path):
            item["url"] = "/dicts/en/word/" + url + ".z"
            changed += 1
            print(f"  [{fname}] {item.get('name')} -> {item['url']}")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)

print(f"共更新 {changed} 个词库为本地内置")
