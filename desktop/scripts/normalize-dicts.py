# -*- coding: utf-8 -*-
"""词库 trans 数据统一规范化(2026-08-04)

目标:17 个词库(15 考试词库 + Wudao + ecdict)的 trans 数据结构与内容统一:
1. 词性写法统一(a.→adj.、ad.→adv. 等标准映射;【名】等中文标注提取为 n.)
2. cn 文本内嵌词性拆分为独立条目(如 "容易的,安逸的 adv. 慢慢地" → 两条)
3. cn 内多释义分隔符统一为全角逗号 ,(消除 ; 、 半角逗号混用)
4. 异常前缀清理(如 it-words 的 "&,ad.")
5. 无法推断词性的条目保留空 pos(前端已兼容)

用法:python scripts/normalize-dicts.py   (处理 public/dicts/en/word/ 下所有词库,原文件覆盖;先备份!)
备份:desktop/resources/dict-backup/
"""
import json
import os
import re
import zlib

WORD_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'apps', 'nuxt', 'public', 'dicts', 'en', 'word')

# ===== 词性标准化映射 =====
POS_MAP = {
    'a.': 'adj.', 'a': 'adj.', 'adj': 'adj.', 'adj.': 'adj.',
    'ad.': 'adv.', 'ad': 'adv.', 'adv': 'adv.', 'adv.': 'adv.',
    'n': 'n.', 'n.': 'n.', 'v': 'v.', 'v.': 'v.', 'vi.': 'vi.', 'vt.': 'vt.',
    'aux.': 'aux.', 'prep.': 'prep.', 'conj.': 'conj.', 'pron.': 'pron.',
    'num.': 'num.', 'art.': 'art.', 'int.': 'int.', 'interj.': 'interj.',
    'abbr.': 'abbr.', 'comb.': 'comb.', 'pref.': 'pref.', 'suff.': 'suff.',
    'det.': 'det.', 'phr.': 'phr.',
}
# 标准词性集合(用于扫描 cn 内嵌词性:取映射后的标准写法)
STD_POS_SET = set(POS_MAP.values())
# 用于从 cn 文本识别词性的原始写法(按长度降序,避免 a. 误吞 ad.)
POS_PATTERNS = sorted(
    {k for k in POS_MAP if k.endswith('.') and k not in ('a', 'n', 'v', 'ad', 'adj', 'adv')},
    key=len, reverse=True,
)
POS_RE = re.compile(
    r'(?<![A-Za-z])(?:' + '|'.join(re.escape(p) for p in POS_PATTERNS) + r')(?![A-Za-z])'
)

# 中文词性标注 → 标准 pos
CN_POS_MAP = {
    '【名】': 'n.', '【动】': 'v.', '【形】': 'adj.', '【副】': 'adv.',
    '【介】': 'prep.', '【连】': 'conj.', '【代】': 'pron.', '【数】': 'num.',
    '【冠】': 'art.', '【叹】': 'int.', '【缩】': 'abbr.',
}

SEP_RE = re.compile(r'\s*[;；、]\s*|\s*,\s*')  # 统一为全角逗号的分隔符


def norm_pos(pos):
    """词性写法标准化;无法识别返回 ''"""
    p = (pos or '').strip().rstrip('.') + '.' if (pos or '').strip() and not pos.strip().endswith('.') else (pos or '').strip()
    p = p.lower()
    # 尝试精确映射
    if p in POS_MAP:
        return POS_MAP[p]
    # 去掉尾点再映射(如 "adj" / "a")
    if p.endswith('.'):
        key = p[:-1]
        if key in POS_MAP:
            return POS_MAP[key]
    return ''


def split_embedded_pos(cn):
    """处理 cn 文本:内嵌词性段拆成 [(pos, text), ...];无内嵌词性的段合并为一条 [(None, 合并文本)]。
    规则:分号/双空格分段;段以词性开头 → 新条目;段内嵌词性 → 前后拆开;
    无词性段 → 合并进上一条(有 pos 则追加到其 cn,否则作为独立无 pos 条目)。"""
    segs = re.split(r'[;；]\s*|\s{2,}', cn.strip())
    out = []
    for seg in segs:
        if not seg:
            continue
        m = POS_RE.match(seg)
        if m:
            pos = norm_pos(m.group(0))
            rest = seg[m.end():].strip(' .,,;；、')
            if pos:
                out.append((pos, rest))
                continue
        # 段内含词性标记(如 "容易的,安逸的 adv. 慢慢地")——找词性出现位置拆分
        m2 = POS_RE.search(seg)
        if m2 and m2.start() > 0:
            pos = norm_pos(m2.group(0))
            before = seg[: m2.start()].strip(' .,,;；、')
            after = seg[m2.end():].strip(' .,,;；、')
            if pos:
                if before:
                    out.append((None, before))
                out.append((pos, after))
                continue
        # 无词性段:合并进上一条(保持"一条 pos 多释义"结构,分隔符统一为逗号)
        if out:
            out[-1] = (out[-1][0], (out[-1][1] + '，' + seg) if out[-1][1] else seg)
        else:
            out.append((None, seg))
    return out


