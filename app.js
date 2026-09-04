/* ============================================================
   SylvestreS · 区块链 / 代币化 / RWA 学习笔记
   没有框架，没有构建步骤。写 Markdown → 推到 GitHub → 自动上线
   ============================================================ */

const SITE = {
  name: "SylvestreS",
  tagline: "区块链 · 加密货币 · 代币化 · RWA —— 一条自下而上的学习路径",
  about: [
    "这是一个公开的学习笔记站。我从零开始啃区块链，一路记到资产代币化和 RWA，笔记按 L1–L4 分级挂在「路径」页上。",
    "写下来的目的很单纯：学过就忘，所以把理解落成文字。写得不对的地方，等学到后面再回来改。",
    "站点是纯手写的 HTML/CSS/JS，没有框架、没有构建步骤——文章是 Markdown 文件，浏览器打开时现场渲染。",
  ],
  location: "地球 · 东八区",
  links: [
    { label: "GitHub", url: "https://github.com/SylvestreS" },
    { label: "Email", url: "mailto:me@example.com" },
  ],
  // 从 GitHub 实时拉取仓库（设为 false 关闭）
  liveRepos: true,
  repoCount: 6,
  disclaimer: "本站是个人学习笔记，不是投资建议。写错的地方我自己负责。",
  footerText: "© 2026 SylvestreS · 学习笔记，不构成投资建议",
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

/**
 * L1–L4 分级徽章。首页列表 / 词典 / 路径页 / 术语悬停卡共用。
 * 之前这个函数漏写了，导致这四处渲染时抛 ReferenceError（页面白屏）。
 */
const lvBadge = (lv) =>
  lv ? `<span class="lv" data-lv="${lv}">${String(lv).toUpperCase()}</span>` : "";

const postCard = (p) => `
  <a class="post-item reveal" href="#/post/${p.slug}">
    <div class="post-meta">
      <time>${p.date}</time>
      <span class="dot">·</span>
      <span>${p.minutes} 分钟</span>
      ${lvBadge(p.level)}
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
  await annotateTerms();
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
        <p class="disc-box">${SITE.disclaimer}</p>
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

/* ============ 术语词典：数据、正文标注、悬停释义 ============ */

let GLOSSARY = [];
let TERM_KEYS = [];
let TERM_MAP = new Map();

async function loadGlossary() {
  if (GLOSSARY.length) return GLOSSARY;
  let payload = {};
  try {
    const res = await fetch("data/glossary.json");
    payload = await res.json();
    GLOSSARY = payload.terms || [];
  } catch {
    GLOSSARY = [];
  }
  // 像 "Node" 这种通用英文单词不参与正文自动标注，否则会误伤无关句子
  const exclude = new Set((payload.annotate_exclude || []).map((s) => s.toLowerCase()));
  TERM_MAP = new Map();
  GLOSSARY.forEach((t) => {
    [t.term, t.zh, ...(t.aliases || [])].forEach((k) => {
      if (k && !exclude.has(k.toLowerCase())) TERM_MAP.set(k.toLowerCase(), t);
    });
  });
  TERM_KEYS = [...TERM_MAP.keys()].sort((a, b) => b.length - a.length);
  return GLOSSARY;
}

const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cssId = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-");

function ensureTip() {
  let tip = document.getElementById("gtip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "gtip";
    tip.className = "gtip";
    document.body.appendChild(tip);
  }
  return tip;
}

/** 给正文里出现的术语加虚下划线（跳过代码与链接内部） */
async function annotateTerms() {
  const root = document.querySelector(".prose");
  if (!root) return;
  await loadGlossary();
  if (!TERM_KEYS.length) return;

  const re = new RegExp("(" + TERM_KEYS.map(reEscape).join("|") + ")", "gi");
  const skip = new Set(["CODE", "PRE", "A", "SCRIPT", "STYLE"]);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      let p = n.parentElement;
      while (p && p !== root) {
        if (skip.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        p = p.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach((node) => {
    const text = node.nodeValue;
    re.lastIndex = 0;
    if (!re.test(text)) return;
    re.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let last = 0;
    let m;
    while ((m = re.exec(text))) {
      const entry = TERM_MAP.get(m[0].toLowerCase());
      if (!entry) continue;
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const span = document.createElement("span");
      span.className = "term";
      span.textContent = m[0];
      span.dataset.term = entry.term;
      frag.appendChild(span);
      last = m.index + m[0].length;
    }
    if (!last) return;
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  });
}

let tipBound = false;
function initGlossaryTip() {
  if (tipBound) return; // 幂等：重复绑定会让一次点击被处理两遍，效果互相抵消
  tipBound = true;
  const tip = ensureTip();
  let hideTimer = null;

  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest && e.target.closest(".term");
    if (!el) return;
    const entry = GLOSSARY.find((t) => t.term === el.dataset.term);
    if (!entry) return;
    clearTimeout(hideTimer);
    tip.innerHTML =
      `<div class="gtip-head"><b>${entry.zh}</b>` +
      `<span>${entry.term}</span>${lvBadge(entry.level)}</div>` +
      `<p>${entry.brief}</p>`;
    tip.classList.add("show");
    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const maxLeft = document.documentElement.clientWidth - tw - 16;
    tip.style.left = Math.max(12, Math.min(r.left + scrollX, maxLeft)) + "px";
    tip.style.top = r.bottom + scrollY + 8 + "px";
  });

  document.addEventListener("mouseout", (e) => {
    if (e.target.closest && e.target.closest(".term")) {
      hideTimer = setTimeout(() => tip.classList.remove("show"), 200);
    }
  });
  tip.addEventListener("mouseover", () => clearTimeout(hideTimer));
  tip.addEventListener("mouseout", () => tip.classList.remove("show"));

  // 点击术语跳到词典对应条目
  document.addEventListener("click", (e) => {
    const el = e.target.closest && e.target.closest(".term");
    if (el) location.hash = `#/glossary/${encodeURIComponent(el.dataset.term)}`;
  });
}

