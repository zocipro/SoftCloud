# 完整版本验证记录

日期：2026-09-30。基准：上游 `cf8f8d07d68dfa9079becc72b0717a45b33485f3`。

## 已通过

- 原始 518 文件全部存在；505 文件逐字节相同，13 文件属于声明的主题、品牌、存储键、测试数据键和已批准条款改动。后端、API、worker、迁移、算法、提示词和功能开关未改动。
- `npm ci`、完整 `npm run typecheck`、原版 SSR/客户端构建。
- 183 项原版后端测试：隔离的 PostgreSQL 17.10 数据库，35 个原始迁移成功；空测试库执行，183 通过，0 失败。
- 16 项原版前端测试：16 通过，0 失败。仅修改收藏测试的存储键，使其与软云既有收藏键一致，断言未修改。
- 原始 `scripts/smoke.ts`：19 个页面、14 个机器出口和 MCP 握手，共 34 项检查全部通过，模型榜没有以 503 跳过。
- 原始 `scripts/lb-round.ts --fetch`：实际公开来源采集，v15 求解并发布一轮；19 项评测、8 家机构。汇率更新、官方价格导入成功。Artificial Analysis 缺少 key，按上游规则不参与；不是复制原站榜单数据。
- 浏览器：模型榜实际国产厂商筛选成功；1440、390、320 px 页面宽度分别等于视口宽度；深色主题正常，检查后恢复跟随系统。
- 浏览器：Tibo 重置日历与规则页面可读；完整后台新建信源提供 RSS、网页列表、JSON、X、公众号、外部上报六种类型。

## 测试复现

数据库必须是新建、已迁移且名字以 `_test` 或 `_ci` 结尾的专用库。原始模型测试会调用本机 HTTP stub，需要打开模型调用路径；外部付费服务必须保持隔离。新增的 `scripts/isolated-test-network.mjs` 拒绝非 loopback socket，并通过 NODE_OPTIONS 传递给测试子进程。

```sh
COLLECT_ENABLED=false MODEL_CALLS_ENABLED=false \
DATABASE_URL=postgres://127.0.0.1:5432/softcloud_aihot_ci node scripts/migrate.ts

COLLECT_ENABLED=false MODEL_CALLS_ENABLED=true \
FEISHU_CONTENT_PUSH_ENABLED=false FEISHU_INTERNAL_ENABLED=false INDEXNOW_SUBMIT_ENABLED=false \
NODE_OPTIONS='--import=./scripts/isolated-test-network.mjs' \
DATABASE_URL=postgres://127.0.0.1:5432/softcloud_aihot_ci \
node --test --test-concurrency=1 --test-timeout=120000 'tests/*.test.ts'

node --test apps/web/tests/*.test.ts
node scripts/verify-upstream.mjs
```

首次在关闭模型路径的环境执行上游测试产生 27 个配置导致的失败；开启本机 stub 路径后复用了该测试库，残留任务导致两项翻译测试失败。重新使用全新数据库并隔离全部外部网络后，完整套件 183 项全部通过。未修改上游实现或删除失败测试。

## 尚未验证 / 完成

正式服务器部署、现有 D1 内容迁移、官网子路径集成、生产管理认证、正式 worker 连续调度，以及真实模型、SocialData、Artificial Analysis、公众号和飞书等服务的凭据与连通性均未完成。完整代码保留了这些能力，不能把代码存在或本机检查通过表述为全部线上功能已经运行。

本机预览只使用独立数据库、公开榜单来源和原始种子数据；Tibo 没有真实历史记录。开发管理员模式仅在 loopback 开发环境使用，生产环境由上游启动检查拒绝此模式。