def extract_cn_pos(cn):
    """从 cn 提取中文词性标注(如【名】),返回 (pos, 清理后的cn)"""
    for tag, pos in CN_POS_MAP.items():
        if tag in cn:
            return pos, cn.replace(tag, '').strip(' .,,;；、')
    return None, cn


def clean_cn(cn):
    """清理 cn:去除多余空白与开头标点,统一释义分隔符"""
    if not cn:
        return ''
    cn = re.sub(r'^\s*[&,.;；、\s]+', '', cn)  # 清理 &, 等异常前缀
    cn = re.sub(r'\s+', ' ', cn).strip(' .,,;；、')
    # 多释义分隔符统一为全角逗号
    cn = SEP_RE.sub('，', cn)
    cn = re.sub(r'，{2,}', '，', cn)
    return cn.strip(' ，')


def normalize_trans(trans):
    """规范化一个词的 trans 数组"""
    if not isinstance(trans, list):
        return trans
    result = []
    for item in trans:
        if not isinstance(item, dict):
            continue
        pos = norm_pos(item.get('pos', ''))
        cn = item.get('cn') or ''
        freq = item.get('frequency')  # ecdict 词频,保留
        # 1. 中文词性标注提取(【名】等)
        if not pos:
            pos, cn = extract_cn_pos(cn)
        # 2. 清理 cn 内嵌词性 → 可能拆成多条
        pieces = split_embedded_pos(cn)
        for piece_pos, piece_cn in pieces:
            p = (pos if not piece_pos else piece_pos) or ''
            c = clean_cn(piece_cn)
            if not c:
                continue
            result.append({'pos': p, 'cn': c})
            if freq is not None and len(result) and 'frequency' not in result[-1]:
                result[-1]['frequency'] = freq
    return result


def merge_same_pos(trans):
    """同词性条目合并(2026-08-04,CET-4-frequency 等词库每条释义一个条目,粒度过细):
    同一词内 pos 相同的条目合并为一条,按 frequency 降序、逗号连接;frequency 取最高值。
    对"一条 pos 多释义"结构的词库(考试词库/ecdict)无影响(pos 无重复)。"""
    if not isinstance(trans, list):
        return trans
    groups = {}
    order = []
    for t in trans:
        if not isinstance(t, dict):
            continue
        pos = t.get('pos', '')
        if pos not in groups:
            groups[pos] = []
            order.append(pos)
        groups[pos].append(t)
    out = []
    for pos in order:
        items = sorted(
            groups[pos],
            key=lambda x: x.get('frequency') if isinstance(x.get('frequency'), (int, float)) else -1,
            reverse=True,
        )
        cns = [it.get('cn') for it in items if it.get('cn')]
        if not cns:
            continue
        freqs = [it.get('frequency') for it in items if isinstance(it.get('frequency'), (int, float))]
        merged = {'pos': pos, 'cn': '，'.join(cns)}
        if freqs:
            merged['frequency'] = max(freqs)
        out.append(merged)
    return out


def normalize_word(w):
    """规范化一个词条"""
    if not isinstance(w, dict):
        return w
    w = dict(w)
    if 'trans' in w:
        w['trans'] = merge_same_pos(normalize_trans(w['trans']))
    return w


def load_dict(path):
    if path.endswith('.z'):
        with open(path, 'rb') as f:
            return json.loads(zlib.decompress(f.read()))
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def save_dict(path, data):
    if path.endswith('.z'):
        with open(path, 'wb') as f:
            f.write(zlib.compress(json.dumps(data, ensure_ascii=False).encode('utf-8'), 9))
    else:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, separators=(',', ':'))


def main():
    files = sorted(
        [os.path.join(WORD_DIR, n) for n in os.listdir(WORD_DIR)
         if n.endswith('.json') or n.endswith('.json.z')]
    )
    total_words = 0
    for p in files:
        name = os.path.basename(p)
        data = load_dict(p)
        words = data if isinstance(data, list) else data.get('words', data)
        if isinstance(words, list):
            words = [normalize_word(w) for w in words]
        else:
            words = normalize_word(words)
        if isinstance(data, dict) and 'words' in data:
            data['words'] = words
        else:
            data = words
        save_dict(p, data)
        total_words += len(words) if isinstance(words, list) else 1
        print(f'[OK] {name} ({len(words) if isinstance(words, list) else 1}词)')
    print(f'完成,共处理 {total_words} 词')


if __name__ == '__main__':
    main()
