# SylvestreS · 区块链 / 代币化 / RWA 学习笔记

极简黑白风格的学习笔记站，纯 HTML / CSS / JavaScript。**没有框架，没有构建步骤。**

学习路径自下而上分四级：**L1 区块链 → L2 加密货币 → L3 资产代币化 → L4 RWA**。

## 写笔记

在 `posts/` 下新建一个 `.md` 文件，开头写 front matter：

```markdown
---
title: 文章标题
date: 2026-09-01
tags: [区块链, 基础概念]
summary: 一句话摘要，显示在列表里。
level: L1
track: blockchain
---

正文从这里开始，支持 Markdown 语法。
```

`level` 取 `L1`–`L4`，`track` 取 `blockchain` / `cryptocurrency` / `tokenization` / `rwa`。

然后跑一次索引脚本：

```bash
python sync_posts.py
```

它会扫描所有文章，生成 `posts/index.json`（列表页用）和 `feed.xml`（RSS 订阅源），
顺便校验术语库和路径数据——比如路径指向了不存在的文章、或某篇笔记忘了挂到路径上，都会报警。

## 两个数据文件

- `data/roadmap.json` —— 学习路径。四个分级 + 23 个知识点，每个知识点可用 `post` 字段挂上对应笔记。前端会渲染出进度条，勾选状态存在浏览器 localStorage 里（首次访问时，已有笔记的知识点自动勾选）。
- `data/glossary.json` —— 术语词典。收录 39 条术语，笔记正文里出现的术语会自动加虚下划线，鼠标悬停出释义，点击跳到完整条目。

给词典加词条：

```json
{
  "term": "Oracle",
  "zh": "预言机",
  "level": "L3",
  "track": "tokenization",
  "aliases": ["预言机", "Chainlink"],
  "brief": "一句话解释。",
  "detail": "两到三句展开解释。"
}
```

`aliases` 里的词也会参与正文自动匹配。如果某个词太通用容易误伤（比如 "Node"），
把它加进顶层的 `annotate_exclude` 数组，就只出现在词典里、不在正文标注。

## 支持的 Markdown 语法

标题、段落、**粗体**、*斜体*、行内 `代码`、围栏代码块（带复制按钮）、
无序/有序列表、引用、表格、分割线、链接、图片。

## 目录结构

```
site/
  index.html      页面骨架
  style.css       全部样式（明暗双主题）
  app.js          Markdown 解析器 + 路由 + 各页面渲染
  posts/
    *.md          笔记（Markdown + front matter）
    index.json    自动生成的索引
  data/
    glossary.json 术语词典
    roadmap.json  学习路径
  feed.xml        自动生成的 RSS 订阅源
  .nojekyll       关键：禁用 GitHub Pages 的 Jekyll 构建
```

> `.nojekyll` 不能删。GitHub Pages 默认会用 Jekyll 把 `.md` 转成 HTML，
> 那样前端就 fetch 不到 Markdown 原文了。

## 本地预览

必须通过 HTTP 打开（fetch 在 `file://` 下会被浏览器拦截）：

```bash
cd site && python -m http.server 8080
```

## 页面

| 路由 | 内容 |
| --- | --- |
| `#/` | 笔记列表（含搜索、标签筛选） |
| `#/roadmap` | 学习路径（L1–L4 分级，可勾选进度） |
| `#/glossary` | 术语词典（搜索 + 分级筛选） |
| `#/glossary/<术语>` | 定位到某个词条 |
| `#/post/<slug>` | 单篇笔记（含目录、术语释义、上下篇） |
| `#/archive` | 按年份归档 |
| `#/about` | 关于本站 + GitHub 项目 |

## 站点信息

站名、简介、社交链接、免责声明都在 `app.js` 顶部的 `SITE` 对象里改。

## 测试

```bash
node smoke_test.js
```

校验 Markdown 解析结果、术语库与路径数据的完整性，以及术语标注正则不会死循环。

## 部署

托管在 GitHub Pages：`https://sylvestres.github.io/`

> 本站内容只是个人学习笔记，不构成任何投资建议。
