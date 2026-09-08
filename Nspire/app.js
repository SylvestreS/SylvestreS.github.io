/* ============================================================
   TI-Nspire CX II CAS · 网页版 — 主程序
   架构：状态机 + 应用路由 + algebrite CAS 封装
   ============================================================ */

(function () {
  "use strict";

  // ----- 全局状态 -----
  const S = {
    currentApp: "home",   // home / calculator / graphs / ...
    history: [],          // 旧表达式（用于箭头键回溯）
    cursor: 0,            // history 指针（-1 = 当前正在编辑）
    entry: "",            // 当前正在编辑的表达式
    ans: null,            // 上一个结果（字符串）
    mode: "exact",        // exact / approx
    shift: false,
    ctrl: false,
    caps: false,          // caps lock
  };

  // ----- 8 个应用（真机 Nspire CX II CAS）-----
  const APPS = [
    { id: "calculator", name: "Calculator", icon: "🧮", implemented: true },
    { id: "graphs",     name: "Graphs",     icon: "📈", implemented: false },
    { id: "geometry",   name: "Geometry",   icon: "📐", implemented: false },
    { id: "lists",      name: "Lists & Spreadsheet", icon: "📋", implemented: false },
    { id: "notes",      name: "Notes",      icon: "📝", implemented: false },
    { id: "data",       name: "Data & Statistics",   icon: "📊", implemented: false },
    { id: "python",     name: "Python",     icon: "🐍", implemented: false },
    { id: "vernier",    name: "Vernier DataQuest",   icon: "🔬", implemented: false },
  ];

  const lcd = document.getElementById("lcd");

  // ============================================================
  //  Algebrite CAS 封装
  //  把用户输入（Nspire 风格）转成 algebrite 表达式并求值
  // ============================================================
  const CAS = {
    /**
     * 把 Nspire 风格输入做符号归一化，再交给 algebrite.run 求值。
     * - π → pi
     * - θ → theta
     * - √( → sqrt(
     * - ∫ → integral
     * - d⁄dx → derivative
     * - ^ → ^
     * - ** → ^
     */
    normalize(input) {
      return String(input)
        .replace(/π/g, "pi")
        .replace(/θ/g, "theta")
        .replace(/√\(/g, "sqrt(")
        .replace(/∫/g, "integral")
        .replace(/∑/g, "sum")
        .replace(/d⁄dx/g, "derivative")
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/−/g, "-")
        .replace(/\^/g, "^")
        .replace(/\*\*/g, "^");
    },

    eval(input) {
      const expr = this.normalize(input);
      try {
        const out = Algebrite.run(expr);
        if (out === undefined || out === null) return { ok: false, err: "空结果" };
        return { ok: true, value: this.clean(out) };
      } catch (e) {
        return { ok: false, err: String(e && e.message ? e.message : e).slice(0, 80) };
      }
    },

    /** 清理 algebrite 输出（去掉无意义的 1*x 之类） */
    clean(s) {
      return String(s).trim()
        .replace(/\s+/g, " ")
        .replace(/\b1\s+\*?\s+/g, "")
        .replace(/\*\s*1\b/g, "");
    },

    /** 用 CAS 把数字结果强制近似为十进制 */
    approx(s) {
      try {
        const n = parseFloat(Algebrite.run("float(" + this.normalize(s) + ")"));
        if (Number.isFinite(n)) return String(n);
      } catch (_) {}
      return s;
    },

    /** 把 ans 等特殊标记展开 */
    substitute(input) {
      return input.replace(/\bans\b/gi, "(" + (S.ans || "0") + ")");
    },
  };

  // ============================================================
  //  LCD 渲染
  // ============================================================
  function render() {
    if (S.currentApp === "home") return renderHome();
    if (S.currentApp === "calculator") return renderCalculator();
    return renderStub(S.currentApp);
  }

  function renderHome() {
    const cards = APPS.map((a) => `
      <div class="app-card ${a.implemented ? "" : "coming-soon"}"
           data-app="${a.id}">
        <div class="app-icon">${a.icon}</div>
        <div class="app-name">${a.name}</div>
      </div>
    `).join("");
    lcd.innerHTML = `<div class="home-view">${cards}</div>`;
    // 绑定点击
    lcd.querySelectorAll(".app-card").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.getAttribute("data-app");
        const app = APPS.find((a) => a.id === id);
        if (!app.implemented) {
          flash("应用未实现，敬请期待。");
          return;
        }
        openApp(id);
      });
    });
  }

  function renderCalculator() {
    const modeBadge = S.mode === "exact"
      ? `<span class="badge mode-exact">EXACT</span>`
      : `<span class="badge mode-approx">APPROX</span>`;

    const rows = S.history.map((h) => `
      <div class="row input">${escapeHtml(h.input)}</div>
      <div class="row output">${escapeHtml(h.output)}</div>
    `).join("");

    const cursorChar = S.entry.length === 0 ? "<span class=\"cursor\">&nbsp;</span>" : "";
    lcd.innerHTML = `
      <div class="calc-view">
        <div class="lcd-status">
          <span>${modeBadge} <span style="color:#4a4a3a">Document1 · Page 1.1</span></span>
          <span>${S.ans !== null ? "Ans = " + escapeHtml(S.ans) : ""}</span>
        </div>
        <div class="calc-history" id="calc-history">
          ${rows}
        </div>
        <div class="calc-entry" id="calc-entry">${escapeHtml(S.entry) || cursorChar}</div>
      </div>
    `;
    // 自动滚到底
    const ch = document.getElementById("calc-history");
    if (ch) ch.scrollTop = ch.scrollHeight;
  }

  function renderStub(appId) {
    const app = APPS.find((a) => a.id === appId) || { name: appId };
    lcd.innerHTML = `
      <div class="app-view">
        <div class="app-header">
          <span class="title">${app.name}</span>
          <span class="back" id="back-home">home</span>
        </div>
        <div class="stub">Coming in next release · 下一版上线</div>
      </div>
    `;
    document.getElementById("back-home").addEventListener("click", () => openApp("home"));
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
    })[c]);
  }

  // ============================================================
  //  应用切换
  // ============================================================
  function openApp(id) {
    S.currentApp = id;
    // 进入计算器时清空 entry 与历史
    if (id === "calculator") {
      S.entry = "";
      S.cursor = -1;
      // 历史保留（如果之前有过）
    }
    render();
  }

  // ============================================================
  //  Calculator 行为
  // ============================================================
  function calcAppend(text) {
    if (S.cursor >= 0) {
      // 在历史回溯时编辑 → 切回当前编辑
      const h = S.history[S.history.length - 1 - S.cursor];
      S.entry = h ? h.input : "";
      S.cursor = -1;
    }
    S.entry += text;
    render();
  }

  function calcBackspace() {
    if (S.entry.length > 0) {
      S.entry = S.entry.slice(0, -1);
      render();
    }
  }

  function calcClearEntry() {
    S.entry = "";
    render();
  }

  function calcEnter() {
    const input = S.entry.trim();
    if (!input) return;

    // 处理赋值：name := value 或 name = value（以 : 开头）
    let expr = CAS.substitute(input);

    // 赋值语法：a:=5
    const assign = expr.match(/^([a-zA-Z_]\w*)\s*:=\s*(.+)$/);
    if (assign) {
      const [, name, value] = assign;
      const r = CAS.eval(value);
      if (!r.ok) {
        flash("赋值失败：" + r.err);
        return;
      }
      try {
        Algebrite.run(name + "=" + r.value);
        S.ans = r.value;
        S.history.push({ input: input, output: r.value });
      } catch (e) {
        flash("变量定义失败");
        return;
      }
    } else {
      const r = CAS.eval(expr);
      if (!r.ok) {
        S.history.push({ input: input, output: "Error: " + r.err, err: true });
      } else {
        const shown = S.mode === "approx" ? CAS.approx(r.value) : r.value;
        S.ans = r.value;
        S.history.push({ input: input, output: shown });
      }
    }
    S.entry = "";
    S.cursor = -1;
    render();
  }

  function calcNegate() {
    // 在 entry 末尾追加 -（用于把数字 / 表达式取反）
    if (S.entry === "" || /[+\-*/^(]$/.test(S.entry)) {
      calcAppend("(-");
    } else {
      calcAppend("-");
    }
  }

  function calcRecall() {
    if (S.ans !== null) calcAppend("Ans");
  }

  function calcToggleMode() {
    S.mode = S.mode === "exact" ? "approx" : "exact";
    flash("Mode: " + S.mode.toUpperCase());
    render();
  }

  function calcHistoryUp() {
    if (S.history.length === 0) return;
    if (S.cursor < S.history.length - 1) {
      S.cursor++;
      const h = S.history[S.history.length - 1 - S.cursor];
      if (h) {
        S.entry = h.input;
        render();
      }
    }
  }

  function calcHistoryDown() {
    if (S.cursor > -1) {
      S.cursor--;
      if (S.cursor === -1) {
        S.entry = "";
      } else {
        const h = S.history[S.history.length - 1 - S.cursor];
        if (h) S.entry = h.input;
      }
      render();
    }
  }

  // 闪烁提示（用于 mode 切换等）
  function flash(msg) {
    const old = lcd.innerHTML;
    const oldApp = S.currentApp;
    lcd.innerHTML = `<div style="padding:20px;text-align:center;color:#1a1a1f;font-size:14px;">${escapeHtml(msg)}</div>`;
    setTimeout(() => {
      if (S.currentApp === oldApp) render();
      else lcd.innerHTML = old;
    }, 700);
  }

  // ============================================================
  //  按键 → 行为 映射
  // ============================================================
  function handleKey(el) {
    const char = el.getAttribute("data-char");
    const action = el.getAttribute("data-action");
    const mod = el.getAttribute("data-key");

    // 修饰键
    if (mod === "home")  return openApp("home");
    if (mod === "esc")   return openApp("home");
    if (mod === "shift") return toggleShift();
    if (mod === "ctrl")  return toggleCtrl();
    if (mod === "caps")  return toggleCaps();
    if (mod === "del")   return calcBackspace();
    if (mod === "tab")   return calcAppend("\t");
    if (mod === "menu" || mod === "doc" || mod === "var") return flash(`${mod.toUpperCase()} 菜单（占位）`);

    // 仅在 calculator 应用响应
    if (S.currentApp !== "calculator") {
      if (S.currentApp === "home" && char) {
        // 在 home 时按字母直接打开 calculator
        openApp("calculator");
      }
    }

    if (S.currentApp === "calculator") {
      if (action === "enter") return calcEnter();
      if (action === "backspace") return calcBackspace();
      if (action === "clear-entry") return calcClearEntry();
      if (action === "negate") return calcNegate();
      if (action === "ans") return calcRecall();
      if (action === "approx") return calcToggleMode();
      if (action === "space") return calcAppend(" ");
      if (action === "d_dx")  return calcAppend("d⁄dx(");
      if (action === "integral") return calcAppend("∫(");
      if (action === "sqrt")     return calcAppend("√(");
      if (action === "power")    return calcAppend("^");
      if (action === "power2")   return calcAppend("^2");
      if (action === "power-1")  return calcAppend("^(-1)");
      if (action === "frac")     return calcAppend("/");
      if (action === "frac2")    return calcAppend("/");
      if (action === "assign")   return calcAppend(":=");
      if (action === "le")       return calcAppend("<=");
      if (action === "ge")       return calcAppend(">=");
      if (action === "log")      return calcAppend("log(");
      if (action === "ln")       return calcAppend("ln(");
      if (action === "sin")      return calcAppend("sin(");
      if (action === "cos")      return calcAppend("cos(");
      if (action === "tan")      return calcAppend("tan(");
      if (action === "factor")   return calcAppend("factor(");
      if (action === "simplify") return calcAppend("simplify(");
      if (char !== null) {
        let ch = char;
        if (S.shift && /^[a-z]$/.test(ch)) ch = ch.toUpperCase();
        calcAppend(ch);
      }
    }

    // shift/ctrl 用一次即清
    if (S.shift && mod !== "shift" && mod !== "caps") S.shift = false;
    if (S.ctrl && mod !== "ctrl") S.ctrl = false;
    updateModBody();
  }

  function toggleShift() {
    S.shift = !S.shift;
    updateModBody();
  }
  function toggleCtrl() {
    S.ctrl = !S.ctrl;
    updateModBody();
  }
  function toggleCaps() {
    S.caps = !S.caps;
    updateModBody();
  }
  function updateModBody() {
    document.body.classList.toggle("shift-on", S.shift);
    document.body.classList.toggle("ctrl-on", S.ctrl);
  }

  // ============================================================
  //  触摸板（4 向 + 中心）
  // ============================================================
  function setupTouchpad() {
    const tp = document.getElementById("touchpad");
    if (!tp) return;
    tp.addEventListener("click", (e) => {
      const t = e.target;
      if (t.classList.contains("tp-up"))    return calcHistoryUp();
      if (t.classList.contains("tp-down"))  return calcHistoryDown();
      if (t.classList.contains("tp-left"))  return flash("LEFT（占位）");
      if (t.classList.contains("tp-right")) return flash("RIGHT（占位）");
      if (t.classList.contains("tp-center") || t === tp) return calcEnter();
    });
  }

  // ============================================================
  //  物理键盘支持（同时绑定，方便桌面端使用）
  // ============================================================
  function setupPhysicalKeyboard() {
    document.addEventListener("keydown", (e) => {
      // 不拦截输入框（虽然本页面没有 input，但以防万一）
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      // 直接打开 calculator
      if (e.key === "Escape")  return openApp("home");
      if (e.key === "Home")    return openApp("home");
      if (e.key === "Enter")   return calcEnter();
      if (e.key === "Backspace") return calcBackspace();
      if (e.key === "ArrowUp")    return calcHistoryUp();
      if (e.key === "ArrowDown")  return calcHistoryDown();
      if (e.key === "Shift") return S.shift = true, updateModBody();
      if (e.key === "Control") return S.ctrl = true, updateModBody();
      if (e.key.length === 1) calcAppend(e.key);
    });
    document.addEventListener("keyup", (e) => {
      if (e.key === "Shift") return S.shift = false, updateModBody();
      if (e.key === "Control") return S.ctrl = false, updateModBody();
    });
  }

  // ============================================================
  //  启动
  // ============================================================
  function setupKeys() {
    document.querySelectorAll(".key").forEach((el) => {
      el.addEventListener("click", () => handleKey(el));
    });
  }

  function boot() {
    if (typeof Algebrite === "undefined") {
      lcd.innerHTML = `<div style="padding:20px;color:#8a2a2a;">CAS 库未加载。请检查 vendor/algebrite.js 是否存在。</div>`;
      return;
    }
    setupKeys();
    setupTouchpad();
    setupPhysicalKeyboard();
    updateModBody();
    render();
    // 自动开 Calculator（更像真机开机的 Scratchpad 体验）
    openApp("calculator");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
