/* ============================================================
   TI BA II PLUS 模拟器
   状态机：标准计算 / TVM / 现金流 / 摊销 / 债券 / 设置
   ============================================================ */

/* ---------- 按键布局（5 列 · 与真机一致） ---------- */
const LAYOUT = [
  // Row 1: 顶行（双行标签：主功能 + 黄色 2nd 功能同印在键上）
  [
    { id: "QUIT", label: "QUIT", snd: "CPT", cls: "two-line" },
    { id: "SET", label: "SET", snd: "ENTER", cls: "two-line" },
    { id: "UP", label: "\u2191", snd: "DEL", cls: "two-line" },
    { id: "DOWN", label: "\u2193", snd: "INS", cls: "two-line" },
    { id: "ON", label: "ON", snd: "OFF", cls: "two-line" },
  ],
  // Row 2: 2nd + CF / NPV / IRR / →（2nd 是奶黄键）
  [
    { id: "2nd", label: "2nd", cls: "snd-key" },
    { id: "CF", label: "CF" },
    { id: "NPV", label: "NPV" },
    { id: "IRR", label: "IRR" },
    { id: "RIGHT", label: "\u2192", cls: "arrow" },
  ],
  // Row 3: TVM（键上方黄色 2nd 标签印在机身上）
  [
    { id: "N", label: "N", snd: "xP/Y", cls: "tvm" },
    { id: "IY", label: "I/Y", snd: "P/Y", cls: "tvm" },
    { id: "PV", label: "PV", snd: "AMORT", cls: "tvm" },
    { id: "PMT", label: "PMT", snd: "BGN", cls: "tvm" },
    { id: "FV", label: "FV", snd: "CLR TVM", cls: "tvm" },
  ],
  // Row 4: 数学（深键，键上方 2nd 标签）
  [
    { id: "POW", label: "y\u02e3", snd: "K" },
    { id: "PCT", label: "%", snd: "\u221ax" },
    { id: "SQR", label: "x\u00b2", snd: "HYP" },
    { id: "INV", label: "1/x", snd: "INV" },
    { id: "DIV", label: "\u00f7", snd: "RAND", cls: "op" },
  ],
  // Row 5: 更多数学
  [
    { id: "INVHYP", label: "INV" },
    { id: "LPAR", label: "(", snd: "e\u02e3" },
    { id: "RPAR", label: ")", snd: "LN" },
    { id: "STO", label: "STO", snd: "ROUND" },
    { id: "MUL", label: "\u00d7", snd: "STAT", cls: "op" },
  ],
  // Row 6: 7 8 9 −
  [
    { id: "DATE", label: "DATE", snd: "STO" },
    { id: "7", label: "7", cls: "digit" },
    { id: "8", label: "8", cls: "digit" },
    { id: "9", label: "9", cls: "digit" },
    { id: "SUB", label: "\u2212", snd: "nPr", cls: "op" },
  ],
  // Row 7: 4 5 6 +
  [
    { id: "BOND", label: "BOND", snd: "RCL" },
    { id: "4", label: "4", cls: "digit" },
    { id: "5", label: "5", cls: "digit" },
    { id: "6", label: "6", cls: "digit" },
    { id: "ADD", label: "+", snd: "nCr", cls: "op" },
  ],
  // Row 8: 1 2 3 =（= 占两行）
  [
    { id: "CEC", label: "CE|C", snd: "CLR WORK" },
    { id: "1", label: "1", cls: "digit" },
    { id: "2", label: "2", cls: "digit" },
    { id: "3", label: "3", cls: "digit" },
    { id: "EQ", label: "=", snd: "ANS", cls: "tall op" },
  ],
  // Row 9: 0 . +/−（= 跨到这一行）
  [
    { id: "MEM", label: "MEM", snd: "FORMAT" },
    { id: "0", label: "0", cls: "digit" },
    { id: "DOT", label: ".", cls: "digit" },
    { id: "PM", label: "+/\u2212", cls: "digit" },
    { blank: true },
  ],
];

/* ---------- 状态 ---------- */
const S = {
  on: true,
  entry: null,
  cur: 0,
  label: "",
  ext: "",
  snd: false,
  cpt: false,
  decimals: 2,
  tvm: { N: null, IY: null, PV: null, PMT: null, FV: null },
  py: 12,
  cy: 12,
  bgn: false,
  mem: Array(10).fill(0),
  expr: "",
  lastAns: 0,
  mode: "std",
  cf: { c0: 0, list: [] },
  cfPos: -1,
  cfSub: "cf",
  cfRate: null,
  am: { p1: 1, p2: 1, bal: null, prn: null, int: null },
  amPos: 0,
  bond: { cpn: null, yld: null, pri: null, n: null, f: 2 },
  bdPos: 0,
  pyPos: 0,
  // DATE 工作表：ACT 实际天数 / 360 三十日法；M.DDYY 输入
  date: { method: "act", d1: null, d2: null, dbd: null, pos: 0 },
  // DEPR 工作表：method 1=SL 2=SYD 3=DB(200%)，输出 DEP 与 RDV
  dep: { method: 1, lif: null, cst: null, sal: null, yr: 1, dep: null, rdv: null },
  depPos: 0,
  err: false,
};

const $ = (s) => document.querySelector(s);
const REG_KEYS = [
  ["N", "N"], ["I/Y", "IY"], ["PV", "PV"], ["PMT", "PMT"], ["FV", "FV"],
];

/* ---------- 数值格式化 ---------- */
function fmt(x) {
  if (x === null || x === undefined) return "0";
  if (!isFinite(x)) return "Error";
  const a = Math.abs(x);
  let s;
  if (a !== 0 && (a >= 1e10 || a < 1e-9)) {
    s = x.toExponential(5);
    s = s.replace(/e([+-])(\d)$/, "e$10$2").replace(/\.?0+e/, "e");
  } else {
    s = x.toFixed(S.decimals);
    if (s === "-0" || Object.is(parseFloat(s), -0)) s = s.slice(1);
  }
  return s.length > 12 ? x.toExponential(5).replace(/\.?0+e/, "e") : s;
}

