# 软云 AI 热点

AIHOT 原版阅读界面与核心整理流程在 SoftCloud 内的免费 Cloudflare 适配。网页入口 `/tools/ai-hot/`，同域 Worker API `/api/ai-hot`；沿用软云蓝白、暗色主题和手机导航。

## 已接入

上游固定于 `885b736dc0fd3ef3d4c9c70af2bc3a981a99ff38`，保留 MIT LICENSE、NOTICE、原版页面与组件、18 个示范 RSS/Atom 信源、行业分类、专题、提示词及精选阈值。生产数据库独立维护，原站私人信源与历史内容未公开，不会复制原站数据。

阅读：精选事件时间线、全量资讯、筛选与搜索、摘要阅读器、事件的多报道和后续进展、专题、日报/周报/月报、本地收藏与已读、RSS、Markdown、匿名 REST 与原版五个只读 MCP 工具。旧 `?view=` 入口兼容新路径。

整理：预筛、两次独立评分、中文理解与摘要；使用上游词面召回和 SAME_OCCURRENCE / SAME_STORY 判定规则，同一发生的归并另做一次独立模型复核。既有文章按定时任务逐条补归组。有精选时生成北京时间 08:00 日报，周一整理前一完整周、每月第一天整理前一完整月。报告引用限定为当期真实入选条目。

管理：登录与 CSRF、信源管理和 RSS 预览、内容修正/撤回/重评/拆组、事件合并、免费模型选择、运行和调用回执、额度、反馈处理、联系方式、上传已有 SelectBench 报告。手动修正持久保存；普通阅读与管理查询均不调用 AI。

## 适配边界

网页使用原版 React 组件，通过 Pages 路由回退加载浏览器应用，未移植上游 SSR/PostgreSQL 服务。仅支持 RSS/Atom 采集；付费 X/公众号连接、全文翻译和再分发、向量召回、模型排行榜优化计算、Codex Reset Monitor 未启用。无历史热度快照时展示未知趋势，不生成曲线；无事件 AI 总结时用真实来源摘要回退。不会用演示内容填充生产页面。

默认 Qwen3-30B 负责预筛、评分、理解、归组与报告；Llama3.3-70B Fast 负责归并复核。后台仅允许选择已列入免费的 Qwen、Llama、GLM4.7 Flash。保留原版阈值不表示与原站付费模型质量相同。

## 免费额度与保留

使用既有 Workers Free、D1、Queues、Workers AI，不升级套餐。控制台 `COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、`FREE_PLAN_VERIFIED` 三项必须为 true 才能收录/推理；配置缺失即关闭。每个 UTC 日最多启动 24 篇新资料、保守预留最多 6,000 Neurons；账号额度由其他应用共享。可设置更低的日/小时/分钟额度。D1 原子事务确保模型收据只有一个拥有者；已完成响应重用，失败预留不返还，平台额度错误停止当天调用。

每 10 分钟轮询一个信源，18 个启用信源正常轮转约 3 小时。完成后清除原始正文；条目/日报保留 90 天，未完成条目 7 天，反馈、模型回执与运行日志 30 天；周/月报和精选同步账本持续保留。默认摘要阅读与匿名接口。条款、隐私版本 1.0 已获站主批准，见 industry/pages。

## 检查与构建

使用 Node 24、pnpm 10.11.1：

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm --filter @aihot/web run typecheck
pnpm --filter @aihot/web test
pnpm --filter @aihot/web build
pnpm run build
```

前端构建写入官网 `tools/ai-hot/`，根 `_redirects` 仅为实际页面路径添加回退，不拦截资源。前端开发端口 4180，API 8790；真实本地 Worker 开发使用 `pnpm run dev`，必须先应用本地迁移且推理开关默认关闭。

## 发布与管理登录

仓库 `zocipro/SoftCloud` main：Pages 项目 `softcloud` 发布静态官网；Worker 项目 `softcloud-ai-hot` 根目录 `apps/ai-hot`，部署命令 `pnpm run deploy`。脚本先在既有 D1 执行增量迁移，随后 `wrangler deploy --keep-vars` 保留控制台开关。复用现有数据库和队列，不新建付费资源。

管理入口 `/tools/ai-hot/admin`。需要在 Worker Secrets 由站主设置 `ADMIN_PASSWORD`（至少 12 字符），未设置拒绝登录。8 小时管理会话使用 Secure/HttpOnly/SameSite Cookie；修改操作必须提供 CSRF。旧 ADMIN_TOKEN 仅用于既有接口兼容，至少 24 字符，前台不会保存。

30 个后端测试使用内存 SQLite 和模拟 AI，7 个前端测试覆盖收藏、Markdown、请求取消和历史缓存；不产生真实模型费用，不代表上游完整测试套件通过。
