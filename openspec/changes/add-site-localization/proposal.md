## Why

CleanU 官网需要为首页、更新日志、隐私政策和支持页提供可直接访问的简体中文与英文版本，同时继续通过现有 Cloudflare Pages 工作流发布静态网站。Astro 重构保持现有视觉样式，国际化路由遵循 Astro 的 locale 目录约定。

## What Changes

- 使用 Astro 静态构建官网，以共享布局和页面组件承载四类页面；每种语言直接生成独立 HTML。
- 使用 Astro 原生 i18n 路由：简体中文默认路由不带语言前缀，英文页面位于 `/en/` 下；根路径继续显示中文首页。
- 保持现有颜色、排版、布局、截图和控件视觉；页面入口与路由按 Astro 文件系统约定组织，继续保留主题、导航、首页预览与 GitHub Release 功能。
- 继续从中英文语言资源读取静态和运行时文案；通过 URL 决定语言，不自动跳转或回退到另一种语言。
- 保留正式构建的 `SITE_URL` 校验、子路径部署和对应语言页面的 `hreflang`；可索引页面补充 `canonical`、`x-default` 和与页面可见内容一致的结构化数据，不新增文案，不输出价格或评分。
- 购买回跳页保留 `noindex` 和原有的中英文 `hreflang`。
- 构建输出 `robots.txt`、`sitemap.xml`、中文 `404.html` 和英文 `en/404.html`。不存在的地址返回 404 状态和对应语言的提示页。
- 移除已不再需要的 Vite 多入口生成器与路径压平插件，构建仍只发布 `dist/`。
- 用户后续确认首页只保留一个本地化下载按钮，指向最新 Release 的通用 DMG；移除架构探测与分架构按钮，无通用产物或请求失败时保留发布页入口。
- 中英文首页在下载按钮下方的信息行显示可下载的 CleanU 版本。信息按价格、一次买断、永久更新、macOS 系统要求、`v{version}` 排列。版本号与 DMG 链接读取同一条最新稳定版发布记录。点击版本号会打开对应语言的更新日志并定位到该版本。没有发布数据时，省略版本号及其前面的分隔点。
- 官网在同一浏览器中记住上次访问首页时看到的 CleanU 版本。首次访问只记录当前版本。回访时若官网提供了更高版本，在版本号右上角显示无文字的青绿色小圆点，并记录新版本。同一版本在下次访问时省略圆点。中英文隐私政策说明这项浏览器本地记录。
- 更新日志以竖向时间线串联版本，保留列表语义，标示链接定位的版本，并在最新稳定版本号旁提供本地化的下载按钮。
- 页脚品牌链接与导航栏一样，返回当前语言的首页。
- 新包命名为 CleanU-{version}.dmg，移除文件名中的 universal 后缀；按 JSON 的真实名称匹配附件和输出下载路径，继续兼容历史包原文件名。
- 更新日志和下载链接都在构建时生成。CleanU 发布后只通知 tag，官网 CI 按最新 Release 的 tag 读取全量 JSON 并恢复安装包，统一部署到 Pages。每次官网重建都查询最新已发布 Release，按其 tag 读取 CleanU 根目录全量 changelogs.json，并恢复对应最新稳定版下载；历史只保留中英文日志，旧安装包保留在私有 GitHub Release；任何文件丢失、被替换、校验失败或超过 25 MiB，都必须停止部署，保留线上网站。需要手动刷新时运行官网自身 Publish，不另设 CleanU 侧的重复同步 workflow。

## Capabilities

### New Capabilities

- `site-localization`: 官网四类页面的中英文静态版本、语言切换、语言一致的站内导航、静态与动态文案本地化、视觉与交互连续性，以及开发和发布构建的一致性。

### Modified Capabilities

无。当前项目没有已发布的 OpenSpec 能力规格。

## Impact

- `astro.config.mjs`、`package.json` 与锁文件：Astro 静态输出、原生 i18n 路由和子路径部署。
- `src/`：Astro 页面入口、共享布局、页面组件、语言资源与 `common/` 共享浏览器模块；使用方直接引用所需模块，移除已无引用的 `common/index.js` 转发入口，页面专属脚本和样式与组件并置，全站共享样式放在 `src/styles/site.css`。
- `src/i18n/translations.js`、`src/i18n/routes.js`：页面文案、页面标识和资源路径辅助；根级 `scripts/`：构建期文案与 `SITE_URL` 校验，其 Node 测试统一放在根级 `tests/`，不使用含义模糊的根级 `build/` 源码目录。
- `src/data/structured-data.js` 与 `src/data/sitemaps.js` 分别生成页面结构化数据和抓取发现文件。构建钩子写出 `robots.txt` 和 `sitemap.xml`，两个 404 入口复用同一个页面组件。
- `public/`：保留现有静态图片和 favicon；沿用 Astro 默认公开资源目录。
- 移除 `vite.config.js`、`build/flatten-pages.js` 及基于占位符生成 HTML 的实现；保留适用的语言校验与回归检查。
- README、`AGENTS.md` 和 Cloudflare Pages 发布工作流文档。
- 继续通过 Cloudflare Pages 发布静态 `dist/`，不引入服务端运行时、React/Vue 前端运行时或新数据服务。

- 发布前根据提交生成待整理草稿，由开发助手或维护者准备并确认 `changelogs/{version}.json` 中的 zh-CN/en 说明。发布流程校验两种语言完整后从全量 changelogs.json 生成仅本次版本的英文 GitHub Release 正文；官网按 locale 生成纯文本 HTML，不使用运行时翻译服务。

- 收敛官网发布代码为一个执行脚本与一个本地数据模块，合并 sync/assets/check 的 CLI 包装。页面只读取本地快照，网络请求和安装包恢复留在发布阶段；每次重建恢复最新 DMG、数据修订和生产版本检查继续保留。

- 精简 Publish YAML，把官网四个手动发版步骤合并为部署前准备版本、部署后推送发布两个步骤，保留原顺序；自动同步仍不递增官网版本，main/tag 一次原子推送，不新增发布入口或脚本。