function shownValue() {
  if (S.entry !== null) return S.entry;
  // DATE 工作表的 DT1/DT2 字段用 M.DDYY 格式显示
  if (S.mode === "date" && (S.date.pos === 1 || S.date.pos === 2)) {
    const d = S.date.pos === 1 ? S.date.d1 : S.date.d2;
    if (d) return formatMddyy(d);
  }
  return fmt(S.cur);
}

function currentNum() {
  return S.entry !== null ? parseFloat(S.entry) || 0 : S.cur;
}

/* ---------- TVM 求解 ---------- */

// 每期实际利率：名义年利率 IY% 按 C/Y 复利，再换算到 P/Y 的付款周期
function periodRate() {
  const iy = S.tvm.IY === null ? 0 : S.tvm.IY;
  const cy = S.cy || 1;
  const py = S.py || 1;
  const eff = Math.pow(1 + iy / (100 * cy), cy / py) - 1;
  return eff;
}

// 年金现值因子；i=0 时退化为 N
function annuity(i, n, g) {
  if (n === 0) return 0;
  if (Math.abs(i) < 1e-14) return n;
  const v = Math.pow(1 + i, -n);
  return (1 - v) / i * (1 + i * g);
}

// TVM 方程残差：PV + PMT*factor + FV*v^n = 0
function tvmResidual(i) {
  const n = S.tvm.N === null ? 0 : S.tvm.N;
  const pv = S.tvm.PV || 0;
  const pmt = S.tvm.PMT || 0;
  const fv = S.tvm.FV || 0;
  const v = Math.pow(1 + i, -n);
  return pv + pmt * annuity(i, n, S.bgn ? 1 : 0) + fv * v;
}

function solveTVM(target) {
  const t = S.tvm;
  const n = t.N, iy = t.IY, pv = t.PV, pmt = t.PMT, fv = t.FV;

  // 求 N
  if (target === "N") {
    if (iy === null) return errOut();
    const i = periodRate();
    if (pmt === null || pmt === 0) {
      if (pv === null || fv === null || pv === 0 || fv === 0) return errOut();
      const x = -pv / fv;
      if (x <= 0) return errOut();
      return -Math.log(x) / Math.log(1 + i);
    }
    const g = S.bgn ? 1 : 0;
    if (Math.abs(i) < 1e-14) {
      const x = -(pv + fv) / pmt;
      return isFinite(x) && x > 0 ? x : errOut();
    }
    const k = pmt * (1 + i * g) / i;
    const denom = fv - k;
    const numer = -(pv + k);
    if (denom === 0) return errOut();
    const x = numer / denom;
    if (!(x > 0)) return errOut();
    return -Math.log(x) / Math.log(1 + i);
  }

  // 求 I/Y：扫描找符号变化区间，再二分（见 solveIY）
  if (target === "IY") {
    if (n === null || n === 0) return errOut();
    if ((pv === null || pv === 0) && (pmt === null || pmt === 0)) return errOut();
    if ((fv === null || fv === 0) && (pmt === null || pmt === 0)) return errOut();
    return solveIY();
  }

  const i = iy === null ? 0 : periodRate();
  const n2 = n === null ? 0 : n;
  const v = Math.pow(1 + i, -n2);
  const A = annuity(i, n2, S.bgn ? 1 : 0);

  if (target === "PV") {
    if (n === null) return errOut();
    return -((pmt || 0) * A + (fv || 0) * v);
  }
  if (target === "FV") {
    if (n === null) return errOut();
    return -((pv || 0) + (pmt || 0) * A) / v;
  }
  if (target === "PMT") {
    if (n === null) return errOut();
    if (A === 0) return errOut();
    return -((pv || 0) + (fv || 0) * v) / A;
  }
  return errOut();
}

// 求每期利率：先在常用区间扫描符号变化，再二分收敛
function solveIY() {
  const f = tvmResidual;
  let prev = null, prevX = null;
  const scan = (from, to, step) => {
    for (let x = from; x <= to; x += step) {
      const v = f(x);
      if (!isFinite(v)) { prev = null; continue; }
      if (Math.abs(v) < 1e-13) return { exact: x };
      if (prev !== null && prev * v < 0) return { lo: prevX, hi: x };
      prev = v; prevX = x;
    }
    return null;
  };
  let r = scan(-0.9999, 5, 0.001);
  if (!r) { prev = null; prevX = null; r = scan(5, 1000, 0.05); }
  if (!r) return errOut();

  let per;
  if (r.exact !== undefined) {
    per = r.exact;
  } else {
    let a = r.lo, b = r.hi, fa = f(a);
    for (let i = 0; i < 200; i++) {
      const m = (a + b) / 2, fm = f(m);
      if (!isFinite(fm)) break;
      if (Math.abs(fm) < 1e-14) { a = b = m; break; }
      if (fa * fm <= 0) b = m; else { a = m; fa = fm; }
    }
    per = (a + b) / 2;
  }
  const cy = S.cy || 1, py = S.py || 1;
  return (Math.pow(1 + per, py / cy) - 1) * cy * 100;
}

function errOut() {
  S.err = true;
  return NaN;
}

/* ---------- 现金流 ---------- */
function cfFlows() {
  const out = [S.cf.c0];
  S.cf.list.forEach((g) => {
    for (let i = 0; i < (g.f || 1); i++) out.push(g.c);
  });
  return out;
}

function npvAt(rate) {
  const flows = cfFlows();
  let sum = 0;
  for (let t = 0; t < flows.length; t++) sum += flows[t] / Math.pow(1 + rate, t);
  return sum;
}

