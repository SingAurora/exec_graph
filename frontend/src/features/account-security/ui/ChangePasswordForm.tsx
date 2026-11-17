import {passwordMaxCharacters} from '../../../entities/account/lib/validation'
import {SecurityField} from './SecurityField'
import {useSecurityForm} from './useSecurityForm'

type ChangePasswordFormProps = {
    email: string
    countdown: number
    onRequestCode: (retryAfter: number) => void
}

/** 修改登录密码的独立表单。 */
export function ChangePasswordForm({email, countdown, onRequestCode}: ChangePasswordFormProps) {
    const {formRef, pending, codeSending, codeTarget, field, submit, sendCode, updateErrors} = useSecurityForm({
        kind: 'password',
        email,
        countdown,
        onRequestCode,
    })

    return (
        <form ref={formRef} className="grid gap-4" noValidate onSubmit={submit} onChange={updateErrors} onBlur={updateErrors}>
            <fieldset className="contents" disabled={pending || codeSending}>
                <SecurityField {...field('currentPassword')} label="当前密码" type="password"
                               autoComplete="current-password" placeholder="输入当前密码"/>
                <SecurityField {...field('password')} label="新密码" type="password"
                               autoComplete="new-password" maxLength={passwordMaxCharacters}
                               placeholder="6–32 位英文、数字或符号且不同于当前密码"/>
                <SecurityField {...field('confirmation')} label="确认新密码" type="password"
                               autoComplete="new-password" placeholder="再次输入新密码"/>
                <SecurityField {...field('code')} label="绑定邮箱验证码" inputMode="numeric"
                               autoComplete="one-time-code" maxLength={6} placeholder="6 位数字验证码"
                               action={<button className="quiet-button min-w-28 shrink-0 tabular-nums" type="button"
                                               disabled={countdown > 0}
                                               onClick={sendCode}>{countdown > 0 ? `${countdown}s 后重发` : codeTarget ? '重新发送' : '发送验证码'}</button>}/>
                <div className="flex justify-end gap-3 pt-1">
                    <button className="primary-button" type="submit">更新密码</button>
                </div>
            </fieldset>
        </form>
    )
}
