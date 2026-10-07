// Public operation metadata only. Executable scripts stay on the server.
export type OfficeAction = "install" | "activate" | "uninstall" | "reinstall";
export type OfficeTerminal = "cmd" | "powershell";
export const officeCommands = [
  {
    "id": "install",
    "title": "仅安装",
    "description": "安装 Office LTSC 专业增强版 2024 及所选组件，并移除脚本打开网页的调用。",
    "notice": "安装操作也可能关闭正在运行的 Office 应用，请先保存文档。",
    "destructive": false
  },
  {
    "id": "activate",
    "title": "仅激活",
    "description": "为 ProPlus2024Volume 设置通用批量许可密钥，并连接 s1.kms.cx 执行 KMS 激活。",
    "notice": "KMS 密钥不能替代有效的 Office 批量许可证。",
    "destructive": false
  },
  {
    "id": "uninstall",
    "title": "仅卸载",
    "description": "卸载全部 Office，清理相关配置、许可、服务与缓存，并重启资源管理器。",
    "notice": "此操作会移除现有 Office 及其配置。请先保存文档和备份需要保留的设置。",
    "destructive": true
  },
  {
    "id": "reinstall",
    "title": "完整重装",
    "description": "卸载 → 核对残留 → 安装 → 激活 → 核对许可状态；步骤失败、需要重启或来源版本变化时停止。",
    "notice": "此操作会先卸载全部 Office。脚本会预检安装配置，无法下载或校验失败时在卸载前停止。",
    "destructive": true
  }
] as const;
