package mail

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	bootstrapconfig "github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common"
	"github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/common/profile"
	ses "github.com/tencentcloud/tencentcloud-sdk-go/tencentcloud/ses/v20201002"
)

type Mailer struct {
	// client 在进程生命周期内复用，处理所有发往腾讯云 SES 的请求。
	client *ses.Client
	config bootstrapconfig.MailConfig
}

func NewTencentSES(config bootstrapconfig.MailConfig, credentials bootstrapconfig.CredentialsConfig) (*Mailer, error) {
	// 启动时就校验发件人、模板和凭据，避免用户请求验证码时才发现配置缺失。
	if config.Region == "" || config.TemplateID == 0 || config.FromEmail == "" || credentials.AccessKeyID == "" || credentials.AccessKeySecret == "" {
		return nil, fmt.Errorf("incomplete Tencent SES configuration")
	}
	client, err := ses.NewClient(common.NewCredential(credentials.AccessKeyID, credentials.AccessKeySecret), config.Region, profile.NewClientProfile())
	if err != nil {
		return nil, fmt.Errorf("create Tencent SES client: %w", err)
	}
	return &Mailer{client: client, config: config}, nil
}

func (mailer *Mailer) SendVerificationCode(ctx context.Context, email, code string) error {
	// SES 模板变量以序号占位：{{1}} 对应验证码，{{2}} 对应有效分钟数。
	templateData, err := json.Marshal(map[string]string{
		"1": code,
		"2": strconv.Itoa(mailer.config.CodeTTLMinutes),
	})
	if err != nil {
		return fmt.Errorf("encode email template data: %w", err)
	}

	request := ses.NewSendEmailRequest()
	request.FromEmailAddress = common.StringPtr(mailer.config.FromEmail)
	request.Destination = common.StringPtrs([]string{email})
	request.Subject = common.StringPtr("Paperfly 注册验证码")
	request.Template = &ses.Template{
		TemplateID:   common.Uint64Ptr(mailer.config.TemplateID),
		TemplateData: common.StringPtr(string(templateData)),
	}
	// 触发类型 1 表示事务邮件，适合发送验证码。
	request.TriggerType = common.Uint64Ptr(1)
	if _, err := mailer.client.SendEmailWithContext(ctx, request); err != nil {
		return fmt.Errorf("send Tencent SES email: %w", err)
	}
	return nil
}
