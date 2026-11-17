import {SecurityField} from './SecurityField'
import {useSecurityForm} from './useSecurityForm'

type ChangeEmailFormProps = {
    email: string
    countdown: number
    onRequestCode: (retryAfter: number) => void
}

/** 修改绑定邮箱的独立表单。 */
export function ChangeEmailForm({email, countdown, onRequestCode}: ChangeEmailFormProps) {
    const {formRef, pending, codeSending, codeTarget, field, submit, sendCode, updateErrors} = useSecurityForm({
        kind: 'email',
        email,
        countdown,
        onRequestCode,
    })

    return (
        <form ref={formRef} className="grid gap-4" noValidate onSubmit={submit} onChange={updateErrors} onBlur={updateErrors}>
            <fieldset className="contents" disabled={pending || codeSending}>
                <SecurityField {...field('email')} label="新邮箱" type="email" autoComplete="email" autoCapitalize="none"
                               spellCheck={false} placeholder="输入新的邮箱地址"/>
                <SecurityField {...field('code')} label="新邮箱验证码" inputMode="numeric"
                               autoComplete="one-time-code" maxLength={6} placeholder="6 位数字验证码"
                               action={<button className="quiet-button min-w-28 shrink-0 tabular-nums" type="button"
                                               disabled={countdown > 0}
                                               onClick={sendCode}>{countdown > 0 ? `${countdown}s 后重发` : codeTarget ? '重新发送' : '发送验证码'}</button>}/>
                <SecurityField {...field('currentPassword')} label="当前密码" type="password"
                               autoComplete="current-password" placeholder="输入当前密码"/>
                <div className="flex justify-end gap-3 pt-1">
                    <button className="primary-button" type="submit">更新邮箱</button>
                </div>
            </fieldset>
        </form>
    )
}
