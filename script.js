const STORAGE_TXN = "spendtrack.transactions";
const STORAGE_BUDGETS = "spendtrack.budgets";
const STORAGE_THEME = "spendtrack.theme";
const STORAGE_CUSTOM_CATEGORIES = "spendtrack.customCategories";

const PALETTES = [
  { name: "Rose", lightBg: "#FBE0E4", lightText: "#C2255C", darkBg: "#3D1F26", darkText: "#FAA2C1" },
  { name: "Amber", lightBg: "#FCEACB", lightText: "#B4590A", darkBg: "#3D2E1A", darkText: "#FFB870" },
  { name: "Teal", lightBg: "#D6F0EC", lightText: "#0B7285", darkBg: "#173330", darkText: "#66D9CE" },
  { name: "Indigo", lightBg: "#E3E0FB", lightText: "#5F3DC4", darkBg: "#2A2450", darkText: "#B197FC" },
  { name: "Lime", lightBg: "#E9F5D6", lightText: "#5C940D", darkBg: "#2B331A", darkText: "#A9E34B" },
  { name: "Slate", lightBg: "#E4E7EB", lightText: "#495057", darkBg: "#2E3236", darkText: "#CED4DA" }
];

const CATEGORIES = {
  expense: [
    { name: "Food", icon: "🍔", var: "food" },
    { name: "Transport", icon: "🚌", var: "transport" },
    { name: "Bills", icon: "🧾", var: "bills" },
    { name: "Shopping", icon: "🛍️", var: "shopping" },
    { name: "Entertainment", icon: "🎬", var: "entertainment" },
    { name: "Health", icon: "❤️", var: "health" },
    { name: "Other", icon: "📦", var: "other" }
  ],
  income: [
    { name: "Salary", icon: "💼", var: "salary" },
    { name: "Freelance", icon: "💻", var: "freelance" },
    { name: "Business", icon: "🏢", var: "business" },
    { name: "Investment", icon: "📈", var: "investment" },
    { name: "Other", icon: "💰", var: "other" }
  ]
};

/* ---------- STATE ---------- */
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

let transactions = load(STORAGE_TXN, []);
let budgets = load(STORAGE_BUDGETS, {});
let customCategories = load(STORAGE_CUSTOM_CATEGORIES, { expense: [], income: [] });

let modalType = "expense";
let selectedCategory = null;
let amountStr = "";
let selectedPaletteIndex = 0;

function saveTransactions() { localStorage.setItem(STORAGE_TXN, JSON.stringify(transactions)); }
function saveBudgets() { localStorage.setItem(STORAGE_BUDGETS, JSON.stringify(budgets)); }
function saveCustomCategories() { localStorage.setItem(STORAGE_CUSTOM_CATEGORIES, JSON.stringify(customCategories)); }

/* ---------- HELPERS ---------- */
const $ = id => document.getElementById(id);

function allCategories(type) { return [...(CATEGORIES[type] || []), ...(customCategories[type] || [])]; }
function findCategory(type, name) { return allCategories(type).find(c => c.name === name); }
function catVar(type, name) { const c = findCategory(type, name); return c ? c.var : "other"; }
function catBg(type, name) { return `var(--cat-${catVar(type, name)}-bg)`; }
function catText(type, name) { return `var(--cat-${catVar(type, name)}-text)`; }
function catIcon(type, name) { const c = findCategory(type, name); return c ? c.icon : "📦"; }

function cssVal(varExpr) {
  const name = varExpr.replace(/^var\(|\)$/g, "");
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
}

