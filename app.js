/* ============================================================
   SylvestreS · 纯 JS 博客
   没有框架，没有构建步骤。写 Markdown → 推到 GitHub → 自动上线
   ============================================================ */

const SITE = {
  name: "SylvestreS",
  tagline: "写代码，做设计，记录想法。",
  about: [
    "你好，我是 SylvestreS。这里放我写的东西——关于代码、设计，以及一些还没想清楚的想法。",
    "这个站点没有框架，也没有构建步骤：文章是 Markdown 文件，浏览器打开时现场解析渲染。",
  ],
  location: "地球 · 东八区",
  links: [
    { label: "GitHub", url: "https://github.com/SylvestreS" },
    { label: "Email", url: "mailto:me@example.com" },
  ],
  // 从 GitHub 实时拉取仓库（设为 false 关闭）
  liveRepos: true,
  repoCount: 6,
  footerText: "© 2026 · 手写于编辑器，托管于 GitHub Pages",
};

const $ = (sel, el = document) => el.querySelector(sel);
const view = () => $("#view");

/* ============ Markdown 解析器 ============ */

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inline = (text) =>
  text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');

/** 渲染 Markdown，返回 { html, toc } —— toc 为各级标题目录 */
function renderMarkdown(src) {
  const fences = [];
  // 1. 先抽出围栏代码块，避免块内内容被其他规则误伤
  let text = src.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    fences.push({ lang: lang || "", code: code.replace(/\n$/, "") });
    return `\u0000FENCE${fences.length - 1}\u0000`;
  });

  text = escapeHtml(text);

  const lines = text.split("\n");
  const out = [];
  const toc = [];
  let i = 0;
  let guard = -1;

  // 注意：文本已做 HTML 转义，引用符 ">" 此时是 "&gt;"
  const isQuote = (l) => /^(&gt;|>)\s?/.test(l);
  const stripQuote = (l) => l.replace(/^(&gt;|>)\s?/, "");

  const isBlockStart = (l) =>
    /^(#{1,6})\s/.test(l) || /^(-{3,}|\*{3,})$/.test(l.trim()) ||
    isQuote(l) || /^([-*]\s|\d+\.\s)/.test(l) || l.includes("\u0000FENCE");

  while (i < lines.length) {
    // 兜底：若某分支未能推进游标，强制前进，避免异常内容导致死循环
    if (i === guard) { i++; continue; }
    guard = i;

    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // 代码块占位符
    const fence = line.match(/^\u0000FENCE(\d+)\u0000$/);
    if (fence) {
      const f = fences[+fence[1]];
      out.push(
        `<pre class="code"${f.lang ? ` data-lang="${f.lang}"` : ""}>` +
        `<button class="copy" type="button">复制</button>` +
        `<code>${f.code}</code></pre>`
      );
      i++; continue;
    }

    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const id = "h-" + toc.length;
      toc.push({ level, text: h[2].replace(/[*_`]/g, ""), id });
      out.push(`<h${level} id="${id}">${inline(h[2])}</h${level}>`);
      i++; continue;
    }

    // 分割线
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { out.push("<hr />"); i++; continue; }

    // 引用块
    if (isQuote(line)) {
      const buf = [];
      while (i < lines.length && isQuote(lines[i])) {
        buf.push(stripQuote(lines[i]));
        i++;
      }
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }

    // 表格
    if (line.includes("|") && i + 1 < lines.length &&
        /^[\s|:-]+$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      const split = (l) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = split(line);
      const align = split(lines[i + 1]).map((c) =>
        /^:-+:$/.test(c) ? "center" : /-+:$/.test(c) ? "right" : "left");
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(split(lines[i]));
        i++;
      }
      const th = head.map((c, n) =>
        `<th style="text-align:${align[n] || "left"}">${inline(c)}</th>`).join("");
      const tb = rows.map((r) =>
        `<tr>${r.map((c, n) =>
          `<td style="text-align:${align[n] || "left"}">${inline(c)}</td>`).join("")}</tr>`
      ).join("");
      out.push(`<table><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table>`);
      continue;
    }

    // 列表
    if (/^([-*]\s|\d+\.\s)/.test(line)) {
      const ordered = /^\d+\.\s/.test(line);
      const items = [];
      while (i < lines.length && /^([-*]\s|\d+\.\s)/.test(lines[i])) {
        items.push(lines[i].replace(/^([-*]\s|\d+\.\s)/, ""));
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</${tag}>`);
      continue;
    }

    // 段落
    const buf = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    if (buf.length) out.push(`<p>${inline(buf.join(" "))}</p>`);
  }

  return { html: out.join("\n"), toc };
}

/** 剥离 front matter，返回 { meta, body } */
function splitFrontMatter(raw) {
  if (!raw.startsWith("---")) return { meta: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, body: raw };
  const meta = {};
  for (const line of raw.slice(3, end).trim().split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const val = line.slice(idx + 1).trim();
    meta[line.slice(0, idx).trim()] = val.startsWith("[")
      ? val.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean)
      : val;
  }
  return { meta, body: raw.slice(end + 4).replace(/^\n/, "") };
}

/* ============ 数据 ============ */

let POSTS = [];

async function loadIndex() {
  if (POSTS.length) return POSTS;
  const res = await fetch("posts/index.json");
  const data = await res.json();
  POSTS = data.posts || [];
  return POSTS;
}

/* ============ 视图：文章列表 ============ */

function tagBar(active) {
  const tags = [...new Set(POSTS.flatMap((p) => p.tags))];
  return `<div class="tagbar">
    <a class="tag ${active ? "" : "on"}" href="#/">全部</a>
    ${tags.map((t) =>
      `<a class="tag ${active === t ? "on" : ""}" href="#/tag/${encodeURIComponent(t)}">${t}</a>`
    ).join("")}
  </div>`;
}

const postCard = (p) => `
  <a class="post-item reveal" href="#/post/${p.slug}">
    <div class="post-meta">
      <time>${p.date}</time>
      <span class="dot">·</span>
      <span>${p.minutes} 分钟</span>
      ${p.tags.map((t) => `<span class="chip">${t}</span>`).join("")}
    </div>
    <h2 class="post-title">${p.title}</h2>
    <p class="post-summary">${p.summary}</p>
    <span class="post-more">阅读 →</span>
  </a>`;

async function viewHome(tag) {
  const posts = await loadIndex();
  const list = tag ? posts.filter((p) => p.tags.includes(tag)) : posts;

  view().innerHTML = `
    <section class="hero-sm">
      <h1>${SITE.name}</h1>
      <p class="tagline">${SITE.tagline}</p>
      <div class="search-row">
        <input id="search" type="search" placeholder="搜索文章…" autocomplete="off" />
        ${tagBar(tag)}
      </div>
    </section>

    <section>
      <h2 class="section-title">${tag ? `标签：${tag}` : "全部文章"} · ${list.length} 篇</h2>
      <div class="post-list" id="post-list">${list.map(postCard).join("")}</div>
      <p class="empty" id="empty" style="display:none">没有匹配的文章。</p>
    </section>`;

  const input = $("#search");
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    const hit = list.filter((p) =>
      (p.title + p.summary + p.tags.join("")).toLowerCase().includes(q));
    $("#post-list").innerHTML = hit.map(postCard).join("");
    $("#empty").style.display = hit.length ? "none" : "block";
  });

  observeReveals();
}

