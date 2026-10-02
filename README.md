# ChinaTech 重构版（M1样板）

Next.js App Router、React、TypeScript的独立维修管理网站样板，包含公开首页、账号入口、维修工单、工单采购到货、一机一档整机、客户及权限演示。

所有内置资料均为虚构fixture。本轮仅在浏览器本地存储保存样板操作，尚未接入正式认证、服务端授权／RLS、业务事务或云文件存储；生产构建禁用本地预览登录。此候选分支尚不具备替换正式后台的条件。

## 本地运行

使用Node22或24，运行`npm ci`，将`.env.example`复制为`.env.local`，再运行`npm run dev`。LOCAL_PREVIEW仅供本地开发；不得把它当成正式认证。

## 验证

`npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`。

正式系统的源码历史、数据库及附件另有私有本地备份，不属于公开源码树。
