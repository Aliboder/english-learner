# 子集化 MiSans 字体:保留拉丁字母 + GB2312 6763 常用汉字 + 常用标点,输出 woff2
# 用法: python scripts/subset-fonts.py
# 输入: 项目根目录下 MiSans-*.ttf(10 个字重)
# 输出: frontend/apps/nuxt/public/fonts/misans/MiSans-*.woff2(构建时随 public 复制进 dist)
import os
from fontTools import subset
from fontTools.ttLib import TTFont

SRC = r'D:\SystemFiles\Documents\Project\English_Learner'
OUT = r'D:\SystemFiles\Documents\Project\English_Learner\desktop\frontend\apps\nuxt\public\fonts\misans'
os.makedirs(OUT, exist_ok=True)

# GB2312 全部 6763 个汉字(覆盖率 99.9%+)
hanzi = []
for cp in range(0x4E00, 0x9FA6):
    try:
        chr(cp).encode('gb2312')
        hanzi.append(cp)
    except UnicodeEncodeError:
        pass

# 常用区间:基本拉丁 / 拉丁-1 / 通用标点 / CJK 标点 / 全角 / 箭头符号
ranges = [(0x20, 0x7E), (0xA0, 0xFF), (0x2000, 0x206F), (0x2190, 0x21FF), (0x3000, 0x303F), (0xFF00, 0xFFEF)]
unicodes = set(hanzi)
for a, b in ranges:
    unicodes.update(range(a, b + 1))

files = sorted(f for f in os.listdir(SRC) if f.startswith('MiSans-') and f.endswith('.ttf'))
print(f'发现 {len(files)} 个字重, 字符数: {len(hanzi)} 汉字 + 符号区间')
for f in files:
    src = os.path.join(SRC, f)
    out = os.path.join(OUT, f.replace('.ttf', '.woff2'))
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']  # 保留 kern/liga 等排版特性
    opts.name_IDs = ['*']
    opts.name_languages = ['*']
    opts.drop_tables += ['FFTM']
    ss = subset.Subsetter(options=opts)
    font = TTFont(src)
    ss.populate(unicodes=unicodes)
    ss.subset(font)
    font.save(out)
    print(f'  {f}: {os.path.getsize(src)//1024}KB -> {os.path.getsize(out)//1024}KB')
print('完成')