/* ============ 视图：单篇文章 ============ */

async function viewPost(slug) {
  const posts = await loadIndex();
  const idx = posts.findIndex((p) => p.slug === slug);
  if (idx === -1) return notFound();

  const meta = posts[idx];
  let body = "";
  try {
    const res = await fetch(`posts/${slug}.md`);
    if (!res.ok) throw new Error();
    body = splitFrontMatter(await res.text()).body;
  } catch {
    body = "_文章加载失败，请稍后重试。_";
  }

  const { html, toc } = renderMarkdown(body);
  const prev = posts[idx + 1];
  const next = posts[idx - 1];

  view().innerHTML = `
    <article class="post">
      <a class="back" href="#/">← 返回列表</a>
      <header class="post-head">
        <div class="post-meta">
          <time>${meta.date}</time>
          <span class="dot">·</span>
          <span>${meta.minutes} 分钟</span>
          ${meta.tags.map((t) =>
            `<a class="chip" href="#/tag/${encodeURIComponent(t)}">${t}</a>`).join("")}
        </div>
        <h1>${meta.title}</h1>
      </header>

      ${toc.filter((t) => t.level <= 3).length > 2 ? `
        <aside class="toc">
          <div class="toc-title">目录</div>
          <ol>${toc.filter((t) => t.level <= 3).map((t) =>
            `<li class="lv${t.level}"><a href="#${t.id}">${t.text}</a></li>`).join("")}</ol>
        </aside>` : ""}

      <div class="prose">${html}</div>

      <nav class="post-nav">
        ${prev ? `<a href="#/post/${prev.slug}"><span>上一篇</span>${prev.title}</a>` : "<span></span>"}
        ${next ? `<a class="r" href="#/post/${next.slug}"><span>下一篇</span>${next.title}</a>` : "<span></span>"}
      </nav>
    </article>`;

  document.querySelectorAll("pre.code").forEach(setupCodeBlock);
  document.title = `${meta.title} · ${SITE.name}`;
  observeReveals();
}

/* ============ 视图：归档 / 关于 ============ */

