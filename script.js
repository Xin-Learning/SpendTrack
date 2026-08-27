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

function allCategories(type) {
  return [...(CATEGORIES[type] || []), ...(customCategories[type] || [])];
}

function findCategory(type, name) {
  return allCategories(type).find(c => c.name === name);
}

function rebuildCustomCategoryStyles() {
  let styleEl = document.getElementById("customCatStyle");
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

function catBg(type, name) {
  const c = findCategory(type, name);
  return c ? `var(--cat-${c.var}-bg)` : "var(--cat-other-bg)";
}

function catText(type, name) {
  const c = findCategory(type, name);
  return c ? `var(--cat-${c.var}-text)` : "var(--cat-other-text)";
}

function catIcon(type, name) {
  const c = findCategory(type, name);
  return c ? c.icon : "📦";
}

let transactions = load(STORAGE_TXN, []);
let budgets = load(STORAGE_BUDGETS, {});
let customCategories = load(STORAGE_CUSTOM_CATEGORIES, { expense: [], income: [] });

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveTransactions() { localStorage.setItem(STORAGE_TXN, JSON.stringify(transactions)); }
function saveBudgets() { localStorage.setItem(STORAGE_BUDGETS, JSON.stringify(budgets)); }
function saveCustomCategories() { localStorage.setItem(STORAGE_CUSTOM_CATEGORIES, JSON.stringify(customCategories)); }

function fmtMoney(n) {
  const sign = n < 0 ? "-" : "";
  return sign + "RM " + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function pad2(n) { return String(n).padStart(2, "0"); }
function toLocalDateStr(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function today() { return toLocalDateStr(new Date()); }
function monthKey(dateStr) { return dateStr.slice(0, 7); }
function currentMonthKey() { return today().slice(0, 7); }

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- THEME ---------- */
function initTheme() {
  const stored = localStorage.getItem(STORAGE_THEME);
  const theme = stored || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_THEME, theme);
  const icon = theme === "dark" ? "☀️" : "🌙";
  document.getElementById("themeToggle").textContent = icon;
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "dark" ? "light" : "dark");
}

document.getElementById("themeToggle").addEventListener("click", toggleTheme);
document.getElementById("themeToggle2").addEventListener("click", toggleTheme);

/* ---------- TABS ---------- */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

document.querySelectorAll("[data-goto]").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.goto));
});

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === "panel-" + tab));
  if (tab === "charts") renderCharts();
}

/* ---------- SETTINGS MODAL ---------- */
const settingsModal = document.getElementById("settingsModal");
document.getElementById("settingsBtn").addEventListener("click", () => settingsModal.classList.add("open"));
document.getElementById("closeSettings").addEventListener("click", () => settingsModal.classList.remove("open"));
settingsModal.addEventListener("click", e => { if (e.target === settingsModal) settingsModal.classList.remove("open"); });

