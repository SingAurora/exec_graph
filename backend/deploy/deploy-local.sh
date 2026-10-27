#!/usr/bin/env bash
set -euo pipefail

# 在本地构建 Linux 发布产物，再传到服务器，适合自娱自乐阶段的快速部署。
repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
# 可以用 EXEC_GRAPH_DEPLOY_HOST 临时覆盖服务器地址。
remote=${EXEC_GRAPH_DEPLOY_HOST:-root@115.159.206.123}
remote_root=/opt/exec-graph
# 传入 SSH 控制 socket 后，多个 SSH 操作复用同一条已认证连接。
ssh_control_path=${EXEC_GRAPH_SSH_CONTROL_PATH:-}

# 统一执行远程命令；没有控制 socket 时退化为普通 SSH。
remote_ssh() {
	if [[ -n $ssh_control_path ]]; then
		ssh -S "$ssh_control_path" "$remote" "$@"
	else
		ssh "$remote" "$@"
	fi
}

if [[ ! -d $repo_root/.git ]]; then
    echo '当前目录不是 Git 工作区。' >&2
    exit 1
fi

# 版本标识只取当前提交号；未提交的本地修改仍会参与构建和上传。
revision=$(git -C "$repo_root" rev-parse --short HEAD 2>/dev/null || printf 'working-tree')
# 发布目录只在本次脚本运行期间存在，不把构建产物写回项目目录。
artifact_dir=$(mktemp -d "${TMPDIR:-/tmp}/exec-graph-artifacts.XXXXXX")
remote_source=
# 成功或失败退出时都清理本地和服务器临时目录。
cleanup() {
	if [[ -n $remote_source ]]; then
		remote_ssh "rm -rf -- '$remote_source'" >/dev/null 2>&1 || true
	fi
	rm -rf -- "$artifact_dir"
}
trap cleanup EXIT

echo '正在本地构建前端……'
(
	cd "$repo_root/frontend"
	# 本机已有依赖时直接复用，避免每次部署重新安装。
	if [[ ! -d node_modules ]]; then
		bun install --frozen-lockfile
	fi
	# 清空 API 地址并关闭模拟服务，生成正式连接真实后端的前端。
	VITE_API_BASE_URL= VITE_ENABLE_API_MOCKS=false VITE_ENABLE_DEMO_LOGIN=false bun run build
)

echo '正在本地交叉编译 Linux/amd64 Go 服务……'
# Mac 上编译出服务器 Linux x86_64 可直接运行的静态程序。
mkdir -p "$artifact_dir/backend/bin" "$artifact_dir/frontend"
(
	cd "$repo_root/backend"
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -o "$artifact_dir/backend/bin/exec-graph" ./cmd/api
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -o "$artifact_dir/backend/bin/exec-graph-manage" ./cmd/manage
)
cp -a "$repo_root/frontend/dist" "$artifact_dir/frontend/dist"
# update.sh 会在服务器端负责数据库检查、版本切换和重启。
cp "$repo_root/backend/deploy/update.sh" "$artifact_dir/update.sh"
chmod 755 "$artifact_dir/update.sh"
# 记录本次使用的本地发布版本，便于服务器查看当前运行版本。
printf '%s\n' "local-${revision}" > "$artifact_dir/REVISION"

# 服务器先接收至临时目录，避免直接覆盖正在运行的版本。
if ! remote_source=$(remote_ssh "mktemp -d '$remote_root/source.XXXXXX'"); then
	echo '无法连接服务器，未开始部署。' >&2
	exit 1
fi

echo "正在传输本地发布产物（基准提交 ${revision}）……"
# tar 通过 SSH 管道传输，不需要在本地或服务器保存中间压缩包。
COPYFILE_DISABLE=1 tar --no-xattrs -C "$artifact_dir" -cf - . \
    | remote_ssh "tar -xf - -C '$remote_source'"

echo '正在服务器上检查依赖、切换版本并重启……'
# 告诉服务器脚本使用已构建产物，跳过服务器端的 Bun 和 Go 编译。
remote_ssh \
	"install -o root -g root -m 755 '$remote_source/update.sh' /usr/local/bin/exec-graph-update && EXEC_GRAPH_ARTIFACT_DIR='$remote_source' EXEC_GRAPH_SOURCE_REVISION='local-${revision}' /usr/local/bin/exec-graph-update"

echo '本地工作区部署完成。'
