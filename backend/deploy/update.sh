#!/usr/bin/env bash
set -euo pipefail

# 默认从 GitHub main 更新；首次部署也可传入已经上传的工作区快照目录。
deploy_root=/opt/exec-graph
repository_url=${EXEC_GRAPH_REPOSITORY_URL:-https://github.com/SingAurora/exec_graph.git}
branch=${EXEC_GRAPH_DEPLOY_BRANCH:-main}
config_path=/etc/exec-graph/config.yaml
health_base_url=${EXEC_GRAPH_HEALTH_BASE_URL:-http://127.0.0.1}
public_url=${EXEC_GRAPH_PUBLIC_URL:-https://yinxu.fun}

if [[ $(id -u) -ne 0 ]]; then
    echo '请使用 root 或 sudo 执行部署。' >&2
    exit 1
fi
exec 9>/run/lock/exec-graph-update.lock
flock -n 9 || { echo '已有更新任务正在运行。' >&2; exit 1; }
umask 022
mkdir -p "$deploy_root/releases"
build_dir=$(mktemp -d "$deploy_root/build.XXXXXX")
release_dir=$(mktemp -d "$deploy_root/releases/$(date -u +%Y%m%dT%H%M%SZ).XXXXXX")
chmod 755 "$release_dir"
activated=false
cleanup() {
    rm -rf -- "$build_dir"
    if [[ $activated == false ]]; then
        rm -rf -- "$release_dir"
    fi
}
trap cleanup EXIT

if [[ -n ${EXEC_GRAPH_SOURCE_DIR:-} ]]; then
    cp -a "$EXEC_GRAPH_SOURCE_DIR/." "$build_dir/"
    revision=${EXEC_GRAPH_SOURCE_REVISION:-workspace-snapshot}
else
    echo '正在从 GitHub 拉取代码……'
    if [[ ! -d $deploy_root/repository.git ]]; then
        git init --bare "$deploy_root/repository.git"
    fi
    git --git-dir="$deploy_root/repository.git" fetch --depth=1 "$repository_url" "refs/heads/$branch"
    revision=$(git --git-dir="$deploy_root/repository.git" rev-parse FETCH_HEAD)
    git --git-dir="$deploy_root/repository.git" archive FETCH_HEAD | tar -x -C "$build_dir"
fi

echo '正在构建前端……'
(
    cd "$build_dir/frontend"
    bun install --frozen-lockfile
    VITE_API_BASE_URL= VITE_ENABLE_API_MOCKS=false VITE_ENABLE_DEMO_LOGIN=false bun run build
)
mkdir -p "$release_dir/backend/bin" "$release_dir/frontend"
echo '正在构建 Go 服务……'
(
    cd "$build_dir/backend"
    CGO_ENABLED=0 go build -trimpath -o "$release_dir/backend/bin/exec-graph" ./cmd/api
    CGO_ENABLED=0 go build -trimpath -o "$release_dir/backend/bin/exec-graph-manage" ./cmd/manage
)
cp -a "$build_dir/frontend/dist" "$release_dir/frontend/dist"
printf '%s\n' "$revision" > "$release_dir/REVISION"

export EXEC_GRAPH_CONFIG="$config_path"
echo '正在检查真实依赖和数据库版本……'
"$release_dir/backend/bin/exec-graph-manage" check
# 迁移由管理命令显式执行，API 启动仍然只校验版本。
"$release_dir/backend/bin/exec-graph-manage" migrate
"$release_dir/backend/bin/exec-graph-manage" verify

echo '正在切换并重启服务……'
systemctl stop exec-graph.service
ln -sfn "$release_dir" "$deploy_root/current"
activated=true
systemctl start exec-graph.service
for ((attempt=0; attempt<30; attempt++)); do
    if curl --noproxy '*' --fail --silent "$health_base_url/api/commands/system/health" >/dev/null &&
       curl --noproxy '*' --fail --silent "$health_base_url/" >/dev/null; then
        echo "部署完成：$revision"
        echo "访问地址：$public_url/"
        exit 0
    fi
    sleep 1
done
echo '服务启动验证失败，请运行 journalctl -u exec-graph -n 50 查看日志。' >&2
exit 1