document.getElementById("exportBtn").addEventListener("click", () => {
  const payload = { transactions, budgets, customCategories, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `spendtrack-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("importBtn").addEventListener("click", () => {
  document.getElementById("importFile").click();
});

document.getElementById("importFile").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try {
      data = JSON.parse(reader.result);
    } catch {
      alert("That file isn't valid JSON.");
      e.target.value = "";
      return;
    }
    if (!Array.isArray(data.transactions) || typeof data.budgets !== "object") {
      alert("That file doesn't look like a SpendTrack backup.");
      e.target.value = "";
      return;
    }
    if (!confirm("This will replace your current transactions and budgets with the imported backup. Continue?")) {
      e.target.value = "";
      return;
    }
    transactions = data.transactions;
    budgets = data.budgets;
    customCategories = data.customCategories && typeof data.customCategories === "object"
      ? { expense: data.customCategories.expense || [], income: data.customCategories.income || [] }
      : { expense: [], income: [] };
    saveTransactions();
    saveBudgets();
    saveCustomCategories();
    rebuildCustomCategoryStyles();
    renderAll();
    settingsModal.classList.remove("open");
    e.target.value = "";
  };
  reader.readAsText(file);
});

/* ---------- TRANSACTION MODAL ---------- */
const txnModal = document.getElementById("txnModal");
const txnForm = document.getElementById("txnForm");
const modalTitle = document.getElementById("modalTitle");
const deleteTxnBtn = document.getElementById("deleteTxnBtn");
let modalType = "income";

const typeButtons = document.querySelectorAll("#txnModal .type-btn");
typeButtons.forEach(btn => {
  btn.addEventListener("click", () => setModalType(btn.dataset.type));
});

function setModalType(type) {
  modalType = type;
  typeButtons.forEach(b => b.classList.toggle("active", b.dataset.type === type));
  document.getElementById("newCategoryPanel").style.display = "none";
  populateCategorySelect();
}

function populateCategorySelect(selected) {
  const select = document.getElementById("category");
  select.innerHTML = "";
  allCategories(modalType).forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.icon + " " + c.name;
    select.appendChild(opt);
  });
  const addOpt = document.createElement("option");
  addOpt.value = "__add__";
  addOpt.textContent = "➕ Add new category";
  select.appendChild(addOpt);
  if (selected) select.value = selected;
}

function renderPaletteSwatches() {
  const container = document.getElementById("paletteSwatches");
  container.innerHTML = "";
  PALETTES.forEach((p, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "palette-swatch" + (i === selectedPaletteIndex ? " selected" : "");
    btn.style.background = p.lightBg;
    btn.title = p.name;
    btn.addEventListener("click", () => {
      selectedPaletteIndex = i;
      renderPaletteSwatches();
    });
    container.appendChild(btn);
  });
}

let selectedPaletteIndex = 0;

document.getElementById("category").addEventListener("change", e => {
  if (e.target.value === "__add__") {
    document.getElementById("newCategoryPanel").style.display = "block";
    selectedPaletteIndex = 0;
    renderPaletteSwatches();
    document.getElementById("newCatName").focus();
  }
});

document.getElementById("cancelNewCat").addEventListener("click", () => {
  document.getElementById("newCategoryPanel").style.display = "none";
  document.getElementById("newCatName").value = "";
  document.getElementById("newCatIcon").value = "";
  populateCategorySelect();
});

document.getElementById("confirmNewCat").addEventListener("click", () => {
  const name = document.getElementById("newCatName").value.trim();
  if (!name) {
    alert("Please enter a category name.");
    return;
  }
  if (allCategories(modalType).some(c => c.name.toLowerCase() === name.toLowerCase())) {
    alert("That category already exists.");
    return;
  }
  const icon = document.getElementById("newCatIcon").value.trim() || "🏷️";
  const varId = "custom" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  customCategories[modalType].push({ name, icon, var: varId, paletteIndex: selectedPaletteIndex });
  saveCustomCategories();
  rebuildCustomCategoryStyles();

  document.getElementById("newCategoryPanel").style.display = "none";
  document.getElementById("newCatName").value = "";
  document.getElementById("newCatIcon").value = "";
  populateCategorySelect(name);
  populateCategoryFilter();
  renderBudgets();
});

function openAddModal() {
  modalTitle.textContent = "Add Transaction";
  deleteTxnBtn.style.display = "none";
  document.getElementById("txnId").value = "";
  txnForm.reset();
  document.getElementById("date").value = today();
  setModalType("income");
  txnModal.classList.add("open");
}

function openEditModal(id) {
  const t = transactions.find(x => x.id === id);
  if (!t) return;
  modalTitle.textContent = "Edit Transaction";
  deleteTxnBtn.style.display = "inline-block";
  document.getElementById("txnId").value = t.id;
  document.getElementById("amount").value = t.amount;
  document.getElementById("date").value = t.date;
  document.getElementById("paymentMethod").value = t.paymentMethod;
  document.getElementById("note").value = t.note || "";
  modalType = t.type;
  typeButtons.forEach(b => b.classList.toggle("active", b.dataset.type === t.type));
  document.getElementById("newCategoryPanel").style.display = "none";
  populateCategorySelect(t.category);
  txnModal.classList.add("open");
}

function closeTxnModal() { txnModal.classList.remove("open"); }

document.getElementById("fabAdd").addEventListener("click", openAddModal);
document.getElementById("closeModal").addEventListener("click", closeTxnModal);
txnModal.addEventListener("click", e => { if (e.target === txnModal) closeTxnModal(); });

txnForm.addEventListener("submit", e => {
  e.preventDefault();
  const id = document.getElementById("txnId").value;
  const amount = parseFloat(document.getElementById("amount").value);
  if (!amount || amount <= 0) return;
  if (document.getElementById("category").value === "__add__") {
    alert("Finish adding your new category first, or pick an existing one.");
    return;
  }

  const data = {
    type: modalType,
    amount,
    category: document.getElementById("category").value,
    date: document.getElementById("date").value,
    paymentMethod: document.getElementById("paymentMethod").value,
    note: document.getElementById("note").value.trim()
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

deleteTxnBtn.addEventListener("click", () => {
  const id = document.getElementById("txnId").value;
  if (!id) return;
  if (!confirm("Delete this transaction?")) return;
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  closeTxnModal();
  renderAll();
});

/* ---------- COMPUTATIONS ---------- */
function computeTotals() {
  const balance = transactions.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
  const mKey = currentMonthKey();
  const monthTxns = transactions.filter(t => monthKey(t.date) === mKey);
  const monthIncome = monthTxns.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTxns.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  return { balance, monthIncome, monthExpense, monthSavings: monthIncome - monthExpense };
}

/* ---------- RENDER: DASHBOARD ---------- */
function renderDashboard() {
  const { balance, monthIncome, monthExpense, monthSavings } = computeTotals();
  document.getElementById("statBalance").textContent = fmtMoney(balance);
  document.getElementById("statIncome").textContent = "▲ " + fmtMoney(monthIncome);
  document.getElementById("statExpense").textContent = "▼ " + fmtMoney(monthExpense);
  document.getElementById("statSavings").textContent = fmtMoney(monthSavings);

  const recent = transactions.slice(0, 5);
  const recentList = document.getElementById("recentList");
  recentList.innerHTML = "";
  document.getElementById("recentEmpty").style.display = recent.length === 0 ? "block" : "none";
  recent.forEach(t => recentList.appendChild(buildTxnRow(t)));
}

/* ---------- RENDER: TRANSACTIONS ---------- */
function populateCategoryFilter() {
  const select = document.getElementById("categoryFilter");
  const currentVal = select.value;
  select.innerHTML = '<option value="all">All categories</option>';
  const allCats = [...allCategories("income"), ...allCategories("expense")];
  const seen = new Set();
  allCats.forEach(c => {
    if (seen.has(c.name)) return;
    seen.add(c.name);
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.icon + " " + c.name;
    select.appendChild(opt);
  });
  select.value = currentVal || "all";
}

function buildTxnRow(t) {
  const li = document.createElement("li");
  li.className = "txn-item";
  li.style.background = catBg(t.type, t.category);
  li.innerHTML = `
    <div class="txn-icon" style="background:rgba(255,255,255,0.5);">${catIcon(t.type, t.category)}</div>
    <div class="txn-info">
      <span class="txn-cat">${escapeHtml(t.category)}${t.note ? " · " + escapeHtml(t.note) : ""}</span>
      <span class="txn-meta">${fmtDate(t.date)} · ${escapeHtml(t.paymentMethod)}</span>
    </div>
    <span class="txn-amount ${t.type}">${t.type === "income" ? "+" : "-"}${fmtMoney(t.amount)}</span>
  `;
  li.addEventListener("click", () => openEditModal(t.id));
  return li;
}

function renderTransactionList() {
  const search = document.getElementById("searchInput").value.trim().toLowerCase();
  const typeF = document.querySelector("#typeFilter .chip.active").dataset.type;
  const catF = document.getElementById("categoryFilter").value;

  let list = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  if (typeF !== "all") list = list.filter(t => t.type === typeF);
  if (catF !== "all") list = list.filter(t => t.category === catF);
  if (search) {
    list = list.filter(t =>
      t.category.toLowerCase().includes(search) ||
      (t.note || "").toLowerCase().includes(search)
    );
  }

  const container = document.getElementById("txnFullList");
  container.innerHTML = "";
  document.getElementById("txnEmpty").style.display = list.length === 0 ? "block" : "none";
  list.forEach(t => container.appendChild(buildTxnRow(t)));
}

document.getElementById("searchInput").addEventListener("input", renderTransactionList);
document.getElementById("categoryFilter").addEventListener("change", renderTransactionList);
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
  const container = document.getElementById("budgetList");
  container.innerHTML = "";

  allCategories("expense").forEach(c => {
    const spent = transactions
      .filter(t => t.type === "expense" && t.category === c.name && monthKey(t.date) === mKey)
      .reduce((s, t) => s + t.amount, 0);
    const limit = budgets[c.name] || 0;
    const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
    const isOver = limit > 0 && spent > limit;
    const isWarn = limit > 0 && !isOver && spent / limit >= 0.8;

    const card = document.createElement("div");
    card.className = "budget-card";
    card.innerHTML = `
      <div class="budget-top">
        <div class="budget-cat">
          <span class="budget-cat-icon" style="background:${catBg("expense", c.name)};">${c.icon}</span>
          ${c.name}
        </div>
        <input type="number" class="budget-limit-input" min="0" placeholder="No limit" value="${limit || ""}" data-cat="${c.name}">
      </div>
      <div class="budget-bar-track">
        <div class="budget-bar-fill ${isOver ? "over" : isWarn ? "warn" : ""}" style="width:${limit > 0 ? pct : 0}%;"></div>
      </div>
      <div class="budget-sub ${isOver ? "over-text" : ""}">
        <span>${fmtMoney(spent)} spent</span>
        <span>${limit > 0 ? (isOver ? "Over budget!" : fmtMoney(limit - spent) + " left") : "No limit set"}</span>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll(".budget-limit-input").forEach(input => {
    input.addEventListener("change", () => {
      const cat = input.dataset.cat;
      const val = parseFloat(input.value);
      if (val > 0) budgets[cat] = val;
      else delete budgets[cat];
      saveBudgets();
      renderBudgets();
    });
  });
}

/* ---------- RENDER: CHARTS ---------- */
function renderCharts() {
  renderDonut();
  renderBarChart();
}

function renderDonut() {
  const mKey = currentMonthKey();
  const totals = {};
  transactions
    .filter(t => t.type === "expense" && monthKey(t.date) === mKey)
    .forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount; });

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const svg = document.getElementById("donutChart");
  const legend = document.getElementById("donutLegend");
  const emptyEl = document.getElementById("donutEmpty");
  svg.innerHTML = "";
  legend.innerHTML = "";

  if (entries.length === 0) {
    emptyEl.style.display = "block";
    svg.style.display = "none";
    legend.style.display = "none";
    return;
  }
  emptyEl.style.display = "none";
  svg.style.display = "block";
  legend.style.display = "flex";

  const total = entries.reduce((s, [, v]) => s + v, 0);
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  bg.setAttribute("cx", "100"); bg.setAttribute("cy", "100"); bg.setAttribute("r", radius);
  bg.setAttribute("fill", "none");
  bg.setAttribute("stroke", "var(--surface-soft)");
  bg.setAttribute("stroke-width", "28");
  svg.appendChild(bg);

  entries.forEach(([cat, amt]) => {
    const frac = amt / total;
    const dash = frac * circumference;
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "100"); circle.setAttribute("cy", "100"); circle.setAttribute("r", radius);
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", catText("expense", cat));
    circle.setAttribute("stroke-width", "28");
    circle.setAttribute("stroke-dasharray", `${dash} ${circumference - dash}`);
    circle.setAttribute("stroke-dashoffset", -offset);
    circle.setAttribute("transform", "rotate(-90 100 100)");
    svg.appendChild(circle);
    offset += dash;

    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `
      <span class="legend-dot" style="background:${catText("expense", cat)};"></span>
      <span class="legend-label">${escapeHtml(cat)}</span>
      <span class="legend-amt">${fmtMoney(amt)}</span>
    `;
    legend.appendChild(row);
  });
}

