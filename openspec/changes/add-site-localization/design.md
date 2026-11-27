## Context

CleanU 官网提供首页、更新日志、隐私政策和支持页，页面文案存放于 `src/locales/{zh-CN,en}.json`。用户要求改用 Astro，并明确只需保持现有视觉样式，其余采用 Astro 约定。

行为契约见 `specs/site-localization/spec.md`。最终产物为八个独立静态页面与共享资源，部署工作流继续上传 `dist/`。

## Goals / Non-Goals

**Goals:**

- 使用 Astro 的静态多页面构建和组件组织，删去手写 HTML 生成与引用压平层。
- 保持现有页面视觉样式，继续提供语言一致的页面、站内导航和 Pages 子路径部署。
- 复用语言 JSON、主题存储和现有图片；Release 数据在发布和构建时同步，不引入 UI 框架运行时。
- 让开发服务和发布构建都由 Astro 直接渲染同一组页面源文件。

**Non-Goals:**

- 不重新设计页面、不改写产品文案或重新制作截图。
- 不增加自动语言跳转、客户端路由、服务端渲染、CMS 或新运行时数据源。
- 下载与双语更新日志按后续确认改为构建期数据同步。

## Decisions

### 1. Astro 原生 i18n 路由与目录式静态输出

使用 Astro `output: 'static'`、`build.format: 'directory'` 和 `trailingSlash: 'always'`。配置 `zh-CN` 为默认 locale，并关闭默认 locale 前缀；中文页面由 `pages/` 下的入口提供，英文页面放入 `pages/en/`。公开路径分别为 `/`、`/changelog/`、`/privacy/`、`/support/` 和 `/en/`、`/en/changelog/`、`/en/privacy/`、`/en/support/`。

页面语言链接和绝对 `hreflang` 地址使用 `astro:i18n` 的 `getRelativeLocaleUrl`、`getAbsoluteLocaleUrl`。`src/i18n/routes.js` 仅映射站点页面标识及资源 base，不再重复实现 locale 路由，并由页面文案入口复用。发布工作流注入 `SITE_URL` 时，从其路径派生 Astro `base`；本地开发没有 `SITE_URL` 时使用站点根路径。

Astro 按静态站点构建；页面不需要服务器，也不以客户端路由接管普通导航。开发和构建都直接编译 Astro 源码，不再预先写出 `.generated/` HTML。

### 2. 共享布局与页面组件只提取重复结构

`src/layouts/SiteLayout.astro` 负责文档语言、标题与描述、主题色、共享 CSS、导航、主题初始化、页脚和页面运行时文案数据。首页、更新日志、隐私政策和支持页各有一个页面组件；八个薄入口仅传入对应语言。

页脚品牌与导航栏品牌都使用普通链接。在首页链接到 `#top`，在其他页面用 `pageHref` 生成当前语言的首页链接，支持部署子路径。

页面继续使用原有视觉样式和交互钩子。Astro 页面组件按职责组织，避免为适配旧模板而维护重复 HTML 生成层。

语言文案由 `src/locales/{zh-CN,en}.json` 提供。构建前校验两种语言的文案键、非空文本和插值参数集合；运行时字典只包含当前页面实际使用的必要类别。HTML 内容由 Astro 正常转义，运行时 JSON 嵌入前额外转义 `<`，避免文案中的结束标签截断脚本数据块。

页面使用 `translationsFor()` 获取当前语言文案；布局属性和运行时文案数据统一称为 `translations`，浏览器端通过 `translate()` 读取单条运行时文案。

运行时文案读取与全站交互初始化分别放在 `src/common/translations.js` 和 `src/common/site.js`；使用方直接引用所需模块。下载和日志静态化后页面脚本已无需共享翻译接口，移除没有调用方的 `src/common/index.js` 转发入口。

构建期的文案和 `SITE_URL` 校验实现放在根级 `scripts/`，其 Node 测试统一放在根级 `tests/`，用 `pnpm test` 执行。页面源码会调用的路由与资源路径辅助放在 `src/i18n/`；根级 `build/` 不作为源码目录，避免与生成产物 `dist/` 混淆。

### 3. 将现有 CSS 和交互原样接入 Astro

公共 `src/styles/site.css` 保留全站令牌、基础排版和跨组件规则；四个页面组件各自的 CSS 与所属 Astro 组件放在同一目录，CSS 声明值保持不变。页面私有交互脚本也与所属组件并置；跨页共享浏览器逻辑与 Release 配置放在 `src/common/`，仍以普通模块脚本加载，无需改写成 Vue、React 或客户端水合组件。`src/pages/` 只放 Astro 文件路由。静态资源使用 Astro 默认的根级 `public/` 目录。

