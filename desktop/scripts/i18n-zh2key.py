# i18n 半自动转换:把模板属性(title/desc/placeholder/label/q 等)、文本节点、Toast 里的纯中文
# 包成 $t('原文')(中文原文作 key,zh.json 值=原文,en.json 由人工补翻译)。
# 安全规则:只匹配"纯中文"串(不含变量 {{}}、引号、尖括号、英文字母、数字),自动跳过注释行。
# 不动的:注释、XLSX 列名/导出表头(数组/对象字面量,非本模式)、日志正文(Log.vue 排除)、复杂拼接(人工处理)。
import os, re, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

TARGETS = [
    'packages/core/src/components/About.vue',
    'packages/core/src/components/Book.vue',
    'packages/core/src/components/ReleaseBanner.vue',
    'packages/core/src/components/list/DictCardList.vue',
    'packages/core/src/components/setting/CommonSetting.vue',
    'packages/core/src/components/setting/FsrsSetting.vue',
    'packages/core/src/components/setting/SettingDialog.vue',
    'packages/core/src/components/setting/SettingsDialog.vue',
    'packages/core/src/components/setting/SoundSetting.vue',
    'packages/core/src/components/setting/TtsEngineSettings.vue',
    'packages/core/src/components/setting/WordSetting.vue',
    'packages/core/src/components/word/ChangeLastPracticeIndexDialog.vue',
    'packages/core/src/components/word/Footer.vue',
    'packages/core/src/components/word/GroupList.vue',
    'packages/core/src/components/word/PracticeSettingDialog.vue',
    'packages/core/src/components/word/PracticeWordListDialog.vue',
    'packages/core/src/components/word/ReviewPlanDialog.vue',
    'packages/core/src/components/word/ShufflePracticeSettingDialog.vue',
    'packages/core/src/components/word/Statistics.vue',
    'packages/core/src/components/word/TranslationList.vue',
    'packages/core/src/components/word/TypeWord.vue',
    'packages/core/src/components/word/VolumeSettingMiniDialog.vue',
    'packages/core/src/components/word/WordDetail.vue',
    'packages/core/src/components/word/WordLookupPopover.vue',
    'packages/core/src/components/word/WordMarkPickList.vue',
    'apps/nuxt/app/pages/fsrs.vue',
    'apps/nuxt/app/pages/(words)/dict-list.vue',
    'apps/nuxt/app/pages/(words)/dict.vue',
    'apps/nuxt/app/pages/(words)/practice-words/[id].vue',
    'apps/nuxt/app/pages/(words)/words.vue',
    'apps/nuxt/app/pages/(words)/words-test/[id].vue',
    'apps/nuxt/app/layouts/default.vue',
]

CN = r'一-鿿＀-￯　-〿、，。；：！？（）【】《》·—…“”‘’'
PURE = f'[{CN}]+'  # 纯中文(含中文标点)
NO_VAR = f'(?![^"\']*\\{{\\{{)'  # 值里不含 {{ 变量

ATTRS = ['title', 'desc', 'placeholder', 'label', 'q', 'message', 'active-text', 'inactive-text',
         'confirm-button-text', 'cancel-button-text']

attr_re = re.compile(r'\b(' + '|'.join(ATTRS) + r')="(' + PURE + r')"')
text_re = re.compile(r'>(' + PURE + r')<')
toast_re = re.compile(r"Toast\.(warning|success|error|info)\(\s*'(" + PURE + r")'\s*\)")
str_re = re.compile(r"'(?P<k>" + PURE + r")'")

def is_comment(line):
    s = line.strip()
    return s.startswith('//') or s.startswith('<!--') or s.startswith('/*') or s.startswith('*')

keys = set()
changed = 0
for rel in TARGETS:
    if not os.path.exists(rel):
        print(f'[跳过] {rel}')
        continue
    lines = open(rel, encoding='utf-8').read().splitlines()
    out = []
    fkeys = set()
    for i, ln in enumerate(lines):
        orig = ln
        # 跳过注释行
        if is_comment(ln):
            out.append(ln)
            continue
        # 1) 属性
        for m in attr_re.finditer(ln):
            k = m.group(2)
            ln = ln.replace(m.group(0), f':{m.group(1)}="$t(\'{k}\')"')
            fkeys.add(k)
        # 2) 文本节点
        for m in text_re.finditer(ln):
            k = m.group(1)
            ln = ln.replace(m.group(0), f'>{{{{ $t(\'{k}\') }}}}<')
            fkeys.add(k)
        # 3) Toast
        for m in toast_re.finditer(ln):
            k = m.group(2)
            ln = ln.replace(m.group(0), f"Toast.{m.group(1)}($t('{k}'))")
            fkeys.add(k)
        if ln != orig:
            changed += 1
        out.append(ln)
    if fkeys:
        keys.update(fkeys)
        open(rel, 'w', encoding='utf-8').write('\n'.join(out))
        print(f'[改] {rel}: {len(fkeys)} 处新 key')
    else:
        print(f'[-] {rel}: 无命中')

print()
print(f'共改动 {changed} 行,提取 {len(keys)} 个中文 key')
io.open('i18n_keys.txt', 'w', encoding='utf-8').write('\n'.join(sorted(keys)))
print('key 清单已写入 i18n_keys.txt')
