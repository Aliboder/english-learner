import type { Dict, TaskWords, Word } from '../types'
import { DictType, getDefaultDict, getDefaultWord } from '../types'
import { useBaseStore } from '../stores/base.ts'
import { useSettingStore } from '../stores/setting.ts'
import { cloneDeep, isDictIdMatch, shuffle } from '../utils'
import { DictId } from '../config/env.ts'
import dayjs from 'dayjs'

export function useWordOptions() {
  const store = useBaseStore()

  function isWordCollect(val: Word) {
    return !!store.collectWord.words.find(v => v.word.toLowerCase() === val.word.toLowerCase())
  }

  function toggleWordCollect(val: Word) {
    let rIndex = store.collectWord.words.findIndex(v => v.word.toLowerCase() === val.word.toLowerCase())
    if (rIndex > -1) {
      store.collectWord.words.splice(rIndex, 1)
    } else {
      store.collectWord.words.push(val)
    }
    store.collectWord.length = store.collectWord.words.length
  }

  function isWordSimple(val: Word) {
    return !!store.knownWordsSet.has(val.word.toLowerCase())
  }

  function toggleWordSimple(val: Word) {
    let rIndex = store.knownWords.findIndex(v => v === val.word.toLowerCase())
    if (rIndex > -1) {
      store.known.words.splice(rIndex, 1)
    } else {
      store.known.words.push(val)
    }
    store.known.length = store.known.words.length
  }

  function delWrongWord(val: Word) {
    let rIndex = store.wrong.words.findIndex(v => v.word.toLowerCase() === val.word.toLowerCase())
    if (rIndex > -1) {
      store.wrong.words.splice(rIndex, 1)
    }
    store.wrong.length = store.wrong.words.length
  }

  function delSimpleWord(val: Word) {
    let rIndex = store.known.words.findIndex(v => v.word.toLowerCase() === val.word.toLowerCase())
    if (rIndex > -1) {
      store.known.words.splice(rIndex, 1)
    }
    store.known.length = store.known.words.length
  }

  function getCollectibleDicts(excludeDictId?: string) {
    return store.word.bookList.filter(dict => {
      if (dict.id !== DictId.wordCollect && !dict.custom) return false
      if (excludeDictId && isDictIdMatch(dict, excludeDictId)) return false
      return true
    })
  }

  function resolveDictInBookList(dict: Dict) {
    return store.word.bookList.find(d => isDictIdMatch(d, dict.id)) ?? dict
  }

  function addWordToDict(val: Word, dict: Dict): { ok: boolean } {
    const target = resolveDictInBookList(dict)
    const rIndex = target.words.findIndex(v => v.word.toLowerCase() === val.word.toLowerCase())
    if (rIndex > -1) return { ok: false }
    target.words.push(val)
    target.length = target.words.length
    return { ok: true }
  }

  async function createCustomDict(name: string): Promise<{ ok: true; dict: Dict } | { ok: false; reason: 'empty' | 'duplicate' | 'api' }> {
    const trimmed = name.trim()
    if (!trimmed) return { ok: false, reason: 'empty' }
    if (store.word.bookList.find(v => v.name === trimmed)) {
      return { ok: false, reason: 'duplicate' }
    }
    let data: Dict = getDefaultDict({
      name: trimmed,
      id: 'custom-dict-' + Date.now(),
      custom: true,
    })
    data.type = DictType.word
    store.word.bookList.push(cloneDeep(data))
    return { ok: true, dict: data }
  }

  return {
    isWordCollect,
    toggleWordCollect,
    getCollectibleDicts,
    addWordToDict,
    createCustomDict,
    isWordSimple,
    toggleWordSimple,
    delWrongWord,
    delSimpleWord,
  }
}

export function getCurrentStudyWord(): TaskWords {
  const store = useBaseStore()
  let data: TaskWords = { new: [], review: [] }
  let dict = store.sdict
  let words = dict.words.slice()

  if (words?.length) {
    const settingStore = useSettingStore()
    //忽略列表：简单词或已掌握
    const ignoreSet = [store.allIgnoreWordsSet, store.knownWordsSet][settingStore.ignoreSimpleWord ? 0 : 1]
    const perDay = dict.perDayStudyNumber
    const start = dict.lastLearnIndex
    const complete = dict.complete
    const isEnd = start >= dict.length - 1 && dict.length !== 1
    const reviewRatio = settingStore.wordReviewRatio

    let end = start
    if (!isEnd) {
      //从start往后取perDay个单词，作为新词
      for (let i = start; i < words.length; i++) {
        let item = words[i]
        if (data.new.length >= perDay) break
        if (!ignoreSet.has(item.word)) {
          data.new.push(item)
        }
        end++
      }
    }

    //如果复习比大于等于1，或者已完成，才生成复习词
    if (reviewRatio >= 1 || complete || isEnd) {
      // 小写索引:与 fsrsData 的小写 key 匹配,Christ/Polish 等大写词也能进复习队列
      const wordMap = new Map(words.map(s => [s.word.toLowerCase(), s]))
      //复习总数量;如果已结束那么复习比最小是1
      const totalNeed = perDay * (isEnd ? reviewRatio || 1 : reviewRatio)
      const now = Date.now()

      let waitRemoveFromFsrsData = []

      //取 due 到期的单词
      let reviewWordStrList = Object.entries(store.fsrsData)
        .filter(([word, card]) => {
          //1、这里的due字段被json序列化之后又恢复是字符串了，所以要用dayjs比较
          //2、要在当前学习这本词典里面
          //3、不在新词里面
          // console.log(`单词：${word},到期时间：${dayjs(card.due).format('YYYY-MM-DD HH:mm:ss')}`)
          let isMastered = ignoreSet.has(word)
          if (isMastered) {
            waitRemoveFromFsrsData.push(word)
          }
          return (
            !isMastered &&
            dayjs(card.due).valueOf() <= now &&
            wordMap.has(word) &&
            !data.new.some(v => v.word.toLowerCase() === word)
          )
        })
        .sort((a, b) => dayjs(a[1].due).valueOf() - dayjs(b[1].due).valueOf())
        .map(([word]) => word)

      waitRemoveFromFsrsData.map(word => {
        delete store.fsrsData[word]
      })
      // console.log('fsrs 里 due 到期单词', reviewWordStrList)

      data.review = shuffle(
        reviewWordStrList
          .slice(0, totalNeed)
          .map(word => wordMap.get(word))
          .filter(obj => obj)
      )
      //如果数量不够再填充
      if (data.review.length < totalNeed) {
        // 固定填充逻辑
        let list = words.slice(0, start).reverse()
        if (complete) list = list.concat(words.slice(end).reverse())
        // 固定填充复习词需要过滤掉有FSRS记录的
        let set = new Set(
          Array.from(ignoreSet)
            .concat(Object.keys(store.fsrsData))
            .concat(data.new.map(v => v.word.toLowerCase()))
        )
        list = list.filter(item => !set.has(item.word))
        data.review = data.review.concat(list.slice(0, totalNeed - data.review.length))
      }
    }
  }
  return data
}