function fmtMoney(n) {
  return (n < 0 ? "-" : "") + "RM " + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPlain(n) {
  return Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pad2(n) { return String(n).padStart(2, "0"); }
function toLocalDateStr(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function today() { return toLocalDateStr(new Date()); }
function monthKey(s) { return s.slice(0, 7); }
function currentMonthKey() { return today().slice(0, 7); }

function dayLabel(dateStr) {
  const t = new Date();
  const y = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
  if (dateStr === today()) return "Today";
  if (dateStr === toLocalDateStr(y)) return "Yesterday";
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function rebuildCustomCategoryStyles() {
  let styleEl = $("customCatStyle");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "customCatStyle";
    document.head.appendChild(styleEl);
  }
  let css = "";
  ["expense", "income"].forEach(type => {
    (customCategories[type] || []).forEach(c => {
      const p = PALETTES[c.paletteIndex] || PALETTES[0];
      css += `:root{--cat-${c.var}-bg:${p.lightBg};--cat-${c.var}-text:${p.lightText};}`;
      css += `:root[data-theme="dark"]{--cat-${c.var}-bg:${p.darkBg};--cat-${c.var}-text:${p.darkText};}`;
    });
  });
  styleEl.textContent = css;
}

/* ---------- THEME ---------- */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_THEME, theme);
  $("themeToggle").textContent = theme === "dark" ? "☀️" : "🌙";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", cssVal("var(--bg)"));
}
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "dark" ? "light" : "dark");
  if ($("panel-charts").classList.contains("active")) renderCharts();
}
function initTheme() {
  const stored = localStorage.getItem(STORAGE_THEME);
  applyTheme(stored || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
}
$("themeToggle").addEventListener("click", toggleTheme);
$("themeToggle2").addEventListener("click", toggleTheme);

/* ---------- TABS ---------- */
function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === "panel-" + tab));
  window.scrollTo(0, 0);
  if (tab === "charts") renderCharts();
}
document.querySelectorAll(".tab-btn").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
document.querySelectorAll("[data-goto]").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.goto)));

/* ---------- SETTINGS ---------- */
const settingsModal = $("settingsModal");
$("settingsBtn").addEventListener("click", () => settingsModal.classList.add("open"));
$("closeSettings").addEventListener("click", () => settingsModal.classList.remove("open"));
settingsModal.addEventListener("click", e => { if (e.target === settingsModal) settingsModal.classList.remove("open"); });

