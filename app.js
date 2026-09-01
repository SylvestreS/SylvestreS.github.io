/* ============================================================
   个人主页 · 纯 JS 渲染
   修改内容只需编辑下面的 SITE 配置，无需懂代码
   ============================================================ */

const SITE = {
  // ---- 基本信息 ----
  name: "SylvestreS",          // GitHub 用户名
  eyebrow: "你好，我是",           // 打字机前缀
  bio: "一个喜欢造东西的人。写代码、做设计、记录想法。这里是我的小角落，存放我做过的项目和正在思考的事。",
  location: "地球 · 东八区",

  // ---- 社交链接 ----
  links: [
    { label: "GitHub",  url: "https://github.com/SylvestreS", icon: "github" },
    { label: "Email",   url: "mailto:me@example.com", icon: "mail" },
    { label: "RSS",     url: "#blog", icon: "rss" },
  ],

  // ---- 统计数字（随便写）----
  facts: [
    { num: "N+", label: "项目" },
    { num: "∞",  label: "好奇心" },
    { num: "2026", label: "至今" },
  ],

  // ---- 项目（本地静态数据；若开启 liveRepos 会自动拉取 GitHub 仓库）----
  projects: [
    {
      name: "项目一",
      desc: "用一句话介绍这个项目解决了什么问题。",
      url: "https://github.com/SylvestreS",
      lang: "JavaScript",
      stars: 0,
    },
    {
      name: "项目二",
      desc: "用一句话介绍这个项目解决了什么问题。",
      url: "https://github.com/SylvestreS",
      lang: "TypeScript",
      stars: 0,
    },
    {
      name: "项目三",
      desc: "用一句话介绍这个项目解决了什么问题。",
      url: "https://github.com/SylvestreS",
      lang: "Python",
      stars: 0,
    },
  ],

  // ---- 从 GitHub 实时拉取最新仓库（需要网络；失败自动回退到静态数据）----
  liveRepos: true,   // 设为 false 则只显示上面手写的项目
  repoCount: 6,      // 拉取数量

  // ---- 动态 / 博客 ----
  posts: [
    {
      date: "2026-09-01",
      title: "主页上线了",
      url: "#",
      desc: "把个人主页部署到了 GitHub Pages。极简黑白，没有多余的东西。",
    },
    {
      date: "2026-08-15",
      title: "写在夏末",
      url: "#",
      desc: "一些最近的想法和读书笔记。（示例条目，可在 app.js 中修改）",
    },
    {
      date: "2026-07-30",
      title: "新项目开工",
      url: "#",
      desc: "开始折腾一个新玩具，详情过段时间再写。（示例条目，可在 app.js 中修改）",
    },
  ],

  // ---- 页脚 ----
  footerText: "© 2026 · 手写于编辑器，托管于 GitHub Pages",
};

/* ============ 图标（内联 SVG，黑白主题用 currentColor）============ */
const ICONS = {
  github: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4.24-8 5-8-5V6l8 5 8-5v2.24Z"/></svg>',
  rss: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6.18 17.82a2.18 2.18 0 1 1-4.36 0 2.18 2.18 0 0 1 4.36 0ZM2 10.2v3.1a8.7 8.7 0 0 1 8.7 8.7h3.1C13.8 15.4 8.6 10.2 2 10.2ZM2 3v3.1C12.5 6.1 21 14.6 21 25h3.1C24.1 13 13.9 2.9 2 3Z" transform="scale(0.85)"/></svg>',
};

const $ = (sel, el = document) => el.querySelector(sel);

/* ============ 渲染函数 ============ */

function renderHero() {
  const main = $("main");
  main.insertAdjacentHTML("beforeend", `
    <section class="hero" id="about">
      <p class="hero-eyebrow"><span id="typewriter"></span><span class="cursor">▌</span></p>
      <h1>${SITE.name}</h1>
      <p class="hero-bio">${SITE.bio}</p>
      <div class="hero-links">
        ${SITE.links.map((l) => `
          <a href="${l.url}" ${l.url.startsWith("http") ? 'target="_blank" rel="noopener"' : ""}>
            ${ICONS[l.icon] || ""}<span>${l.label}</span>
          </a>`).join("")}
      </div>
      <span class="scroll-hint">SCROLL ↓</span>
    </section>
  `);
}