async function viewArchive() {
  const posts = await loadIndex();
  const years = {};
  posts.forEach((p) => {
    const y = (p.date || "").slice(0, 4);
    (years[y] = years[y] || []).push(p);
  });

  view().innerHTML = `
    <section>
      <h2 class="section-title">归档 · ${posts.length} 篇</h2>
      ${Object.keys(years).sort((a, b) => b - a).map((y) => `
        <div class="arch-year">
          <div class="arch-label">${y}</div>
          <div class="arch-list">
            ${years[y].map((p) => `
              <a class="arch-item" href="#/post/${p.slug}">
                <time>${p.date.slice(5)}</time>
                <span>${p.title}</span>
              </a>`).join("")}
          </div>
        </div>`).join("")}
    </section>`;
}

async function viewAbout() {
  view().innerHTML = `
    <section>
      <h2 class="section-title">关于 / About</h2>
      <div class="about-card">
        <h3>${SITE.name}</h3>
        ${SITE.about.map((p) => `<p>${p}</p>`).join("")}
        <p class="muted">${SITE.location}</p>
        <div class="hero-links">
          ${SITE.links.map((l) =>
            `<a href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`).join("")}
          <a href="feed.xml">RSS</a>
        </div>
      </div>
      <h2 class="section-title" style="margin-top:56px">项目 / Projects</h2>
      <div class="projects-grid" id="projects-grid"><div class="loading">载入中…</div></div>
    </section>`;
  loadLiveRepos();
}

/* ============ 路由 ============ */

async function router() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [seg, arg] = hash.split("/");

  if (!seg) return viewHome();
  if (seg === "post" && arg) return viewPost(decodeURIComponent(arg));
  if (seg === "archive") return viewArchive();
  if (seg === "about") return viewAbout();
  if (seg === "tag" && arg) return viewHome(decodeURIComponent(arg));
  return notFound();
}

function notFound() {
  view().innerHTML = `
    <section class="hero-sm">
      <h1>404</h1>
      <p class="tagline">没有找到这个页面。</p>
      <a class="back" href="#/">← 回到首页</a>
    </section>`;
}

/* ============ 交互 ============ */

function initTheme() {
  const saved = localStorage.getItem("theme");
  const dark = saved
    ? saved === "dark"
    : window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  $("#theme-icon").textContent = dark ? "◑" : "◐";

  $("#theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    $("#theme-icon").textContent = next === "dark" ? "◑" : "◐";
  });
}

function initProgress() {
  const bar = $("#progress");
  const update = () => {
    const h = document.documentElement;
    const pct = h.scrollTop / (h.scrollHeight - h.clientHeight || 1);
    bar.style.width = (pct * 100).toFixed(2) + "%";
  };
  addEventListener("scroll", update, { passive: true });
  update();
}

function setupCodeBlock(pre) {
  pre.querySelector(".copy").addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText(pre.querySelector("code").innerText);
      e.target.textContent = "已复制";
      setTimeout(() => (e.target.textContent = "复制"), 1600);
    } catch {
      e.target.textContent = "复制失败";
    }
  });
}

let observer = null;
function observeReveals() {
  if (!("IntersectionObserver" in window)) return;
  observer = observer || new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("visible"); observer.unobserve(e.target); }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
}

async function loadLiveRepos() {
  if (!SITE.liveRepos) return;
  const grid = $("#projects-grid");
  if (!grid) return;
  try {
    const res = await fetch(
      `https://api.github.com/users/${SITE.name}/repos?sort=updated&per_page=${SITE.repoCount}`);
    if (!res.ok) throw new Error();
    const repos = (await res.json()).filter((r) => !r.fork).slice(0, SITE.repoCount);
    grid.innerHTML = repos.length
      ? repos.map((r) => `
          <a class="project" href="${r.html_url}" target="_blank" rel="noopener">
            <div class="p-name"><span>${r.name}</span><span class="arrow">↗</span></div>
            <p class="p-desc">${r.description || "暂无描述"}</p>
            <div class="p-meta">
              ${r.language ? `<span class="lang">${r.language}</span>` : ""}
              <span>★ ${r.stargazers_count}</span>
            </div>
          </a>`).join("")
      : `<p class="muted">还没有公开仓库。</p>`;
  } catch {
    grid.innerHTML = `<p class="muted">仓库加载失败，稍后刷新试试。</p>`;
  }
}

/* ============ 启动 ============ */

async function navigate() {
  document.title = SITE.name;
  await router();
  scrollTo({ top: 0 });
  const bar = $("#progress");
  if (bar) bar.style.width = "0%";
}

addEventListener("hashchange", navigate);

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initProgress();
  $("#footer").innerHTML = `
    <span>${SITE.footerText}</span>
    <span><a href="#/">↑ 回到顶部</a></span>`;
  navigate();
});
