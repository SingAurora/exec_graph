import { CheckCircle2, Eye, EyeOff, FlaskConical, KeyRound, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { AIKeyConfig, AIProvider, SaveAIKeyInput } from '../../../entities/ai-key/model/types'
import { aiProviders } from '../../../entities/ai-key/model/catalog'
import { sortAIKeyConfigs } from '../../../entities/ai-key/lib/configurations'
import { testAIConfig } from '../api/test'
import { Tooltip } from '../../../shared/ui/tooltip/Tooltip'
import { Select } from '../../../shared/ui/select/Select'
import { useToast } from '../../../shared/ui/toast/useToast'

type AIKeySettingsProps = {
  configs: AIKeyConfig[]
  onSave: (input: SaveAIKeyInput) => void
  onSetDefault: (id: string) => void
  onDelete: (id: string) => void
}

/** Renders transient AI credential input and saved configuration metadata. */
export function AIKeySettings({ configs, onSave, onSetDefault, onDelete }: AIKeySettingsProps) {
  const initialProvider = aiProviders[0]
  const [provider, setProvider] = useState<AIProvider>(initialProvider.id)
  const [label, setLabel] = useState(`个人 ${initialProvider.label}`)
  const [model, setModel] = useState(initialProvider.models[0].id)
  const [apiKey, setApiKey] = useState('')
  const [isKeyVisible, setIsKeyVisible] = useState(false)
  const [status, setStatus] = useState('')
  const [testingId, setTestingId] = useState<string | null>(null)
  const { showToast } = useToast()
  const selectedProvider = aiProviders.find((option) => option.id === provider) ?? initialProvider
  const sortedConfigs = sortAIKeyConfigs(configs)

  const changeProvider = (nextProvider: AIProvider) => {
    const option = aiProviders.find((item) => item.id === nextProvider) ?? initialProvider
    setProvider(option.id)
    setLabel(`个人 ${option.label}`)
    setModel(option.models[0].id)
    setApiKey('')
    setIsKeyVisible(false)
    setStatus('')
  }

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedKey = apiKey.trim()
    if (!trimmedKey || !selectedProvider.models.some((item) => item.id === model)) { setStatus('请选择模型并填写 API Key。'); return }
    onSave({ provider, label: label.trim() || `个人 ${selectedProvider.label}`, model, baseUrl: selectedProvider.baseUrl, keyHint: `**** ${trimmedKey.slice(-4)}`, apiKey: trimmedKey })
    changeProvider(initialProvider.id)
    showToast({ kind: 'info', message: 'AI 配置已保存' })
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
      <div className="grid items-start gap-5 min-[701px]:grid-cols-[minmax(150px,1fr)_minmax(0,520px)]"><div className="grid gap-[5px]"><strong className="text-sm">AI 密钥</strong><span className="text-xs text-muted">用于整理行动和表达</span></div>
        <form className="grid w-full grid-cols-2 gap-3 max-[700px]:grid-cols-1" onSubmit={save}>
          <label className="grid gap-1.5"><span className="text-xs font-medium text-ink">服务商</span><Select className="!h-10 w-full !border !border-line !bg-surface !text-sm !font-normal focus-visible:!border-signal" ariaLabel="服务商" value={provider} onValueChange={(value) => changeProvider(value as AIProvider)} options={aiProviders.map((option) => ({ value: option.id, label: option.label }))} /></label>
          <label className="grid gap-1.5"><span className="text-xs font-medium text-ink">配置名称</span><input className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-signal" value={label} maxLength={40} onChange={(event) => setLabel(event.target.value)} placeholder={`个人 ${selectedProvider.label}`} /></label>
          <label className="grid gap-1.5"><span className="text-xs font-medium text-ink">模型</span><Select key={provider} className="!h-10 w-full !border !border-line !bg-surface !text-sm !font-normal focus-visible:!border-signal" ariaLabel="模型" value={model} onValueChange={(value) => { if (selectedProvider.models.some((option) => option.id === value)) { setModel(value); setStatus('') } }} options={selectedProvider.models.map((option) => ({ value: option.id, label: option.label }))} /></label>
          <label className="grid gap-1.5"><span className="text-xs font-medium text-ink">API Key</span><span className="relative block"><input className="h-10 w-full rounded-md border border-line bg-surface px-3 pr-10 text-sm text-ink outline-none focus:border-signal" aria-label="API Key" type={isKeyVisible ? 'text' : 'password'} value={apiKey} autoComplete="off" onChange={(event) => { setApiKey(event.target.value); setStatus('') }} placeholder="输入 API Key" /><button className="absolute right-1 top-1 grid size-[30px] place-items-center rounded bg-transparent text-muted hover:bg-soft hover:text-signal" type="button" aria-label={isKeyVisible ? '隐藏 API Key' : '显示 API Key'} title={isKeyVisible ? '隐藏 API Key' : '显示 API Key'} onClick={() => setIsKeyVisible((visible) => !visible)}>{isKeyVisible ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
          <div className="col-span-full flex min-h-[38px] items-center justify-between gap-3 max-[700px]:col-span-1"><span className="text-[11px] text-signal" role="status">{status}</span><button className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-md border-0 bg-signal px-3.5 py-[9px] text-[13px] font-semibold text-on-signal transition hover:bg-signal-dark" type="submit" disabled={!apiKey.trim()}><KeyRound size={15} />保存配置</button></div>
        </form>
      </div>
      {sortedConfigs.map((config) => <div className="flex items-center justify-between gap-5 max-[700px]:grid max-[700px]:items-start" key={config.id}><div className="grid min-w-0 gap-1"><span className="inline-flex items-center gap-[7px] text-[10px] font-bold text-signal">{providerLabel(config.provider)}{config.isDefault && <em className="rounded-lg bg-signal-soft px-1.5 py-0.5 not-italic">使用中</em>}</span><strong className="text-sm">{config.label}</strong><span className="text-xs text-muted">{config.model} · {config.keyHint}</span></div><div className="flex items-center gap-[7px] max-[700px]:justify-start"><button className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-transparent px-3 py-2 text-xs font-semibold text-muted transition hover:border-signal hover:text-signal" type="button" onClick={() => test(config)} disabled={testingId === config.id}><FlaskConical size={14} />{testingId === config.id ? '测试中' : '测试'}</button>{!config.isDefault && <button className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-transparent px-3 py-2 text-xs font-semibold text-muted transition hover:border-signal hover:text-signal" type="button" onClick={() => onSetDefault(config.id)}><CheckCircle2 size={14} />设为使用中</button>}{config.source !== 'platform' && <Tooltip content="删除配置"><button className="grid size-[34px] place-items-center rounded-md border border-line bg-transparent text-muted transition hover:border-signal hover:text-signal" type="button" aria-label={`删除 ${config.label}`} onClick={() => onDelete(config.id)}><Trash2 size={15} /></button></Tooltip>}</div></div>)}
    </div>
  </div>
}

function providerLabel(provider: AIProvider) {
  return aiProviders.find((option) => option.id === provider)?.label ?? provider
}