静态图标、截图与 favicon 放入 Astro `public` 资源目录，构建路径通过 `BASE_URL` 生成，以兼容仓库子路径。页面专属样式继续使用既有类名，特别保留首页预览标签的等宽布局、单一滑块尺寸计算、减动效、键盘操作与窄屏规则。

主题初始化脚本保持在 head 中尽早运行，以防首次绘制闪现错误主题。更新日志的 Release 列表由 Astro 在构建时渲染，原文经 HTML 转义；浏览器不再加载或缓存列表，也无需加载、超时或 API 错误提示。

### 4. 正式 URL 与语言关联继续显式校验

复用现有 `SITE_URL` 规则：本地可省略，正式发布通过 `REQUIRE_SITE_URL=true` 要求有效的公开 HTTPS URL。Astro `base` 采用其站点子路径，`getAbsoluteLocaleUrl` 生成带部署路径的绝对 `hreflang` 地址；中文和英文页面配对同一逻辑页面。

站内地址由 Astro locale helper 生成，不能在组件里拼接遗漏 base 的根绝对路径。HTML 导出后检查八个页面入口、语言关联、站内目标和静态资源引用，避免只在开发服务器根路径有效。

### 5. 以现有页面为基准进行视觉和行为验收

重构前在现有开发服务记录首页、更新日志、隐私政策和支持页的视觉基准。Astro 版本在相同视口和主题下复查；首页还检查预览切换、导航、主题、FAQ、下载入口和减动效。窄屏检查语言入口、导航展开、预览标签与内容溢出。页面与路由组织可按 Astro 约定调整，视觉样式保持一致。

除了截图对照，还检查八个 locale URL、英语/中文切换、无 JavaScript 的静态正文、`hreflang`、默认中文根路径及 Pages 子路径资源加载。不得以修改样式值来适配路由或组件结构。

## 抓取发现与结构化元数据

以下改动只写入 `<head>` 和构建产物，现有十二个页面的 `<body>` 保持逐字节一致，不新增或改写任何可见文案。

结构化数据由 `src/data/structured-data.js` 的纯函数生成：共享布局输出组织、站点和页面节点，首页组件追加软件产品和 FAQ 节点，合为一段 `@graph`。字段只取页面上已经可见的内容：名称取品牌名，描述取页脚标语，系统要求取首屏信息行，版本号与下载地址取首页下载按钮使用的同一条最新稳定版记录，FAQ 取首页四组问答。购买配置属于内部配置，且购买未开放时页面显示关闭状态，因此不输出 `offers`，也不读取购买配置。不生成评分、`llms.txt`、OG 标签或无法保证准确的字段。没有 `SITE_URL` 时整体省略，不输出虚构的绝对地址。

可索引页面复用生成 `hreflang` 的语言路由函数。当前语言页面作为 `canonical`，对应的中文页面作为 `x-default`。购买回跳页保留 `noindex` 和中英文 `hreflang`，省略 `canonical` 和 `x-default`。

`robots.txt` 与 `sitemap.xml` 在现有 `astro:build:done` 钩子里与 `_headers` 一起写出，生成逻辑和 `pageUrlFor` 放在 `src/data/sitemaps.js`，不新增依赖。静态端点无法在缺少 `SITE_URL` 时跳过输出（非动态路由忽略 `getStaticPaths`），钩子可以按 `SITE_URL` 是否存在决定是否生成站点地图。`pageUrlFor` 按 Astro locale 路由规则拼接绝对地址，并由 `site:check` 与构建产物中的 `hreflang` 逐条比对，防止两套规则漂移。站点地图只列可索引页面并附带语言关联；`robots.txt` 只写全站许可和站点地图地址，不逐个枚举爬虫。没有 `SITE_URL` 时仍输出 `robots.txt`，但不声明站点地图，也不生成 `sitemap.xml`。

Cloudflare Pages 会为未知路径选择最近的 `404.html`。`src/pages/404.astro` 和 `src/pages/en/404.astro` 分别生成中文和英文提示页，由各自的 URL 匹配。两页与普通页面共用路由表、页头语言切换和产物校验。页头语言链接指向另一种语言的 404，正文返回链接指向当前语言的首页。两页省略页面头部的语言关联、`canonical` 和结构化数据，也不进入站点地图。

`scripts/check-site.js` 在现有页面与链接检查之外，断言结构化数据可解析、`canonical` 与语言关联一致、`robots.txt` 与 `404.html` 存在，并在设置 `SITE_URL` 时核对站点地图条目。生成逻辑由 Node 测试覆盖，不依赖 Astro 运行时。

