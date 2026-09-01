# SylvestreS

极简黑白风格的个人博客，纯 HTML / CSS / JavaScript。**没有框架，没有构建步骤。**

## 写文章

在 `posts/` 下新建一个 `.md` 文件，开头写 front matter：

```markdown
---
title: 文章标题
date: 2026-09-01
tags: [随笔, 前端]
summary: 一句话摘要，显示在文章列表里。
---

正文从这里开始，支持 Markdown 语法。
```

然后跑一次索引脚本：

```bash
python sync_posts.py
```

它会扫描所有文章，生成 `posts/index.json`（列表页用）和 `feed.xml`（RSS 订阅源）。

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
    *.md          文章（Markdown + front matter）
    index.json    自动生成的文章索引
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
| `#/` | 文章列表（含搜索、标签筛选） |
| `#/post/<slug>` | 单篇文章（含目录、上下篇） |
| `#/archive` | 按年份归档 |
| `#/about` | 关于我 + GitHub 项目 |

## 站点信息

博客名、简介、社交链接等在 `app.js` 顶部的 `SITE` 对象里改。

## 部署

托管在 GitHub Pages：`https://sylvestres.github.io/`
