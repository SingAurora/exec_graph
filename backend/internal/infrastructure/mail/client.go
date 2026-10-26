// Package mail 通过已配置的模板发送验证码，不提供向任意地址发送任意内容的接口。
package mail

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/profile"
	ses "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/ses/v20201002"
)

// Sender 在进程内复用 SES 客户端，未启用时明确拒绝发送。
type Sender struct {
	client   *ses.Client
	from     string
	template uint64
}

// Disabled 为未装配邮件能力的测试或开发环境返回显式关闭的发送器。
func Disabled() *Sender { return &Sender{} }

// New 兼容旧区域、发件人和模板配置，不使用旧产品名称。
func New(c config.Mail, credentials config.Credentials) (*Sender, error) {
	if !c.Enabled {
		return Disabled(), nil
	}
	if c.Region == "" || c.TemplateID == 0 || c.FromEmail == "" || credentials.AccessKeyID == "" || credentials.AccessKeySecret == "" {
		return nil, fmt.Errorf("启用邮件需要完整的区域、模板、发件人和凭据")
	}
	options := profile.NewClientProfile()
	options.HttpProfile.ReqTimeout = int(constants.MailOperationTimeout.Seconds())
	client, err := ses.NewClient(common.NewCredential(credentials.AccessKeyID, credentials.AccessKeySecret), c.Region, options)
	if err != nil {
		return nil, fmt.Errorf("创建邮件客户端失败")
	}
	return &Sender{client: client, from: c.FromEmail, template: c.TemplateID}, nil
}

// SendCode 模板占位 1 为验证码，2 为有效分钟数；不将验证码写入日志或响应。
func (s *Sender) SendCode(ctx context.Context, email, code string, ttl time.Duration) error {
	if s.client == nil {
		return fault.New(fault.Unavailable, "邮件认证暂未启用")
	}
	// 模板变量名由现有外部模板规定，属于动态 JSON 键。
	data, err := json.Marshal(map[string]string{"1": code, "2": strconv.Itoa(int(ttl.Minutes()))})
	if err != nil {
		return err
	}
	request := ses.NewSendEmailRequest()
	request.FromEmailAddress = common.StringPtr(s.from)
	request.Destination = common.StringPtrs([]string{email})
	request.Subject = common.StringPtr("引序邮箱验证码")
	request.Template = &ses.Template{TemplateID: common.Uint64Ptr(s.template), TemplateData: common.StringPtr(string(data))}
	request.TriggerType = common.Uint64Ptr(1)
	if _, err := s.client.SendEmailWithContext(ctx, request); err != nil {
		return fmt.Errorf("邮件服务发送失败")
	}
	return nil
}