function solveIRR() {
  const flows = cfFlows();
  if (flows.length < 2) return errOut();
  const signs = new Set(flows.map((f) => Math.sign(f)).filter((s) => s !== 0));
  if (signs.size < 2) return errOut();

  const f = (r) => {
    let s = 0;
    for (let t = 0; t < flows.length; t++) s += flows[t] / Math.pow(1 + r, t);
    return s;
  };

  let found = null;
  // 扫描找符号变化
  let prev = null, prevX = null;
  for (let k = 0; k <= 2000; k++) {
    const r = -0.999 + k * 0.001;
    if (r > 10) break;
    const v = f(r);
    if (!isFinite(v)) { prev = null; continue; }
    if (signs.has(1) && Math.abs(v) < 1e-10) { found = r; break; }
    if (prev !== null && ((prev < 0 && v > 0) || (prev > 0 && v < 0))) {
      let a = prevX, b = r, fa = prev, fb = v;
      for (let it = 0; it < 300; it++) {
        const m = (a + b) / 2, fm = f(m);
        if (!isFinite(fm)) break;
        if (Math.abs(fm) < 1e-13) { a = b = m; break; }
        if (fa * fm <= 0) { b = m; fb = fm; } else { a = m; fa = fm; }
      }
      found = (a + b) / 2;
      break;
    }
    prev = v; prevX = r;
  }
  if (found === null) {
    // 大范围再扫
    let prev2 = null, prevX2 = null;
    for (let k = 1; k <= 400; k++) {
      const r = k * 0.05;
      const v = f(r);
      if (!isFinite(v)) { prev2 = null; continue; }
      if (prev2 !== null && ((prev2 < 0 && v > 0) || (prev2 > 0 && v < 0))) {
        let a = prevX2, b = r, fa = prev2, fb = v;
        for (let it = 0; it < 300; it++) {
          const m = (a + b) / 2, fm = f(m);
          if (!isFinite(fm)) break;
          if (Math.abs(fm) < 1e-13) { a = b = m; break; }
          if (fa * fm <= 0) { b = m; fb = fm; } else { a = m; fa = fm; }
        }
        found = (a + b) / 2;
        break;
      }
      prev2 = v; prevX2 = r;
    }
  }
  if (found === null) return errOut();
  return found * 100;
}

/* ---------- 摊销 ---------- */
// 摊销：逐期递推。PV 为正（借入），PMT 为负（偿还）
// 每期利息 = 余额 × i，本金偿还 = |PMT| − 利息，余额递减
function amortize(p1, p2) {
  const t = S.tvm;
  if (t.N === null || t.PMT === null || t.PV === null) return null;
  const i = periodRate();
  const n = t.N, pmt = t.PMT;
  let bal = t.PV;
  let prn = 0, int = 0;
  const end = Math.min(Math.max(p2, 1), Math.round(n));
  const from = Math.max(p1, 1);
  for (let k = 1; k <= end; k++) {
    if (S.bgn) bal = bal + pmt;      // 期初付款：先扣款，再计息
    const ik = bal * i;
    const pk = -pmt - ik;
    if (k >= from) { prn += pk; int += ik; }
    bal = bal - pk;
    if (S.bgn) bal = bal - pmt;      // 还原到下期期初口径
  }
  return { bal: bal, prn: prn, int: int };
}

/* ---------- 债券 ---------- */
function bondPrice(cpn, yld, n, f, rv) {
  const c = cpn / 100 / f * rv;
  let p = 0;
  for (let k = 1; k <= n * f; k++) p += c / Math.pow(1 + yld / 100 / f, k);
  p += rv / Math.pow(1 + yld / 100 / f, n * f);
  return p;
}

function bondYield(cpn, pri, n, f, rv) {
  let lo = -0.99, hi = 2;
  const g = (y) => bondPrice(cpn, y * 100, n, f, rv) - pri;
  if (g(lo) * g(hi) > 0) {
    lo = -0.99; hi = 5;
    if (g(lo) * g(hi) > 0) return errOut();
  }
  for (let i = 0; i < 300; i++) {
    const m = (lo + hi) / 2;
    if (g(lo) * g(m) <= 0) hi = m; else lo = m;
  }
  return (lo + hi) / 2 * 100;
}

/* ---------- 日期（DATE 工作表） ---------- */
// 解析 M.DDYY 格式：月.日年(2位)。年份约定：00–49 → 20xx，50–99 → 19xx
function parseMddyy(s) {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  const m = t.match(/^(\d{1,2})\.(\d{0,4})$/);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  let rest = m[2];
  if (rest.length === 0) rest = "01";  // 仅月份：日默认 1
  if (rest.length < 4) rest = rest.padEnd(4, "0");
  const day = parseInt(rest.slice(0, 2), 10);
  const yy = parseInt(rest.slice(2, 4), 10);
  const year = yy < 50 ? 2000 + yy : 1900 + yy;
  if (month < 1 || month > 12) return null;
  if (!validYmd(year, month, day)) return null;
  return { y: year, m: month, d: day };
}

