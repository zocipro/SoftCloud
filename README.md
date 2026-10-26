# 软云网络官网 · SoftCloud

软云网络（SoftCloud）的品牌官网与站内工具集合。官网集中展示软云旗下产品，并提供一组无需登录、在浏览器本地运行的常用工具。

- 线上地址：<https://zoci.pro>
- 当前版本：2.0（2026 年 10 月）
- 托管平台：Cloudflare Pages

## 目录

- [产品](#产品)
- [站内工具](#站内工具)
- [技术栈](#技术栈)
- [目录结构](#目录结构)
- [本地开发](#本地开发)
- [测试](#测试)
- [部署](#部署)
- [设计规范](#设计规范)
- [无障碍与兼容性](#无障碍与兼容性)
- [子项目](#子项目)
- [第三方组件与许可](#第三方组件与许可)

## 产品

官网产品区按以下顺序展示，均以独立站点运行：

| 产品 | 说明 | 地址 |
| --- | --- | --- |
| 押韵共创 | 单押、双押与多押搜索，词组互查；登录后可投稿押韵搭配，系统记录首次提交者，未登录可匿名浏览 | <https://ya.zoci.pro> |
| 软云单词 | 键盘拼写与听写练习，支持选择词库、错词回顾与学习记录 | <https://words.zoci.pro> |
| 软云专注 | 雨声、海浪、咖啡馆等环境声自由混音，配合番茄钟与睡眠定时，无需登录 | <https://focus.zoci.pro> |
| SBTI 人格测试 | 趣味人格问卷，给出主类型、匹配度、解读与 15 个维度的答题倾向 | <https://sbti.zoci.pro> |

产品卡片中的界面图为 SVG 功能示意，并非真实截图或用户数据。

## 站内工具

官网「常用工具」区提供以下 5 个同域工具，入口配置在 `index.html` 的 `#tools` 区块：

| 工具 | 路径 | 功能 |
| --- | --- | --- |
| 编码工具箱 | `/tools/bm/` | URL 编解码、Base64、MD5、图片 Base64 转换 |
| 批量图片处理 | `/tools/png/` | 本地批量压缩、缩放、格式转换与 ZIP 打包下载 |
| 王者重复名 | `/tools/wzry-name/` | 重复昵称与空白名候选生成，结果以游戏内实际校验为准 |
| 软云排版 | `/tools/mars-editor/` | 基于 md-wechat 的 Markdown 公众号排版编辑器 |
| 人生清单 | `/tools/life-list/` | 60 项预设人生目标与自定义目标，记录进度并导出图片或 JSON |

数据处理说明：

- 图片等文件仅在浏览器本地处理，不会上传到服务器。
- 清单、收藏等数据保存在当前浏览器的本地存储中，更换设备或清理浏览器数据前请先导出备份。
- 本站不提供云端图床、卡密或平台转换服务。

`tools/` 目录下另有未在首页列出的页面，随站点一并部署：

| 页面 | 路径 |
| --- | --- |
| 软云 AI 热点 | `/tools/ai-hot/` |
| GPT Image 2 提示词库 | `/tools/gpt-image-2/` |
| 二维码与链接解析 | `/tools/aggregate-parser/` |
| 周边图生成器 | `/tools/sp/` |
| 小红书引导图 | `/tools/xhs/` |

## 技术栈

- **页面**：原生 HTML、CSS 与 JavaScript，无框架、无构建步骤。
- **3D**：Three.js 0.180.0（本地提供于 `vendor/`），WebGL 渲染品牌云标。
- **样式**：CSS 自定义属性实现浅色与深色双主题，响应式布局覆盖桌面、平板与手机。
- **托管**：Cloudflare Pages 静态托管；AI 热点的数据服务运行于 Cloudflare Workers。

## 目录结构

```text
.
├── index.html              官网页面内容
├── styles.css              双主题与响应式样式
├── script.js               页面交互：主题切换、导航、滚动动效、3D 场景加载
├── scene.js                Three.js 3D 云标场景
├── _redirects              Cloudflare Pages 路由规则（AI 热点）
├── ruanyun.png             品牌 Logo 原图
├── assets/
│   ├── brand-icon.png      站点图标
│   ├── logo-shapes.js      依据原图描摹的 Logo 轮廓
│   ├── logo-motion.js      云标的自主运动与手势物理（独立模块，可单独测试）
│   └── demo-*.svg          产品功能示意图
├── vendor/                 Three.js 及其许可证
├── tools/                  站内工具页面与共享脚本、样式
├── apps/
│   ├── ai-hot/             软云 AI 热点源码与 Workers 服务
│   └── md-wechat/          软云排版编辑器上游源码
└── tests/                  Node.js 测试
```

## 本地开发

本站为纯静态站点，无需安装依赖。在仓库根目录启动任意静态文件服务器即可，例如：

```sh
python3 -m http.server 4173
```

然后访问 <http://localhost:4173>。

3D 场景使用 ES Modules，必须通过 HTTP 访问，直接双击打开 HTML 文件（`file://`）时无法加载。

修改 `styles.css`、`script.js`、`scene.js` 或示意图后，请同步更新 `index.html` 中对应引用的 `?v=` 版本号，避免浏览器沿用旧缓存。

## 测试

测试基于 Node.js 内置测试运行器，需安装 Node.js 18 或以上版本：

```sh
node --test tests/*.mjs
```

| 测试文件 | 覆盖内容 |
| --- | --- |
| `tests/logo-motion.test.mjs` | 云标的自主运动、快速释放后的惯性、软限位、重新抓取时的连续性，以及 60 Hz 与 120 Hz 下的一致性 |
| `tests/tools.test.mjs` | 工具共享逻辑：UTF-8 Base64、链接提取、图片尺寸计算、昵称生成 |

## 部署

仓库已接入 Cloudflare Pages（项目名 `softcloud`），推送后自动部署：

| 分支 | 环境 | 地址 |
| --- | --- | --- |
| `main` | 生产环境 | <https://zoci.pro> |
| 其他分支 | 预览环境 | `https://<分支名>.softcloud.pages.dev` |

构建配置：无构建命令，输出目录为仓库根目录。建议先推送到预览分支确认效果，再合并到 `main` 上线。

如需手动部署，请上传根目录的页面、脚本、样式，以及 `ruanyun.png`、`assets/`、`vendor/` 与完整的 `tools/` 目录，并保持原有目录结构。

AI 热点的数据服务需单独部署到 Cloudflare Workers，步骤见 [`apps/ai-hot/README.md`](apps/ai-hot/README.md)。`.openai/hosting.json` 仅用于另一套独立的站点预览，不影响 Cloudflare Pages 部署。

## 设计规范

2.0 版本的视觉与交互约定：

**视觉**

- 主色取自品牌 Logo 原图的青绿至海蓝渐变；默认浅色主题，提供深色主题，用户选择保存在本地存储中（键名 `softcloud-theme-blue`，站内工具共用）。
- 四款产品各有专属色调：押韵共创为蓝色，软云单词为青绿色，软云专注为靛蓝色，SBTI 为珊瑚色。卡片标签、悬停光晕与功能示意图均使用对应色调。
- 图标与箭头统一使用 SVG，避免部分手机将文字符号渲染为彩色 Emoji。

**页面结构**

1. 悬浮式导航栏，手机端收起为下拉菜单。
2. 首屏：主标题、行动按钮、统计数据与可交互的 3D 云标。
3. 关键词滚动条，串联全部产品与工具。
4. 产品区：押韵共创整行主推展示，其余三款并列；示意图置于浏览器窗口样式的框中，整张卡片可点击。
5. 工具区：宽屏一行五列，平板为三列加两列，手机为紧凑列表。
6. 关于区：宣言文字随滚动逐字点亮，下方为三条理念与统计数据。
7. 行动号召卡片与站点导航页脚。

**3D 云标**

- 依据 `ruanyun.png` 的轮廓建模，按原图上色，下方有随漂浮起伏的柔光投影。
- 云标持续自主转动与漂浮，支持鼠标与触屏全向拖动；松手后沿手势方向惯性滑行，再平滑回到自主轨迹。
- 旋转角度限制在左右 ±50°、上下 ±22°，接近边界时阻力逐渐增大，始终保持正面朝向。
- 仅模型中央区域响应拖动，周围留白与页面其他区域可正常滚动。
- 首帧绘制完成后淡入显示；WebGL 不可用、加载失败、超时或禁用 JavaScript 时，回退为静态 Logo，页面其他内容不受影响。
- 页面不可见或云标滚出视口时暂停渲染。

## 无障碍与兼容性

- 支持完整的键盘导航，并提供「跳转到产品」快捷链接。3D 云标获得焦点后，可用方向键调整角度，按 Home 键复位。
- 手机端菜单支持 Esc 键或点击外部区域关闭。
- 遵循系统「减少动态效果」设置：停用滚动条、背景漂移与逐字点亮等动画，并降低云标的自主运动幅度，手动拖动保持正常。
- 适配手机、平板与桌面浏览器。

## 子项目

| 目录 | 说明 |
| --- | --- |
| [`apps/ai-hot/`](apps/ai-hot/README.md) | 软云 AI 热点：AI 资讯精选、热点、中文摘要、日报、搜索、RSS 与本地收藏。页面位于 `tools/ai-hot/`，数据接口为同域 `/api/ai-hot`；定时收录与模型调用仅在 Cloudflare 后台运行，阅读页面不会触发模型调用。该页面已不在官网首页展示。 |
| [`apps/md-wechat/`](apps/md-wechat/SOFTCLOUD.md) | 软云排版编辑器的上游源码、锁定依赖与集成说明。构建产物已放入 `tools/mars-editor/`，部署时无需重新安装依赖。 |

## 第三方组件与许可

本仓库使用以下开源项目，均保留其原始许可证：

| 组件 | 用途 | 许可证位置 |
| --- | --- | --- |
| Three.js 0.180.0 | 3D 云标渲染 | `vendor/THREE-LICENSE.txt` |
| md-wechat | 软云排版编辑器 | `apps/md-wechat/LICENSE`、`tools/mars-editor/LICENSE` |
| AIHOT | 软云 AI 热点 | `tools/ai-hot/LICENSE`、`tools/ai-hot/NOTICE` |
| SparkMD5、JSZip、jsQR、gif.js | 工具的编码、打包、二维码与动图能力 | `tools/vendor/` |
| awesome-gpt-image-2 | GPT Image 2 提示词与案例 | `tools/gpt-image-2/LICENSE` |

完整的来源与许可说明见站内页面 [`/tools/credits.html`](https://zoci.pro/tools/credits.html)。

© 2026 软云网络
