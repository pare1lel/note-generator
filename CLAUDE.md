# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
npm run dev     # 启动开发服务器(http://localhost:3000)
npm run build   # 生产构建
npm start       # 运行生产构建
npm run lint    # Next.js ESLint
```

本仓库无测试套件。

### 启动方式说明

- 直接 `npm run dev` 时会回退到本地 SQLite(`data/notes.db`),首次运行自动创建。
- 接入 Turso 远程库或自定义 JWT 密钥时,使用 `./start.sh`(已被 gitignore,内含真实 secret;脚本会注入 `TURSO_DATABASE_URL`、`TURSO_AUTH_TOKEN`、`JWT_SECRET` 后再 `npm run dev`)。
- 修改 schema 或种子数据后,删除 `data/notes.db` 让 `lib/db.ts` 重新初始化。

## 架构总览

这是一个面向英语阅读教学的 LLM 标注应用。核心机制是 **TipTap 编辑器内的内联标注 + 浏览器直连 Anthropic 兼容 API 的流式生成**,服务端仅做认证、鉴权和持久化。

### 三层架构

1. **数据层 `src/lib/db.ts`** — 使用 `@libsql/client`,既支持远程 Turso(`libsql://...`)也支持本地 SQLite(`file:data/notes.db`),由 `TURSO_DATABASE_URL` 切换。客户端是模块级单例,schema 通过 `initPromise` 懒初始化一次。四张表:`users` / `articles` / `annotations` / `style_reports`,所有 article 子表都 `ON DELETE CASCADE`。注意 `updateArticle` 会同时清空该文章的所有 annotation 和 style report —— 内容改动后旧标注的位置信息已失效。

2. **API 层 `src/app/api/`** — Next.js App Router 路由。所有涉及 article 的路由都必须先 `verifyOwnership`(组合 `getSessionFromRequest` + `getArticleOwner`),避免越权访问;每个文件里都重复定义了这个本地辅助函数(刻意未抽公共模块,改动时注意保持一致)。
   - `auth/*` — 注册/登录/登出/me,使用 JWT cookie(`jose` 签发,HttpOnly,7 天有效)。新用户注册时会自动播种 `last-leaf` 文章。
   - `articles` / `articles/[id]` / `articles/[id]/annotations` / `articles/[id]/style-report` — REST 风格,所有 LLM 生成结果由客户端 POST/PUT 上来,**服务端不直接调用 LLM**。

3. **前端层 `src/app/page.tsx`(主控)+ `src/components/` + `src/extensions/`** — 这是逻辑最重的一层。

### LLM 调用是浏览器直连,不经服务端

关键设计点:**API key 存在浏览器 `localStorage`(`Settings.tsx` 中 `STORAGE_KEY = "apiConfigs"`),由 `src/lib/stream-json.ts` 中的 `streamGenerate` 直接 fetch 到用户配置的 Anthropic 兼容端点**(发送 `x-api-key` + `anthropic-dangerous-direct-browser-access: true` 头)。后端永远看不到 API key。

- 支持配置多个 API,失败时弹出 `ApiErrorDialog`,用户可选择"试下一个"或"用 Demo 模式回退"。
- Demo 模式 = `src/lib/llm-simulator.ts`,无网络时也能跑。
- 三种生成类型 `word | sentence | style`,prompt 模板在 `src/lib/prompts.ts`。所有 prompt 都强制 LLM 返回**纯 JSON**(无 markdown 围栏),并要求**双语**(英文 + 中文)字段。

### 流式 JSON 解析(`lib/stream-json.ts`)

LLM 是逐 token 返回的,JSON 通常残缺。这里有两套机制:

- **`tryParsePartialJson`** — 边收边解析:遇到字符串/数组/对象未闭合时,补上引号和右括号后尝试 `JSON.parse`,解析成功就触发 `onUpdate(partial)`,让 UI 实时渲染半成品。
- **`repairJson`** — 收完后兜底:把字符串值内未转义的换行/控制字符/双引号修正。利用"下一个非空白字符是否是结构字符(`,}]:`)"来判断引号是结构闭合还是内容引号。

主页面(`page.tsx`)对应有 `mergeWordPartial` / `mergeSentencePartial` / `mergeStylePartial`,每次只覆盖非空字段,保证局部更新不会清空已生成内容。`abortFlag` 是 `React.RefObject<boolean>`,文章切换时设 `true`,正在跑的 stream 检测到后丢弃增量。

### TipTap 标注扩展(`src/extensions/annotation-mark.ts`)

自定义 `Mark`,渲染为 `<span data-annotation-id data-annotation-number data-annotation-type>`,**同时通过 ProseMirror Plugin 在 mark 末尾插入 `<sup>` widget Decoration 作为编号角标**。badge 不属于文档内容,因此 `getParagraphText` 在拼上下文给 LLM 时必须 `clone + 删除 .annotation-badge` 再取 textContent —— 否则编号数字会污染传给 LLM 的段落。

### 标注持久化与重放

`annotations` 表保存 `mark_from`、`mark_to`、`mark_number`(ProseMirror 位置)。文章加载后:

1. `page.tsx` 把数据库返回的 mark 信息塞进 `savedMarks` 传给 `ReadingEditor`;
2. `ReadingEditor` 把 `savedMarks` 推入 `pendingAnnotationsRef`;
3. 当对应 annotation 在 `annotations` 数组里出现时,effect 才真正用 `editor.view.dispatch` 添加 mark。

这种"待应用队列"模式是因为编辑器初始化和注解数据到达不同步。新生成的标注也走同样流程:先 push pending、立刻显示 placeholder、流式填充内容、最终 POST 到 `/api/articles/[id]/annotations`。

由于内容编辑(如 `updateArticle`)会清空所有标注,**编辑文章前要警示用户**;保存前需要从 `editor.getHTML()` 移除残留的 annotation mark(参见最近一条 fix commit `2c2a237`)。

### 路径别名

`tsconfig.json` 设了 `@/* → src/*`,导入时统一用 `@/components/...`、`@/lib/...`。

## 主要技术栈

Next.js 15(App Router) · React 19 · TypeScript(strict) · Tailwind CSS · TipTap 2 / ProseMirror · `@libsql/client` · `jose` / `bcryptjs`
