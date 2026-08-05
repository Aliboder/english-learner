# -*- coding: utf-8 -*-
"""
从 TypeWords CDN 下载面向中学生/大学生的词库,压缩为 .json.z 内置(与 compress-dicts.py 同格式)。
用法: python scripts/fetch-inner-dicts.py
输出: frontend/apps/nuxt/public/dicts/en/word/*.json.z
之后必须: python scripts/generate-dict-index.py(重建查词索引)
"""
import os
import sys
import urllib.request
import zlib

if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE = "https://files.typewords.cc/dicts/en/word/"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WORD_DIR = os.path.join(SCRIPT_DIR, "..", "frontend", "apps", "nuxt", "public", "dicts", "en", "word")

FILES = [
    # 中学生
    "ZhongKaoHeXin.json",            # 中考核心词
    "GaoKaoZhenTiHeXinGaoPin.json",  # 高考历年真题核心高频
    "gaokao-yuedu-gaopin.json",      # 高考英语阅读高频词汇
    "PEPChuZhong7_1_T.json",         # 人教版 七年级上
    "PEPChuZhong8_1_T.json",         # 人教版 八年级上
    "PEPChuZhong9_1_T.json",         # 人教版 九年级
    "PEPGaoZhong_1_T.json",          # 人教版 高中必修1
    "PEPGaoZhong_2_T.json",          # 人教版 高中必修2
    "PEPGaoZhong_3_T.json",          # 人教版 高中必修3
    "PEPGaoZhong_4_T.json",          # 人教版 高中必修4
    "PEPGaoZhong_5_T.json",          # 人教版 高中必修5
    # 大学生
    "xinghuoqiaoji_4.json",          # 四级巧记速记
    "xinghuoqiaoji_6.json",          # 六级巧记速记
    "926.json",                      # 考研 926 词汇
    "3000_ClassRoom_English_Words.json",  # 专升本 3000 词
    # 通用
    "Oxford3000.json",               # 牛津 3000
]


def main():
    for f in FILES:
        dst = os.path.join(WORD_DIR, f + ".z")
        if os.path.exists(dst):
            print(f"  {f}: 已存在,跳过")
            continue
        print(f"  下载 {f} ...", end=" ")
        try:
            raw = urllib.request.urlopen(BASE + f, timeout=60).read()
        except Exception as e:
            print(f"失败({e}),跳过")
            continue
        z = zlib.compress(raw, 9)
        with open(dst, "wb") as fp:
            fp.write(z)
        print(f"OK {len(raw)//1024}KB -> {len(z)//1024}KB")

    print("完成;请重跑 generate-dict-index.py 并更新 list 配置")


if __name__ == "__main__":
    main()