async function viewGlossary(focus) {
  const terms = await loadGlossary();
  const levels = ["L1", "L2", "L3", "L4"];
  let lv = "";

  view().innerHTML = `
    <section class="hero-sm">
      <h1>术语词典</h1>
      <p class="tagline">${terms.length} 个词条 · 笔记正文里的术语带虚下划线，悬停即可查看，点击跳到完整条目</p>
      <div class="search-row">
        <input id="gsearch" type="search" placeholder="搜索术语或别名…" autocomplete="off" />
        <div class="tagbar" id="glevels">
          <button type="button" class="tag on" data-lv="">全部</button>
          ${levels.map((l) =>
            `<button type="button" class="tag" data-lv="${l}">${l}</button>`).join("")}
        </div>
      </div>
    </section>

    <section>
      <h2 class="section-title">词条 · <span id="gcount">0</span></h2>
      <div class="gloss-list" id="gloss-list"></div>
      <p class="empty" id="gempty" style="display:none">没有匹配的术语。</p>
    </section>`;

  const render = () => {
    const q = $("#gsearch").value.trim().toLowerCase();
    const list = terms.filter((t) => {
      if (lv && t.level !== lv) return false;
      if (!q) return true;
      return [t.term, t.zh, ...(t.aliases || []), t.brief, t.detail]
        .join(" ").toLowerCase().includes(q);
    });
    $("#gloss-list").innerHTML = list.map((t) => `
      <div class="gloss-item" id="g-${cssId(t.term)}">
        <div class="gloss-head">${lvBadge(t.level)}
          <h3>${t.zh}<span class="gloss-en">${t.term}</span></h3>
        </div>
        <p class="gloss-brief">${t.brief}</p>
        <p class="gloss-detail">${t.detail}</p>
        ${(t.aliases || []).length
          ? `<div class="gloss-alias">也称作 ${t.aliases.join(" · ")}</div>` : ""}
      </div>`).join("");
    $("#gcount").textContent = list.length;
    $("#gempty").style.display = list.length ? "none" : "block";
  };

  $("#gsearch").addEventListener("input", render);
  $("#glevels").addEventListener("click", (e) => {
    const btn = e.target.closest("button.tag");
    if (!btn) return;
    lv = btn.dataset.lv;
    $("#glevels").querySelectorAll(".tag").forEach((b) => b.classList.toggle("on", b === btn));
    render();
  });
  render();

  if (focus) {
    const el = document.getElementById("g-" + cssId(focus));
    if (el) { el.classList.add("focus"); scrollTo({ top: el.offsetTop - 100 }); }
  }
}

