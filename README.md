# ChinaTech 维修管理网站

Next.js App Router、React、TypeScript。公开首页与门店后台分开；客户设备、工单采购和门店自有待售单机保持独立身份。

## 运行模式

使用 Node.js 24，执行 `npm ci`。

- 本地界面样板：复制 `.env.example` 为 `.env.local`，保留 `BACKEND_MODE=preview`、`LOCAL_PREVIEW=1`，执行 `npm run dev`，访问 `http://localhost:3000`。样板账号和虚构数据仅供本地预览。
- 正式后台：设置 `BACKEND_MODE=supabase`、`LOCAL_PREVIEW=0`，配置自己的 `SUPABASE_URL`、公开发布密钥、`APP_DATABASE_URL` 和确切的 `APP_ORIGIN`。执行 `npm run build`、`npm start`。部署环境绝不启用样板登录。

不要提交真实 `.env`、连接密码、账号会话或业务备份。`APP_DATABASE_URL` 只供服务端使用，必须是受限 `chinatech_runtime` 角色，不能使用 postgres 或 service_role。

## 后台接入

`supabase/migrations/` 建立 `chinatech_v2`、`chinatech_v2_private` 业务空间。安装前核对目标项目；迁移需要数据库管理权限，仅在已授权目标执行。迁移不导入旧业务记录，不自动为注册用户建立门店或管理员权限。

运行角色密码须单独安全配置。云连接使用 Supavisor 事务池、SSL 和关闭 prepared statements。首位老板与空门店需要管理员明确初始化；后续公开注册验证邮箱后仍等待门店审核。新应用使用独立 HttpOnly 登录 cookie，Auth 身份与门店权限由服务端及数据库重新核对。

工单、客户、采购、整机、销售事实、签名、门店设置和成员变更通过 Next.js 服务端事务保存，检查门店、权限、版本及稳定请求 ID。财务内容在返回浏览器前按权限投影。售后建维修与销售关联同事务提交；界面使用经鉴权的实时变更提示、轻量版本核对和聚焦刷新；保存返回已提交实体，并立即补查当前页面。通知失败时回退核对，权限与版本仍由正式读取检查。

接机照片在浏览器压缩为 JPEG，再由服务器解码验证；单张最多 240,000 字节、长边 1000px，当前最多六张。照片字节与工单一起写入私有表，快照只返回引用；读取再次检查登录、门店及维修查看权限，不提供公共下载 URL。每张工单最多保留 30 张照片历史，超过上限整次保存回滚。整机已保存照片保留原字节，详情与冻结销售照片通过私有引用按需读取，每次核对会话、门店及查看权限。

记账和退款操作记录门店已发生的事实；没有连接支付、税务、供应商下单、短信、客户邮件或 AI 服务。电子签名记录核对事实，不代表已完成法律效力或硬件触笔认证。

## 性能与后续开发

新增及修改功能必须遵守[性能与加载约束](PERFORMANCE.md)。后台页面使用摘要、服务端分页和按需详情；完整计数、查重、关联历史、权限、幂等、事务与原有图片质量必须保持。

## 验证

`npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`。

`tests/backend.integration.mjs` 验证真实 Auth、RLS、并发版本、幂等、跨门店、财务投影、售后事务及照片访问；它只接受本项目独立本地 Supabase 端口 55421/55422 与应用 3117（或显式 `BACKEND_TEST_PORT=3151` 的隔离候选），并需要本机私有测试连接文件。该脚本不会连接生产环境，保留合成测试历史。

`supabase/config.toml` 为独立本地配置，开发业务数据不迁入云端。源码不包含旧站业务数据、密钥或备份。