function renderBarChart() {
  const svg = document.getElementById("barChart");
  svg.innerHTML = "";

  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
  }

  const data = months.map(mKey => {
    const income = transactions.filter(t => t.type === "income" && monthKey(t.date) === mKey).reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === "expense" && monthKey(t.date) === mKey).reduce((s, t) => s + t.amount, 0);
    return { mKey, income, expense };
  });

  const max = Math.max(1, ...data.map(d => Math.max(d.income, d.expense)));
  const chartH = 150, chartTop = 10, chartBottom = chartTop + chartH;
  const groupW = 320 / data.length;
  const barW = 12;

  data.forEach((d, i) => {
    const cx = groupW * i + groupW / 2;
    const incomeH = (d.income / max) * chartH;
    const expenseH = (d.expense / max) * chartH;

    const incomeRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    incomeRect.setAttribute("x", cx - barW - 2);
    incomeRect.setAttribute("y", chartBottom - incomeH);
    incomeRect.setAttribute("width", barW);
    incomeRect.setAttribute("height", incomeH);
    incomeRect.setAttribute("rx", 4);
    incomeRect.setAttribute("fill", "var(--income-text)");
    svg.appendChild(incomeRect);

    const expenseRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    expenseRect.setAttribute("x", cx + 2);
    expenseRect.setAttribute("y", chartBottom - expenseH);
    expenseRect.setAttribute("width", barW);
    expenseRect.setAttribute("height", expenseH);
    expenseRect.setAttribute("rx", 4);
    expenseRect.setAttribute("fill", "var(--expense-text)");
    svg.appendChild(expenseRect);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", cx);
    label.setAttribute("y", chartBottom + 16);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "9");
    label.setAttribute("fill", "var(--muted)");
    const d2 = new Date(d.mKey + "-01T00:00:00");
    label.textContent = d2.toLocaleDateString(undefined, { month: "short" });
    svg.appendChild(label);
  });
}

/* ---------- RENDER ALL ---------- */
function renderAll() {
  renderDashboard();
  populateCategoryFilter();
  renderTransactionList();
  renderBudgets();
  if (document.getElementById("panel-charts").classList.contains("active")) renderCharts();
}

initTheme();
rebuildCustomCategoryStyles();
populateCategorySelect();
document.getElementById("date").value = today();
renderAll();

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}
