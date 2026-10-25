// Command api 仅负责进入组合根，不包含业务或依赖创建。
package main

import (
	"fmt"
	"github.com/singaurora/exec-graph/backend/internal/bootstrap"
	"os"
)

func main() {
	if err := bootstrap.Run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
