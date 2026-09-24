'use strict';

const $ = (id) => document.getElementById(id);

/* =====================================================
   TABS
   ===================================================== */
const tabs = Array.from(document.querySelectorAll('.tab'));
let activeTabId = 'tab-calc';

function selectTab(tab, moveFocus = false) {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $(t.dataset.panel).hidden = !on;
  });
  $('screenTitle').textContent = tab.dataset.title;
  activeTabId = tab.id;
  if (moveFocus) tab.focus();
}

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', (e) => {
    let next = null;
    if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
    else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
    else if (e.key === 'Home') next = tabs[0];
    else if (e.key === 'End') next = tabs[tabs.length - 1];
    if (next) { e.preventDefault(); selectTab(next, true); }
  });
});

/* =====================================================
   CALCULATOR
   ===================================================== */
const OPS = ['+', '−', '×', '÷'];
const exprEl = $('expression');
const previewEl = $('preview');

let expr = '';
let justEvaluated = false;
let errorMsg = '';

/* --- Safe expression evaluator (no eval) --- */
function evaluate(str) {
  const tokens = str.match(/\d+\.?\d*|\.\d+|[+−×÷%]/g) || [];
  let i = 0;
  const peek = () => tokens[i];

  function parseFactor() {
    const t = tokens[i];
    if (t === '−') { i++; const f = parseFactor(); return { v: -f.v, pct: f.pct }; }
    if (t === '+') { i++; return parseFactor(); }
    if (t === undefined || !/^[\d.]/.test(t)) throw new Error('SYNTAX');
    i++;
    let v = parseFloat(t);
    let pct = false;
    while (peek() === '%') { i++; v /= 100; pct = true; }
    return { v, pct };
  }

  function parseTerm() {
    let { v, pct } = parseFactor();
    while (peek() === '×' || peek() === '÷') {
      const op = tokens[i++];
      const r = parseFactor();
      if (op === '÷') {
        if (r.v === 0) throw new Error('DIV0');
        v /= r.v;
      } else {
        v *= r.v;
      }
      pct = false;
    }
    return { v, pct };
  }

  function parseExpr() {
    let { v } = parseTerm();
    while (peek() === '+' || peek() === '−') {
      const op = tokens[i++];
      const r = parseTerm();
      // Samsung-style percent: 200 + 10% = 220
      const rv = r.pct ? v * r.v : r.v;
      v = op === '+' ? v + rv : v - rv;
    }
    return v;
  }

  const result = parseExpr();
  if (i !== tokens.length) throw new Error('SYNTAX');
  return result;
}

function fmt(n) {
  if (!Number.isFinite(n) || Math.abs(n) >= 1e15) throw new Error('RANGE');
  let s = String(parseFloat(n.toPrecision(12)));
  if (/e/i.test(s)) s = n.toFixed(12).replace(/\.?0+$/, '');
  return s.replace('-', '−');
}

function groupNumbers(s) {
  return s.replace(/\d+(\.\d*)?/g, (m) => {
    const [int, dec] = m.split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return dec === undefined ? grouped : `${grouped}.${dec}`;
  });
}

const stripTrailingOps = (s) => s.replace(/[+−×÷]+$/, '');

function computePreview() {
  if (justEvaluated || !expr) return '';
  const s = stripTrailingOps(expr);
  if (!s || /^−?[\d.]+$/.test(s)) return '';
  try {
    const out = fmt(evaluate(s));
    return out === s ? '' : groupNumbers(out);
  } catch {
    return '';
  }
}

function render() {
  const text = expr === '' ? '0' : groupNumbers(expr);
  exprEl.textContent = text;
  const len = text.length;
  exprEl.style.fontSize = (len <= 9 ? 64 : len <= 14 ? 48 : len <= 22 ? 36 : 28) + 'px';
  previewEl.textContent = errorMsg || computePreview();
}

/* --- Input handlers --- */
function inputDigit(d) {
  if (justEvaluated) { expr = ''; justEvaluated = false; }
  if (expr.length >= 80) return;
  if (expr.endsWith('%')) expr += '×';
  const cur = expr.match(/\d*\.?\d*$/)[0];
  if (cur === '0') expr = expr.slice(0, -1);
  expr += d;
}

function inputDot() {
  if (justEvaluated) { expr = ''; justEvaluated = false; }
  if (expr.length >= 80) return;
  if (expr.endsWith('%')) { expr += '×0.'; return; }
  const cur = expr.match(/\d*\.?\d*$/)[0];
  if (cur.includes('.')) return;
  expr += cur === '' ? '0.' : '.';
}

function inputOperator(op) {
  justEvaluated = false;
  if (expr === '') { if (op === '−') expr = '−'; return; }
  const last = expr.slice(-1);
  if (OPS.includes(last)) {
    if (op === '−' && (last === '×' || last === '÷')) { expr += op; return; }
    const stripped = expr.replace(/[+−×÷]+$/, '');
    if (stripped === '') return;
    expr = stripped + op;
    return;
  }
  expr += op;
}

