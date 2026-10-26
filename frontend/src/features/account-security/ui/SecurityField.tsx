import { CircleAlert, Eye, EyeOff } from 'lucide-react'
import { useState, type InputHTMLAttributes, type ReactNode } from 'react'

type SecurityFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  error?: string
  action?: ReactNode
}

/** Provides consistent inline feedback and password visibility in security forms. */
export function SecurityField({ id, label, error, action, type = 'text', ...inputProps }: SecurityFieldProps) {
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">{label}</label>
      <div className="flex items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <input {...inputProps} id={id} type={isPassword && visible ? 'text' : type} required
            className={`form-input h-10 data-[invalid=true]:border-coral ${isPassword ? 'pr-10' : ''}`}
            data-invalid={Boolean(error)} />
          {isPassword && <button className="absolute right-1 top-1 grid size-8 place-items-center rounded bg-transparent text-muted hover:bg-soft hover:text-ink" type="button" title={`${visible ? '隐藏' : '显示'}${label}`} onClick={() => setVisible((current) => !current)}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button>}
        </div>
        {action}
      </div>
      <p id={`${id}-error`} className="flex min-h-4 items-start gap-1 text-xs font-normal leading-4 text-coral">{error && <><CircleAlert size={13} className="mt-px shrink-0" /><span>{error}</span></>}</p>
    </div>
  )
}