$("exportBtn").addEventListener("click", () => {
  const payload = { transactions, budgets, customCategories, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `spendtrack-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

$("importBtn").addEventListener("click", () => $("importFile").click());

$("importFile").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); }
    catch { alert("That file isn't valid JSON."); e.target.value = ""; return; }
    if (!Array.isArray(data.transactions) || typeof data.budgets !== "object") {
      alert("That file doesn't look like a SpendTrack backup.");
      e.target.value = ""; return;
    }
    if (!confirm("This will replace your current transactions and budgets with the imported backup. Continue?")) {
      e.target.value = ""; return;
    }
    transactions = data.transactions;
    budgets = data.budgets;
    customCategories = data.customCategories && typeof data.customCategories === "object"
      ? { expense: data.customCategories.expense || [], income: data.customCategories.income || [] }
      : { expense: [], income: [] };
    saveTransactions(); saveBudgets(); saveCustomCategories();
    rebuildCustomCategoryStyles();
    renderAll();
    settingsModal.classList.remove("open");
    e.target.value = "";
  };
  reader.readAsText(file);
});

/* ---------- TRANSACTION SHEET ---------- */
const txnModal = $("txnModal");

function setModalType(type) {
  modalType = type;
  document.querySelectorAll("#txnModal .type-btn").forEach(b => b.classList.toggle("active", b.dataset.type === type));
  $("modalTitle").textContent = ($("txnId").value ? "Edit " : "New ") + type;
  $("saveTxnBtn").textContent = "Save " + type;
  $("newCategoryPanel").style.display = "none";
  if (!findCategory(type, selectedCategory)) selectedCategory = allCategories(type)[0].name;
  renderCatRow();
}

document.querySelectorAll("#txnModal .type-btn").forEach(b =>
  b.addEventListener("click", () => setModalType(b.dataset.type)));

function renderCatRow() {
  const row = $("catRow");
  row.innerHTML = "";
  allCategories(modalType).forEach(c => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat-btn" + (c.name === selectedCategory ? " active" : "");
    if (c.name === selectedCategory) {
      btn.style.background = `var(--cat-${c.var}-bg)`;
      btn.style.color = `var(--cat-${c.var}-text)`;
    }
    btn.innerHTML = `<span class="cat-emoji">${c.icon}</span><span>${escapeHtml(c.name)}</span>`;
    btn.addEventListener("click", () => { selectedCategory = c.name; renderCatRow(); });
    row.appendChild(btn);
  });

  const add = document.createElement("button");
  add.type = "button";
  add.className = "cat-btn";
  add.innerHTML = `<span class="cat-emoji">＋</span><span>New</span>`;
  add.addEventListener("click", () => {
    $("newCategoryPanel").style.display = "block";
    selectedPaletteIndex = 0;
    renderPaletteSwatches();
    $("newCatName").focus();
  });
  row.appendChild(add);
}

function renderPaletteSwatches() {
  const container = $("paletteSwatches");
  container.innerHTML = "";
  PALETTES.forEach((p, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "palette-swatch" + (i === selectedPaletteIndex ? " selected" : "");
    btn.style.background = p.lightBg;
    btn.title = p.name;
    btn.addEventListener("click", () => { selectedPaletteIndex = i; renderPaletteSwatches(); });
    container.appendChild(btn);
  });
}

$("cancelNewCat").addEventListener("click", () => {
  $("newCategoryPanel").style.display = "none";
  $("newCatName").value = "";
  $("newCatIcon").value = "";
});

$("confirmNewCat").addEventListener("click", () => {
  const name = $("newCatName").value.trim();
  if (!name) { alert("Please enter a category name."); return; }
  if (allCategories(modalType).some(c => c.name.toLowerCase() === name.toLowerCase())) {
    alert("That category already exists."); return;
  }
  const icon = $("newCatIcon").value.trim() || "🏷️";
  const varId = "custom" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  customCategories[modalType].push({ name, icon, var: varId, paletteIndex: selectedPaletteIndex });
  saveCustomCategories();
  rebuildCustomCategoryStyles();
  $("newCategoryPanel").style.display = "none";
  $("newCatName").value = "";
  $("newCatIcon").value = "";
  selectedCategory = name;
  renderCatRow();
  populateCategoryFilter();
  renderBudgets();
});

/* amount keypad */
function renderAmount() {
  $("amountDisplay").textContent = amountStr === "" ? "0" : amountStr;
  $("saveTxnBtn").disabled = !(parseFloat(amountStr) > 0);
}

$("keypad").addEventListener("click", e => {
  const key = e.target.closest("button");
  if (!key) return;
  const k = key.dataset.key;
  if (k === "del") amountStr = amountStr.slice(0, -1);
  else if (k === ".") { if (!amountStr.includes(".")) amountStr = (amountStr || "0") + "."; }
  else {
    const decimals = amountStr.split(".")[1];
    if (decimals && decimals.length >= 2) return;
    if (amountStr === "0") amountStr = k; else amountStr += k;
  }
  renderAmount();
});

function openAddModal() {
  $("txnId").value = "";
  amountStr = "";
  selectedCategory = null;
  $("date").value = today();
  $("paymentMethod").value = "Cash";
  $("note").value = "";
  $("deleteTxnBtn").style.display = "none";
  setModalType("expense");
  renderAmount();
  txnModal.classList.add("open");
}

function openEditModal(id) {
  const t = transactions.find(x => x.id === id);
  if (!t) return;
  $("txnId").value = t.id;
  amountStr = String(t.amount);
  selectedCategory = t.category;
  $("date").value = t.date;
  $("paymentMethod").value = t.paymentMethod || "Cash";
  $("note").value = t.note || "";
  $("deleteTxnBtn").style.display = "inline-block";
  setModalType(t.type);
  renderAmount();
  txnModal.classList.add("open");
}

function closeTxnModal() { txnModal.classList.remove("open"); }

$("fabAdd").addEventListener("click", openAddModal);
$("closeModal").addEventListener("click", closeTxnModal);
txnModal.addEventListener("click", e => { if (e.target === txnModal) closeTxnModal(); });

$("saveTxnBtn").addEventListener("click", () => {
  const amount = parseFloat(amountStr);
  if (!amount || amount <= 0) return;
  const id = $("txnId").value;
  const data = {
    type: modalType,
    amount,
    category: selectedCategory,
    date: $("date").value || today(),
    paymentMethod: $("paymentMethod").value,
    note: $("note").value.trim()
  };
  if (id) {
    const idx = transactions.findIndex(t => t.id === id);
    if (idx !== -1) transactions[idx] = { ...transactions[idx], ...data };
  } else {
    data.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    transactions.unshift(data);
  }
  saveTransactions();
  closeTxnModal();
  renderAll();
});

$("deleteTxnBtn").addEventListener("click", () => {
  const id = $("txnId").value;
  if (!id || !confirm("Delete this transaction?")) return;
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  closeTxnModal();
  renderAll();
});

/* ---------- TXN ROWS ---------- */
function buildTxnRow(t) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "txn-item";
  const meta = [t.note, t.paymentMethod].filter(Boolean).map(escapeHtml).join(" · ");
  btn.innerHTML = `
    <span class="txn-icon" style="background:${catBg(t.type, t.category)};">${catIcon(t.type, t.category)}</span>
    <span class="txn-info">
      <span class="txn-cat">${escapeHtml(t.category)}</span>
      <span class="txn-meta">${meta || "&nbsp;"}</span>
    </span>
    <span class="txn-amount ${t.type}">${t.type === "income" ? "+" : "−"} ${fmtPlain(t.amount)}</span>
  `;
  btn.addEventListener("click", () => openEditModal(t.id));
  return btn;
}

function renderGroups(container, list) {
  container.innerHTML = "";
  const groups = {};
  list.forEach(t => { (groups[t.date] = groups[t.date] || []).push(t); });
  Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(date => {
    const rows = groups[date];
    const net = rows.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
    const head = document.createElement("div");
    head.className = "day-head";
    head.innerHTML = `<span>${dayLabel(date)}</span><span class="day-total ${net >= 0 ? "income" : "expense"}">${net >= 0 ? "+" : "−"} ${fmtMoney(Math.abs(net)).replace("RM ", "RM ")}</span>`;
    container.appendChild(head);
    rows.forEach(t => container.appendChild(buildTxnRow(t)));
  });
}

/* ---------- COMPUTE ---------- */
function computeTotals() {
  const mKey = currentMonthKey();
  const monthTxns = transactions.filter(t => monthKey(t.date) === mKey);
  const monthIncome = monthTxns.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTxns.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalLimit = Object.values(budgets).reduce((s, v) => s + (Number(v) || 0), 0);
  return { monthIncome, monthExpense, totalLimit };
}

function monthName() {
  return new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/* ---------- RENDER: HOME ---------- */
function renderDashboard() {
  const { monthIncome, monthExpense, totalLimit } = computeTotals();
  $("heroMonth").textContent = monthName();
  $("statIncome").textContent = fmtMoney(monthIncome);
  $("statExpense").textContent = fmtMoney(monthExpense);

  const hasBudget = totalLimit > 0;
  $("heroBarWrap").style.display = hasBudget ? "flex" : "none";
  $("heroHint").style.display = hasBudget ? "none" : "block";

  if (hasBudget) {
    const left = totalLimit - monthExpense;
    $("heroLabel").textContent = left >= 0 ? "Left to spend this month" : "Over budget this month";
    const [whole, cents] = fmtMoney(Math.abs(left)).split(".");
    $("heroValue").innerHTML = `${whole}<span class="cents">.${cents}</span>`;
    $("heroValue").classList.toggle("over", left < 0);
    const pct = Math.min((monthExpense / totalLimit) * 100, 100);
    $("heroBarFill").style.width = pct + "%";
    $("heroBarFill").classList.toggle("over", left < 0);
    $("heroSpent").textContent = fmtMoney(monthExpense) + " spent";
    $("heroLimit").textContent = "of " + fmtMoney(totalLimit) + " budget";
  } else {
    $("heroLabel").textContent = "Spent this month";
    const [whole, cents] = fmtMoney(monthExpense).split(".");
    $("heroValue").innerHTML = `${whole}<span class="cents">.${cents}</span>`;
    $("heroValue").classList.remove("over");
  }

  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  $("recentEmpty").style.display = recent.length ? "none" : "block";
  renderGroups($("recentGroups"), recent);
}

/* ---------- RENDER: ACTIVITY ---------- */
function populateCategoryFilter() {
  const select = $("categoryFilter");
  const currentVal = select.value;
  select.innerHTML = '<option value="all">All categories</option>';
  const seen = new Set();
  [...allCategories("income"), ...allCategories("expense")].forEach(c => {
    if (seen.has(c.name)) return;
    seen.add(c.name);
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.icon + " " + c.name;
    select.appendChild(opt);
  });
  select.value = currentVal || "all";
}

function renderTransactionList() {
  const search = $("searchInput").value.trim().toLowerCase();
  const typeF = document.querySelector("#typeFilter .chip.active").dataset.type;
  const catF = $("categoryFilter").value;

  let list = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  if (typeF !== "all") list = list.filter(t => t.type === typeF);
  if (catF !== "all") list = list.filter(t => t.category === catF);
  if (search) {
    list = list.filter(t =>
      t.category.toLowerCase().includes(search) || (t.note || "").toLowerCase().includes(search));
  }

  $("txnEmpty").style.display = list.length ? "none" : "block";
  renderGroups($("txnGroups"), list);
}

$("searchInput").addEventListener("input", renderTransactionList);
$("categoryFilter").addEventListener("change", renderTransactionList);
document.querySelectorAll("#typeFilter .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#typeFilter .chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    renderTransactionList();
  });
});

/* ---------- RENDER: BUDGETS ---------- */
function renderBudgets() {
  const mKey = currentMonthKey();
  const { monthExpense, totalLimit } = computeTotals();

  const now = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  $("budgetSubhead").textContent = `${monthName()} · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;

  if (totalLimit > 0) {
    $("overallPct").textContent = Math.round((monthExpense / totalLimit) * 100) + "% used";
    $("overallAmounts").innerHTML = `${fmtMoney(monthExpense)}<br>of ${fmtMoney(totalLimit)}`;
  } else {
    $("overallPct").textContent = "No limits yet";
    $("overallAmounts").textContent = "Set one below";
  }

  const container = $("budgetList");
  container.innerHTML = "";

  allCategories("expense").forEach(c => {
    const spent = transactions
      .filter(t => t.type === "expense" && t.category === c.name && monthKey(t.date) === mKey)
      .reduce((s, t) => s + t.amount, 0);
    const limit = Number(budgets[c.name]) || 0;
    const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
    const isOver = limit > 0 && spent > limit;
    const isWarn = limit > 0 && !isOver && spent / limit >= 0.8;

    let status = "No limit set · " + fmtMoney(spent) + " spent";
    if (isOver) status = fmtMoney(spent - limit) + " over budget";
    else if (isWarn) status = fmtMoney(limit - spent) + " left · running close";
    else if (limit > 0) status = fmtMoney(limit - spent) + " left";

    const card = document.createElement("div");
    card.className = "budget-card";
    card.innerHTML = `
      <div class="budget-top">
        <span class="budget-cat-icon" style="background:${catBg("expense", c.name)};">${c.icon}</span>
        <span class="budget-name">${escapeHtml(c.name)}</span>
        <input type="number" class="budget-limit-input" min="0" placeholder="No limit" value="${limit || ""}" data-cat="${escapeHtml(c.name)}">
      </div>
      <div class="budget-bar-track">
        <div class="budget-bar-fill ${isOver ? "over" : isWarn ? "warn" : ""}" style="width:${pct}%;"></div>
      </div>
      <div class="budget-status ${isOver ? "over" : isWarn ? "warn" : ""}">${status}</div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll(".budget-limit-input").forEach(input => {
    input.addEventListener("change", () => {
      const val = parseFloat(input.value);
      if (val > 0) budgets[input.dataset.cat] = val;
      else delete budgets[input.dataset.cat];
      saveBudgets();
      renderBudgets();
      renderDashboard();
    });
  });
}

/* ---------- RENDER: CHARTS ---------- */
function renderCharts() {
  $("chartsMonth").textContent = monthName();
  renderDonut();
  renderBarChart();
  renderTakeaway();
}

function renderDonut() {
  const mKey = currentMonthKey();
  const totals = {};
  transactions
    .filter(t => t.type === "expense" && monthKey(t.date) === mKey)
    .forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount; });

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const svg = $("donutChart");
  const legend = $("donutLegend");
  const holder = svg.parentElement;
  svg.innerHTML = "";
  legend.innerHTML = "";

  if (!entries.length) {
    $("donutEmpty").style.display = "block";
    holder.style.display = "none";
    legend.style.display = "none";
    return;
  }
  $("donutEmpty").style.display = "none";
  holder.style.display = "block";
  legend.style.display = "flex";

  const total = entries.reduce((s, [, v]) => s + v, 0);
  $("donutTotal").textContent = Math.round(total).toLocaleString();

  const radius = 80, circumference = 2 * Math.PI * radius;
  let offset = 0;

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  bg.setAttribute("cx", "100"); bg.setAttribute("cy", "100"); bg.setAttribute("r", radius);
  bg.setAttribute("fill", "none");
  bg.setAttribute("stroke", cssVal("var(--surface-soft)"));
  bg.setAttribute("stroke-width", "30");
  svg.appendChild(bg);

  entries.forEach(([cat, amt]) => {
    const colour = cssVal(catText("expense", cat));
    const dash = (amt / total) * circumference;
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "100"); circle.setAttribute("cy", "100"); circle.setAttribute("r", radius);
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", colour);
    circle.setAttribute("stroke-width", "30");
    circle.setAttribute("stroke-dasharray", `${dash} ${circumference - dash}`);
    circle.setAttribute("stroke-dashoffset", -offset);
    circle.setAttribute("transform", "rotate(-90 100 100)");
    svg.appendChild(circle);
    offset += dash;

    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `
      <span class="legend-dot" style="background:${colour};"></span>
      <span class="legend-label">${escapeHtml(cat)}</span>
      <span class="legend-amt">${fmtPlain(amt)}</span>
    `;
    legend.appendChild(row);
  });
}

function renderBarChart() {
  const svg = $("barChart");
  svg.innerHTML = "";

  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
  }

  const data = months.map(mKey => ({
    mKey,
    income: transactions.filter(t => t.type === "income" && monthKey(t.date) === mKey).reduce((s, t) => s + t.amount, 0),
    expense: transactions.filter(t => t.type === "expense" && monthKey(t.date) === mKey).reduce((s, t) => s + t.amount, 0)
  }));

  const max = Math.max(1, ...data.map(d => Math.max(d.income, d.expense)));
  const chartH = 150, chartTop = 8, chartBottom = chartTop + chartH;
  const groupW = 320 / data.length, barW = 12;
  const incomeCol = cssVal("var(--income-text)");
  const expenseCol = cssVal("var(--expense-text)");
  const mutedCol = cssVal("var(--muted)");
  const textCol = cssVal("var(--text)");

  data.forEach((d, i) => {
    const cx = groupW * i + groupW / 2;
    [[d.income, cx - barW - 2, incomeCol], [d.expense, cx + 2, expenseCol]].forEach(([val, x, colour]) => {
      const h = (val / max) * chartH;
      if (h <= 0) return;
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", x);
      rect.setAttribute("y", chartBottom - h);
      rect.setAttribute("width", barW);
      rect.setAttribute("height", h);
      rect.setAttribute("rx", 4);
      rect.setAttribute("fill", colour);
      svg.appendChild(rect);
    });

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", cx);
    label.setAttribute("y", chartBottom + 20);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "10");
    label.setAttribute("font-weight", "700");
    label.setAttribute("font-family", "Nunito, sans-serif");
    label.setAttribute("fill", i === data.length - 1 ? textCol : mutedCol);
    label.textContent = new Date(d.mKey + "-01T00:00:00").toLocaleDateString(undefined, { month: "short" });
    svg.appendChild(label);
  });
}

function renderTakeaway() {
  const { monthIncome, monthExpense } = computeTotals();
  const el = $("takeaway");
  if (!monthIncome && !monthExpense) {
    el.style.display = "none";
    return;
  }
  el.style.display = "block";
  const saved = monthIncome - monthExpense;
  el.textContent = saved >= 0
    ? `You've saved ${fmtMoney(saved)} this month.`
    : `You've spent ${fmtMoney(-saved)} more than you earned this month.`;
}

/* ---------- INIT ---------- */
function renderAll() {
  renderDashboard();
  populateCategoryFilter();
  renderTransactionList();
  renderBudgets();
  if ($("panel-charts").classList.contains("active")) renderCharts();
}

initTheme();
rebuildCustomCategoryStyles();
$("date").value = today();
renderAll();

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}
