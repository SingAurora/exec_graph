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
	client *ses.Client
	config bootstrapconfig.SESConfig
}

func NewTencentSES(config bootstrapconfig.SESConfig) (*Mailer, error) {
	if config.Region == "" || config.TemplateID == 0 || config.FromEmail == "" || config.SecretID == "" || config.SecretKey == "" {
		return nil, fmt.Errorf("incomplete Tencent SES configuration")
	}
	client, err := ses.NewClient(common.NewCredential(config.SecretID, config.SecretKey), config.Region, profile.NewClientProfile())
	if err != nil {
		return nil, fmt.Errorf("create Tencent SES client: %w", err)
	}
	return &Mailer{client: client, config: config}, nil
}

func (mailer *Mailer) SendVerificationCode(ctx context.Context, email, code string) error {
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
	request.TriggerType = common.Uint64Ptr(1)
	if _, err := mailer.client.SendEmailWithContext(ctx, request); err != nil {
		return fmt.Errorf("send Tencent SES email: %w", err)
	}
	return nil
}
