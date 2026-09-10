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
    { id: "graphs",     name: "Graphs",     icon: "📈", implemented: true },
    { id: "geometry",   name: "Geometry",   icon: "📐", implemented: true },
    { id: "lists",      name: "Lists & Spreadsheet", icon: "📋", implemented: true },
    { id: "notes",      name: "Notes",      icon: "📝", implemented: true },
    { id: "data",       name: "Data & Statistics",   icon: "📊", implemented: true },
    { id: "python",     name: "Python",     icon: "🐍", implemented: true },
    { id: "vernier",    name: "Vernier DataQuest",   icon: "🔬", implemented: true },
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
    if (S.currentApp === "graphs") return renderGraphs();
    if (S.currentApp === "notes") return renderNotes();
    if (S.currentApp === "lists") return renderLists();
    if (S.currentApp === "data") return renderData();
    if (S.currentApp === "geometry") return renderGeometry();
    if (S.currentApp === "python") return renderPython();
    if (S.currentApp === "vernier") return renderVernier();
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
    // 进入 Graphs 时初始化状态
    if (id === "graphs" && !S.graphs) {
      S.graphs = defaultGraphs();
    }
    if (id === "notes" && !S.notes) S.notes = defaultNotes();
    if (id === "lists" && !S.lists) S.lists = defaultLists();
    if (id === "data" && !S.data) S.data = defaultData();
    if (id === "geometry" && !S.geom) S.geom = defaultGeom();
    if (id === "python" && !S.python) S.python = defaultPython();
    if (id === "vernier" && !S.vernier) S.vernier = defaultVernier();
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

  function calcClearAll() {
    S.entry = "";
    S.history = [];
    S.cursor = -1;
    S.ans = null;
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
    let action = el.getAttribute("data-action");
    // 双标签键：shift 激活时优先用副标签 action
    if (S.shift) {
      const alt = el.getAttribute("data-action-shift");
      if (alt) action = alt;
    }
    const mod = el.getAttribute("data-key");

    // 修饰键
    if (mod === "home" || mod === "esc") return openApp("home");
    if (mod === "shift") return toggleShift();
    if (mod === "ctrl")  return toggleCtrl();
    if (mod === "caps")  return toggleCaps();
    if (mod === "tab")   { if (S.currentApp === "calculator") return calcAppend("\t"); return; }
    if (mod === "E")     { if (S.currentApp === "calculator") return calcAppend("10^"); return; }  // 真机 E 键 = EE（科学计数）
    if (mod === "var")   return flash("VAR 菜单（占位）");
    if (mod === "menu" || mod === "doc" || mod === "doc2") return flash(`${mod.toUpperCase()} 菜单（占位）`);
    if (mod === "on")    return flash("ON 关机键（占位）");
    if (mod === "page")  return flash("PAGE 多页（占位）");

    const app = S.currentApp;
    if (app === "home") { if (char) openApp("calculator"); return; }

    if (app === "calculator") {
      if (mod === "del" || mod === "del-top" || action === "backspace") return calcBackspace();
      if (action === "clear") return calcClearAll();
      // ctrl + =  →  赋值 :=
      if (S.ctrl && action === "equals") return calcAppend(":=");
      if (action === "equals")   return calcAppend("=");
      if (action === "e_pow")    return calcAppend("e^");
      if (action === "ten_pow")  return calcAppend("*10^");
      if (action === "divide")   return calcAppend("/");
      if (action === "minus")    return calcAppend("-");
      if (action === "paren_r")  return calcAppend(")");
      if (action === "lt-icon1" || action === "lt-icon2" || action === "lt-icon3" || action === "lt-icon-r2") return flash("模板键（占位）");
      if (action === "lt-enter") return calcEnter();
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
      if (action === "power-3")  return calcAppend("^(-3)");
      if (action === "frac")     return calcAppend("/");
      if (action === "fraction") return calcAppend("/");
      if (action === "frac2")    return calcAppend("/");
      if (action === "assign")   return calcAppend(":=");
      if (action === "comma")    return calcAppend(",");
      if (action === "le")       return calcAppend("<=");
      if (action === "ge")       return calcAppend(">=");
      if (action === "log")      return calcAppend("log(");
      if (action === "ln")       return calcAppend("ln(");
      if (action === "sin")      return calcAppend("sin(");
      if (action === "cos")      return calcAppend("cos(");
      if (action === "tan")      return calcAppend("tan(");
      if (action === "factor")   return calcAppend("factor(");
      if (action === "simplify") return calcAppend("simplify(");
      if (action === "arcsin")  return calcAppend("arcsin(");
      if (action === "arccos")  return calcAppend("arccos(");
      if (action === "arctan")  return calcAppend("arctan(");
      if (action === "pi")      return calcAppend("pi");
      if (action === "ekey")    return calcAppend("e");
      if (action === "assign")  return calcAppend(":=");
      if (action === "ge")      return calcAppend(">=");
      if (action === "clear")   return calcClearAll();
      if (action === "catlg")    return flash("CATALOG（占位）");
      if (action === "angle")    return calcAppend("∠");
      if (action === "ee")       return calcAppend("*10^");
      if (action === "flag" || action === "flag2" || action === "flag3") return flash("FLAG（占位）");
      if (action === "toggle-exact") return calcToggleMode();
      if (action === "del")      return calcBackspace();
      if (char !== null) {
        let ch = char;
        // 真机行为：键上印大写，但默认输入小写（像手机键盘）
        // shift 按下时切大写；caps lock 反转默认大小写
        if (/^[a-zA-Z]$/.test(ch)) {
          const lower = ch.toLowerCase();
          const upper = ch.toUpperCase();
          if (S.shift) ch = S.caps ? lower : upper;
          else        ch = S.caps ? upper : lower;
        }
        calcAppend(ch);
      }
    }

    if (app === "graphs") {
      const g = S.graphs;
      // 窗口字段编辑（On-screen 键）
      if (g && g.windowOpen && g.winField) {
        const inp = document.getElementById("win-" + g.winField);
        if (inp) {
          if (mod === "del" || mod === "del-top" || action === "backspace") { inp.value = inp.value.slice(0, -1); return; }
          if (action === "clear") { inp.value = ""; return; }
          if (action === "enter") { graphApplyWindow(); return; }
          if (action === "negate") { inp.value += "-"; return; }
          if (char !== null && /^[0-9.\-]$/.test(char)) { inp.value += char; return; }
          return;
        }
      }
      if (mod === "del" || mod === "del-top" || action === "backspace") return graphsBackspace();
      if (action === "clear") return graphsClear();
      if (action === "enter" || action === "lt-enter") return graphCommit();
      const gmap = {
        "negate": "-", "sqrt": "sqrt(", "pi": "pi", "ekey": "e",
        "sin": "sin(", "cos": "cos(", "tan": "tan(",
        "arcsin": "arcsin(", "arccos": "arccos(", "arctan": "arctan(",
        "log": "log(", "ln": "ln(", "power": "^", "power2": "^2",
        "ten_pow": "*10^", "e_pow": "e^", "paren_r": ")", "comma": ",",
        "le": "<=", "ge": ">=", "ans": "Ans", "ee": "*10^", "assign": ":", "space": " "
      };
      if (Object.prototype.hasOwnProperty.call(gmap, action)) { graphsAppend(gmap[action]); }
      else if (char !== null) {
        let ch = char;
        if (/^[a-zA-Z]$/.test(ch)) {
          const lower = ch.toLowerCase(), upper = ch.toUpperCase();
          if (S.shift) ch = S.caps ? lower : upper;
          else        ch = S.caps ? upper : lower;
        }
        graphsAppend(ch);
      }
      // 真机：按一次普通键后清除 shift/ctrl 高亮
      S.shift = false; S.ctrl = false; updateModBody();
      return;
    }

    // 其它应用（notes/lists/data/geometry/python/vernier）
    return appDispatch(action, char, mod);
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
      if (S.currentApp === "graphs") {
        if (t.classList.contains("tp-up"))    return graphSelectPrev();
        if (t.classList.contains("tp-down"))  return graphSelectNext();
        if (t.classList.contains("tp-left"))  return graphTraceStep(-1);
        if (t.classList.contains("tp-right")) return graphTraceStep(1);
        if (t.classList.contains("tp-center") || t === tp) return graphToggleTrace();
        return;
      }
      if (S.currentApp === "lists") {
        const L = S.lists;
        if (t.classList.contains("tp-up"))    { L.active.r = Math.max(0, L.active.r - 1); L.edit = L.data[L.active.r][L.active.c]; render(); return; }
        if (t.classList.contains("tp-down"))  { L.active.r = Math.min(L.rows - 1, L.active.r + 1); L.edit = L.data[L.active.r][L.active.c]; render(); return; }
        if (t.classList.contains("tp-left"))  { L.active.c = Math.max(0, L.active.c - 1); L.edit = L.data[L.active.r][L.active.c]; render(); return; }
        if (t.classList.contains("tp-right")) { L.active.c = Math.min(L.cols - 1, L.active.c + 1); L.edit = L.data[L.active.r][L.active.c]; render(); return; }
        if (t.classList.contains("tp-center") || t === tp) return listsCommit();
        return;
      }
      if (S.currentApp === "data") {
        if (t.classList.contains("tp-center") || t === tp) return dataAdd();
        return;
      }
      if (S.currentApp === "notes" || S.currentApp === "python") {
        if (t.classList.contains("tp-center") || t === tp) return appType("\n");
        return;
      }
      if (S.currentApp === "geometry" || S.currentApp === "vernier") return;
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
      if (e.key === "Escape" || e.key === "Home") return openApp("home");
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;

      if (S.currentApp === "graphs") {
        if (e.key === "Enter") return graphCommit();
        if (e.key === "Backspace") return graphsBackspace();
        if (e.key === "ArrowLeft")  return graphTraceStep(-1);
        if (e.key === "ArrowRight") return graphTraceStep(1);
        if (e.key === "ArrowUp")    return graphSelectPrev();
        if (e.key === "ArrowDown")  return graphSelectNext();
        if (e.key === "Shift")   { S.shift = true;  updateModBody(); return; }
        if (e.key === "Control") { S.ctrl = true;   updateModBody(); return; }
        if (e.key.length === 1) graphsAppend(e.key);
        return;
      }

      // calculator
      if (e.key === "Enter")   return calcEnter();
      if (e.key === "Backspace") return calcBackspace();
      if (e.key === "ArrowUp")    return calcHistoryUp();
      if (e.key === "ArrowDown")  return calcHistoryDown();
      if (e.key === "Shift") return S.shift = true, updateModBody();
      if (e.key === "Control") return S.ctrl = true, updateModBody();
      if (e.ctrlKey && e.key === "=") { S.ctrl = false; updateModBody(); return calcAppend(":="); }
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
  // ============================================================
  //  Graphs 绘图应用
  // ============================================================

  function defaultGraphs() {
    return {
      funcs: [
        { expr: "", color: "#2b6cff" },
        { expr: "", color: "#d23b3b" },
        { expr: "", color: "#2e9e4f" },
        { expr: "", color: "#caa024" },
      ],
      active: 0,
      window: { xmin: -10, xmax: 10, ymin: -10, ymax: 10 },
      entry: "",
      traceOn: false,
      traceX: NaN,
      windowOpen: false,
      winField: null,   // 当前正在用屏幕键盘编辑的窗口字段
    };
  }

  // ---------- 数学解析器（用于绘图数值计算）----------
  // 支持：数字(含科学计数)、x、pi、e、四则、^（右结合）、一元负号、
  //       函数 sin/cos/tan/arcsin.../ln/log/sqrt/abs/exp/...、
  //       隐式乘法（2x → 2*x，2(x+1)→2*(x+1)，sin(x)cos(x) 等）
  function tokenizeGraph(src) {
    const s = String(src).toLowerCase();
    const toks = [];
    let i = 0;
    const isDigit = (c) => c >= "0" && c <= "9";
    const isAlpha = (c) => c >= "a" && c <= "z";
    while (i < s.length) {
      const c = s[i];
      if (c === " " || c === "\t") { i++; continue; }
      if (isDigit(c) || (c === "." && isDigit(s[i + 1]))) {
        let j = i, num = "";
        while (j < s.length && (isDigit(s[j]) || s[j] === ".")) num += s[j++];
        if (s[j] === "e" && (isDigit(s[j + 1]) || ((s[j + 1] === "+" || s[j + 1] === "-") && isDigit(s[j + 2])))) {
          num += s[j++];
          if (s[j] === "+" || s[j] === "-") num += s[j++];
          while (j < s.length && isDigit(s[j])) num += s[j++];
        }
        toks.push({ t: "num", v: parseFloat(num) });
        i = j; continue;
      }
      if (isAlpha(c)) {
        let j = i, name = "";
        while (j < s.length && isAlpha(s[j])) name += s[j++];
        if (name === "pi") { toks.push({ t: "const", v: Math.PI }); i = j; continue; }
        if (name === "e")  { toks.push({ t: "const", v: Math.E });  i = j; continue; }
        if (name === "x")  { toks.push({ t: "var" }); i = j; continue; }
        const fns = ["sin","cos","tan","asin","acos","atan","arcsin","arccos","arctan",
                     "ln","log","sqrt","abs","exp","floor","ceil","round","sign",
                     "sinh","cosh","tanh","cbrt"];
        if (fns.indexOf(name) >= 0) { toks.push({ t: "fn", v: name }); i = j; continue; }
        throw new Error("未知标识符: " + name);
      }
      if (c === "(") { toks.push({ t: "lp" }); i++; continue; }
      if (c === ")") { toks.push({ t: "rp" }); i++; continue; }
      if (c === ",") { toks.push({ t: "comma" }); i++; continue; }
      if ("+-*/^".indexOf(c) >= 0) { toks.push({ t: "op", v: c }); i++; continue; }
      throw new Error("非法字符: " + c);
    }
    return toks;
  }

  function insertImplicit(toks) {
    const out = [];
    for (let k = 0; k < toks.length; k++) {
      out.push(toks[k]);
      const a = toks[k], b = toks[k + 1];
      if (!b) continue;
      const aMul = a.t === "num" || a.t === "const" || a.t === "var" || a.t === "rp";
      const bMul = b.t === "num" || b.t === "const" || b.t === "var" || b.t === "fn" || b.t === "lp";
      if (aMul && bMul) out.push({ t: "op", v: "*" });
    }
    return out;
  }

  function parseGraph(toks) {
    let p = 0;
    const peek = () => toks[p];
    const next = () => toks[p++];
    function parseExpr() { return parseAddSub(); }
    function parseAddSub() {
      let node = parseMulDiv();
      while (peek() && peek().t === "op" && (peek().v === "+" || peek().v === "-")) {
        const op = next().v; const rhs = parseMulDiv();
        node = { t: "bin", op, l: node, r: rhs };
      }
      return node;
    }
    function parseMulDiv() {
      let node = parsePow();
      while (peek() && peek().t === "op" && (peek().v === "*" || peek().v === "/")) {
        const op = next().v; const rhs = parsePow();
        node = { t: "bin", op, l: node, r: rhs };
      }
      return node;
    }
    function parsePow() {
      const node = parseUnary();
      if (peek() && peek().t === "op" && peek().v === "^") {
        next(); const rhs = parsePow();
        return { t: "bin", op: "^", l: node, r: rhs };
      }
      return node;
    }
    function parseUnary() {
      if (peek() && peek().t === "op" && (peek().v === "-" || peek().v === "+")) {
        const op = next().v; const rhs = parseUnary();
        return { t: "un", op, x: rhs };
      }
      return parsePrimary();
    }
    function parsePrimary() {
      const tk = peek();
      if (!tk) throw new Error("表达式不完整");
      if (tk.t === "num")   { next(); return { t: "num", v: tk.v }; }
      if (tk.t === "var")   { next(); return { t: "var" }; }
      if (tk.t === "const") { next(); return { t: "const", v: tk.v }; }
      if (tk.t === "lp") {
        next(); const e = parseExpr();
        if (!peek() || peek().t !== "rp") throw new Error("缺少 )");
        next(); return e;
      }
      if (tk.t === "fn") {
        next();
        if (!peek() || peek().t !== "lp") throw new Error("函数需要 (");
        next(); const e = parseExpr();
        if (!peek() || peek().t !== "rp") throw new Error("缺少 )");
        next(); return { t: "fn", v: tk.v, x: e };
      }
      throw new Error("意外符号");
    }
    const ast = parseExpr();
    if (p < toks.length) throw new Error("多余的符号");
    return ast;
  }

  function evalGraph(node, x) {
    switch (node.t) {
      case "num":   return node.v;
      case "var":   return x;
      case "const": return node.v;
      case "un":    { const v = evalGraph(node.x, x); return node.op === "-" ? -v : v; }
      case "bin": {
        const a = evalGraph(node.l, x), b = evalGraph(node.r, x);
        switch (node.op) {
          case "+": return a + b;
          case "-": return a - b;
          case "*": return a * b;
          case "/": return a / b;
          case "^": return Math.pow(a, b);
        }
        return NaN;
      }
      case "fn": {
        const a = evalGraph(node.x, x);
        switch (node.v) {
          case "sin": return Math.sin(a);
          case "cos": return Math.cos(a);
          case "tan": return Math.tan(a);
          case "asin": case "arcsin": return Math.asin(a);
          case "acos": case "arccos": return Math.acos(a);
          case "atan": case "arctan": return Math.atan(a);
          case "ln": case "log": return Math.log(a);
          case "sqrt": return Math.sqrt(a);
          case "abs": return Math.abs(a);
          case "exp": return Math.exp(a);
          case "floor": return Math.floor(a);
          case "ceil": return Math.ceil(a);
          case "round": return Math.round(a);
          case "sign": return Math.sign(a);
          case "sinh": return Math.sinh(a);
          case "cosh": return Math.cosh(a);
          case "tanh": return Math.tanh(a);
          case "cbrt": return Math.cbrt(a);
        }
        return NaN;
      }
    }
    return NaN;
  }

  function graphEval(expr, x) {
    try {
      if (expr == null) return NaN;
      const s = String(expr).trim();
      if (!s) return NaN;
      const cache = graphEval._cache || (graphEval._cache = {});
      let ast = cache[s];
      if (!ast) { ast = parseGraph(insertImplicit(tokenizeGraph(s))); cache[s] = ast; }
      const v = evalGraph(ast, x);
      return v;
    } catch (e) {
      return NaN;
    }
  }

  // ---------- Graphs 行为 ----------
  function graphsAppend(text) { S.graphs.entry += text; render(); }
  function graphsBackspace() {
    if (S.graphs.entry.length > 0) { S.graphs.entry = S.graphs.entry.slice(0, -1); render(); }
  }
  function graphsClear() {
    if (S.graphs.entry) S.graphs.entry = "";
    else S.graphs.funcs[S.graphs.active].expr = "";
    render();
  }
  function graphCommit() {
    const g = S.graphs;
    if (g.entry.trim() !== "") {
      g.funcs[g.active].expr = g.entry;
      g.entry = "";
    }
    if (g.active < g.funcs.length - 1) g.active++;
    render();
  }
  function graphSelect(i) {
    const g = S.graphs;
    g.active = i;
    g.entry = g.funcs[i].expr;
    render();
  }
  function graphSelectPrev() {
    const g = S.graphs;
    g.active = (g.active - 1 + g.funcs.length) % g.funcs.length;
    g.entry = g.funcs[g.active].expr;
    render();
  }
  function graphSelectNext() {
    const g = S.graphs;
    g.active = (g.active + 1) % g.funcs.length;
    g.entry = g.funcs[g.active].expr;
    render();
  }
  function graphToggleTrace() {
    const g = S.graphs;
    g.traceOn = !g.traceOn;
    if (g.traceOn && !Number.isFinite(g.traceX)) {
      g.traceX = (g.window.xmin + g.window.xmax) / 2;
    }
    render();
  }
  function graphTraceStep(dir) {
    const g = S.graphs;
    if (!g.traceOn) g.traceOn = true;
    if (!Number.isFinite(g.traceX)) g.traceX = (g.window.xmin + g.window.xmax) / 2;
    const step = (g.window.xmax - g.window.xmin) / 50;
    g.traceX += dir * step;
    render();
  }
  function graphApplyWindow() {
    const g = S.graphs;
    const names = ["xmin", "xmax", "ymin", "ymax"];
    const vals = {};
    let okAll = true;
    names.forEach((n) => {
      const inp = document.getElementById("win-" + n);
      const v = parseFloat(inp && inp.value);
      if (!Number.isFinite(v)) okAll = false; else vals[n] = v;
    });
    if (okAll && vals.xmin < vals.xmax && vals.ymin < vals.ymax) {
      g.window = vals; g.winField = null; render();
    } else {
      flash("窗口参数无效（需 xmin<xmax 且 ymin<ymax）");
    }
  }

  // ---------- 画布渲染 ----------
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    let s;
    if (n < 1.5) s = 1; else if (n < 3) s = 2; else if (n < 7) s = 5; else s = 10;
    return s * p;
  }
  function fmtTick(v) { return Math.abs(v) < 1e-9 ? "0" : (Math.round(v * 100) / 100).toString(); }
  function round2(v) { return Math.round(v * 100) / 100; }

  function drawGraph() {
    const canvas = document.getElementById("graph-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return; // jsdom 无 2d 上下文，跳过实际绘制
    const W = 540, H = 360;
    canvas.width = W; canvas.height = H;
    const g = S.graphs, win = g.window;
    ctx.fillStyle = "#fbfbf4"; ctx.fillRect(0, 0, W, H);

    const sx = W / (win.xmax - win.xmin);
    const sy = H / (win.ymax - win.ymin);
    const X = (x) => (x - win.xmin) * sx;
    const Y = (y) => H - (y - win.ymin) * sy;

    const step = niceStep((win.xmax - win.xmin) / 10);
    // 网格
    ctx.strokeStyle = "#e6e6da"; ctx.lineWidth = 1;
    for (let x = Math.ceil(win.xmin / step) * step; x <= win.xmax; x += step) {
      const px = X(x); ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
    }
    for (let y = Math.ceil(win.ymin / step) * step; y <= win.ymax; y += step) {
      const py = Y(y); ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
    }
    // 坐标轴
    ctx.strokeStyle = "#888"; ctx.lineWidth = 1.5;
    if (win.xmin <= 0 && win.xmax >= 0) { ctx.beginPath(); ctx.moveTo(X(0), 0); ctx.lineTo(X(0), H); ctx.stroke(); }
    if (win.ymin <= 0 && win.ymax >= 0) { ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); ctx.stroke(); }
    // 刻度
    ctx.fillStyle = "#555"; ctx.font = "9px monospace";
    for (let x = Math.ceil(win.xmin / step) * step; x <= win.xmax; x += step) {
      if (Math.abs(x) < 1e-9) continue;
      ctx.fillText(fmtTick(x), X(x) + 2, Y(0) + 11);
    }
    for (let y = Math.ceil(win.ymin / step) * step; y <= win.ymax; y += step) {
      if (Math.abs(y) < 1e-9) continue;
      ctx.fillText(fmtTick(y), X(0) + 2, Y(y) - 2);
    }
    // 曲线
    const N = Math.max(160, W);
    for (let fi = 0; fi < g.funcs.length; fi++) {
      const expr = g.funcs[fi].expr.trim();
      if (!expr) continue;
      ctx.strokeStyle = g.funcs[fi].color; ctx.lineWidth = 2; ctx.beginPath();
      let started = false, prevY = null;
      for (let k = 0; k <= N; k++) {
        const x = win.xmin + (win.xmax - win.xmin) * k / N;
        const y = graphEval(expr, x);
        if (!Number.isFinite(y)) { started = false; prevY = null; continue; }
        const px = X(x), py = Y(y);
        if (py < -H || py > 2 * H) { started = false; prevY = null; continue; }
        if (!started) { ctx.moveTo(px, py); started = true; }
        else {
          if (prevY !== null && Math.abs(py - prevY) > H * 0.6) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        prevY = py;
      }
      ctx.stroke();
    }
    // TRACE 光标
    if (g.traceOn) {
      const px = X(g.traceX);
      ctx.strokeStyle = "#444"; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
      ctx.setLineDash([]);
      const expr = g.funcs[g.active].expr.trim();
      if (expr) {
        const ty = graphEval(expr, g.traceX);
        if (Number.isFinite(ty) && ty >= win.ymin && ty <= win.ymax) {
          const py = Y(ty);
          ctx.fillStyle = g.funcs[g.active].color;
          ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#111"; ctx.font = "10px monospace";
          ctx.fillText("(" + round2(g.traceX) + ", " + round2(ty) + ")", Math.min(px + 6, W - 84), Math.max(12, py - 6));
        }
      }
    }
  }

  function renderGraphs() {
    const g = S.graphs;
    const eqList = g.funcs.map((f, i) =>
      `<div class="graph-eq ${i === g.active ? "active" : ""}" data-f="${i}"><span class="fx" style="color:${f.color}">f${i + 1}(x)=</span> <span class="gexpr">${escapeHtml(f.expr) || "…"}</span></div>`
    ).join("");
    const traceBtn = g.traceOn ? "active" : "";

    let windowHtml = "";
    if (g.windowOpen) {
      const w = g.window;
      windowHtml = `<div class="graph-window">
        <label>xmin</label><input id="win-xmin" type="text" value="${w.xmin}">
        <label>xmax</label><input id="win-xmax" type="text" value="${w.xmax}">
        <label>ymin</label><input id="win-ymin" type="text" value="${w.ymin}">
        <label>ymax</label><input id="win-ymax" type="text" value="${w.ymax}">
        <button class="gbtn" data-gact="win-apply">Apply</button>
        <button class="gbtn" data-gact="win-reset">Reset</button>
      </div>`;
    }

    lcd.innerHTML = `<div class="graph-view">
      <div class="graph-toolbar">
        <span class="gtitle">Graphs</span>
        <button class="gbtn" data-gact="window">Window</button>
        <button class="gbtn ${traceBtn}" data-gact="trace">Trace</button>
        <button class="gbtn" data-gact="home">home</button>
      </div>
      <canvas id="graph-canvas" class="graph-canvas"></canvas>
      ${windowHtml}
      <div class="graph-eqs">${eqList}</div>
      <div class="graph-entry"><span class="fx" style="color:${g.funcs[g.active].color}">f${g.active + 1}(x)=</span> ${escapeHtml(g.entry) || '<span class="cursor">&nbsp;</span>'}</div>
      ${g.traceOn ? `<div class="graph-trace">Trace @ x = ${round2(g.traceX)}</div>` : ""}
    </div>`;

    lcd.querySelectorAll("[data-f]").forEach((el) =>
      el.addEventListener("click", () => graphSelect(parseInt(el.getAttribute("data-f"), 10))));
    lcd.querySelectorAll("[data-gact]").forEach((el) =>
      el.addEventListener("click", () => {
        const a = el.getAttribute("data-gact");
        if (a === "window") { g.windowOpen = !g.windowOpen; g.winField = null; render(); }
        else if (a === "trace") graphToggleTrace();
        else if (a === "home") openApp("home");
        else if (a === "win-apply") graphApplyWindow();
        else if (a === "win-reset") { g.window = { xmin: -10, xmax: 10, ymin: -10, ymax: 10 }; render(); }
      }));
    if (g.windowOpen) {
      ["xmin", "xmax", "ymin", "ymax"].forEach((name) => {
        const inp = document.getElementById("win-" + name);
        if (inp) inp.addEventListener("focus", () => { g.winField = name; });
      });
    }
    drawGraph();
  }

  // ============================================================
  //  通用：文本型 App 的键盘输入
  // ============================================================
  function appActiveInput() {
    const app = S.currentApp;
    if (app === "notes") return document.getElementById("notes-area");
    if (app === "python") return document.getElementById("py-code");
    if (app === "lists")  return document.getElementById("cell-edit");
    if (app === "data")   return document.getElementById("data-entry");
    return null;
  }
  function appType(text) {
    const el = appActiveInput();
    if (!el) return;
    const s = el.selectionStart == null ? el.value.length : el.selectionStart;
    const e = el.selectionEnd == null ? el.value.length : el.selectionEnd;
    el.value = el.value.slice(0, s) + text + el.value.slice(e);
    const pos = s + text.length;
    try { el.selectionStart = el.selectionEnd = pos; } catch (_) {}
    el.focus();
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function appBackspace() {
    const el = appActiveInput();
    if (!el) return;
    const s = el.selectionStart == null ? el.value.length : el.selectionStart;
    const e = el.selectionEnd == null ? el.value.length : el.selectionEnd;
    if (s !== e) el.value = el.value.slice(0, s) + el.value.slice(e);
    else if (s > 0) el.value = el.value.slice(0, s - 1) + el.value.slice(s);
    const pos = Math.max(0, s !== e ? s : s - 1);
    try { el.selectionStart = el.selectionEnd = pos; } catch (_) {}
    el.focus();
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  // 字母默认小写（与真机一致）
  function appChar(char) {
    if (char == null) return null;
    if (/^[A-Za-z]$/.test(char)) {
      const lo = char.toLowerCase();
      const up = char.toUpperCase();
      return S.shift ? (S.caps ? lo : up) : (S.caps ? up : lo);
    }
    return char;
  }
  const TEXT_INSERT = {
    equals: "=", divide: "/", minus: "-", paren_r: ")",
    sin: "sin(", cos: "cos(", tan: "tan(",
    arcsin: "asin(", arccos: "acos(", arctan: "atan(",
    ln: "ln(", log: "log(", sqrt: "sqrt(", pi: "pi", ekey: "e",
    e_pow: "e^", ten_pow: "1e", power: "^", power2: "^2",
    assign: ":=", comma: ",", le: "<=", ge: ">=", space: " ", approx: "~",
  };
  const PY_INSERT = {
    equals: "=", divide: "/", minus: "-", paren_r: ")",
    sin: "math.sin(", cos: "math.cos(", tan: "math.tan(",
    arcsin: "math.asin(", arccos: "math.acos(", arctan: "math.atan(",
    ln: "math.log(", log: "math.log10(", sqrt: "math.sqrt(", pi: "math.pi",
    ekey: "math.e", e_pow: "math.exp(", ten_pow: "1e", power: "**", power2: "**2",
    assign: "=", comma: ",", le: "<=", ge: ">=", space: " ", approx: "==",
  };
  function appDispatch(action, char, mod) {
    const app = S.currentApp;
    if (mod === "home" || mod === "esc") return openApp("home");
    if (char != null) char = appChar(char);
    if (app === "notes") {
      if (mod === "del" || action === "backspace") return appBackspace();
      if (action === "clear") { S.notes.text = ""; saveNotes(); render(); return; }
      if (action === "enter" || action === "lt-enter") return appType("\n");
      let t = char; if (action && TEXT_INSERT[action]) t = TEXT_INSERT[action];
      if (t != null) appType(t);
      return;
    }
    if (app === "python") {
      if (mod === "del" || action === "backspace") return appBackspace();
      if (action === "clear") { S.python.code = ""; render(); return; }
      if (action === "enter" || action === "lt-enter") return appType("\n");
      let t = char; if (action && PY_INSERT[action]) t = PY_INSERT[action];
      if (t != null) appType(t);
      return;
    }
    if (app === "lists")   return listsKey(action, char, mod);
    if (app === "data")    return dataKey(action, char, mod);
    if (app === "geometry") return; // 主要由按钮 / 画布驱动
    if (app === "vernier") return;  // 主要由按钮驱动
  }

  // ============================================================
  //  Notes 应用
  // ============================================================
  function defaultNotes() {
    let saved = "";
    try { saved = localStorage.getItem("nspire-notes") || ""; } catch (_) {}
    return { text: saved };
  }
  function saveNotes() { try { localStorage.setItem("nspire-notes", S.notes.text); } catch (_) {} }
  function renderNotes() {
    lcd.innerHTML = `<div class="notes-view">
      <div class="app-bar">
        <span class="app-title">Notes</span>
        <span class="app-sub">Document1 · 自动保存</span>
        <button class="gbtn" data-gact="home">home</button>
      </div>
      <textarea id="notes-area" class="notes-area" placeholder="在此输入笔记…">${escapeHtml(S.notes.text)}</textarea>
    </div>`;
    const ta = document.getElementById("notes-area");
    ta.addEventListener("input", () => { S.notes.text = ta.value; saveNotes(); });
    document.querySelector('[data-gact="home"]').addEventListener("click", () => openApp("home"));
    setTimeout(() => ta.focus(), 0);
  }

  // ============================================================
  //  Lists & Spreadsheet 应用
  // ============================================================
  function defaultLists() {
    const cols = 6, rows = 12;
    const data = [];
    for (let r = 0; r < rows; r++) data.push(new Array(cols).fill(""));
    return { rows, cols, data, active: { r: 0, c: 0 }, edit: "" };
  }
  function colName(c) { return String.fromCharCode(65 + c); }
  function renderLists() {
    const L = S.lists;
    let cells = "";
    for (let r = 0; r < L.rows; r++) {
      for (let c = 0; c < L.cols; c++) {
        const active = (r === L.active.r && c === L.active.c) ? " active" : "";
        cells += `<div class="cell${active}" data-r="${r}" data-c="${c}">${escapeHtml(L.data[r][c])}</div>`;
      }
    }
    lcd.innerHTML = `<div class="grid-view">
      <div class="app-bar">
        <span class="app-title">Lists &amp; Spreadsheet</span>
        <button class="gbtn" data-gact="home">home</button>
      </div>
      <div class="cell-edit-row">
        <span class="cell-ref">${colName(L.active.c)}${L.active.r + 1}</span>
        <input id="cell-edit" class="cell-edit" value="${escapeHtml(L.edit)}" placeholder="值或 =A1+B2">
      </div>
      <div class="grid" style="grid-template-columns:repeat(${L.cols},1fr)">${cells}</div>
    </div>`;
    lcd.querySelectorAll(".cell").forEach((el) => el.addEventListener("click", () => {
      const r = +el.getAttribute("data-r"), c = +el.getAttribute("data-c");
      L.active = { r, c }; L.edit = L.data[r][c]; render();
    }));
    const inp = document.getElementById("cell-edit");
    inp.addEventListener("input", () => { L.edit = inp.value; });
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); listsCommit(); } });
    document.querySelector('[data-gact="home"]').addEventListener("click", () => openApp("home"));
    setTimeout(() => inp.focus(), 0);
  }
  function listsCommit() {
    const L = S.lists;
    L.data[L.active.r][L.active.c] = L.edit;
    recalcLists();
    if (L.active.r < L.rows - 1) L.active = { r: L.active.r + 1, c: L.active.c };
    L.edit = L.data[L.active.r][L.active.c];
    render();
  }
  function recalcLists() {
    const L = S.lists;
    for (let pass = 0; pass < 3; pass++) {
      for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) {
        const v = L.data[r][c];
        if (typeof v === "string" && v.charAt(0) === "=") {
          try { L.data[r][c] = evalCellFormula(v.slice(1), L); } catch (_) {}
        }
      }
    }
  }
  function evalCellFormula(expr, L) {
    const replaced = expr.replace(/([A-Z])(\d+)/g, (m, col, row) => {
      const c = col.charCodeAt(0) - 65;
      const r = parseInt(row, 10) - 1;
      if (r < 0 || r >= L.rows || c < 0 || c >= L.cols) return "0";
      const val = L.data[r][c];
      const n = parseFloat(val);
      return Number.isFinite(n) ? String(n) : "0";
    });
    const r = Function('"use strict";return (' + replaced + ');')();
    return Number.isFinite(r) ? String(r) : "?";
  }
  function listsKey(action, char, mod) {
    if (mod === "del" || action === "backspace") return appBackspace();
    if (action === "clear") { S.lists.edit = ""; S.lists.data[S.lists.active.r][S.lists.active.c] = ""; render(); return; }
    if (action === "enter" || action === "lt-enter") return listsCommit();
    let t = char; if (action && TEXT_INSERT[action]) t = TEXT_INSERT[action];
    if (t != null) appType(t);
  }

  // ============================================================
  //  Data & Statistics 应用
  // ============================================================
  function defaultData() { return { x: [], y: [], plot: "scatter", edit: "" }; }
  function renderData() {
    const D = S.data;
    lcd.innerHTML = `<div class="data-view">
      <div class="app-bar">
        <span class="app-title">Data &amp; Statistics</span>
        <button class="gbtn" data-gact="home">home</button>
      </div>
      <div class="data-entry-row">
        <input id="data-entry" class="data-entry" value="${escapeHtml(D.edit)}" placeholder="x,y 回车添加（或单值）">
        <button class="gbtn" data-gact="add">Add</button>
        <button class="gbtn" data-gact="undo">Undo</button>
      </div>
      <div class="data-plot-btns">
        <button class="gbtn" data-gact="scatter">Scatter</button>
        <button class="gbtn" data-gact="hist">Hist</button>
        <button class="gbtn" data-gact="box">Box</button>
      </div>
      <canvas id="data-canvas" class="data-canvas"></canvas>
      <div class="data-stat" id="data-stat"></div>
    </div>`;
    const inp = document.getElementById("data-entry");
    inp.addEventListener("input", () => { D.edit = inp.value; });
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); dataAdd(); } });
    lcd.querySelectorAll("[data-gact]").forEach((el) => el.addEventListener("click", () => {
      const a = el.getAttribute("data-gact");
      if (a === "home") return openApp("home");
      if (a === "add") return dataAdd();
      if (a === "undo") { if (D.x.length) { D.x.pop(); D.y.pop(); drawData(); } return; }
      if (a === "scatter") { D.plot = "scatter"; drawData(); }
      if (a === "hist") { D.plot = "hist"; drawData(); }
      if (a === "box") { D.plot = "box"; drawData(); }
    }));
    setTimeout(() => inp.focus(), 0);
    drawData();
  }
  function dataAdd() {
    const D = S.data;
    const parts = D.edit.trim().split(/[\s,]+/).filter(Boolean);
    if (parts.length >= 2) {
      const x = parseFloat(parts[0]), y = parseFloat(parts[1]);
      if (Number.isFinite(x) && Number.isFinite(y)) { D.x.push(x); D.y.push(y); }
    } else if (parts.length === 1) {
      const v = parseFloat(parts[0]);
      if (Number.isFinite(v)) { D.x.push(v); D.y.push(NaN); }
    }
    D.edit = "";
    render();
  }
  function dataKey(action, char, mod) {
    if (mod === "del" || action === "backspace") return appBackspace();
    if (action === "clear") { S.data.edit = ""; render(); return; }
    if (action === "enter" || action === "lt-enter") return dataAdd();
    let t = char; if (action && TEXT_INSERT[action]) t = TEXT_INSERT[action];
    if (t != null) appType(t);
  }
  function drawData() {
    const canvas = document.getElementById("data-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return;
    const D = S.data, W = 540, H = 300; canvas.width = W; canvas.height = H;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    const stat = document.getElementById("data-stat");
    if (D.plot === "scatter") {
      const xs = D.x, ys = D.y.filter((v) => Number.isFinite(v));
      if (xs.length) {
        const xmin = Math.min(...xs), xmax = Math.max(...xs);
        const ymin = Math.min(...ys), ymax = Math.max(...ys);
        const sx = W / (xmax - xmin || 1), sy = H / (ymax - ymin || 1);
        ctx.strokeStyle = "#888";
        xs.forEach((x, i) => { const y = D.y[i]; if (!Number.isFinite(y)) return; const px = (x - xmin) * sx, py = H - (y - ymin) * sy; ctx.fillStyle = "#2b6cff"; ctx.beginPath(); ctx.arc(px, py, 3, 0, 7); ctx.fill(); });
        if (stat) stat.textContent = `n=${xs.length}  x:[${round2(xmin)}, ${round2(xmax)}]  y:[${round2(ymin)}, ${round2(ymax)}]`;
      }
    } else if (D.plot === "hist") {
      const vals = D.x.filter((v) => Number.isFinite(v));
      if (vals.length) {
        const min = Math.min(...vals), max = Math.max(...vals);
        const bins = 8, bw = (max - min || 1) / bins;
        const counts = new Array(bins).fill(0);
        vals.forEach((v) => { let b = Math.floor((v - min) / bw); if (b >= bins) b = bins - 1; if (b < 0) b = 0; counts[b]++; });
        const maxc = Math.max(...counts, 1), bwpx = W / bins;
        counts.forEach((c, b) => { const h = H * c / maxc; ctx.fillStyle = "#2b6cff"; ctx.fillRect(b * bwpx + 1, H - h, bwpx - 2, h); });
        if (stat) stat.textContent = `n=${vals.length}  min=${round2(min)}  max=${round2(max)}  mean=${round2(vals.reduce((a, b) => a + b, 0) / vals.length)}`;
      }
    } else if (D.plot === "box") {
      const vals = D.x.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b);
      if (vals.length) {
        const q = (p) => vals[Math.floor(p * (vals.length - 1))];
        const mn = vals[0], mx = vals[vals.length - 1], q1 = q(0.25), med = q(0.5), q3 = q(0.75);
        const xmin = mn - 0.2 * (mx - mn || 1), xmax = mx + 0.2 * (mx - mn || 1);
        const sx = W / (xmax - xmin), Y = H / 2;
        ctx.strokeStyle = "#333"; ctx.lineWidth = 2;
        const px = (v) => (v - xmin) * sx;
        ctx.beginPath(); ctx.moveTo(px(mn), Y); ctx.lineTo(px(q1), Y); ctx.moveTo(px(q3), Y); ctx.lineTo(px(mx), Y); ctx.stroke();
        ctx.fillStyle = "rgba(43,108,255,0.25)"; ctx.fillRect(px(q1), Y - 40, px(q3) - px(q1), 80);
        ctx.strokeStyle = "#2b6cff"; ctx.strokeRect(px(q1), Y - 40, px(q3) - px(q1), 80);
        ctx.beginPath(); ctx.moveTo(px(med), Y - 40); ctx.lineTo(px(med), Y + 40); ctx.stroke();
        if (stat) stat.textContent = `min=${round2(mn)}  Q1=${round2(q1)}  med=${round2(med)}  Q3=${round2(q3)}  max=${round2(mx)}`;
      }
    }
  }

  // ============================================================
  //  Geometry 应用
  // ============================================================
  function defaultGeom() { return { tool: "point", points: [], shapes: [], drag: null, _pending: null, color: "#2b6cff" }; }
  function renderGeometry() {
    const G = S.geom;
    lcd.innerHTML = `<div class="geom-view">
      <div class="app-bar">
        <span class="app-title">Geometry</span>
        <button class="gbtn ${G.tool === "point" ? "active" : ""}" data-gact="tool-point">Point</button>
        <button class="gbtn ${G.tool === "seg" ? "active" : ""}" data-gact="tool-seg">Segment</button>
        <button class="gbtn ${G.tool === "line" ? "active" : ""}" data-gact="tool-line">Line</button>
        <button class="gbtn ${G.tool === "circle" ? "active" : ""}" data-gact="tool-circle">Circle</button>
        <button class="gbtn" data-gact="clear">Clear</button>
        <button class="gbtn" data-gact="home">home</button>
      </div>
      <canvas id="geom-canvas" class="geom-canvas"></canvas>
      <div class="geom-hint">点击放置点；线段/直线/圆先点起点再点终点/半径点；拖动点可移动</div>
    </div>`;
    lcd.querySelectorAll("[data-gact]").forEach((el) => el.addEventListener("click", () => {
      const a = el.getAttribute("data-gact");
      if (a === "home") return openApp("home");
      if (a === "clear") { G.points = []; G.shapes = []; G._pending = null; drawGeom(); render(); return; }
      if (a.startsWith("tool-")) { G.tool = a.slice(5); G._pending = null; render(); }
    }));
    setupGeomCanvas();
    drawGeom();
  }
  function setupGeomCanvas() {
    const G = S.geom;
    const canvas = document.getElementById("geom-canvas");
    if (!canvas) return;
    const W = 540, H = 360; canvas.width = W; canvas.height = H;
    function pos(e) { const r = canvas.getBoundingClientRect(); const sx = W / r.width, sy = H / r.height; return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy }; }
    canvas.onmousedown = (e) => {
      const p = pos(e);
      for (const pt of G.points) { if (Math.hypot(pt.x - p.x, pt.y - p.y) < 10) { G.drag = pt; return; } }
      if (G.tool === "point") { G.points.push({ x: p.x, y: p.y }); drawGeom(); }
      else if (G.tool === "seg" || G.tool === "line" || G.tool === "circle") {
        if (!G._pending) G._pending = { x: p.x, y: p.y };
        else { G.shapes.push({ type: G.tool, a: G._pending, b: { x: p.x, y: p.y }, color: G.color }); G._pending = null; drawGeom(); }
      }
    };
    canvas.onmousemove = (e) => { if (G.drag) { const p = pos(e); G.drag.x = p.x; G.drag.y = p.y; drawGeom(); } };
    canvas.onmouseup = () => { G.drag = null; };
  }
  function drawGeom() {
    const canvas = document.getElementById("geom-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return;
    const G = S.geom, W = canvas.width, H = canvas.height;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#eee";
    for (let x = 0; x <= W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    G.shapes.forEach((s) => {
      ctx.strokeStyle = s.color; ctx.lineWidth = 2;
      if (s.type === "seg" || s.type === "line") { ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(s.b.x, s.b.y); ctx.stroke(); }
      else if (s.type === "circle") { const r = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y); ctx.beginPath(); ctx.arc(s.a.x, s.a.y, r, 0, 7); ctx.stroke(); }
    });
    G.points.forEach((pt) => { ctx.fillStyle = "#c0392b"; ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, 7); ctx.fill(); });
    if (G._pending) { ctx.fillStyle = "#888"; ctx.beginPath(); ctx.arc(G._pending.x, G._pending.y, 4, 0, 7); ctx.fill(); }
  }

  // ============================================================
  //  Python 应用（Skulpt 真实执行；无引擎时回退到轻量求值器）
  // ============================================================
  function defaultPython() {
    let saved = "";
    try { saved = localStorage.getItem("nspire-python") || "print(\"Hello, Nspire\")\nfor i in range(3):\n    print(i*i)\n"; } catch (_) {}
    return { code: saved, output: "", error: "" };
  }
  function renderPython() {
    const P = S.python;
    lcd.innerHTML = `<div class="py-view">
      <div class="app-bar">
        <span class="app-title">Python</span>
        <button class="gbtn" data-gact="run">Run ▶</button>
        <button class="gbtn" data-gact="clear">Clear</button>
        <button class="gbtn" data-gact="home">home</button>
      </div>
      <textarea id="py-code" class="py-code" spellcheck="false">${escapeHtml(P.code)}</textarea>
      <div class="py-out" id="py-out"></div>
    </div>`;
    const ta = document.getElementById("py-code");
    ta.addEventListener("input", () => { P.code = ta.value; try { localStorage.setItem("nspire-python", P.code); } catch (_) {} });
    lcd.querySelectorAll("[data-gact]").forEach((el) => el.addEventListener("click", () => {
      const a = el.getAttribute("data-gact");
      if (a === "home") return openApp("home");
      if (a === "clear") { P.code = ""; P.output = ""; P.error = ""; render(); return; }
      if (a === "run") return pythonRun();
    }));
  }
  function pythonRun() {
    const P = S.python;
    const out = document.getElementById("py-out");
    if (typeof Sk !== "undefined") {
      P.output = ""; P.error = "";
      try {
        Sk.configure({
          output: (s) => { P.output += s; },
          read: (f) => { if (f === "__main__.py" || f === "<stdin>.py") return P.code; throw new Error("No module: " + f); },
        });
        Sk.importMainWithBody("<stdin>", false, P.code, true);
        setTimeout(() => { if (out) out.textContent = P.output + (P.error ? ("\nError: " + P.error) : ""); }, 0);
      } catch (e) { P.error = String(e); if (out) out.textContent = "Error: " + P.error; }
    } else {
      let buf = "";
      try { pyFallback(P.code, (s) => { buf += s; }); P.output = buf; }
      catch (e) { P.error = String(e && e.message ? e.message : e); }
      if (out) out.textContent = buf + (P.error ? ("\nError: " + P.error) : "");
    }
  }
  // 轻量 Python 子集求值器（无 Skulpt 时可用）：print / 赋值 / for-range / if / 算术 / 常用内置
  function pyFallback(src, outf) {
    const raw = src.replace(/\t/g, "    ").split("\n").map((l) => l.replace(/\r$/, ""));
    const env = {};
    const __range = (a, b, c) => { if (b === undefined) { b = a; a = 0; c = 1; } if (c === undefined) c = 1; const r = []; if (c > 0) { for (let i = a; i < b; i += c) r.push(i); } else { for (let i = a; i > b; i += c) r.push(i); } return r; };
    function exprVal(s) {
      s = String(s).trim();
      s = s.replace(/True/g, "true").replace(/False/g, "false").replace(/None/g, "null").replace(/\brange\b/g, "__range");
      // Python 的 // 整数除法 → __fdiv（避免被 JS 当成行注释）
      let prev;
      do { prev = s; s = s.replace(/(\S+)\s*\/\/\s*(\S+)/g, "__fdiv($1,$2)"); } while (s !== prev && s.indexOf("//") >= 0);
      const f = new Function("__range", "__fdiv", "abs", "min", "max", "int", "float", "str", "len", "with(this){ return (" + s + "); }");
      return f.call(env, __range, (a, b) => Math.floor(a / b), Math.abs, Math.min, Math.max, (x) => parseInt(x, 10), parseFloat, String, (x) => (x && x.length) || 0);
    }
    function run(lines, startIndent) {
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) { i++; continue; }
        const indent = line.search(/\S/);
        if (indent < startIndent) break;
        if (indent > startIndent) { i++; continue; }
        const content = line.trim();
        if (content.charAt(0) === "#") { i++; continue; }
        let m;
        if ((m = content.match(/^print\((.*)\)$/s))) { try { outf(String(exprVal(m[1])) + "\n"); } catch (e) { outf("Error: " + e + "\n"); } i++; continue; }
        if ((m = content.match(/^(\w+)\s*=\s*(.+)$/))) { try { env[m[1]] = exprVal(m[2]); } catch (e) { outf("Error: " + e + "\n"); } i++; continue; }
        if ((m = content.match(/^for\s+(\w+)\s+in\s+(.+):$/))) {
          let iter = []; try { iter = exprVal(m[2]); } catch (e) { outf("Error: " + e + "\n"); }
          const varName = m[1], body = []; let j = i + 1;
          while (j < lines.length && lines[j].search(/\S/) > indent) { body.push(lines[j]); j++; }
          const bodyIndent = body.length ? body[0].search(/\S/) : indent + 4;
          iter.forEach((v) => { env[varName] = v; run(body, bodyIndent); });
          i = j; continue;
        }
        if ((m = content.match(/^if\s+(.+):$/))) {
          let cond = false; try { cond = !!exprVal(m[1]); } catch (e) {}
          const body = []; let j = i + 1;
          while (j < lines.length && lines[j].search(/\S/) > indent) { body.push(lines[j]); j++; }
          const bodyIndent = body.length ? body[0].search(/\S/) : indent + 4;
          if (cond) run(body, bodyIndent);
          i = j; continue;
        }
        i++;
      }
    }
    run(raw, 0);
    return "";
  }

  // ============================================================
  //  Vernier DataQuest 应用（模拟采集，无真实传感器）
  // ============================================================
  function defaultVernier() { return { samples: [], collecting: false }; }
  function renderVernier() {
    const V = S.vernier;
    lcd.innerHTML = `<div class="vernier-view">
      <div class="app-bar">
        <span class="app-title">Vernier DataQuest</span>
        <button class="gbtn" data-gact="collect">采集 Collect</button>
        <button class="gbtn" data-gact="reset">Reset</button>
        <button class="gbtn" data-gact="home">home</button>
      </div>
      <div class="vernier-note">（浏览器无真实传感器，以下为模拟数据）</div>
      <canvas id="vernier-canvas" class="vernier-canvas"></canvas>
      <div class="vernier-stat" id="vernier-stat"></div>
    </div>`;
    lcd.querySelectorAll("[data-gact]").forEach((el) => el.addEventListener("click", () => {
      const a = el.getAttribute("data-gact");
      if (a === "home") return openApp("home");
      if (a === "reset") { V.samples = []; drawVernier(); return; }
      if (a === "collect") return vernierCollect();
    }));
    drawVernier();
  }
  function vernierSample(i) { return Math.round((Math.sin(i / 3) * 8 + (i % 2 ? 1.2 : -1.2) + 10) * 100) / 100; }
  function vernierCollect() { const V = S.vernier; V.samples.push(vernierSample(V.samples.length)); drawVernier(); }
  function drawVernier() {
    const canvas = document.getElementById("vernier-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return;
    const V = S.vernier, W = 540, H = 300; canvas.width = W; canvas.height = H;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    const st = document.getElementById("vernier-stat");
    if (V.samples.length) {
      const ys = V.samples, min = Math.min(...ys), max = Math.max(...ys);
      const sy = H / (max - min || 1), pad = 20;
      ctx.strokeStyle = "#2e9e4f"; ctx.lineWidth = 2; ctx.beginPath();
      ys.forEach((y, i) => { const px = pad + (W - 2 * pad) * i / (ys.length - 1 || 1); const py = H - pad - (y - min) * sy; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); });
      ctx.stroke();
      if (st) st.textContent = `n=${ys.length}  min=${round2(min)}  max=${round2(max)}  last=${round2(ys[ys.length - 1])}`;
    }
  }

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
    // 暴露内部接口供测试 / 调试（无害）
    window.__nspire = {
      graphEval: graphEval,
      getState: function () { return S; },
      drawGraph: drawGraph,
    };
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
