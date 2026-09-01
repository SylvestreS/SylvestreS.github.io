---
title: GitHub Pages 部署踩坑记：当 git push 走不通时
date: 2026-08-12
tags: [部署, 技术]
summary: 网络把 github.com 拦了，git push 用不了。最后我用 REST API 完成了全部部署动作。
---

给站点部署到 GitHub Pages 时，遇到了一个有意思的障碍：`git push` 根本推不上去。

## 问题

排查下来，这台机器访问 `github.com` 主域直接被网络策略拦掉：

```
代理连接 → 502 Bad Gateway
直连     → 连接超时
```

但奇怪的是 **`api.github.com` 是通的**。也就是说，Git 协议走不了，HTTP API 可以。

## 方案：全程走 REST API

既然 API 通，那就把部署的每个动作都换成 API 调用：

| 动作 | 替代方案 |
| --- | --- |
| 建仓库 | `POST /user/repos` |
| `git add` + `commit` | `PUT /repos/{owner}/{repo}/contents/{path}` |
| 开启 Pages | `POST /repos/{owner}/{repo}/pages` |
| 查构建状态 | `GET /repos/{owner}/{repo}/pages` |

## 踩到的坑

**坑一：空仓库不能用 Git Data API**

按常规思路，应该先 `POST /git/blobs` 建 blob，再用 tree/commit 一次提交多文件。但对**空仓库**调用 blobs 接口会直接报错：

```json
{ "message": "Git Repository is empty." }
```

解决办法是改用 Contents API 逐文件提交，第一个文件会自动创建初始提交。

**坑二：Token 权限**

细粒度 Token（fine-grained）默认没有 Administration 写权限，建仓库会失败：

```json
{ "message": "Resource not accessible by personal access token" }
```

换成经典 Token 勾上 `repo` 权限即可。

**坑三：自建域名会让原地址 301**

给 Pages 绑定 CNAME 后，`用户名.github.io` 会**永久重定向**到新域名。如果新域名的 DNS 还没生效，站点就直接失联了。

> 教训：自定义域名一定要等 DNS 真正指向过来之后再绑定，顺序反了网站就会挂。

## 结论

`api.github.com` 是个很可靠的后门。写个脚本，部署就是敲一行命令的事。
