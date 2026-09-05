# 软云网络 · SoftCloud

软云网络品牌首页：让想象，成为日常。

## 本地预览

这是无需安装依赖的 HTML / CSS / JavaScript 静态站点。在项目目录运行任意静态服务器，例如：

```sh
python3 -m http.server 4173
```

访问 `http://localhost:4173`。3D 场景使用 ES modules，需要通过 HTTP 访问，不支持双击 HTML 的 `file://` 模式。

## 页面与交互

- 取自原始 Logo 的蓝白视觉，默认明亮浅色，支持可选深蓝主题并记住选择。
- 依据原始 Logo 轮廓制作的 Three.js 蓝白立体云标，支持缓慢转动与桌面指针响应。
- 动画可暂停；遵循系统减少动态效果设置；不可见时停止渲染。
- WebGL 不可用时保留静态排版与所有产品入口。
- 适配手机、键盘导航及滚动入场。

现有产品入口：SoftCloud TV (`tv.zoci.pro`)、SBTI 人格测试 (`sbti.zoci.pro`)、AI Todo (`aitodo.zoci.pro`)。

## 文件与部署

`index.html` 为内容，`styles.css` 为双主题与响应式样式，`script.js` 为页面交互，`scene.js` 为 3D 场景。

部署时上传这四个文件、`ruanyun.png`、`assets/` 与 `vendor/`，保持目录结构即可；无需服务器端程序或构建步骤。`.openai/hosting.json` 仅用于独立的 Sites 预览，不影响原有静态托管。

Three.js 0.180.0 随项目本地提供，许可证见 `vendor/THREE-LICENSE.txt`。电影卡片的蓝天海岸景观为原创 AI 生成插图，不是实际电影海报或影片截图。
