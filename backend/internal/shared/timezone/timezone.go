// Package timezone 固定平台的中国时区边界。
package timezone

import "time"

// China 是平台唯一的展示和接口时区。
var China = time.FixedZone("Asia/Shanghai", 8*60*60)

// InChina 把时间点转换为接口固定输出的东八区表示。
func InChina(value time.Time) time.Time {
	return value.In(China)
}
