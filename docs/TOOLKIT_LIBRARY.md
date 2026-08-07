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

`supabase/migrations/20260806222149_authenticated_toolkit_library.sql` 仅为向前兼容新增迁移，启用 RLS 并只授予 `service_role`，创建私有 `repairdesk-toolkit-files` bucket（200 MiB 上限）。本任务不应用生产迁移、不创建生产对象、不上传真实文件、不部署。
