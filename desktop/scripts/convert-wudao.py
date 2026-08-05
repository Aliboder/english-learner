# -*- coding: utf-8 -*-
"""
将 Wudao-dict 的离线英词典转换为 TypeWords 内置词库格式,并压缩存储。

用法: python scripts/convert-wudao.py
输入: 项目根目录的克隆 Wudao-dict/wudao-dict/dict/en.ind + en.z(96,233 词)
输出: frontend/apps/nuxt/public/dicts/en/word/Wudao.json.z(zlib 压缩 JSON)
      --keep-json 参数可同时保留未压缩的 Wudao.json(调试用)

字段映射:
  Wudao                      → TypeWords
  word                       → word
  id(重新编号)                → id
  美音 ['kænsl]              → phonetic0(kænsl,去方括号)
  英音 ['kæns(ə)l]           → phonetic1
  paraphrase ["vt. 取消；删去"] → trans [{pos, cn}]
  sentence 嵌套[en, cn] 对    → sentences(每词最多 2 条)
  无同义词/词源/短语           → 空数组
"""
import json
import os
import re
import sys
import zlib

# Windows 控制台默认 GBK,打印中文/音标会报错,强制 UTF-8
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout.reconfigure(encoding="utf-8")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# desktop/scripts/ → desktop → 项目根
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
# Wudao-dict 克隆在项目根目录下
WUDAO_DICT_DIR = os.path.join(PROJECT_ROOT, "..", "Wudao-dict", "wudao-dict", "dict")
OUT_DIR = os.path.join(
    PROJECT_ROOT, "frontend", "apps", "nuxt", "public", "dicts", "en", "word"
)
OUT_Z = os.path.join(OUT_DIR, "Wudao.json.z")
OUT_JSON = os.path.join(OUT_DIR, "Wudao.json")

MAX_SENTENCES = 2  # 每词最多保留的例句条数


def parse_pos_cn(text: str):
    """"vt. 取消；删去" → ("vt.", "取消；删去");无词性前缀则 pos 为空"""
    s = text.strip()
    m = re.match(r"^([a-zA-Z./]+\.)\s*(.*)$", s)
    if m and m.group(2):
        return m.group(1), m.group(2)
    return "", s


def extract_sentences(raw) -> list:
    """sentence 结构: [["英文释义+中文释义", "词性", [["en", "cn"], ...]], ...]
    展平所有 [en, cn] 对,截取前 MAX_SENTENCES 条"""
    pairs = []
    if not isinstance(raw, list):
        return pairs
    for item in raw:
        if not isinstance(item, list) or len(item) < 3 or not isinstance(item[2], list):
            continue
        for pair in item[2]:
            if isinstance(pair, list) and len(pair) >= 2:
                pairs.append({"c": str(pair[0] or ""), "cn": str(pair[1] or "")})
                if len(pairs) >= MAX_SENTENCES:
                    return pairs
    return pairs


def main():
    ind_path = os.path.join(WUDAO_DICT_DIR, "en.ind")
    z_path = os.path.join(WUDAO_DICT_DIR, "en.z")
    if not (os.path.exists(ind_path) and os.path.exists(z_path)):
        print(f"找不到 Wudao-dict 词典文件: {WUDAO_DICT_DIR}")
        print("请先克隆 https://github.com/ChestnutHeng/Wudao-dict 到项目根目录")
        return 1

    # 1. 读索引(词 → 偏移)
    offsets = []
    for line in open(ind_path, encoding="utf-8"):
        line = line.strip()
        if not line:
            continue
        w, o = line.split("|")
        offsets.append((w, int(o)))
    print(f"索引词条: {len(offsets)}")

    # 2. 读全部数据到内存,按偏移切片解压
    data = open(z_path, "rb").read()
    words = []
    skip = 0
    for i, (raw_word, off) in enumerate(offsets):
        end = offsets[i + 1][1] if i + 1 < len(offsets) else len(data)
        chunk = data[off:end]
        try:
            text = zlib.decompress(chunk).decode("utf-8")
        except Exception:
            skip += 1
            continue
        parts = text.split("|")
        if len(parts) < 6:
            skip += 1
            continue
        word = parts[0]
        if not word:
            skip += 1
            continue

        # 音标: ['kænsl] → kænsl
        us = parts[2].strip("[]").strip()
        uk = parts[3].strip("[]").strip()

        # 释义
        trans = []
        try:
            para = json.loads(parts[5]) if parts[5] else []
        except Exception:
            para = []
        for p in para:
            pos, cn = parse_pos_cn(str(p))
            if cn:
                trans.append({"pos": pos, "cn": cn})

        # 例句
        try:
            sent_raw = json.loads(parts[8]) if parts[8] else []
        except Exception:
            sent_raw = []
        sentences = extract_sentences(sent_raw)

        words.append(
            {
                "id": str(len(words) + 1),
                "word": word,
                "phonetic0": us,
                "phonetic1": uk,
                "trans": trans,
                "sentences": sentences,
                "phrases": [],
                "synos": [],
                "relWords": {"root": "", "rels": []},
                "etymology": [],
            }
        )
        if len(words) % 20000 == 0:
            print(f"  已转换 {len(words)} 词...")

    if not words:
        print("转换结果为空,检查输入文件")
        return 1

    # 3. 按单词字母排序(词表显示有序)
    words.sort(key=lambda x: x["word"].lower())

    # 4. 输出(压缩存储)
    os.makedirs(OUT_DIR, exist_ok=True)
    raw_json = json.dumps(words, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    compressed = zlib.compress(raw_json, 9)
    with open(OUT_Z, "wb") as f:
        f.write(compressed)

    if "--keep-json" in sys.argv:
        with open(OUT_JSON, "wb") as f:
            f.write(raw_json)

    # 5. 验证:解压回读抽查
    back = zlib.decompress(compressed)
    back_list = json.loads(back)
    sample = back_list[0]
    print(f"\n完成: {len(words)} 词(跳过 {skip} 条)")
    print(f"未压缩 JSON: {len(raw_json)/1024/1024:.1f} MB")
    print(f"压缩后:      {len(compressed)/1024/1024:.1f} MB (输出 {OUT_Z})")
    print(f"抽查首词: {json.dumps(sample, ensure_ascii=False)[:300]}")
    no_trans = sum(1 for w in words if not w["trans"])
    with_sent = sum(1 for w in words if w["sentences"])
    print(f"无释义词: {no_trans} | 有例句词: {with_sent}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
