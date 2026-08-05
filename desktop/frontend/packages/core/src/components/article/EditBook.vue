<script setup lang="ts">
import type { Dict } from '../../types'
import { cloneDeep, ensureCustomDictCopy } from '../../utils'
import { onMounted, reactive } from 'vue'
import { useRuntimeStore } from '../../stores/runtime.ts'
import { useBaseStore } from '../../stores/base.ts'
import { BaseButton, BaseInput, Form, FormItem, Option, Select, Toast, Textarea } from '@english-learner/base'
import { getDefaultDict, DictType } from '../../types'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  isAdd: boolean
  isBook: boolean
  /** 创建副本时传入的预填数据，含已生成的 id/sourceId 等 */
  initialData?: Partial<Dict>
  submitMode?: 'store' | 'draft'
  fluid?: boolean
}>()
const emit = defineEmits<{
  submit: [dict?: Dict]
  close: []
}>()
const runtimeStore = useRuntimeStore()
const store = useBaseStore()
const DefaultDictForm = {
  id: '',
  name: '',
  description: '',
  category: '',
  tags: [],
  translateLanguage: 'zh-CN',
  language: 'en',
  type: DictType.article,
}
let dictForm: any = $ref(cloneDeep(DefaultDictForm))
const dictFormRef: any = $ref()
let loading = $ref(false)
const { t: $t } = useI18n()
const dictRules: any = reactive({
  name: [
    { required: true, message: '请输入名称', trigger: 'blur' },
    { max: 20, message: '名称不能超过20个字符', trigger: 'blur' },
  ],
})

async function onSubmit() {
  await dictFormRef.validate(async valid => {
    if (valid) {
      let data: Dict = getDefaultDict(dictForm)
      data.type = props.isBook ? DictType.article : DictType.word
      let source = [store.article, store.word][props.isBook ? 0 : 1]
      if (props.submitMode === 'draft') {
        data.id = data.id || props.initialData?.id || 'pending-dict-' + Date.now()
        data.custom = true
        if (source.bookList.find(v => v.name === data.name)) {
          Toast.warning('已有相同名称！')
          return
        }
        emit('submit', getDefaultDict(data))
        return
      }
      //todo 可以检查的更准确些，比如json对比
      if (props.isAdd) {
        if (props.initialData?.id) {
          // 副本模式：保留已生成的 id 和 sourceId
          data.id = props.initialData.id
          data.sourceId = props.initialData.sourceId ?? ''
        } else {
          data.id = 'custom-dict-' + Date.now()
        }
        data.custom = true
        if (source.bookList.find(v => v.name === data.name)) {
          Toast.warning('已有相同名称！')
          return
        } else {
          source.bookList.push(cloneDeep(data))
          runtimeStore.editDict = data
          emit('submit', data)
          Toast.success('添加成功')
        }
      } else {
        const originalId = data.id
        data = ensureCustomDictCopy(data)
        let rIndex = source.bookList.findIndex(v => v.id === originalId)
        runtimeStore.editDict = data
        if (rIndex > -1) {
          source.bookList[rIndex] = getDefaultDict(data)
          emit('submit', data)
          Toast.success('修改成功')
        } else {
          source.bookList.push(getDefaultDict(data))
          Toast.success('修改成功并加入我的词典')
        }
      }
    } else {
      Toast.warning('请填写完整')
    }
  })
}

onMounted(() => {
  if (props.initialData) {
    // 创建副本模式：用传入的初始数据填充表单
    dictForm = cloneDeep({ ...cloneDeep(DefaultDictForm), ...props.initialData })
  } else if (!props.isAdd) {
    dictForm = cloneDeep(runtimeStore.editDict)
  }
})
</script>

<template>
  <div :class="fluid ? 'w-full mt-4' : 'w-120 mt-4'">
    <Form ref="dictFormRef" :rules="dictRules" :model="dictForm" label-width="8rem">
      <FormItem label="名称" prop="name">
        <BaseInput v-model="dictForm.name" />
      </FormItem>
      <FormItem label="描述">
        <Textarea v-model="dictForm.description" autosize></Textarea>
      </FormItem>
      <FormItem label="原文语言" v-if="false">
        <Select v-model="dictForm.language" placeholder="请选择">
          <Option label="英语" value="en" />
          <Option label="德语" value="de" />
          <Option label="日语" value="ja" />
          <Option label="代码" value="code" />
        </Select>
      </FormItem>
      <FormItem label="译文语言" v-if="false">
        <Select v-model="dictForm.translateLanguage" placeholder="请选择">
          <Option label="中文" value="zh-CN" />
          <Option label="英语" value="en" />
          <Option label="德语" value="de" />
          <Option label="日语" value="ja" />
        </Select>
      </FormItem>
      <div class="center">
        <base-button type="info" @click="emit('close')">{{ '关闭' }}</base-button>
        <base-button type="primary" :loading="loading" @click="onSubmit">{{ '确认' }}</base-button>
      </div>
    </Form>
  </div>
</template>

<style scoped lang="scss"></style>