function inputPercent() {
  justEvaluated = false;
  if (/[\d%]$/.test(expr)) expr += '%';
}

function toggleSign() {
  justEvaluated = false;
  const m = expr.match(/\d+\.?\d*$/);
  if (!m) return;
  const before = expr.slice(0, expr.length - m[0].length);
  const prev = before.slice(-1);
  const prevPrev = before.slice(-2, -1);
  if (prev === '−') {
    const unary = before.length === 1 || OPS.includes(prevPrev);
    expr = before.slice(0, -1) + (unary ? '' : '+') + m[0];
  } else if (prev === '+') {
    expr = before.slice(0, -1) + '−' + m[0];
  } else {
    expr = before + '−' + m[0];
  }
}

function backspace() {
  justEvaluated = false;
  expr = expr.slice(0, -1);
}

function clearAll() {
  expr = '';
  justEvaluated = false;
}

function equals() {
  if (!expr) return;
  const s = stripTrailingOps(expr);
  if (!s) return;
  try {
    expr = fmt(evaluate(s));
    justEvaluated = true;
  } catch (e) {
    errorMsg =
      e.message === 'DIV0' ? "Can't divide by 0" :
      e.message === 'RANGE' ? 'Result out of range' :
      'Invalid format used';
  }
}

function press(key) {
  errorMsg = '';
  if (/^\d$/.test(key)) inputDigit(key);
  else {
    switch (key) {
      case '.': inputDot(); break;
      case '+': case '−': case '×': case '÷': inputOperator(key); break;
      case '%': inputPercent(); break;
      case '±': toggleSign(); break;
      case '⌫': backspace(); break;
      case 'C': clearAll(); break;
      case '=': equals(); break;
    }
  }
  render();
}

$('keypad').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-key]');
  if (btn) press(btn.dataset.key);
});

/* Physical keyboard support (calculator tab only) */
const KEY_MAP = {
  '+': '+', '-': '−', '*': '×', x: '×', X: '×', '/': '÷',
  '%': '%', '.': '.', ',': '.', '=': '=', Enter: '=',
  Backspace: '⌫', Escape: 'C', Delete: 'C',
};

document.addEventListener('keydown', (e) => {
  if (activeTabId !== 'tab-calc') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest('.tabbar')) return;
  if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); return; }
  const mapped = KEY_MAP[e.key];
  if (mapped) { e.preventDefault(); press(mapped); }
});

render();

/* =====================================================
   CONVERTERS
   ===================================================== */
// Each unit maps to a factor that converts it to the category's base unit.
const UNITS = {
  Speed:  { 'mph': 0.44704, 'km/h': 1 / 3.6, 'm/s': 1 },                       // base: m/s
  Length: { 'm': 1, 'km': 1000, 'ft': 0.3048, 'in': 0.0254, 'mi': 1609.344 },  // base: m
  Volume: { 'L': 1, 'mL': 0.001, 'gal': 3.785411784 },                          // base: L (US gallon)
};

/* Currency: units per 1 USD. Fallback values are approximate; edit as you like. */
const FALLBACK_RATES = { USD: 1, EUR: 0.86, GBP: 0.74, INR: 88 };
const RATE_CACHE_KEY = 'galaxyCalc.rates.v1';
const RATE_API = 'https://open.er-api.com/v6/latest/USD';

let currencyRates = { ...FALLBACK_RATES };
let currencyStatus = 'Offline fallback rates (approximate)';

const categoryEl = $('category');
const fromValueEl = $('fromValue');
const toValueEl = $('toValue');
const fromUnitEl = $('fromUnit');
const toUnitEl = $('toUnit');
const rateNoteEl = $('rateNote');
const currencyStatusEl = $('currencyStatus');

const numberFmt = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 8 });

function getFactors(category) {
  if (category === 'Currency') {
    const f = {};
    for (const [code, perUsd] of Object.entries(currencyRates)) f[code] = 1 / perUsd; // to USD
    return f;
  }
  return UNITS[category];
}

function convertValue(value, category, from, to) {
  const f = getFactors(category);
  return (value * f[from]) / f[to];
}

function populateUnits() {
  const cat = categoryEl.value;
  const codes = Object.keys(getFactors(cat));
  const options = codes.map((c) => `<option value="${c}">${c}</option>`).join('');
  fromUnitEl.innerHTML = options;
  toUnitEl.innerHTML = options;
  fromUnitEl.value = codes[0];
  toUnitEl.value = codes[1];
  currencyStatusEl.hidden = cat !== 'Currency';
  updateConversion();
}

