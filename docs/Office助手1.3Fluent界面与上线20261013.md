# Office 助手 1.3 Fluent 界面

用户授权按推荐设计修改并上线。先完成三语交互预览，再实施原生；新预览见[1.3预览](previews/office-assistant-ui-v1.3.html)。Chrome三语×六尺寸×十一状态198组无横向溢出/控件越界，清空、Word单选卸载保留其余和机器OneDrive禁用已实际点击；预览全部模拟，不作为实际Office操作证据。

原生沿用现有WPF与已包含的Fluent.Light资源，不新增组件库。主操作紫色，应用卡片选中紫边/浅紫面，字号/间距分正常与紧凑布局；主页面无滚动容器。应用管理直接按钮绑定原卸载门禁，重新检测后进入独立选择和确认窗口。更多只含单独激活/导出，刷新位于检测卡；两图标按钮44×44并保留三语可访问名称/tooltip。进度卡固定底部，长详情独立窗口。所有任务窗口共用Light资源，关闭Fluent背景材质，保持实色卡片。

保留已有安装、许可、恢复、取消、指纹、MSI与OneDrive安全范围；Core仅版本号改变。124 Core/既有三语流程及原120组主窗＋24组管理窗口共144组实际WPF控件合成检查按实际运行补记录。界面与worker仍是原账户/机器锁等同一流程，无后台、数据库或外部消息变更。

未签名测试版、releaseReady=false。完整真实Windows GUI/DPI/UAC、Office/OneDrive安装/激活/卸载及文档保留尚待验收；编译/合成控件/HTML不能替代。首轮Windows实际控件发现最小窗口超高11.28DIP，已收紧装饰图标/间距并扩宽组件列，保留字号与完整状态换行；对应CSS紧凑66组复验通过，原失败日志保留。最终CI/双包输入哈希/发布与正式两域证据在上线后记录。

主题依据：[微软WPF Fluent说明](https://learn.microsoft.com/zh-cn/dotnet/desktop/wpf/whats-new/net90)。
