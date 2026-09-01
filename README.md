# 个人主页

极简黑白风格的个人主页，纯 HTML / CSS / JavaScript，无任何框架和构建步骤。

## 板块

- **简介** — 一段自我介绍 + 统计数字
- **项目** — 默认展示 `app.js` 中手写的项目；开启 `liveRepos: true` 后自动从 GitHub API 拉取你的最新仓库
- **动态** — 时间线形式的想法记录

## 如何修改内容

所有文字内容都在 `app.js` 顶部的 `SITE` 配置对象里，改完保存、提交即可，无需懂代码。

## 本地预览

任意静态服务器均可，例如：

```bash
python -m http.server 8080
```

## 部署

托管在 GitHub Pages。
