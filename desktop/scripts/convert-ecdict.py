# -*- coding: utf-8 -*-
"""
将 ECDICT(英汉词典数据库 v1.0.28, MIT)转换为 TypeWords 内置词库格式并压缩存储。

用法: python scripts/convert-ecdict.py
输入: desktop/resources/tmp/stardict.db(ECDICT sqlite 完整版, 下载自
      https://github.com/skywind3000/ECDICT/releases 的 ecdict-sqlite 包)
      以及 Wudao.json.z(用于合并例句)
输出: frontend/apps/nuxt/public/dicts/en/word/ecdict.json.z

筛选范围: 有当代语料库词频(frq 非空)的词条 ≈ 84.6 万(常用词全覆盖 + 全部考纲词)。
排序: 按词频排名升序(高频在前, 练习/词表先见高频词)。
例句: 从 Wudao 词库按词合并(每词最多 2 条), 其余词暂无例句。
"""
import json
import os
import re
import sqlite3
import sys
import zlib

# Windows 控制台默认 GBK,打印中文会报错,强制 UTF-8
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout.reconfigure(encoding="utf-8")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
DB_PATH = os.path.join(ROOT, "resources", "tmp", "stardict.db")
WUDAO_Z = os.path.join(ROOT, "frontend", "apps", "nuxt", "public", "dicts", "en", "word", "Wudao.json.z")
OUT_DIR = os.path.join(ROOT, "frontend", "apps", "nuxt", "public", "dicts", "en", "word")
OUT_Z = os.path.join(OUT_DIR, "ecdict.json.z")
OUT_JSON = os.path.join(OUT_DIR, "ecdict.json")

MAX_SENTENCES = 2  # 合并的例句条数(来自 Wudao)

# frq 排名 → TypeWords Frequency 三档(Rare/Uncommon/Common)
FRQ_COMMON = 3000    # 前 3000 高频词 → Common
FRQ_UNCOMMON = 20000 # 前 2 万 → Uncommon, 其余 Rare


def frq_to_frequency(frq: str):
    try:
        n = int(frq)
    except (TypeError, ValueError):
        return None
    if n <= 0:
        return None
    if n <= FRQ_COMMON:
        return 2  # Common
    if n <= FRQ_UNCOMMON:
        return 1  # Uncommon
    return 0  # Rare


def parse_trans(translation: str):
    """translation 按行拆分为 pos/cn,带 frequency(释义排序/颜色条用)"""
    trans = []
    for line in (translation or "").split("\n"):
        line = line.strip()
        if not line:
            continue
        m = re.match(r"^([a-z./]+\.)\s*(.*)$", line)
        if m and m.group(2):
            trans.append({"pos": m.group(1), "cn": m.group(2)})
        else:
            trans.append({"pos": "", "cn": line})
        if len(trans) >= 5:
            break
    return trans


def main():
    if not os.path.exists(DB_PATH):
        print(f"找不到 ECDICT 数据库: {DB_PATH}")
        print("请从 https://github.com/skywind3000/ECDICT/releases 下载 ecdict-sqlite 包")
        print("解压后放到 desktop/resources/tmp/stardict.db")
        return 1

    # 1. 读 Wudao 例句(word → sentences)
    wudao_sentences = {}
    if os.path.exists(WUDAO_Z):
        wudao = json.loads(zlib.decompress(open(WUDAO_Z, "rb").read()))
        for w in wudao:
            if w.get("sentences"):
                wudao_sentences[w["word"].lower()] = w["sentences"][:MAX_SENTENCES]
        print(f"Wudao 例句来源: {len(wudao_sentences)} 词")
    else:
        print("警告: 未找到 Wudao.json.z, 新词库将不含例句")

    # 2. 读 ECDICT 词频词条
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT word, phonetic, translation, frq, tag, exchange FROM stardict "
        "WHERE frq IS NOT NULL AND frq != '' ORDER BY CAST(frq AS INTEGER)"
    )
    words = []
    for word, phonetic, translation, frq, tag, exchange in cur:
        if not word or not word.strip():
            continue
        freq = frq_to_frequency(frq)
        trans = parse_trans(translation)
        if not trans:
            continue
        item = {
            "id": str(len(words) + 1),
            "word": word,
            "phonetic0": phonetic or "",
            "phonetic1": "",
            "trans": trans,
            "sentences": wudao_sentences.get(word.lower(), []),
            "phrases": [],
            "synos": [],
            "relWords": {"root": "", "rels": []},
            "etymology": [],
        }
        # 考试标签(中考/高考/四级/六级/考研/雅思/托福/GRE),供按考纲范围学习
        if tag:
            item["tags"] = tag.split()
        # 词形变化(如 d:cancelled/p:cancelled/i:cancelling/3:cancels),供词形展示
        if exchange:
            item["inflections"] = exchange
        if freq is not None:
            # 词频标记在首条释义上(TranslationList 用 frequency 排序+着色)
            item["trans"][0]["frequency"] = freq
        words.append(item)
        if len(words) % 200000 == 0:
            print(f"  已转换 {len(words)} 词...")
    conn.close()

    if not words:
        print("转换结果为空")
        return 1

    # 3. 输出(压缩存储)
    os.makedirs(OUT_DIR, exist_ok=True)
    raw_json = json.dumps(words, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    compressed = zlib.compress(raw_json, 9)
    with open(OUT_Z, "wb") as f:
        f.write(compressed)
    if "--keep-json" in sys.argv:
        with open(OUT_JSON, "wb") as f:
            f.write(raw_json)

    # 4. 统计
    with_sent = sum(1 for w in words if w["sentences"])
    with_freq = sum(1 for w in words if w["trans"] and w["trans"][0].get("frequency") is not None)
    print(f"\n完成: {len(words)} 词")
    print(f"未压缩 JSON: {len(raw_json)/1024/1024:.1f} MB | 压缩后: {len(compressed)/1024/1024:.1f} MB")
    print(f"有例句: {with_sent} | 有词频标记: {with_freq}")
    sample = words[0]
    print(f"抽查首词(最高频): {json.dumps(sample, ensure_ascii=False)[:300]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