function validYmd(y, m, d) {
  if (m < 1 || m > 12 || d < 1) return false;
  const dim = [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= dim[m - 1];
}

function leap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function formatMddyy(d) {
  if (!d) return "0";
  const yy = d.y % 100;
  return `${d.m}.${String(d.d).padStart(2, "0")}${String(yy).padStart(2, "0")}`;
}

// 格里高利历 → 儒略日
function jdn({ y, m, d }) {
  const a = Math.floor((14 - m) / 12);
  const yr = y + 4800 - a;
  const mo = m + 12 * a - 3;
  return d + Math.floor((153 * mo + 2) / 5) + 365 * yr
    + Math.floor(yr / 4) - Math.floor(yr / 100) + Math.floor(yr / 400) - 32045;
}

// 实际天数（ACT）或 30/360 法（method="360"）
function daysBetween(d1, d2, method) {
  if (method === "360") {
    let dd1 = d1.d, dd2 = d2.d;
    if (dd1 === 31) dd1 = 30;
    if (dd2 === 31 && dd1 === 30) dd2 = 30;
    return (d2.y - d1.y) * 360 + (d2.m - d1.m) * 30 + (dd2 - dd1);
  }
  return jdn(d2) - jdn(d1);
}

/* ---------- 折旧（DEPR 工作表） ---------- */
// method 1=SL 2=SYD 3=DB(200% DB)；返回 { dep, bv, rdv }
function deprCalc(method, lif, cst, sal, yr) {
  if (lif === null || cst === null || sal === null) return null;
  if (yr === null || yr < 1 || yr > lif) return null;
  if (sal > cst) return null;
  if (method === 1) {
    // 直线法：每期等额
    const annual = (cst - sal) / lif;
    const bv = cst - annual * yr;
    return { dep: annual, bv, rdv: bv - sal };
  }
  if (method === 2) {
    // 年数总和法
    const sum = lif * (lif + 1) / 2;
    const dep = (cst - sal) * (lif - yr + 1) / sum;
    let cum = 0;
    for (let k = 1; k < yr; k++) cum += (cst - sal) * (lif - k + 1) / sum;
    const bv = cst - cum - dep;
    return { dep, bv, rdv: bv - sal };
  }
  if (method === 3) {
    // 200% 余额递减：rate=2/life；若余额扣减会跌破残值，则本期只扣到残值
    const rate = 2 / lif;
    let book = cst;
    let dep = 0;
    for (let k = 1; k <= yr; k++) {
      let d = book * rate;
      if (book - d < sal) d = Math.max(0, book - sal);
      book -= d;
      if (k === yr) { dep = d; }
    }
    return { dep, bv: book, rdv: book - sal };
  }
  return null;
}

/* ---------- 表达式求值（AOS，支持优先级与括号） ---------- */
function evalExpr(src) {
  let i = 0;
  const peek = () => src[i];
  function parseExpr() {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = src[i++];
      const r = parseTerm();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function parseTerm() {
    let v = parseUnary();
    while (peek() === "*" || peek() === "/") {
      const op = src[i++];
      const r = parseUnary();
      if (op === "*") v = v * r;
      else { if (r === 0) throw new Error("div0"); v = v / r; }
    }
    return v;
  }
  function parseUnary() {
    if (peek() === "-") { i++; return -parseUnary(); }
    if (peek() === "+") { i++; return parseUnary(); }
    return parsePower();
  }
  function parsePower() {
    const base = parseAtom();
    if (peek() === "^") { i++; const e = parseUnary(); return Math.pow(base, e); }
    return base;
  }
  function parseAtom() {
    if (peek() === "(") {
      i++;
      const v = parseExpr();
      if (peek() === ")") i++;
      return v;
    }
    let s = "";
    while (i < src.length && /[0-9.]/.test(src[i])) s += src[i++];
    if (!s) throw new Error("bad");
    return parseFloat(s);
  }
  const r = parseExpr();
  return r;
}

/* ---------- 显示 ---------- */
function render() {
  $("#lcd-value").textContent = S.on ? shownValue() : "";
  $("#lcd-label").textContent = S.on ? S.label : "";
  $("#lcd-value").parentElement.classList.toggle("off", !S.on);

  document.querySelectorAll(".ind").forEach((el) => {
    const k = el.dataset.ind;
    const on =
      (k === "2nd" && S.snd) || (k === "cpt" && S.cpt) ||
      (k === "bgn" && S.bgn) || (k === "err" && S.err);
    el.classList.toggle("on", !!on);
  });

  const modes = {
    std: "TVM / 标准计算", cf: "现金流工作表", npv: "NPV", irr: "IRR",
    amort: "摊销工作表 AMORT", bond: "债券工作表 BOND", pyset: "P/Y · C/Y 设置",
    date: "日期工作表 DATE", depr: "折旧工作表 DEPR",
  };
  const ml = $("#mode-line");
  if (ml) ml.textContent = S.on ? (modes[S.mode] || "") : "OFF";

  // 寄存器面板
  const regs = REG_KEYS.map(([lab, key]) => {
    const v = S.tvm[key];
    return `<div class="reg ${v !== null ? "set" : ""}"><span>${lab}</span><span>${v === null ? "\u2014" : fmt(v)}</span></div>`;
  }).join("");
  $("#regs").innerHTML = regs +
    `<div class="reg set"><span>P/Y</span><span>${S.py}</span></div>` +
    `<div class="reg set"><span>C/Y</span><span>${S.cy}</span></div>` +
    `<div class="reg"><span>付款时点</span><span>${S.bgn ? "BGN 期初" : "END 期末"}</span></div>`;

  // 现金流视图
  if (S.cf.list.length || S.cf.c0 !== 0) {
    const lines = [`CF0 = ${fmt(S.cf.c0)}`];
    S.cf.list.slice(0, 12).forEach((g, i) => {
      lines.push(`C${String(i + 1).padStart(2, "0")} = ${fmt(g.c)}  F${String(i + 1).padStart(2, "0")} = ${g.f || 1}`);
    });
    if (S.cf.list.length > 12) lines.push(`\u2026 还有 ${S.cf.list.length - 12} 组`);
    $("#cf-view").textContent = lines.join("\n");
  } else {
    $("#cf-view").textContent = "";
  }
}

/* ---------- 输入辅助 ---------- */
function setDisplay(v, label) {
  S.entry = null;
  S.cur = v;
  if (label !== undefined) S.label = label;
}
function clearEntry() {
  S.entry = null;
  S.cur = 0;
}

/* ---------- 工作表导航 ---------- */
function cfFieldName() {
  if (S.cfPos < 0) return "CF0";
  return S.cfSub === "cf" ? `C${String(S.cfPos + 1).padStart(2, "0")}` : `F${String(S.cfPos + 1).padStart(2, "0")}`;
}
function cfFieldValue() {
  if (S.cfPos < 0) return S.cf.c0;
  const g = S.cf.list[S.cfPos];
  if (!g) return 0;
  return S.cfSub === "cf" ? g.c : (g.f || 1);
}
function cfEnsure() {
  if (S.cfPos >= 0 && !S.cf.list[S.cfPos]) S.cf.list[S.cfPos] = { c: 0, f: 1 };
}

function enterCfMode() {
  S.mode = "cf";
  S.cfPos = -1;
  S.cfSub = "cf";
  setDisplay(S.cf.c0, "CF0=");
}

function enterDateMode() {
  S.mode = "date";
  S.date.pos = 0;
  dateShowField();
}

function dateShowField() {
  if (S.date.pos === 0) {
    S.label = S.date.method === "act" ? "ACT" : "360";
    S.cur = S.date.method === "act" ? 1 : 2;
  } else if (S.date.pos === 1) {
    S.label = "DT1=";
    S.cur = 0;
  } else if (S.date.pos === 2) {
    S.label = "DT2=";
    S.cur = 0;
  } else {
    S.label = "DBD=";
    S.cur = S.date.dbd || 0;
  }
}

function enterDeprMode() {
  S.mode = "depr";
  S.depPos = 0;
  deprShowField();
}

function deprShowField() {
  // pos 0: 方法（SL/SYD/DB）；pos 1-4: 输入字段；pos 5-6: 输出字段
  const methodLabels = ["SL", "SYD", "DB"];
  const inLabels = ["LIF=", "CST=", "SAL=", "YR="];
  const inKeys = ["lif", "cst", "sal", "yr"];
  const outLabels = ["DEP=", "RDV="];
  const outKeys = ["dep", "rdv"];
  if (S.depPos === 0) {
    S.label = methodLabels[S.dep.method - 1] + "=";
    S.cur = S.dep.method;
  } else if (S.depPos >= 1 && S.depPos <= 4) {
    S.label = inLabels[S.depPos - 1];
    S.cur = S.dep[inKeys[S.depPos - 1]] === null ? 0 : S.dep[inKeys[S.depPos - 1]];
  } else {
    const idx = S.depPos - 5;
    S.label = outLabels[idx];
    S.cur = S.dep[outKeys[idx]] === null ? 0 : S.dep[outKeys[idx]];
  }
}

/* ---------- 按键分发 ---------- */
function press(id) {
  if (!S.on && id !== "ONOFF" && id !== "ON") return;
  S.err = false;

  // 真机上 ENTER 是 SET 键的 2nd 功能；这里也允许直接 press("ENTER")
  if (id === "ENTER") id = "SET";
  // 真机上 CPT 是 QUIT 键的 2nd 功能；这里也允许直接 press("CPT")
  // CPT 的逻辑保持原样，press("CPT") 直接进入 CPT 等待态
  if (id === "ONOFF") id = "ON";

  const second = S.snd;
  S.snd = false;

  if (second) { pressSnd(id); render(); return; }
  pressMain(id);
  render();
}

function pressMain(id) {
  // CPT 之后按变量键 = 求解
  if (S.cpt) {
    S.cpt = false;
    const map = { N: "N", IY: "IY", PV: "PV", PMT: "PMT", FV: "FV" };
    if (map[id]) {
      const r = solveTVM(map[id]);
      setDisplay(isNaN(r) ? 0 : r, `${id === "IY" ? "I/Y" : id}=`);
      if (!isNaN(r)) S.tvm[map[id]] = r;
      return;
    }
    if (S.mode === "npv" && id === "NPV") return;
    if (S.mode === "irr" && id === "IRR") return;
    if (S.mode === "amort") {
      const f = ["bal", "prn", "int"][S.amPos - 2];
      if (f) {
        const r = amortize(S.am.p1, S.am.p2);
        if (!r) { S.err = true; return; }
        setDisplay(r[f], `${f.toUpperCase()}=`);
        return;
      }
    }
    if (S.mode === "bond") {
      const b = S.bond;
      if (b.pri === null && b.yld !== null && b.cpn !== null && b.n !== null) {
        const p = bondPrice(b.cpn, b.yld, b.n, b.f || 2, 100);
        setDisplay(p, "PRI=");
        S.bond.pri = p;
      } else if (b.yld === null && b.pri !== null && b.cpn !== null && b.n !== null) {
        const y = bondYield(b.cpn, b.pri, b.n, b.f || 2, 100);
        setDisplay(y, "YLD=");
        S.bond.yld = y;
      }
      return;
    }
    return;
  }

  // 数字与小数点
  if (/^[0-9]$/.test(id)) {
    if (S.entry === null) {
      S.entry = id;
      if (S.mode === "std") S.label = "";   // 开始新输入时清掉上一次的变量标签
    } else if (S.entry === "0") {
      S.entry = id;
    } else if (S.entry.length < 14) {
      S.entry += id;
    }
    return;
  }
  if (id === "DOT") {
    if (S.entry === null) S.entry = "0.";
    else if (!S.entry.includes(".")) S.entry += ".";
    return;
  }
  if (id === "PM") {
    if (S.entry !== null) S.entry = S.entry.startsWith("-") ? S.entry.slice(1) : "-" + S.entry;
    else S.cur = -S.cur;
    return;
  }

  // TVM 变量键：存入当前值
  if (["N", "IY", "PV", "PMT", "FV"].includes(id)) {
    const v = currentNum();
    S.tvm[id] = v;
    S.entry = null;
    S.cur = v;
    S.label = `${id === "IY" ? "I/Y" : id}=`;
    if (S.mode === "std" || S.mode === "amort") S.mode = "std";
    return;
  }

  switch (id) {
    case "2nd":
      S.snd = true;
      return;
    case "CPT":
      // 标准模式下 CPT 等待变量键；工作表里 CPT 直接算当前字段（与真机一致）
      if (S.mode === "std") { S.cpt = true; return; }
      doEquals();
      return;
    case "ENTER":
      if (S.entry !== null) {
        const v = currentNum();
        commitEnter(v);
      } else if (S.mode === "bond") {
        commitEnter(S.cur);
      }
      return;
    case "CEC":
      if (S.entry !== null) S.entry = null;
      else { S.cur = 0; S.label = ""; S.expr = ""; }
      if (S.mode === "cf") setDisplay(cfFieldValue(), cfFieldName() + "=");
      return;
    case "UP":
      nav(-1);
      return;
    case "DOWN":
      nav(1);
      return;
    case "CF":
      enterCfMode();
      return;
    case "NPV":
      S.mode = "npv";
      setDisplay(S.cfRate === null ? 0 : S.cfRate, "I=");
      return;
    case "IRR":
      S.mode = "irr";
      setDisplay(0, "IRR=");
      return;
    case "ADD": case "SUB": case "MUL": case "DIV": case "POW": {
      // 只有确实有值才拼进表达式；刚按过 ) 或数字时值已在其内，补 0 会算错
      if (S.entry !== null) { S.expr += S.entry; S.entry = null; }
      else if (S.expr === "" || /[+\-*/^(]$/.test(S.expr)) S.expr += String(S.cur);
      S.expr += ({ ADD: "+", SUB: "-", MUL: "*", DIV: "/", POW: "^" })[id];
      S.cur = 0;
      S.label = "";
      return;
    }
    case "LPAR":
      S.expr += "(";
      S.entry = null;
      return;
    case "RPAR":
      if (S.entry !== null) { S.expr += S.entry; S.entry = null; }
      S.expr += ")";
      return;
    case "EQ":
      doEquals();
      return;
    case "PCT":
      S.cur = currentNum() / 100;
      S.entry = null;
      return;
    case "SQRT":
      S.cur = Math.sqrt(currentNum());
      S.entry = null;
      return;
    case "SQR":
      S.cur = Math.pow(currentNum(), 2);
      S.entry = null;
      return;
    case "INV": {
      const v = currentNum();
      if (v === 0) { S.err = true; return; }
      S.cur = 1 / v;
      S.entry = null;
      return;
    }
    case "LN": {
      const v = currentNum();
      if (v <= 0) { S.err = true; return; }
      S.cur = Math.log(v);
      S.entry = null;
      return;
    }
    case "STO": {
      const k = Math.round(currentNum());
      if (k >= 0 && k <= 9) S.mem[k] = S.cur;
      S.entry = null;
      return;
    }
    case "RCL": {
      const k = Math.round(currentNum());
      S.cur = S.mem[k] || 0;
      S.entry = null;
      return;
    }
    // 顶行 / 右移 / 工作表入口的桩
    case "QUIT":
      S.entry = null;
      S.label = "";
      S.expr = "";
      S.cur = 0;
      S.mode = "std";
      return;
    case "SET":
      commitEnter(currentNum());
      return;
    case "ON":
      S.on = !S.on;
      return;
    case "RIGHT":
      // 工作表里当 ENTER 用
      commitEnter(currentNum());
      return;
    case "INVHYP":
      // 真机上作为下个运算的逆运算；这里简化为 1/x
      S.cur = S.cur !== 0 ? 1 / S.cur : 0;
      S.entry = null;
      return;
    case "DATE":
      enterDateMode();
      return;
    case "MEM":
    case "FORMAT":
    case "ANS":
      S.label = "工作表开发中";
      return;
    case "BOND":
      S.mode = "bond";
      S.bdPos = 0;
      setDisplay(S.bond.cpn || 0, "CPN=");
      return;
  }
}

function commitEnter(v) {
  // 在清 S.entry 之前先保留原文：DATE 工作表需要用 M.DDYY 这种带小数点的字符串
  const hadEntry = S.entry !== null;
  const rawEntry = S.entry;
  S.entry = null;
  S.cur = v;
  if (S.mode === "cf") {
    if (S.cfPos < 0) {
      if (S.cfSub === "cf") S.cf.c0 = v;
    } else {
      cfEnsure();
      const g = S.cf.list[S.cfPos];
      if (S.cfSub === "cf") g.c = v; else g.f = Math.max(1, Math.round(v));
    }
    // 回车后自动前进到下一字段（真机行为）
    nav(1);
    return;
  }
  if (S.mode === "npv") {
    S.cfRate = v;
    S.mode = "npv";
    setDisplay(0, "NPV=");
    return;
  }
  if (S.mode === "pyset") {
    if (S.pyPos === 0) S.py = v || 1; else S.cy = v || 1;
    setDisplay(S.pyPos === 0 ? S.py : S.cy, `${S.pyPos === 0 ? "P/Y" : "C/Y"}=`);
    return;
  }
  if (S.mode === "amort") {
    if (S.amPos === 0) S.am.p1 = Math.max(1, Math.round(v));
    if (S.amPos === 1) S.am.p2 = Math.max(S.am.p1, Math.round(v));
    nav(1);
    return;
  }
  if (S.mode === "bond") {
    const key = ["cpn", "yld", "pri", "n", "f"][S.bdPos];
    if (key) S.bond[key] = v;
    nav(1);
    return;
  }
  if (S.mode === "date") {
    if (S.date.pos === 0) {
      // 方法字段：有新输入时按 1/2 显式设置；无输入则循环切换
      if (hadEntry) {
        const m = parseInt(v, 10);
        if (m === 1) S.date.method = "act";
        else if (m === 2) S.date.method = "360";
      } else {
        S.date.method = S.date.method === "act" ? "360" : "act";
      }
      dateShowField();
    } else if (S.date.pos === 1 || S.date.pos === 2) {
      // DT1/DT2：用 rawEntry 解析为 M.DDYY（v 是 parseFloat 后的数，小数点已丢）
      const d = parseMddyy(rawEntry);
      if (!d) { S.err = true; return; }
      if (S.date.pos === 1) S.date.d1 = d; else S.date.d2 = d;
      nav(1);
    }
    return;
  }
  if (S.mode === "depr") {
    if (S.depPos === 0) {
      // 折旧方法：1=SL 2=SYD 3=DB
      const m = Math.round(v);
      if (m >= 1 && m <= 3) S.dep.method = m;
      deprShowField();
    } else {
      const keys = ["lif", "cst", "sal", "yr"];
      const idx = S.depPos - 1;
      if (idx < 4) S.dep[keys[idx]] = v;
      nav(1);
    }
    return;
  }
}

function nav(dir) {
  if (S.mode === "cf") {
    if (dir === 1) {
      if (S.cfPos < 0 && S.cfSub === "cf") { S.cfSub = "cf"; S.cfPos = 0; }
      else if (S.cfSub === "cf") S.cfSub = "f";
      else { S.cfSub = "cf"; S.cfPos++; }
    } else {
      if (S.cfPos > 0) {
        if (S.cfSub === "cf") { S.cfPos--; S.cfSub = "f"; }
        else S.cfSub = "cf";
      } else if (S.cfPos === 0) {
        if (S.cfSub === "f") S.cfSub = "cf";
        else { S.cfPos = -1; S.cfSub = "cf"; }
      }
    }
    cfEnsure();
    setDisplay(cfFieldValue(), cfFieldName() + "=");
    return;
  }
  if (S.mode === "npv") {
    setDisplay(0, "NPV=");
    return;
  }
  if (S.mode === "pyset") {
    S.pyPos = (S.pyPos + (dir > 0 ? 1 : -1) + 2) % 2;
    setDisplay(S.pyPos === 0 ? S.py : S.cy, `${S.pyPos === 0 ? "P/Y" : "C/Y"}=`);
    return;
  }
  if (S.mode === "amort") {
    const names = ["P1", "P2", "BAL", "PRN", "INT"];
    S.amPos = (S.amPos + (dir > 0 ? 1 : -1) + 5) % 5;
    const vals = [S.am.p1, S.am.p2, S.am.bal, S.am.prn, S.am.int];
    setDisplay(S.amPos <= 1 ? vals[S.amPos] : 0, `${names[S.amPos]}=`);
    return;
  }
  if (S.mode === "bond") {
    const names = ["CPN", "YLD", "PRI", "N", "F"];
    const keys = ["cpn", "yld", "pri", "n", "f"];
    S.bdPos = (S.bdPos + (dir > 0 ? 1 : -1) + 5) % 5;
    setDisplay(S.bond[keys[S.bdPos]] === null ? 0 : S.bond[keys[S.bdPos]], `${names[S.bdPos]}=`);
    return;
  }
  if (S.mode === "date") {
    // pos 0 → 1 → 2 → 3 → 0（DBD 是只读结果，可再按 DOWN 回到方法）
    S.date.pos = (S.date.pos + (dir > 0 ? 1 : -1) + 4) % 4;
    dateShowField();
    return;
  }
  if (S.mode === "depr") {
    S.depPos = (S.depPos + (dir > 0 ? 1 : -1) + 7) % 7;
    deprShowField();
    return;
  }
}

function doEquals() {
  if (S.mode === "npv") {
    const r = npvAt(S.cfRate === null ? 0 : S.cfRate / 100);
    setDisplay(r, "NPV=");
    return;
  }
  if (S.mode === "irr") {
    const r = solveIRR();
    setDisplay(isNaN(r) ? 0 : r, "IRR=");
    return;
  }
  if (S.mode === "amort") {
    const res = amortize(S.am.p1, S.am.p2);
    if (!res) { S.err = true; return; }
    S.am.bal = res.bal; S.am.prn = res.prn; S.am.int = res.int;
    setDisplay(res.bal, "BAL=");
    return;
  }
  if (S.mode === "bond") {
    const b = S.bond;
    if (b.pri === null && b.yld !== null && b.cpn !== null && b.n !== null) {
      const p = bondPrice(b.cpn, b.yld, b.n, b.f || 2, 100);
      b.pri = p;
      setDisplay(p, "PRI=");
    } else if (b.yld === null && b.pri !== null && b.cpn !== null && b.n !== null) {
      const y = bondYield(b.cpn, b.pri, b.n, b.f || 2, 100);
      b.yld = y;
      setDisplay(y, "YLD=");
    }
    return;
  }
  if (S.mode === "date") {
    if (!S.date.d1 || !S.date.d2) { S.err = true; return; }
    S.date.dbd = daysBetween(S.date.d1, S.date.d2, S.date.method);
    S.date.pos = 3;
    dateShowField();
    return;
  }
  if (S.mode === "depr") {
    const r = deprCalc(S.dep.method, S.dep.lif, S.dep.cst, S.dep.sal, S.dep.yr);
    if (!r) { S.err = true; return; }
    S.dep.dep = r.dep;
    S.dep.rdv = r.rdv;
    S.depPos = 5;  // 跳到 DEP 显示
    deprShowField();
    return;
  }
  // 标准算术
  let expr = S.expr;
  if (S.entry !== null) expr += S.entry;
  else if (expr === "") { return; }
  // 表达式以运算符结尾（例如刚按完 × 没输数字）：去掉该运算符
  else if (/[+\-*/^]$/.test(expr)) expr = expr.slice(0, -1);
  // 以数字或 ) 结尾时值已在表达式里，不再追加当前值
  try {
    const v = evalExpr(expr);
    S.lastAns = v;
    setDisplay(v, "");
    S.expr = "";
  } catch {
    S.err = true;
    setDisplay(0, "");
    S.expr = "";
  }
}

/* ---------- 2nd 功能 ---------- */
function pressSnd(id) {
  switch (id) {
    case "FV":
      S.tvm = { N: null, IY: null, PV: null, PMT: null, FV: null };
      clearEntry();
      S.label = "";
      S.mode = "std";
      return;
    case "CEC":
      if (S.mode === "cf") { S.cf = { c0: 0, list: [] }; S.cfPos = -1; S.cfSub = "cf"; enterCfMode(); }
      else { S.expr = ""; clearEntry(); S.label = ""; }
      return;
    case "ENTER":
      if (S.mode === "pyset") {
        // SET 在 P/Y 页无意义，返回
        return;
      }
      if (S.mode === "std" || S.mode === "bgnsct") {
        S.bgn = !S.bgn;
        S.label = S.bgn ? "BGN" : "END";
        S.mode = "std";
      }
      return;
    case "PMT":
      S.mode = "bgnsct";
      setDisplay(0, S.bgn ? "BGN" : "END");
      return;
    case "IY":
      S.mode = "pyset";
      S.pyPos = 0;
      setDisplay(S.py, "P/Y=");
      return;
    case "PV":
      S.mode = "amort";
      S.amPos = 0;
      setDisplay(S.am.p1, "P1=");
      return;
    case "CPT":
      S.mode = "std";
      S.cpt = false;
      clearEntry();
      S.label = "";
      return;
    case "LN":
      S.cur = Math.exp(currentNum());
      S.entry = null;
      return;
    case "PCT":
      // 2nd + % = √x
      S.cur = Math.sqrt(currentNum());
      S.entry = null;
      return;
    case "9":
      S.mode = "bond";
      S.bdPos = 0;
      setDisplay(S.bond.cpn === null ? 0 : S.bond.cpn, "CPN=");
      return;
    case "1":
      enterDateMode();
      return;
    case "4":
      enterDeprMode();
      return;
    case "N":
      if (S.tvm.N !== null) setDisplay(S.tvm.N * (S.py || 1), "xP/Y=");
      return;
    case "DOT":
      S.decimals = Math.max(0, Math.min(9, Math.round(currentNum())));
      setDisplay(S.decimals, "DEC=");
      return;
    case "PM":
      S.py = 12; S.cy = 12; S.bgn = false;
      S.decimals = 2;
      S.tvm = { N: null, IY: null, PV: null, PMT: null, FV: null };
      S.cf = { c0: 0, list: [] };
      S.expr = "";
      clearEntry();
      S.label = "RESET";
      S.mode = "std";
      return;
  }
  // 2nd + 数字：工作表占位提示
  if (/^[0-9]$/.test(id)) {
    setDisplay(0, "工作表开发中");
  }
}

/* ---------- 构建键盘 ---------- */
function buildKeypad() {
  const pad = $("#keypad");
  pad.innerHTML = "";
  LAYOUT.forEach((row) => {
    row.forEach((k) => {
      const slot = document.createElement("div");
      slot.className = "slot";
      if (k.blank) {
        const b = document.createElement("button");
        b.className = "key blank";
        b.tabIndex = -1;
        slot.appendChild(b);
        pad.appendChild(slot);
        return;
      }
      // 双行键（顶行 QUIT/CPT 等）：主+2nd 都印在键上，不显示键上方 snd
      if (k.cls === "two-line") {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "key dark two-line";
        btn.dataset.id = k.id;
        btn.innerHTML = `<span class="k-main">${k.label}</span><span class="k-snd">${k.snd || ""}</span>`;
        btn.addEventListener("click", () => {
          flash(btn);
          press(k.id);
        });
        slot.appendChild(btn);
        pad.appendChild(slot);
        return;
      }
      // 普通键：上方印 snd 标签（黄色，印在机身上），键上是主标签
      const snd = document.createElement("div");
      snd.className = "snd";
      snd.textContent = k.snd || "";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "key " + (k.cls || "dark");
      btn.textContent = k.label;
      btn.dataset.id = k.id;
      btn.addEventListener("click", () => {
        flash(btn);
        press(k.id);
      });
      slot.appendChild(snd);
      slot.appendChild(btn);
      pad.appendChild(slot);
    });
  });
}

function flash(btn) {
  btn.classList.add("pressed");
  setTimeout(() => btn.classList.remove("pressed"), 80);
}

/* ---------- 物理键盘 ---------- */
const KEYMAP = {
  "+": "ADD", "-": "SUB", "*": "MUL", "/": "DIV", "^": "POW",
  "(": "LPAR", ")": "RPAR", ".": "DOT", ",": "DOT",
};
document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  let id = null;
  if (/^[0-9]$/.test(k)) id = k;
  else if (KEYMAP[k]) id = KEYMAP[k];
  else if (k === "Enter" || k === "=") id = "EQ";
  else if (k === "Backspace") { S.entry = S.entry && S.entry.length > 1 ? S.entry.slice(0, -1) : null; render(); e.preventDefault(); return; }
  else if (k === "Escape") id = "CEC";
  else if (k === "ArrowUp") id = "UP";
  else if (k === "ArrowDown") id = "DOWN";
  else if (k === "s" || k === "S") id = "2nd";
  else if (k === "c" || k === "C") id = "CPT";
  else if (k === "n" || k === "N") id = "PM";
  if (!id) return;
  e.preventDefault();
  const btn = document.querySelector(`.key[data-id="${id}"]`);
  if (btn) flash(btn);
  press(id);
});

/* ---------- 启动 ---------- */
buildKeypad();
render();

// 暴露给测试 / 控制台调试（生产环境无副作用）
if (typeof window !== "undefined") {
  window.__calc = { S, press, render };
}
