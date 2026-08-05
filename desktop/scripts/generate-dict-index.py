# -*- coding: utf-8 -*-
"""
生成查词索引 public/dicts/index.json(+ 压缩版 index.json.z)
遍历内嵌词库(en/word/*.json 及 *.json.z 压缩词库),提取 单词 + 词库文件 + 主翻译,供主界面实时查词使用。
词库数据更新后重跑一次即可: python scripts/generate-dict-index.py
输出格式: [{"w": "abandon", "d": "CET4_T.json", "t": "v. 放弃"}, ...]
前端加载优先用 index.json.z(zlib 压缩,体积约 1/4,DecompressionStream 解压)。
"""
import json
import os
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DICT_DIR = os.path.join(ROOT, "frontend", "apps", "nuxt", "public", "dicts", "en", "word")
OUT = os.path.join(ROOT, "frontend", "apps", "nuxt", "public", "dicts", "index.json")
OUT_Z = OUT + ".z"


def load_dict_file(path):
    """加载词库文件,支持 .json.z 压缩格式"""
    if path.endswith(".json.z"):
        with open(path, "rb") as f:
            return json.loads(zlib.decompress(f.read()))
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main_trans(word):
    """取第一条翻译(pos+cn),截断 60 字符"""
    trans = word.get("trans") or []
    if not trans:
        return ""
    first = trans[0] or {}
    t = str(first.get("pos") or "") + str(first.get("cn") or "")
    return t.strip()[:60]


def main():
    items = []
    seen = set()
    for fname in sorted(os.listdir(DICT_DIR)):
        if not (fname.endswith(".json") or fname.endswith(".json.z")):
            continue
        path = os.path.join(DICT_DIR, fname)
        words = load_dict_file(path)
        for w in words:
            word = (w.get("word") or "").strip()
            if not word:
                continue
            key = word.lower()
            if key in seen:
                continue  # 同词只保留第一个词库
            seen.add(key)
            items.append({"w": word, "d": fname, "t": main_trans(w)})

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, separators=(",", ":"))

    # 压缩版(index.json.z):zlib 压缩,前端 DecompressionStream 解压,加载更快
    with open(OUT, "rb") as f:
        with open(OUT_Z, "wb") as fz:
            fz.write(zlib.compress(f.read(), 9))

    size_mb = os.path.getsize(OUT) / 1024 / 1024
    size_z_mb = os.path.getsize(OUT_Z) / 1024 / 1024
    print(f"生成完成: {len(items)} 词 -> {OUT} ({size_mb:.2f} MB) + {OUT_Z} ({size_z_mb:.2f} MB)")


if __name__ == "__main__":
    sys.exit(main())
