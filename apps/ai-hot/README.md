# 软云 AI 热点

在 SoftCloud 官网内集成 AIHOT 的核心阅读流程。页面 `/tools/ai-hot/` 随原有 Cloudflare Pages 发布；同域 `/api/ai-hot` 由独立 Worker 提供。所有服务运行在 Cloudflare，不需要外部服务器或第三方模型密钥。

## 来源与实现范围

上游 `KKKKhazix/AIHOT` 固定于 `885b736dc0fd3ef3d4c9c70af2bc3a981a99ff38`。保留原始 MIT LICENSE、NOTICE、18 个公开 RSS/Atom 信源、分类、话题、提示词和精选阈值，使用 SoftCloud 自己的名称与视觉。

实现：RSS/Atom 定时收录、PASS/BLOCK/UNKNOWN 预筛、两次互不读取结果的评分、中文标题/摘要/推荐理由、事件归类、48 小时热点、每日精选早报、分类/搜索、RSS、本地收藏及受密钥保护的信源管理。

这是针对免费 Cloudflare 的核心流程适配。没有移植上游完整应用：付费 X/公众号采集、完整翻译、向量召回、不同模型的二次事件复核、SAME_STORY 延续关系、周/月报、排行榜、MCP、Codex 自动修复均不包含。事件候选由标题重合召回，只有 SAME_OCCURRENCE 且 confidence >= 0.95 才合并。免费 Qwen 模型的筛选效果尚未与原模型校准；保留阈值不表示质量相同。

## 资源与费用限制

使用 Workers Free、D1、Queues、Workers AI。模型固定为 `@cf/qwen/qwen3-30b-a3b-fp8`。首次发布默认关闭收录和推理，确认账号是 Free、数据迁移完成后，在 Worker 设置中启用三个变量：

- `COLLECT_ENABLED=true`
- `MODEL_CALLS_ENABLED=true`
- `FREE_PLAN_VERIFIED=true`

每日 UTC 00:00 重置：最多启动 24 篇资料、模型保守预留上限 6,000 Neurons（Cloudflare 账号免费总额度是 10,000 Neurons/日，其他应用也共享）。按 UTF-8 字节数、额外 1,024 输入 token 和输出上限预留；失败调用仍计入预留。D1 原子事务控制额度和任务收据；模型响应先保存，再解析，重试复用响应。实际免费额度错误会停止当天调用。不要升级付费套餐或移除保护开关。

每 10 分钟轮询一个信源，18 个正常启用信源约 3 小时轮转一次。北京时间 08:00 起生成前 24 小时精选的早报；没有精选则不生成。公开阅读接口不会调用模型。完成资料清除原始正文，公开资料/日报保留 90 天、未完成资料保留 7 天、收据/运行日志保留 30 天，每日自动清理。

## 本地检查

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run build
pnpm run dev
```

本地开发服务在 8790 端口。数据库迁移：`pnpm exec wrangler d1 migrations apply DB --local`。`wrangler dev --test-scheduled` 可测试定时任务；默认关闭真实模型调用。前端只检查布局时访问 `/tools/ai-hot/?preview=1`，显著标注的虚构示例只在该参数下出现，正式页面不以示例替代真实数据。

## Cloudflare Git 构建

使用现有 GitHub 连接 `zocipro/SoftCloud`，项目 `softcloud-ai-hot`，根目录 `apps/ai-hot`，生产分支 `main`。部署命令 `pnpm run deploy`，无需额外构建命令。Wrangler 自动创建 D1 `softcloud-ai-hot` 和 Queue `softcloud-ai-hot-jobs`，配置 AI 绑定与路由 `zoci.pro/api/ai-hot*`，随后脚本应用 D1 增量迁移。开关变量不写入部署配置，缺失即关闭；`--keep-vars` 保留控制台已设置的开关，避免明确的配置值覆盖线上状态。不要使用 `pnpm deploy`，它是 pnpm 自带的另一条命令。

官网继续原有静态 Pages 发布。若自动配置未写回资源 ID，可在控制台核实绑定；后续发布应复用同名资源。

管理页面 `/tools/ai-hot/admin.html` 需要 Worker Secret `ADMIN_TOKEN`，至少 24 字符。未配置时管理接口始终拒绝访问，不能通过公开页面修改数据。页面不保存此密钥。模型、采集和计划开关通过 Cloudflare 控制台设置。

## 验证

`tests/pipeline.test.mjs` 用独立的内存 SQLite、固定测试材料和模拟 AI 验证实际 Worker 管线、额度、任务复用及只读边界。不会调用真实模型，不表示上游 PostgreSQL 测试通过，也不替代线上真实采集与模型验证。
