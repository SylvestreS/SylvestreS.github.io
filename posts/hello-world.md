---
title: 个人主页上线了
date: 2026-09-01
tags: [随笔, 前端]
summary: 用纯 JavaScript 做了一个极简黑白的主页，托管在 GitHub Pages 上。
---

折腾了半天，这个主页终于上线了。

## 为什么是纯手写

一开始我考虑过 Hugo、Hexo、Astro 这些静态站点生成器，但它们都要装 Node、跑构建、配置 CI。我只是想要一个能放几段字和几个项目链接的地方，于是决定：

> 用最朴素的方式写——HTML + CSS + JavaScript，双击就能打开，不需要任何构建步骤。

## 技术选择

实现上做了这些取舍：

- **不用框架**：没有 React、没有 Vue，原生 DOM API 足够
- **内容即配置**：所有文字放在 `app.js` 顶部的 `SITE` 对象里，改字不用碰逻辑
- **明暗切换**：CSS 变量 + `localStorage` 记住偏好
- **项目自动同步**：运行时调 GitHub API 拉最新仓库

```js
// 就是这么简单
const repos = await fetch(
  `https://api.github.com/users/${SITE.name}/repos?sort=updated`
).then((r) => r.json());
```

## 接下来

这个站点会慢慢长成一个博客。文章用 Markdown 写，浏览器里现场渲染，没有构建步骤。

如果你也在搭自己的主页，希望这套思路对你有用。
