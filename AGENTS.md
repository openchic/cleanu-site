# AGENTS.md — CleanU 官网

只记架构与规范；产品介绍与 `pnpm` 命令见 `README-zh_CN.md`。

## 架构

- Astro 静态路由不带末尾斜杠：`zh-CN` 无前缀，英文在 `/en`；使用根级 `src/`、`public/`，只发布 `dist/`。
- 每页每语言一个薄入口，共用布局与页面组件；`src/locales/{zh-CN,en}.json` 是唯一界面文案源，构建时校验键、类型与插值参数，缺失键不得回退到另一种语言。
- 语言以 URL 为准，导航用普通链接；页面链接与 `hreflang` 由 `astro:i18n` 生成，`src/i18n/routes.js` 映射页面标识，`src/i18n/translations.js` 管理文案并用 `BASE_URL` 生成资源地址，兼容 Pages 子路径。
- 抓取元数据只写入 `<head>` 和构建产物。可索引页由布局输出 `canonical`、`x-default` 与 JSON-LD，字段只取页面可见文案和首页下载使用的同一条发布记录，不读取购买配置。购买回跳页保留 `noindex` 和中英文 `hreflang`。构建钩子输出 `robots.txt` 与 `sitemap.xml`，站点地图只含十个可索引地址。中文和英文 404 分别输出到 `404.html` 和 `en/404.html`，共用路由表、语言切换和产物校验。两页省略页面头部的语言关联与结构化数据，也不进入站点地图。缺少 `SITE_URL` 时省略全部绝对地址，发布构建必须设置。
- Node 测试统一放在根级 `tests/`（`pnpm test`）；构建期校验脚本保留在 `scripts/`。

## 发布数据

- 首页下载与更新日志在构建时读取双语发布快照：文案来自 locale JSON，版本说明来自应用已确认的 changelogs。
- 生产快照必须查询最新已发布 Release，按其 tag 从 CleanU 应用仓库根目录读取 `changelogs.json`，构建后恢复并校验唯一最新稳定版 DMG 再输出 appcast；浏览器不请求 GitHub 或翻译 API，历史日志不含旧下载链接。
- 自动事件不递增官网版本，部署只走完整 Publish 工作流。
- 发布代码只保留 `src/data/releases.js` 与 `scripts/releases.js`：页面引用前者，后者提供 `release:sync` / `release:assets` / `release:check`，不拆分仅作转发的入口文件。

## 开发服务

- 修改界面、文案或样式后，自动启动开发服务（`pnpm dev`，http://localhost:4321），在浏览器校验受影响页面（中英、明暗）；服务已在运行则复用，避免重复占用端口。
- 本地默认无发布数据，更新日志显示空状态，样式与文案校验不受影响；需要真实数据时，启动前用 `CLEANU_RELEASES_FILE=<发布清单路径> pnpm dev` 指向一份应用仓库的 `changelogs.json`，路径按本机环境提供，不写死其它工程位置。本地无下载产物，下载链接 404 属正常。
- 交付时保持服务运行，并给出可访问的页面链接。