/* ============ 学习路径 ============ */

const RM_KEY = "roadmap-progress-v1";
let RM = null;

function rmSave() {
  try { localStorage.setItem(RM_KEY, JSON.stringify(RM.prog)); } catch {}
}

function rmRefresh() {
  const n = RM.items.filter((it) => RM.prog[it.id]).length;
  const done = $("#rm-done");
  const fill = $("#rm-fill");
  if (done) done.textContent = n;
  if (fill) fill.style.width = (n / RM.items.length * 100).toFixed(1) + "%";
  document.querySelectorAll(".rm-block").forEach((block) => {
    const list = RM.items.filter((it) => it.level === block.dataset.lv);
    const sub = block.querySelector(".rm-sub");
    if (sub) sub.textContent = `${list.filter((it) => RM.prog[it.id]).length}/${list.length}`;
  });
}

async function viewRoadmap() {
  let data;
  try {
    const res = await fetch("data/roadmap.json");
    data = await res.json();
  } catch {
    view().innerHTML = `
      <section class="hero-sm">
        <h1>404</h1>
        <p class="tagline">学习路径数据加载失败。</p>
      </section>`;
    return;
  }

  const items = data.items || [];
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(RM_KEY)); } catch {}
  // 首次访问：已有笔记的知识点自动勾选，之后完全交给用户自己维护
  if (!saved || typeof saved !== "object") {
    saved = {};
    items.forEach((it) => { if (it.post) saved[it.id] = true; });
  }
  RM = { items, levels: data.levels || [], prog: saved };
  rmSave();

  view().innerHTML = `
    <section class="hero-sm">
      <h1>学习路径</h1>
      <p class="tagline">${data.note}</p>
      <div class="rm-bar"><div class="rm-fill" id="rm-fill"></div></div>
      <p class="rm-count"><b id="rm-done">0</b> / ${items.length} 个知识点
        · 勾选状态只存在你自己的浏览器里</p>
    </section>

    ${RM.levels.map((L) => {
      const list = items.filter((it) => it.level === L.id);
      const n = list.filter((it) => RM.prog[it.id]).length;
      return `
        <section class="rm-block" data-lv="${L.id}">
          <h2 class="section-title">${lvBadge(L.id)} ${L.zh} · ${L.title}
            <span class="rm-sub">${n}/${list.length}</span></h2>
          <p class="rm-desc">${L.desc}</p>
          <ul class="rm-list">
            ${list.map((it) => `
              <li class="rm-item ${RM.prog[it.id] ? "done" : ""}">
                <button class="rm-check" type="button" data-id="${it.id}"
                        aria-pressed="${RM.prog[it.id] ? "true" : "false"}"
                        aria-label="标记完成">${RM.prog[it.id] ? "✓" : ""}</button>
                <span class="rm-title">${it.title}</span>
                ${it.post
                  ? `<a class="rm-link" href="#/post/${it.post}">笔记 →</a>`
                  : `<span class="rm-todo">待写</span>`}
              </li>`).join("")}
          </ul>
        </section>`;
    }).join("")}`;

  rmRefresh();
}

let rmBound = false;
function initRoadmapClicks() {
  if (rmBound) return; // 幂等：重复绑定会让一次点击切换两次，看起来像没反应
  rmBound = true;
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".rm-check");
    if (!btn || !RM) return;
    const id = btn.dataset.id;
    const on = !RM.prog[id];
    RM.prog[id] = on;
    btn.textContent = on ? "✓" : "";
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.closest(".rm-item").classList.toggle("done", on);
    rmSave();
    rmRefresh();
  });
}

/* ============ 路由 ============ */

async function router() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [seg, arg] = hash.split("/");

  if (!seg) return viewHome();
  if (seg === "post" && arg) return viewPost(decodeURIComponent(arg));
  if (seg === "roadmap") return viewRoadmap();
  if (seg === "glossary") return viewGlossary(arg ? decodeURIComponent(arg) : "");
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
  // 这两个是全局事件委托，整个生命周期只需绑定一次
  // （漏掉就会导致：路径页勾选无反应、正文术语悬停无释义）
  initRoadmapClicks();
  initGlossaryTip();
  $("#footer").innerHTML = `
    <span>${SITE.footerText}</span>
    <span><a href="#/">↑ 回到顶部</a></span>`;
  navigate();
});