function renderAbout() {
  const main = $("main");
  main.insertAdjacentHTML("beforeend", `
    <section class="reveal">
      <h2 class="section-title">关于 / About</h2>
      <div class="about-grid">
        <div class="about-card">
          <h3>${SITE.eyebrow}${SITE.name}</h3>
          <p>${SITE.bio}</p>
          <p style="margin-top:10px">${SITE.location}</p>
        </div>
        <div class="about-facts">
          ${SITE.facts.map((f) => `
            <div class="fact">
              <div class="num">${f.num}</div>
              <div class="label">${f.label}</div>
            </div>`).join("")}
        </div>
      </div>
    </section>
  `);
}

function projectCard(p) {
  return `
    <a class="project reveal" href="${p.url}" target="_blank" rel="noopener">
      <div class="p-name"><span>${p.name}</span><span class="arrow">↗</span></div>
      <p class="p-desc">${p.desc}</p>
      <div class="p-meta">
        ${p.lang ? `<span class="lang">${p.lang}</span>` : ""}
        ${p.stars != null ? `<span>★ ${p.stars}</span>` : ""}
      </div>
    </a>`;
}

function renderProjects(list = SITE.projects) {
  const main = $("main");
  main.insertAdjacentHTML("beforeend", `
    <section id="projects">
      <h2 class="section-title">项目 / Projects</h2>
      <div class="projects-grid" id="projects-grid">
        ${list.map(projectCard).join("")}
      </div>
    </section>
  `);
  observeReveals();
}

function renderBlog() {
  const main = $("main");
  main.insertAdjacentHTML("beforeend", `
    <section id="blog" class="reveal">
      <h2 class="section-title">动态 / Journal</h2>
      <div class="timeline">
        ${SITE.posts.map((p) => `
          <div class="timeline-item">
            <div class="t-date">${p.date}</div>
            <div class="t-title"><a href="${p.url}" ${p.url.startsWith("http") ? 'target="_blank" rel="noopener"' : ""}>${p.title}</a></div>
            <p class="t-desc">${p.desc}</p>
          </div>`).join("")}
      </div>
    </section>
  `);
}

function renderFooter() {
  $(".footer").innerHTML = `
    <span>${SITE.footerText}</span>
    <span><a href="#top">回到顶部 ↑</a></span>
  `;
}

/* ============ 交互 ============ */

function typewriter() {
  const el = $("#typewriter");
  const text = SITE.eyebrow;
  let i = 0;
  (function tick() {
    if (i <= text.length) {
      el.textContent = text.slice(0, i++);
      setTimeout(tick, 120);
    }
  })();
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
  $("#theme-icon").textContent = theme === "dark" ? "◑" : "◐";

  $("#theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    $("#theme-icon").textContent = next === "dark" ? "◑" : "◐";
  });
}

let revealObserver = null;
function observeReveals() {
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("visible"));
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          revealObserver.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
  }
  document.querySelectorAll(".reveal:not(.visible)").forEach((el) => revealObserver.observe(el));
}

/* ============ 可选：从 GitHub 拉取最新仓库 ============ */

async function loadLiveRepos() {
  if (!SITE.liveRepos) return;
  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(SITE.name)}/repos?sort=updated&per_page=${SITE.repoCount}`);
    if (!res.ok) return;
    const repos = (await res.json())
      .filter((r) => !r.fork)
      .slice(0, SITE.repoCount);
    if (!repos.length) return;
    const grid = $("#projects-grid");
    if (grid) {
      grid.innerHTML = repos.map((r) => projectCard({
        name: r.name,
        desc: r.description || "暂无描述",
        url: r.html_url,
        lang: r.language || "",
        stars: r.stargazers_count,
      })).join("");
      observeReveals();
    }
  } catch (_) {
    /* 网络不可用时保持静态数据 */
  }
}

/* ============ 启动 ============ */

document.addEventListener("DOMContentLoaded", () => {
  renderHero();
  renderAbout();
  renderProjects();
  renderBlog();
  renderFooter();
  initTheme();
  typewriter();
  observeReveals();
  loadLiveRepos();
});