function updateConversion() {
  const cat = categoryEl.value;
  const from = fromUnitEl.value;
  const to = toUnitEl.value;
  const raw = fromValueEl.value;
  const val = parseFloat(raw);

  toValueEl.value = raw === '' || Number.isNaN(val)
    ? ''
    : numberFmt.format(convertValue(val, cat, from, to));

  rateNoteEl.textContent = `1 ${from} = ${numberFmt.format(convertValue(1, cat, from, to))} ${to}`;
  currencyStatusEl.textContent = currencyStatus;
}

categoryEl.addEventListener('change', populateUnits);
fromValueEl.addEventListener('input', updateConversion);
fromUnitEl.addEventListener('change', updateConversion);
toUnitEl.addEventListener('change', updateConversion);
$('swapBtn').addEventListener('click', () => {
  const a = fromUnitEl.value;
  fromUnitEl.value = toUnitEl.value;
  toUnitEl.value = a;
  updateConversion();
});

/* --- Currency: live fetch -> cached copy -> built-in fallback --- */
const validRates = (r) => r && ['EUR', 'GBP', 'INR'].every((k) => typeof r[k] === 'number' && r[k] > 0);

function loadCachedRates() {
  try {
    const raw = localStorage.getItem(RATE_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    return validRates(cached.rates) ? cached : null;
  } catch {
    return null;
  }
}

async function refreshRates() {
  const cached = loadCachedRates();
  if (cached) {
    currencyRates = { USD: 1, ...cached.rates };
    currencyStatus = `Cached rates from ${new Date(cached.savedAt).toLocaleString()}`;
    updateConversion();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(RATE_API, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.result !== 'success' || !validRates(data.rates)) throw new Error('Bad payload');

    const rates = { USD: 1, EUR: data.rates.EUR, GBP: data.rates.GBP, INR: data.rates.INR };
    currencyRates = rates;
    currencyStatus = `Live rates · updated ${new Date().toLocaleTimeString()}`;
    try {
      localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rates, savedAt: Date.now() }));
    } catch { /* storage unavailable; ignore */ }
  } catch {
    /* keep the cached or built-in fallback values already applied */
  } finally {
    clearTimeout(timer);
    updateConversion();
  }
}

populateUnits();
refreshRates();

/* =====================================================
   MATH SOLVER (Gemini)
   ===================================================== */
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const SYSTEM_PROMPT =
  'You are a patient math tutor. Solve the algebra problem the user gives you. ' +
  'Show numbered steps, each on its own line, explaining what is done and why. ' +
  'Finish with a line that starts with "Answer:". ' +
  'Use plain text only: no Markdown, no LaTeX, no asterisks. ' +
  'Write math with ^ for powers, sqrt() for roots, and / for fractions. ' +
  'If the input is not a math problem, say so briefly.';

const eqEl = $('equationInput');
const keyEl = $('apiKey');
const solveBtn = $('solveBtn');
const solutionEl = $('solution');
const solveStatusEl = $('solveStatus');

try { keyEl.value = sessionStorage.getItem('galaxyCalc.geminiKey') || ''; } catch { /* ignore */ }

keyEl.addEventListener('input', () => {
  try { sessionStorage.setItem('galaxyCalc.geminiKey', keyEl.value); } catch { /* ignore */ }
});

$('toggleKey').addEventListener('click', (e) => {
  const show = keyEl.type === 'password';
  keyEl.type = show ? 'text' : 'password';
  e.currentTarget.textContent = show ? 'Hide' : 'Show';
  e.currentTarget.setAttribute('aria-pressed', String(show));
});

function cleanModelText(t) {
  return t.replace(/\*\*/g, '').replace(/^#{1,6}\s*/gm, '').replace(/`/g, '').trim();
}

async function solve() {
  const equation = eqEl.value.trim();
  const apiKey = keyEl.value.trim();

  if (!equation) { solveStatusEl.textContent = 'Enter an equation first.'; eqEl.focus(); return; }
  if (!apiKey) { solveStatusEl.textContent = 'Enter your Gemini API key.'; keyEl.focus(); return; }

  solveBtn.disabled = true;
  solveBtn.textContent = 'Solving…';
  solveStatusEl.textContent = 'Contacting Gemini…';
  solutionEl.value = '';

  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: `Solve step by step: ${equation}` }] }],
        generationConfig: { temperature: 0.2 },
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error?.message || `Request failed (HTTP ${res.status})`);
    }

    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || '')
      .join('')
      .trim();

    if (!text) {
      const reason = data?.promptFeedback?.blockReason;
      throw new Error(reason ? `Response blocked (${reason}).` : 'The model returned an empty response.');
    }

    solutionEl.value = cleanModelText(text);
    solveStatusEl.textContent = 'Done.';
  } catch (err) {
    solveStatusEl.textContent = `Error: ${err.message}`;
  } finally {
    solveBtn.disabled = false;
    solveBtn.textContent = 'Solve Step-by-Step';
  }
}

solveBtn.addEventListener('click', solve);
eqEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') solve(); });