未设置 `SITE_URL` 时，检查脚本用保留的 `.invalid` 域名解析站内相对链接。公开地址的校验只使用 `SITE_URL`。

## Risks / Trade-offs

### 静态更新日志与私有发布连接

更新日志继续使用本站字体、黑白主题和颜色令牌。左侧时间线用细竖线连接各版本的圆点，圆点与版本号对齐。最新稳定版用青绿色实心圆点突出，版本号旁提供浅青绿底的下载文字按钮，与首页链接至同一个通用 DMG。历史版本用空心圆点。连线止于最后一个圆点，单个版本只显示圆点。桌面以版本信息与说明两列组织，640px 及以下改为单列。日期在版本号下方，字号为 12px。版本提供站内锚点，说明保持纯文本并由 Astro 转义。

时间线隐藏原生列表标记后，用 `role="list"` 保留 Safari 的列表语义。版本锚点负责定位到相应条目，目标版本号沿用普通版本号样式。

- [静态输出的路由名或子路径与 Astro 配置不同] → 使用 Astro locale URL helper，并核验根路径与部署子路径的最终 `dist/`。
- [Astro 改写 HTML 结构后样式选择器失效] → 保留 class/ID/ARIA/data 属性和 CSS 声明；逐页浏览器对比。
- [public 资源移动后子路径请求 404] → 统一用 `BASE_URL` 生成 HTML 资源路径，检查构建产物本地引用。
- [语言 JSON 被漏用或运行时字典变大] → 静态和动态文案都引用现有字典，只注入页面所需运行时类别，构建时校验字典。
- [私有 Release API 不可匿名读取] → 仅在 CI 同步，用只读 secret；同步失败时停止发布，线上继续保留上一版静态站点。
- [Astro 版本升级带来配置变化] → 锁定 package 与 lockfile 的依赖版本，并以项目构建为准验证。
- [结构化数据与可见内容或下载地址不一致] → 字段只从页面已用的文案和同一条发布记录派生，不手工维护，并由产物检查比对 canonical 与 hreflang。
- [部署平台的 AI 爬虫开关或托管 robots.txt 覆盖站点文件] → 代码无法检测，部署后在 Cloudflare 后台确认两者均未开启。

## Migration Plan

1. 添加 Astro 并配置原生 i18n、目录式静态输出、站点 base 与正式 URL 验证。
2. 建立共享布局与四类页面组件，保持视觉样式并产生八个 locale 路由。
3. 迁移公共和页面专属样式、favicon 与截图到 Astro 兼容的资源入口，确认子路径链接。
4. 删除旧 Vite 配置、入口占位符生成器和压平插件，更新构建、开发、测试和 README 命令。
5. 运行本地化检查、静态构建与页面视觉/交互验收；完成后仍通过现有 Pages 工作流发布 `dist/`，不自动执行线上发布。

## 双语日志、PR 审核与 Pages 分发

手动执行 release.yml 只选择版本升级类型。准备 job 在 main 计算候选版本，向 Gemini 发送前一 tag 以来的 commit subject；不读取代码差异或未提交文件。已有说明直接复用，已有发版 PR 只返回链接，不覆盖人工修改。PR 分支为 changelogs/v{version}，文件记录 version_type 与 source_sha，正文展示双语预览。GEMINI_API_KEY 仅注入生成步骤并以 HTTP header 发送；免费档可能使用输入/输出改进服务，不得发送敏感提交标题。本地 notes/preview 也使用 Gemini，review 命令只确认已校验的说明。

维护者直接编辑 PR 中的 changelogs/{version}.json，合并到 main 即最终发版授权。只有同仓库 changelogs/v 前缀的 PR 合并事件触发 macOS release job。使用 PR merge commit 检出源码，核对 main 未继续前进、版本类型与候选版本一致，以及从 source_sha 至 merge commit 只修改目标说明文件；新增应用提交意味着说明已过期，发布前停止。通过校验后确认 reviewed=true，执行既有测试、版本升级、通用 DMG 构建。

构建后校验真实 DMG 的名称、大小、SHA-256 与 appcast，向 CleanU 根目录 changelogs.json 追加当前记录，保留历史。首次空清单从已发布 GitHub Release 的真实日期及已确认版本说明初始化历史，不导入未发布草稿；此后原样保留历史数据。记录包含 version、published_at、notes.zh-CN/en；最新记录还包含 asset.name/size/sha256，附件 ID 由官网从 Release API 获取，不写私有 URL 或凭据。当前日期在发布 job 生成，官网当前版本日期以 GitHub published_at 为准。

