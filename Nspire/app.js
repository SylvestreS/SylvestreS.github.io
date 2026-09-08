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
    if (S.currentApp === "graphs") return renderGraphs();
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

    // 其它占位应用
    if (mod === "del") return;
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
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (e.key === "Escape" || e.key === "Home") return openApp("home");

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
