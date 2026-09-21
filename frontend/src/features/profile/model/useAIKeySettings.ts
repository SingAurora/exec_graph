import { FormEvent, useCallback, useEffect, useState } from 'react'
import { createAIKey, deleteAIKey, listAIKeys, testAIKeyConfiguration, verifySavedAIKey } from '@/entities/ai-key/api/client'
import { showErrorToast, showSuccessToast } from '@/shared/ui/notifications'
import { aiProviderOptions, type AIKey, type AIProvider } from '@/features/profile/model/settings'

function getAIProviderOption(provider: AIKey['provider']) {
  if (provider === 'openai_compatible') {
    return aiProviderOptions.find((option) => option.id === 'openai') ?? aiProviderOptions[0]
  }
  return aiProviderOptions.find((option) => option.id === provider) ?? aiProviderOptions[0]
}

function getAIKeyErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '请求失败，请稍后重试。'
}

export function useAIKeySettings(accessToken: string) {
  const [aiKeys, setAIKeys] = useState<AIKey[]>([])
  const [aiKeyProvider, setAIKeyProvider] = useState<AIProvider>('deepseek')
  const [aiKeyLabel, setAIKeyLabel] = useState('')
  const [aiKeyValue, setAIKeyValue] = useState('')
  const [aiKeyBaseURL, setAIKeyBaseURL] = useState(getAIProviderOption('deepseek').baseUrl)
  const [aiKeyModel, setAIKeyModel] = useState('')
  const [aiKeyMessage, setAIKeyMessage] = useState('')
  const [isAIKeyVisible, setIsAIKeyVisible] = useState(false)
  const [isTestingAIKey, setIsTestingAIKey] = useState(false)
  const [isLoadingAIKeys, setIsLoadingAIKeys] = useState(false)
  const [isSavingAIKey, setIsSavingAIKey] = useState(false)
  const [busyAIKeyID, setBusyAIKeyID] = useState('')
  const [revealedAIKeyIDs, setRevealedAIKeyIDs] = useState<string[]>([])
  const [isAIKeyDialogOpen, setIsAIKeyDialogOpen] = useState(false)

  const loadAIKeys = useCallback(async () => {
    if (!accessToken) {
      setAIKeys([])
      return
    }
    setIsLoadingAIKeys(true)
    try {
      const data = await listAIKeys(accessToken)
      setAIKeys(data.keys ?? [])
    } catch (error) {
      setAIKeyMessage(error instanceof Error ? error.message : '无法连接服务，请确认后端已启动。')
    } finally {
      setIsLoadingAIKeys(false)
    }
  }, [accessToken])

  useEffect(() => {
    void loadAIKeys()
  }, [loadAIKeys])

  const onAIProviderChange = (provider: AIProvider) => {
    const option = getAIProviderOption(provider)
    setAIKeyProvider(provider)
    setAIKeyMessage('')
    setAIKeyBaseURL(option.baseUrl)
    setAIKeyModel('')
  }

  const getAIKeyDraft = () => ({
    provider: aiKeyProvider,
    label: aiKeyLabel,
    apiKey: aiKeyValue,
    baseUrl: aiKeyBaseURL,
    model: aiKeyModel,
  })

  const validateAIKeyDraft = (action: '保存' | '测试') => {
    setAIKeyMessage('')
    if (!accessToken) {
      setAIKeyMessage(`登录后才能${action} AI 密钥。`)
      return false
    }
    if (!aiKeyValue.trim()) {
      setAIKeyMessage('请输入 API Key。')
      return false
    }
    if (!aiKeyModel.trim()) {
      setAIKeyMessage('请输入模型名称。')
      return false
    }
    return true
  }

  const onAIKeySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validateAIKeyDraft('保存')) return
    setIsSavingAIKey(true)
    try {
      const data = await createAIKey(accessToken, getAIKeyDraft())
      setAIKeys((keys) => [...keys, data])
      setAIKeyValue('')
      setAIKeyLabel('')
      setIsAIKeyVisible(false)
      setIsAIKeyDialogOpen(false)
      setAIKeyMessage('AI 密钥已保存。')
      showSuccessToast('AI 密钥已保存。')
    } catch (error) {
      const message = getAIKeyErrorMessage(error)
      setAIKeyMessage(message)
      showErrorToast(message)
    } finally {
      setIsSavingAIKey(false)
    }
  }

  const onAIKeyTest = async () => {
    if (!validateAIKeyDraft('测试')) return
    setIsTestingAIKey(true)
    try {
      const data = await testAIKeyConfiguration(accessToken, getAIKeyDraft())
      const message = data.message ?? '测试通过。'
      setAIKeyMessage(message)
      showSuccessToast(message)
    } catch (error) {
      const message = getAIKeyErrorMessage(error)
      setAIKeyMessage(message)
      showErrorToast(message)
    } finally {
      setIsTestingAIKey(false)
    }
  }

  const updateAIKey = async (key: AIKey, action: 'verify' | 'delete') => {
    if (!accessToken) return
    setAIKeyMessage('')
    setBusyAIKeyID(key.uuid)
    try {
      if (action === 'delete') {
        const data = await deleteAIKey(accessToken, key.uuid)
        setAIKeys((keys) => keys.filter((item) => item.uuid !== key.uuid))
        const message = data.message ?? 'AI 密钥已删除。'
        setAIKeyMessage(message)
      } else {
        const data = await verifySavedAIKey(accessToken, key.uuid)
        setAIKeys((keys) => keys.map((item) => (item.uuid === key.uuid ? { ...item, lastVerifiedAt: data.lastVerifiedAt ?? new Date().toISOString() } : item)))
        const message = data.message ?? '操作已完成。'
        setAIKeyMessage(message)
        showSuccessToast(message)
      }
    } catch (error) {
      const message = getAIKeyErrorMessage(error)
      setAIKeyMessage(message)
      if (action === 'verify') showErrorToast(message)
    } finally {
      setBusyAIKeyID('')
    }
  }

  return {
    aiKeys, aiKeyProvider, aiKeyLabel, aiKeyValue, aiKeyBaseURL, aiKeyModel, aiKeyMessage, isAIKeyVisible,
    isTestingAIKey, isLoadingAIKeys, isSavingAIKey, busyAIKeyID, revealedAIKeyIDs, isAIKeyDialogOpen,
    setIsAIKeyDialogOpen, setIsAIKeyVisible, setRevealedAIKeyIDs, onAIProviderChange, onAIKeySubmit,
    onAIKeyTest, updateAIKey, setAIKeyLabel, setAIKeyValue, setAIKeyBaseURL, setAIKeyModel,
  }
}