双语历史保存在 changelogs.json，GitHub Release body 只取本次版本的 notes.en。changelogs.json 与项目版本、appcast、确认后的说明进入同一发布 commit 和 tag。Release 只附 Universal DMG，JSON 保存在 tag 对应源码中，无需重复附件。

Release 与 DMG 上传成功后 notify-site 使用 gh api 只向官网发送 cleanu-release/tag 事件。官网以 CLEANU_RELEASES_TOKEN 查询最新稳定 Release，按该 tag 从 CleanU 源码读取全量 changelogs.json，再从同一 Release 获取 DMG 附件 ID。旧通知也读取当前最新 Release，不能降级。GitHub Release/tag 是持久化来源；移除准备 Artifact、运行 ID、再次 prepare 与官网 release-data 分支及写入合并代码。手动刷新通过官网自身 Publish 工作流执行，沿用完整同步、构建和部署，并保留官网自己的版本/tag/Release 流程；不再保留应用侧手动同步入口。

每次官网构建均拉取上述数据，Astro 输出静态双语历史与首页直链。构建后恢复唯一最新 DMG 到 dist/downloads/{version}/{name}，核对大小、SHA-256、25 MiB 上限，并生成公网 updates/appcast.json；部署前再核对最新 Release/tag 的 JSON 修订与线上版本。同版本包不可替换，任何失败不进入部署。生产部署串行执行；官网代码重建和回滚也走完整 Publish workflow，关闭绕过该 workflow 的 Cloudflare Git 自动构建。历史日志保留，Pages 仅保留最新包，旧包留在私有 Release。GitHub/Cloudflare 凭据配置与真实线上验收仍需维护者完成。

## 官网发布模块职责

src/data/releases.js 只负责本地 JSON 读取、契约校验、版本排序与下载路径，供首页和日志 Astro 组件使用，不包含 GitHub 请求。scripts/releases.js 负责所有发布网络操作与唯一 CLI：sync 在构建前写入快照和修订；assets 在构建后校验并恢复唯一最新 DMG 和公网 appcast；check 在部署前核对最新发布修订与线上版本。原先三个包装入口及 release-assets.js 合并到该执行脚本，共用一处 CLI 错误处理，测试导入脚本时不执行 CLI。

应用侧使用 gh api 通知，官网继续核对最新稳定 Release、tag JSON 和附件数据，并在真实下载后检查大小/hash。减少入口不改变失败停止部署、凭据隔离、最新包恢复、历史日志保留和串行部署约束。

新包使用 CleanU-{version}.dmg，数据校验继续接受旧的 CleanU-{version}-universal.dmg。下载路径直接取 JSON 的 asset.name，Release 附件也按该名称匹配；已发布文件和历史元数据保持原样，appcast 的 universal/arm64/x86_64 键仍共用一个通用包。

### 首页版本号与更新圆点

Astro 用生成 DMG 链接的同一条发布记录渲染版本号。版本号使用带下划线的普通链接，悬停时变色，键盘聚焦时显示焦点轮廓。链接目标由当前语言的日志路由和 `releaseId(version)` 生成。更新日志用同一函数生成条目的 ID。窄屏将购买信息与系统要求及版本号分组，并隐藏两组之间的分隔点。购买信息可以换行，各分隔点随对应文案移动。圆点在明暗主题中均使用与应用界面呼应的青绿色，辅助技术使用当前页面语言读取更新提示。

首页脚本在页面打开时读取同源浏览器存储，中文和英文共用 `cleanu:seen-release-version`。从返回的页面读取当前版本，通过 `src/common/release-version.js` 与保存的版本按数字比较。首次访问或遇到无效记录时建立基准，更高版本保存成功后显示圆点，较旧的缓存页面不能降低已见版本。恢复浏览器历史页面时重新检查。没有发布记录、JavaScript 不可用或浏览器拒绝存储时省略圆点。比较无需网络请求，浏览器只保存版本号。

## Workflow 最小精简

同步、测试、Astro 构建、DMG 恢复、部署前检查和 Pages 部署顺序保持一致。官网手动发版的 Git 配置与升版本/commit/tag 合为部署前准备步骤，推送与 GitHub Release 合为部署后的发布步骤，继续用 GITHUB_ENV 传递 NEW_VERSION。保留两步可以维持 Pages 关联的 Git 提交，并避免把 Wrangler 安装时对 package.json 的临时修改提交进去。main 与 tag 原子推送。自动事件跳过两个手动步骤，保留既有手动版本规则与官网 Release，不新增 job 或脚本。
