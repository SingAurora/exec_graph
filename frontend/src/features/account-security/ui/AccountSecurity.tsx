import {LockKeyhole, Mail} from 'lucide-react'
import {useEffect, useState} from 'react'
import {SecurityForm} from './SecurityForm'

const resendDelaySeconds = 60

/** 账户安全页直接展示两个修改表单，不通过编辑按钮切换显隐。 */
export function AccountSecurity({email}: { email: string }) {
    const [emailCountdown, setEmailCountdown] = useState(0)
    const [passwordCountdown, setPasswordCountdown] = useState(0)
    const countingDown = emailCountdown > 0 || passwordCountdown > 0

    // 两个表单各自保留验证码倒计时，任一倒计时运行期间共用一个计时器。
    useEffect(() => {
        if (!countingDown) return
        const timer = window.setInterval(() => {
            setEmailCountdown((seconds) => Math.max(0, seconds - 1))
            setPasswordCountdown((seconds) => Math.max(0, seconds - 1))
        }, 1000)
        return () => window.clearInterval(timer)
    }, [countingDown])

    return (
        <div className="mt-7 grid gap-7">
            <section className="grid grid-cols-[minmax(130px,1fr)_minmax(0,460px)] items-start gap-8">
                <div>
                    <div className="flex items-center gap-2">
                        <Mail size={17} className="text-muted"/>
                        <h2 id="change-email-title" className="text-base font-semibold">修改邮箱</h2>
                    </div>
                    <p className="mt-2 break-all text-sm text-muted">{email}</p>
                </div>
                <SecurityForm
                    kind="email"
                    email={email}
                    countdown={emailCountdown}
                    onRequestCode={() => setEmailCountdown(resendDelaySeconds)}
                />
            </section>
            <section className="grid grid-cols-[minmax(130px,1fr)_minmax(0,460px)] items-start gap-8 border-t border-line pt-7">
                <div>
                    <div className="flex items-center gap-2">
                        <LockKeyhole size={17} className="text-muted"/>
                        <h2 id="change-password-title" className="text-base font-semibold">修改密码</h2>
                    </div>
                    <p className="mt-2 text-sm text-muted">通过绑定邮箱验证身份</p>
                </div>
                <SecurityForm
                    kind="password"
                    email={email}
                    countdown={passwordCountdown}
                    onRequestCode={() => setPasswordCountdown(resendDelaySeconds)}
                />
            </section>
        </div>
    )
}
