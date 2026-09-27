# SoftCloud 集成

上游：https://github.com/laogou717/md-wechat
上游基线：8a21962efdc44b83d1673e557a52cf963c72b669

改动：SoftCloud 顶栏、站内返回入口、蓝白 UI、窄屏上下布局与欢迎示例；保留原生 Markdown、主题、多文档、媒体、导入导出与富文本复制。
部署目录：`/tools/mars-editor/`。

重建：在本目录安装锁定依赖后运行 `pnpm build`，将 dist 内容同步到 ../../tools/mars-editor，并保留 LICENSE。运行 `pnpm test` 验证编辑器。
