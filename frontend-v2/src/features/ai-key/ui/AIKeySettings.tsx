import { CheckCircle2, Eye, EyeOff, KeyRound, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { AIKeyConfig, AIProvider, SaveAIKeyInput } from '../../../entities/ai-key/model/types'
import { Tooltip } from '../../../shared/ui/tooltip/Tooltip'
import { Select } from '../../../shared/ui/select/Select'

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
    onSave({ provider, label: label.trim() || selectedProvider.label, model: model.trim(), baseUrl: baseUrl.trim(), keyHint: `**** ${trimmedKey.slice(-4)}` })
    setApiKey('')
    setIsKeyVisible(false)
    setStatus('AI 配置已保存。')
  }

  return <div className="ai-key-settings">
    <div className="settings-list">
      <div className="setting-row ai-key-setting-row"><div><strong>AI 密钥</strong><span>用于生成计划和完成记录</span></div>
        <form className="ai-key-form" onSubmit={save}>
          <label><span>服务商</span><Select ariaLabel="服务商" value={provider} onValueChange={(value) => changeProvider(value as AIProvider)} options={providerOptions.map((option) => ({ value: option.id, label: option.label }))} /></label>
          <label><span>配置名称</span><input value={label} maxLength={40} onChange={(event) => setLabel(event.target.value)} placeholder={`个人 ${selectedProvider.label}`} /></label>
          <label><span>模型</span><input value={model} onChange={(event) => setModel(event.target.value)} placeholder={selectedProvider.modelPlaceholder} /></label>
          <label><span>API Key</span><span className="secret-input"><input type={isKeyVisible ? 'text' : 'password'} value={apiKey} autoComplete="off" onChange={(event) => { setApiKey(event.target.value); setStatus('') }} placeholder="输入 API Key" /><button type="button" aria-label={isKeyVisible ? '隐藏 API Key' : '显示 API Key'} title={isKeyVisible ? '隐藏 API Key' : '显示 API Key'} onClick={() => setIsKeyVisible((visible) => !visible)}>{isKeyVisible ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
          <label className="ai-key-wide"><span>服务地址</span><input type="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" /></label>
          <div className="ai-key-form-footer"><span role="status">{status}</span><button className="primary-button" type="submit" disabled={!apiKey.trim() || !model.trim() || !baseUrl.trim()}><KeyRound size={15} />保存配置</button></div>
        </form>
      </div>
      {configs.map((config) => <div className="setting-row ai-config-row" key={config.id}><div className="ai-config-copy"><span className="ai-config-label">{providerLabel(config.provider)}{config.isDefault && <em>使用中</em>}</span><strong>{config.label}</strong><span>{config.model} · {config.keyHint}</span><small>{config.baseUrl}</small></div><div className="ai-config-actions">{!config.isDefault && <button className="quiet-button" type="button" onClick={() => onSetDefault(config.id)}><CheckCircle2 size={14} />设为使用中</button>}<Tooltip content="删除配置"><button className="icon-button" type="button" aria-label={`删除 ${config.label}`} onClick={() => onDelete(config.id)}><Trash2 size={15} /></button></Tooltip></div></div>)}
    </div>
  </div>
}

function providerLabel(provider: AIProvider) {
  return providerOptions.find((option) => option.id === provider)?.label ?? provider
}
