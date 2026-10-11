import { CheckCircle2, Eye, EyeOff, FlaskConical, KeyRound, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { AIKeyConfig, AIProvider, SaveAIKeyInput } from '../../../entities/ai-key/model/types'
import { testAIConfig } from '../api/test'
import { Tooltip } from '../../../shared/ui/tooltip/Tooltip'
import { Select } from '../../../shared/ui/select/Select'
import { useToast } from '../../../shared/ui/toast/useToast'

const providerOptions: Array<{ id: AIProvider; label: string; baseUrl: string; modelPlaceholder: string }> = [
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', modelPlaceholder: '例如：deepseek-chat' },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', modelPlaceholder: '例如：gpt-4o-mini' },
  { id: 'doubao', label: '豆包', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', modelPlaceholder: '例如：doubao-seed-1-6-250615' },
  { id: 'claude', label: 'Claude', baseUrl: 'https://api.anthropic.com/v1', modelPlaceholder: '例如：claude-sonnet-4-5' },
  { id: 'openai_compatible', label: 'OpenAI 兼容服务', baseUrl: '', modelPlaceholder: '输入服务提供的模型名称' },
]

type AIKeySettingsProps = {
  configs: AIKeyConfig[]
  onSave: (input: SaveAIKeyInput) => void
  onSetDefault: (id: string) => void
  onDelete: (id: string) => void
}

/** Renders transient AI credential input and saved configuration metadata. */
export function AIKeySettings({ configs, onSave, onSetDefault, onDelete }: AIKeySettingsProps) {
  const initialProvider = providerOptions[0]
  const [provider, setProvider] = useState<AIProvider>(initialProvider.id)
  const [label, setLabel] = useState(`个人 ${initialProvider.label}`)
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(initialProvider.baseUrl)
  const [isKeyVisible, setIsKeyVisible] = useState(false)
  const [status, setStatus] = useState('')
  const [testingId, setTestingId] = useState<string | null>(null)
  const { showToast } = useToast()
  const selectedProvider = providerOptions.find((option) => option.id === provider) ?? initialProvider

  const changeProvider = (nextProvider: AIProvider) => {
    const option = providerOptions.find((item) => item.id === nextProvider) ?? initialProvider
    setProvider(option.id)
    setLabel(`个人 ${option.label}`)
    setModel('')
    setBaseUrl(option.baseUrl)
    setStatus('')
  }

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedKey = apiKey.trim()
    if (!trimmedKey || !model.trim() || !baseUrl.trim()) { setStatus('请填写模型、API Key 和服务地址。'); return }
    onSave({ provider, label: label.trim() || selectedProvider.label, model: model.trim(), baseUrl: baseUrl.trim(), keyHint: `**** ${trimmedKey.slice(-4)}`, apiKey: trimmedKey })
    setApiKey('')
    setIsKeyVisible(false)
    setStatus('AI 配置已保存。')
  }

  const test = async (config: AIKeyConfig) => {
    setTestingId(config.id)
    try {
      await testAIConfig(config)
      showToast({ kind: 'info', message: `${config.label} 连接成功` })
    } catch (error) {
      showToast({ kind: 'error', message: error instanceof Error ? `测试失败：${error.message}` : '测试失败，请检查配置。' })
    } finally {
      setTestingId(null)
    }
  }

  return <div>
    <div className="mt-5 grid gap-5">
      <div className="grid items-start gap-5 min-[701px]:grid-cols-[minmax(150px,1fr)_minmax(0,520px)]"><div className="grid gap-[5px]"><strong className="text-sm">AI 密钥</strong><span className="text-xs text-muted">用于生成计划和完成记录</span></div>
        <form className="grid w-full grid-cols-2 gap-3 max-[700px]:grid-cols-1" onSubmit={save}>
          <label className="grid gap-1.5"><span className="text-[11px] font-bold text-ink">服务商</span><Select className="w-full !border !border-line !bg-transparent focus-visible:!border-signal" ariaLabel="服务商" value={provider} onValueChange={(value) => changeProvider(value as AIProvider)} options={providerOptions.map((option) => ({ value: option.id, label: option.label }))} /></label>
          <label className="grid gap-1.5"><span className="text-[11px] font-bold text-ink">配置名称</span><input className="h-[38px] w-full rounded-md border border-line bg-transparent px-2.5 text-xs text-ink outline-none focus:border-signal" value={label} maxLength={40} onChange={(event) => setLabel(event.target.value)} placeholder={`个人 ${selectedProvider.label}`} /></label>
          <label className="grid gap-1.5"><span className="text-[11px] font-bold text-ink">模型</span><input className="h-[38px] w-full rounded-md border border-line bg-transparent px-2.5 text-xs text-ink outline-none focus:border-signal" value={model} onChange={(event) => setModel(event.target.value)} placeholder={selectedProvider.modelPlaceholder} /></label>
          <label className="grid gap-1.5"><span className="text-[11px] font-bold text-ink">API Key</span><span className="relative block"><input className="h-[38px] w-full rounded-md border border-line bg-transparent px-2.5 pr-10 text-xs text-ink outline-none focus:border-signal" type={isKeyVisible ? 'text' : 'password'} value={apiKey} autoComplete="off" onChange={(event) => { setApiKey(event.target.value); setStatus('') }} placeholder="输入 API Key" /><button className="absolute right-1 top-1 grid size-[30px] place-items-center rounded bg-transparent text-muted hover:bg-soft hover:text-signal" type="button" aria-label={isKeyVisible ? '隐藏 API Key' : '显示 API Key'} title={isKeyVisible ? '隐藏 API Key' : '显示 API Key'} onClick={() => setIsKeyVisible((visible) => !visible)}>{isKeyVisible ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
          <label className="col-span-full grid gap-1.5 max-[700px]:col-span-1"><span className="text-[11px] font-bold text-ink">服务地址</span><input className="h-[38px] w-full rounded-md border border-line bg-transparent px-2.5 text-xs text-ink outline-none focus:border-signal" type="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" /></label>
          <div className="col-span-full flex min-h-[38px] items-center justify-between gap-3 max-[700px]:col-span-1"><span className="text-[11px] text-signal" role="status">{status}</span><button className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-md border-0 bg-signal px-3.5 py-[9px] text-[13px] font-bold text-white transition hover:bg-signal-dark" type="submit" disabled={!apiKey.trim() || !model.trim() || !baseUrl.trim()}><KeyRound size={15} />保存配置</button></div>
        </form>
      </div>
      {configs.map((config) => <div className="flex items-center justify-between gap-5 max-[700px]:grid max-[700px]:items-start" key={config.id}><div className="grid min-w-0 gap-1"><span className="inline-flex items-center gap-[7px] text-[10px] font-bold text-signal">{providerLabel(config.provider)}{config.isDefault && <em className="rounded-lg bg-signal-soft px-1.5 py-0.5 not-italic">使用中</em>}</span><strong className="text-sm">{config.label}</strong><span className="text-xs text-muted">{config.model} · {config.keyHint}</span><small className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-muted">{config.baseUrl}</small></div><div className="flex items-center gap-[7px] max-[700px]:justify-start"><button className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-transparent px-3 py-2 text-xs font-semibold text-muted transition hover:border-signal hover:text-signal" type="button" onClick={() => test(config)} disabled={testingId === config.id}><FlaskConical size={14} />{testingId === config.id ? '测试中' : '测试'}</button>{!config.isDefault && <button className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-transparent px-3 py-2 text-xs font-semibold text-muted transition hover:border-signal hover:text-signal" type="button" onClick={() => onSetDefault(config.id)}><CheckCircle2 size={14} />设为使用中</button>}<Tooltip content="删除配置"><button className="grid size-[34px] place-items-center rounded-md border border-line bg-transparent text-muted transition hover:border-signal hover:text-signal" type="button" aria-label={`删除 ${config.label}`} onClick={() => onDelete(config.id)}><Trash2 size={15} /></button></Tooltip></div></div>)}
    </div>
  </div>
}

function providerLabel(provider: AIProvider) {
  return providerOptions.find((option) => option.id === provider)?.label ?? provider
}
