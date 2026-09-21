import { CheckCircle2, Bot, Eye, EyeOff, KeyRound, LoaderCircle, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { FormEvent, Dispatch, SetStateAction } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { SmartContractsScreen } from '@/features/smart-contract/ui/SmartContractsScreen'
import { aiProviderOptions, controlClass, type AIKey, type AIProvider, type ExecutionSection } from '@/features/profile/model/settings'

function formatVerifiedAt(value?: string) {
  if (!value) return '尚未验证'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '已验证' : `已验证 ${date.toLocaleDateString('zh-CN')}`
}

function getAIProviderOption(provider: AIKey['provider']) {
  if (provider === 'openai_compatible') return aiProviderOptions.find((option) => option.id === 'openai') ?? aiProviderOptions[0]
  return aiProviderOptions.find((option) => option.id === provider) ?? aiProviderOptions[0]
}

type ExecutionSettingsPanelProps = {
  executionSection: ExecutionSection
  setExecutionSection: (section: ExecutionSection) => void
  accessToken: string
  aiKeys: AIKey[]
  isLoadingAIKeys: boolean
  isAIKeyDialogOpen: boolean
  setIsAIKeyDialogOpen: (open: boolean) => void
  aiKeyProvider: AIProvider
  aiKeyLabel: string
  aiKeyValue: string
  aiKeyBaseURL: string
  aiKeyModel: string
  aiKeyMessage: string
  isAIKeyVisible: boolean
  setIsAIKeyVisible: Dispatch<SetStateAction<boolean>>
  isTestingAIKey: boolean
  isSavingAIKey: boolean
  busyAIKeyID: string
  revealedAIKeyIDs: string[]
  setRevealedAIKeyIDs: React.Dispatch<React.SetStateAction<string[]>>
  onAIProviderChange: (provider: AIProvider) => void
  onAIKeySubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onAIKeyTest: () => Promise<void>
  updateAIKey: (key: AIKey, action: 'verify' | 'delete') => Promise<void>
  setAIKeyLabel: (value: string) => void
  setAIKeyValue: (value: string) => void
  setAIKeyBaseURL: (value: string) => void
  setAIKeyModel: (value: string) => void
}

export function ExecutionSettingsPanel(props: ExecutionSettingsPanelProps) {
  const {
    executionSection, setExecutionSection, accessToken, aiKeys, isLoadingAIKeys, isAIKeyDialogOpen, setIsAIKeyDialogOpen,
    aiKeyProvider, aiKeyLabel, aiKeyValue, aiKeyBaseURL, aiKeyModel, aiKeyMessage, isAIKeyVisible, setIsAIKeyVisible,
    isTestingAIKey, isSavingAIKey, busyAIKeyID, revealedAIKeyIDs, setRevealedAIKeyIDs, onAIProviderChange, onAIKeySubmit,
    onAIKeyTest, updateAIKey, setAIKeyLabel, setAIKeyValue, setAIKeyBaseURL, setAIKeyModel,
  } = props
  const selectedAIProvider = getAIProviderOption(aiKeyProvider)

  return (
        <div className="max-w-5xl space-y-8">
      <nav className="flex items-center gap-1 border-b border-rail" aria-label="执行配置分类">
        <button
          type="button"
          onClick={() => setExecutionSection('keys')}
          className={`inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition focus:outline-none focus-visible:shadow-focusline ${executionSection === 'keys' ? 'border-signal text-signal' : 'border-transparent text-graphite hover:text-ink'}`}
        >
          <Bot size={16} aria-hidden="true" />
          AI 密钥
        </button>
        <button
          type="button"
          onClick={() => setExecutionSection('contracts')}
          className={`inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition focus:outline-none focus-visible:shadow-focusline ${executionSection === 'contracts' ? 'border-signal text-signal' : 'border-transparent text-graphite hover:text-ink'}`}
        >
          <ShieldCheck size={16} aria-hidden="true" />
          智能合约
        </button>
      </nav>

      {executionSection === 'keys' ? (
      <section className="border-b border-rail pb-8" aria-labelledby="ai-keys-title">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-rail pb-5">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal">
              <Bot size={16} aria-hidden="true" />
              AI credentials
            </div>
            <h2 id="ai-keys-title" className="mt-2 font-display text-2xl font-semibold text-ink">AI 密钥</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsAIKeyDialogOpen(true)}
            disabled={!accessToken}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-signal px-3 text-sm font-semibold text-white transition hover:bg-signalStrong disabled:cursor-not-allowed disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline"
          >
            <Plus size={16} aria-hidden="true" />
            添加密钥
          </button>
        </div>

        {!accessToken ? <p className="mt-5 text-sm font-medium text-clay">登录后才能配置用于智能合约审查的 AI 密钥。</p> : null}

        <div className="mt-5">
          {isLoadingAIKeys ? <div className="flex items-center gap-2 text-sm font-medium text-graphite"><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />读取密钥库</div> : null}
          {!isLoadingAIKeys && accessToken && aiKeys.length === 0 ? <p className="text-sm font-medium text-graphite">尚未添加 AI 密钥。</p> : null}
          <div className="divide-y divide-rail">
            {aiKeys.map((key) => {
              const isBusy = busyAIKeyID === key.uuid
              return (
                <div key={key.uuid} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <span className="font-semibold text-ink">{key.label}</span>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-graphite">
                      <span>{getAIProviderOption(key.provider).label}</span>
                      <span>{key.model}</span>
                      <span>{key.keyHint}</span>
                      <span>{formatVerifiedAt(key.lastVerifiedAt)}</span>
                    </div>
                    {revealedAIKeyIDs.includes(key.uuid) ? <code className="mt-2 block break-all rounded-md bg-paper px-2 py-1.5 text-xs text-ink">{key.apiKey ?? '此密钥需要重新保存后才能显示原文。'}</code> : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setRevealedAIKeyIDs((ids) => (ids.includes(key.uuid) ? ids.filter((id) => id !== key.uuid) : [...ids, key.uuid]))} disabled={isBusy} className="grid size-9 place-items-center rounded-md text-graphite transition hover:bg-paper hover:text-signal disabled:cursor-wait disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline" title={revealedAIKeyIDs.includes(key.uuid) ? '隐藏原文' : '显示原文'} aria-label={revealedAIKeyIDs.includes(key.uuid) ? `隐藏 ${key.label} 原文` : `显示 ${key.label} 原文`}>{revealedAIKeyIDs.includes(key.uuid) ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}</button>
                    <button type="button" onClick={() => void updateAIKey(key, 'verify')} disabled={isBusy} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-rail bg-paper px-3 text-sm font-semibold text-graphite transition hover:border-signal hover:text-signal disabled:cursor-wait disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline" title="测试密钥" aria-label={`测试 ${key.label}`}>
                      {isBusy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                      测试
                    </button>
                    <button type="button" onClick={() => void updateAIKey(key, 'delete')} disabled={isBusy} className="grid size-9 place-items-center rounded-md text-graphite transition hover:bg-paper hover:text-clay disabled:cursor-wait disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline" title="删除密钥" aria-label={`删除 ${key.label}`}><Trash2 size={16} aria-hidden="true" /></button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
      ) : <SmartContractsScreen compact />}

      <Dialog open={isAIKeyDialogOpen} onOpenChange={setIsAIKeyDialogOpen}>
        <DialogContent className="grid-rows-[auto_minmax(0,1fr)] max-w-2xl">
          <DialogHeader>
            <DialogTitle>添加 AI 密钥</DialogTitle>
            <DialogDescription>配置一把用于项目智能合约审查的 AI 密钥。</DialogDescription>
          </DialogHeader>
          <form className="grid max-h-[calc(100dvh-12rem)] gap-4 overflow-y-auto px-6 py-6 lg:grid-cols-2" onSubmit={onAIKeySubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-ink">服务</span>
            <select value={aiKeyProvider} onChange={(event) => onAIProviderChange(event.target.value as AIProvider)} className={controlClass} disabled={!accessToken || isSavingAIKey}>
              {aiProviderOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-ink">名称</span>
            <input value={aiKeyLabel} onChange={(event) => setAIKeyLabel(event.target.value)} placeholder={selectedAIProvider.labelPlaceholder} className={controlClass} disabled={!accessToken || isSavingAIKey} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-ink">模型</span>
            <input value={aiKeyModel} onChange={(event) => setAIKeyModel(event.target.value)} placeholder={selectedAIProvider.modelPlaceholder} className={controlClass} disabled={!accessToken || isSavingAIKey} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-ink">API Key</span>
            <div className="relative">
              <input
                type={isAIKeyVisible ? 'text' : 'password'}
                autoComplete="off"
                value={aiKeyValue}
                onChange={(event) => setAIKeyValue(event.target.value)}
                placeholder="保存后仅显示掩码"
                className={`${controlClass} w-full pr-11 font-mono`}
                disabled={!accessToken || isSavingAIKey}
              />
              <button
                type="button"
                onClick={() => setIsAIKeyVisible((visible) => !visible)}
                disabled={!accessToken || isSavingAIKey}
                className="absolute right-1 top-1 grid size-9 place-items-center rounded-md text-graphite transition hover:bg-shell hover:text-signal disabled:cursor-not-allowed disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline"
                title={isAIKeyVisible ? '隐藏 API Key' : '显示 API Key'}
                aria-label={isAIKeyVisible ? '隐藏 API Key' : '显示 API Key'}
              >
                {isAIKeyVisible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
          </label>
          <label className="grid gap-2 lg:col-span-2">
            <span className="text-sm font-semibold text-ink">服务地址</span>
            <input type="url" value={aiKeyBaseURL} onChange={(event) => setAIKeyBaseURL(event.target.value)} placeholder={selectedAIProvider.baseUrl} className={controlClass} disabled={!accessToken || isSavingAIKey} />
          </label>
          <div className="flex flex-wrap items-center gap-3 border-t border-rail pt-5 lg:col-span-2">
            <button type="button" onClick={onAIKeyTest} disabled={!accessToken || isSavingAIKey || isTestingAIKey} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-rail bg-paper px-4 text-sm font-semibold text-ink transition hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline">
              {isTestingAIKey ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
              测试
            </button>
            <button type="submit" disabled={!accessToken || isSavingAIKey} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-signal px-4 text-sm font-semibold text-white transition hover:bg-signalStrong disabled:cursor-not-allowed disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline">
              {isSavingAIKey ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <KeyRound size={16} aria-hidden="true" />}
              保存 AI 密钥
            </button>
            {aiKeyMessage ? <span className={`text-sm font-semibold ${aiKeyMessage.includes('失败') || aiKeyMessage.includes('请输入') || aiKeyMessage.includes('登录') || aiKeyMessage.includes('无法') ? 'text-clay' : 'text-moss'}`}>{aiKeyMessage}</span> : null}
          </div>
          </form>
        </DialogContent>
      </Dialog>
        </div>
  )
}
