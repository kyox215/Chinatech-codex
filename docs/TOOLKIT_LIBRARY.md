# 工具集（Authenticated Toolkit Library）

`/toolkit` 是登录后的全局工具目录。已加入店铺的成员可以查看已发布的网页工具和文件资源；平台级管理员可以在最近一次 AAL2/TOTP 验证仍在 5 分钟内时维护目录，即使当前没有店铺也可以管理。

## 资源与访问

- 资源类型只有 `link` 和 `file`，状态为 `draft`、`published`、`archived`；恢复归档资源只能回到草稿。
- 网页工具必须是没有账号信息的绝对 `https` URL。服务器拒绝 localhost、环回、链路本地、私有 IP 字面量和控制字符，也不会在服务器端抓取目标地址。
- 文件只允许 `.zip`、`.7z`、`.rar`、`.exe`、`.msi`、`.dmg`、`.pkg`、`.apk`、`.deb`、`.pdf`，大小为 1 字节至 200 MiB。对象路径由服务器随机生成，不使用原始文件名。
- 文件先由管理员获得一次性 signed upload intent，再从浏览器直传私有 bucket；BFF 不接收大文件 body。finalize 会重新读取 Storage 元数据并以短 Range 检查文件头，失败时文件保持 quarantine 草稿并尽力清理对象。
- 普通访问每次重新鉴权。文件返回最多 60 秒、强制 attachment 的 signed URL；网页工具返回已校验 URL 并由浏览器在新标签页以 `noopener,noreferrer` 打开。

## 文件扫描边界

仓库没有恶意软件扫描器。文件可以直传并 finalize 进入隔离状态，但 `security_review_state` 会保持 `pending`（失败则 `quarantined`），当前没有任何路径可将其标记为 `clean`，因此 hosted file 永远不能发布或下载。页面会明确显示“未自动扫描，当前不可发布”；接入扫描器或 Owner 另批独立流程前，不提供发布旁路。网页工具不受此门影响。

## API 路由

- `GET toolkit/resources`
- `POST toolkit/resources/link`
- `POST toolkit/resources/file/prepare`
- `POST toolkit/resources/:id/file/finalize`
- `POST toolkit/resources/:id/update`
- `POST toolkit/resources/:id/status`
- `POST toolkit/resources/:id/access`

管理写操作由服务端逐路由校验平台管理员、canonical verified email 和最近 AAL2/TOTP；所有写操作带 `revision` 进行 CAS。普通 DTO 不返回 bucket、storage path、upload token、审计字段或未发布资源。

## 数据库与发布

`docs/migration-lineage/archive/TASK-20260823-002-repo-only-unapplied/migrations/20260806222149_authenticated_toolkit_library.sql` 是从候选提交保留的字节级 lineage 证据，启用 RLS、只授予 `service_role` 并创建私有 `repairdesk-toolkit-files` bucket（200 MiB 上限）的历史设计仍可供审查。它的 `production_applied=false`、`status=evidence_only`，不代表任何环境已有对应 schema；原 `supabase/migrations/` 路径已移除。不得执行、恢复或复用这个旧 timestamp。本次 lineage reconciliation 不授权当前 toolkit deployment，也不授权当前 toolkit migration；未来若需相关能力，必须另建新 timestamp migration，并重新通过 lineage、RLS/Storage 与独立发布审批。本文不构成当前应用或工具集部署许可。

应用发布采用 fail-closed 开关 `NEXT_PUBLIC_REPAIRDESK_TOOLKIT_ENABLED=1`。变量不存在或不是精确的 `1` 时，侧栏和命令面板不显示工具集，`/toolkit` 返回 404，所有 `toolkit/*` API 也在访问数据库前返回 404。只有完成生产迁移、RLS/Storage 复核和独立启用批准后才能设置该变量；未接入扫描器前仍不得启用 hosted file 发布。
