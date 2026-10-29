# 引序测试账号

> 本文件包含登录凭据，仅保存在本地，不要提交到 Git 或发送到公开位置。
>
> 当前演示数据集：`frontend-demo-v1`

## 账号密码

以下密码已在 `exec_graph_v1` 中重置，并逐一通过登录验证。数据库只保存 Argon2id 哈希。

| 昵称 | 邮箱 | 密码 |
| --- | --- | --- |
| 乔 | `qiao@example.com` | `YH3Swj2VScGbyZU4RtXv` |
| 林岚 | `lin@example.com` | `xopptxThvDtsVKnn26WZ` |
| miao | `miao@example.com` | `ZMc2tQgtBKMkeGSY6PvT` |
| 阿澈 | `che@example.com` | `DFrogSny8aDvqgPwQKrd` |
| 小满 | `xiaoman@example.com` | `MjGjZ4Mv75DADdUTGxnJ` |
| 陈禾 | `chenhe@example.com` | `3ibsUG24VWtBtQi49NHj` |
| Robin | `robin@example.com` | `aAMqZtmtWBXE5np6bcru` |

## 开发环境免密码登录

开发环境可以显式开启测试号入口，登录固定的“乔”账号：

```yaml
app:
  environment: development
  enable_demo_login: true
```

生产环境禁止启用此入口。当前线上环境保持关闭。
