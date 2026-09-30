(() => {
  "use strict";

  const S = window.STORE;
  const $ = id => document.getElementById(id);

  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const COUNTRIES = [
    ["MY", "60"], ["SG", "65"], ["BN", "673"], ["ID", "62"], ["TH", "66"], ["PH", "63"],
    ["VN", "84"], ["CN", "86"], ["HK", "852"], ["TW", "886"], ["AU", "61"], ["GB", "44"], ["US", "1"]
  ];
  const K = {
    cart: "foodstore.cart",
    customer: "foodstore.customer",
    lastOrder: "foodstore.lastOrder",
    installHidden: "foodstore.installHidden"
  };

  /* ---------- STORAGE ---------- */
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode etc. */ }
  }

  /* ---------- HELPERS ---------- */
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const cents = rm => Math.round(Number(rm || 0) * 100);
  function money(c) {
    return `${S.currency || "RM"} ${(c / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  const pad2 = n => String(n).padStart(2, "0");
  const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  function toMin(hhmm) { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }
  function fmtTime(min) {
    const h = Math.floor(min / 60), m = min % 60;
    return `${h % 12 || 12}:${pad2(m)} ${h >= 12 ? "PM" : "AM"}`;
  }
  function dateFromYmd(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
  function dayName(d) {
    const t = new Date();
    const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return DAY_SHORT[d.getDay()];
  }
  const fullDate = d => `${DAY_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const isImage = s => /[./]/.test(s || "");

  let toastTimer;
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  /* ---------- MENU ---------- */
  const itemsById = new Map(S.items.map(i => [i.id, i]));
  const groupMax = g => g.max || 1;

  function picture(item, cls) {
    const src = item.image || (isImage(item.emoji) ? item.emoji : "");
    return src
      ? `<div class="${cls}"><img src="${esc(src)}" alt="" loading="lazy"></div>`
      : `<div class="${cls}" aria-hidden="true">${esc(item.emoji || "🍽️")}</div>`;
  }

  // choices: { [groupName]: [choiceName, ...] }
  function unitPrice(item, choices) {
    let total = cents(item.price);
    (item.options || []).forEach(g => {
      (choices[g.name] || []).forEach(name => {
        const c = g.choices.find(ch => ch.name === name);
        if (c) total += cents(c.price);
      });
    });
    return total;
  }

  function choiceSummary(item, choices) {
    return (item.options || [])
      .filter(g => (choices[g.name] || []).length)
      .map(g => `${g.name}: ${choices[g.name].join(", ")}`);
  }

  // Keeps choices in menu order so identical picks produce the same cart line.
  function normalizeChoices(item, choices) {
    const out = {};
    (item.options || []).forEach(g => {
      const picked = g.choices.map(c => c.name).filter(n => (choices[g.name] || []).includes(n));
      if (picked.length) out[g.name] = picked;
    });
    return out;
  }

  const lineKey = l => `${l.itemId}|${JSON.stringify(l.choices)}|${l.note || ""}`;

  function validLine(l) {
    const item = l && itemsById.get(l.itemId);
    if (!item || item.soldOut || !Number.isInteger(l.qty) || l.qty < 1) return false;
    const groups = item.options || [];
    const picked = l.choices || {};
    if (Object.keys(picked).some(name => !groups.some(g => g.name === name))) return false;
    return groups.every(g => {
      const sel = picked[g.name] || [];
      if (!Array.isArray(sel) || sel.length > groupMax(g)) return false;
      if (g.required && !sel.length) return false;
      return sel.every(n => g.choices.some(c => c.name === n && !c.soldOut));
    });
  }

  /* ---------- STATE ---------- */
  let cart = load(K.cart, []).filter(validLine).map(l => ({ ...l, key: lineKey(l) }));
  const customer = load(K.customer, {});
  let mode = customer.mode;
  let slot = null;            // { date: "YYYY-MM-DD", time: minutes }
  let pickDate = null;
  let payment = customer.payment;
  let reviewInView = false;

  function saveCart() { save(K.cart, cart.map(({ key, ...l }) => l)); }

  function saveCustomer() {
    save(K.customer, {
      name: $("custName").value.trim(),
      cc: $("custCc").value,
      phone: $("custPhone").value.trim(),
      address: $("custAddress").value.trim(),
      mode,
      payment
    });
  }

  function totals() {
    const subtotal = cart.reduce((s, l) => s + unitPrice(itemsById.get(l.itemId), l.choices) * l.qty, 0);
    const count = cart.reduce((s, l) => s + l.qty, 0);
    let fee = 0, minOrder = cents(S.pickup && S.pickup.minOrder);
    if (mode === "delivery") {
      const d = S.delivery;
      fee = d.freeAbove && subtotal >= cents(d.freeAbove) ? 0 : cents(d.fee);
      minOrder = cents(d.minOrder);
    }
    return { subtotal, fee, total: subtotal + fee, count, minOrder };
  }

  function qtyOfItem(id) { return cart.filter(l => l.itemId === id).reduce((s, l) => s + l.qty, 0); }

  function addLine(line) {
    line.key = lineKey(line);
    const existing = cart.find(l => l.key === line.key);
    if (existing) existing.qty += line.qty;
    else cart.push(line);
  }

  /* ---------- SCHEDULE ---------- */
  function hoursOn(d) {
    if ((S.closedDates || []).includes(ymd(d))) return null;
    const h = S.hours[DAY_KEYS[d.getDay()]];
    return h ? [toMin(h[0]), toMin(h[1])] : null;
  }

  function availableDays() {
    const now = new Date();
    const earliest = now.getTime() + (S.leadMinutes || 0) * 60000;
    const step = S.slotMinutes || 30;
    const days = [];
    for (let i = 0; i < (S.daysAhead || 7); i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const h = hoursOn(d);
      if (!h) continue;
      const slots = [];
      for (let t = h[0]; t + step <= h[1]; t += step) {
        if (new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, t).getTime() >= earliest) slots.push(t);
      }
      if (slots.length) days.push({ date: ymd(d), d, slots });
    }
    return days;
  }

  function slotStillOpen(s) {
    return !!s && availableDays().some(day => day.date === s.date && day.slots.includes(s.time));
  }

  function storeStatus() {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const today = hoursOn(now);
    if (today && nowMin >= today[0] && nowMin < today[1]) return { open: true, text: `Open until ${fmtTime(today[1])}` };
    for (let i = 0; i < 8; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const h = hoursOn(d);
      if (!h || (i === 0 && nowMin >= h[0])) continue;
      const when = i === 0 ? "" : i === 1 ? "tomorrow " : `${DAY_SHORT[d.getDay()]} `;
      return { open: false, text: `Closed · opens ${when}${fmtTime(h[0])}` };
    }
    return { open: false, text: "Closed" };
  }

  /* ---------- STORE INFO ---------- */
  function renderStore() {
    document.title = `${S.title || "Order"} · ${S.name}`;
    if (/^#[0-9a-f]{6}$/i.test(S.accent || "")) {
      document.documentElement.style.setProperty("--accent", S.accent);
      // Dark text on light brand colours, white text on dark ones.
      const rgb = S.accent.slice(1).match(/../g).map(h => parseInt(h, 16) / 255)
        .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      document.documentElement.style.setProperty("--on-accent", lum > 0.4 ? "#111111" : "#FFFFFF");
    }

    $("brandLogo").innerHTML = isImage(S.logo) ? `<img src="${esc(S.logo)}" alt="">` : esc(S.logo || "");
    $("brandTitle").textContent = S.title || "Place your order";
    $("storeName").textContent = S.name;
    const st = storeStatus();
    $("storeStatus").textContent = st.text;
    $("storeStatus").classList.toggle("open", st.open);

    $("notice").hidden = !S.notice;
    $("notice").textContent = S.notice || "";

    $("footAddress").textContent = S.address || "";
    if (S.mapsUrl) $("footAddress").href = S.mapsUrl;
    const order = [1, 2, 3, 4, 5, 6, 0];
    $("footHours").innerHTML = order.map(i => {
      const h = S.hours[DAY_KEYS[i]];
      return `<dt>${DAY_SHORT[i]}</dt><dd>${h ? `${fmtTime(toMin(h[0]))} – ${fmtTime(toMin(h[1]))}` : "Closed"}</dd>`;
    }).join("");

    const ccOptions = COUNTRIES.map(([code, dial]) => `<option value="${dial}">${code} +${dial}</option>`).join("");
    $("custCc").innerHTML = ccOptions;
    $("recCc").innerHTML = ccOptions;
  }

  /* ---------- MENU RENDER ---------- */
  function stepperHtml(qty, attr) {
    return `<div class="stepper">
      <button type="button" ${attr} data-step="-1" aria-label="Remove one">−</button>
      <span>${qty}</span>
      <button type="button" ${attr} data-step="1" aria-label="Add one">+</button>
    </div>`;
  }

  function itemCardInner(item) {
    const qty = qtyOfItem(item.id);
    const hasOptions = (item.options || []).length > 0;
    let action;
    if (item.soldOut) action = `<span class="sold-out">Sold out</span>`;
    else if (qty && !hasOptions) action = stepperHtml(qty, `data-item="${esc(item.id)}"`);
    else action = `<button type="button" class="add-btn" data-open="${esc(item.id)}">Add</button>`;
    const tags = (item.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join("");
    const badge = qty ? `<span class="thumb-badge" aria-label="${qty} in your order">${qty}</span>` : "";
    return `
      <div class="thumb-wrap">${picture(item, "thumb")}${badge}</div>
      <div class="item-body">
        <button type="button" class="item-name" data-open="${esc(item.id)}" ${item.soldOut ? "disabled" : ""}>${esc(item.name)}</button>
        ${tags ? `<div class="tags">${tags}</div>` : ""}
        ${item.description ? `<p class="item-desc">${esc(item.description)}</p>` : ""}
        <div class="item-foot">
          <span class="item-price">${money(cents(item.price))}${hasOptions && item.options.some(g => g.choices.some(c => c.price)) ? "+" : ""}</span>
          ${action}
        </div>
      </div>`;
  }

  function renderMenu() {
    const cats = S.categories.filter(c => S.items.some(i => i.category === c.id));
    $("catNav").innerHTML = cats.map((c, i) =>
      `<button type="button" class="chip${i === 0 ? " active" : ""}" data-cat="${esc(c.id)}">${esc(c.name)}</button>`).join("");
    $("menu").innerHTML = cats.map(c => `
      <div class="cat-group" id="cat-${esc(c.id)}" data-cat="${esc(c.id)}">
        <h3 class="cat-title">${esc(c.name)}</h3>
        ${S.items.filter(i => i.category === c.id).map(i =>
          `<article class="item${i.soldOut ? " is-sold-out" : ""}" data-id="${esc(i.id)}">${itemCardInner(i)}</article>`).join("")}
      </div>`).join("");
    observeCategories();
  }

  // Re-renders part of the page while keeping keyboard focus on the same control.
  function keepFocus(fn) {
    const a = document.activeElement;
    const sel = a && a.dataset && a.dataset.step
      ? `[data-step="${a.dataset.step}"]${a.dataset.item ? `[data-item="${CSS.escape(a.dataset.item)}"]` : ""}${a.dataset.line ? `[data-line="${a.dataset.line}"]` : ""}`
      : null;
    fn();
    if (sel) {
      const next = document.querySelector(sel);
      if (next) next.focus();
    }
  }

  function refreshItemCard(id) {
    const card = document.querySelector(`.item[data-id="${CSS.escape(id)}"]`);
    if (card) card.innerHTML = itemCardInner(itemsById.get(id));
  }

  let catObserver;
  function observeCategories() {
    if (catObserver) catObserver.disconnect();
    if (!("IntersectionObserver" in window)) return;
    catObserver = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActiveChip(e.target.dataset.cat); });
    }, { rootMargin: "-80px 0px -65% 0px" });
    document.querySelectorAll(".cat-group").forEach(g => catObserver.observe(g));
  }

  function setActiveChip(id) {
    const nav = $("catNav");
    nav.querySelectorAll(".chip").forEach(c => {
      const on = c.dataset.cat === id;
      c.classList.toggle("active", on);
      if (on) nav.scrollTo({ left: c.offsetLeft - 16, behavior: "smooth" });
    });
  }

  $("catNav").addEventListener("click", e => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    setActiveChip(chip.dataset.cat);
    $(`cat-${chip.dataset.cat}`).scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("menu").addEventListener("click", e => {
    const step = e.target.closest("[data-step][data-item]");
    if (step) {
      changeItemQty(step.dataset.item, Number(step.dataset.step));
      return;
    }
    const opener = e.target.closest("[data-open]") || e.target.closest(".thumb, .item-desc");
    if (!opener) return;
    const card = e.target.closest(".item");
    const item = card && itemsById.get(card.dataset.id);
    if (!item || item.soldOut) return;
    const hasOptions = (item.options || []).length > 0;
    // Plain items: "Add" goes straight into the order; tapping the name/picture opens details.
    if (!hasOptions && opener.classList.contains("add-btn")) {
      changeItemQty(item.id, 1);
      toast(`Added ${item.name}`);
    } else {
      openItemSheet(item.id);
    }
  });

  function changeItemQty(id, delta) {
    const lines = cart.filter(l => l.itemId === id);
    if (delta > 0) {
      if (lines.length) lines[lines.length - 1].qty += 1;
      else addLine({ itemId: id, qty: 1, choices: {}, note: "" });
    } else if (lines.length) {
      const last = lines[lines.length - 1];
      last.qty -= 1;
      if (last.qty < 1) cart = cart.filter(l => l !== last);
    }
    cartChanged(id);
  }

  function cartChanged(itemId) {
    saveCart();
    keepFocus(() => {
      if (itemId) refreshItemCard(itemId);
      else S.items.forEach(i => refreshItemCard(i.id));
      renderReview();
    });
    renderBar();
    renderReorder();
    clearError("menu");
  }

  /* ---------- ITEM SHEET ---------- */
  let sheet = null; // { item, qty, editKey }

  function openItemSheet(id, editKey) {
    const item = itemsById.get(id);
    const editing = editKey ? cart.find(l => l.key === editKey) : null;
    sheet = { item, qty: editing ? editing.qty : 1, editKey: editing ? editKey : null };
    const choices = editing ? editing.choices : {};

    $("sheetHero").innerHTML = picture(item, "hero-pic");
    $("sheetTitle").textContent = item.name;
    $("sheetDesc").textContent = item.description || "";
    $("sheetPrice").textContent = money(cents(item.price));
    $("sheetNote").value = editing ? editing.note || "" : "";
    $("sheetOptions").innerHTML = (item.options || []).map((g, gi) => {
      const max = groupMax(g);
      const radio = g.required && max === 1;
      const rule = g.required ? (max > 1 ? `Pick 1–${max}` : "Required") : (max > 1 ? `Optional · up to ${max}` : "Optional");
      return `<fieldset class="opt-group" data-group="${gi}">
        <legend class="opt-head"><span class="opt-title">${esc(g.name)}</span><span class="opt-rule${g.required ? " req" : ""}">${rule}</span></legend>
        ${g.choices.map((c, ci) => `
          <label class="opt-row${c.soldOut ? " disabled" : ""}">
            <input type="${radio ? "radio" : "checkbox"}" name="opt-${gi}" value="${ci}"
              ${(choices[g.name] || []).includes(c.name) ? "checked" : ""} ${c.soldOut ? "disabled" : ""}>
            <span class="opt-name">${esc(c.name)}${c.soldOut ? " (sold out)" : ""}</span>
            ${c.price ? `<span class="opt-price">+${money(cents(c.price))}</span>` : ""}
          </label>`).join("")}
      </fieldset>`;
    }).join("");
    applyGroupLimits();
    updateSheetFoot();
    openOverlay("itemSheet");
    $("itemSheet").querySelector(".sheet-scroll").scrollTop = 0;
  }

  function readSheetChoices() {
    const choices = {};
    (sheet.item.options || []).forEach((g, gi) => {
      const picked = [...document.querySelectorAll(`#sheetOptions input[name="opt-${gi}"]:checked`)]
        .map(i => g.choices[Number(i.value)].name);
      if (picked.length) choices[g.name] = picked;
    });
    return choices;
  }

  // Disables extra checkboxes once a group's limit is reached.
  function applyGroupLimits() {
    (sheet.item.options || []).forEach((g, gi) => {
      const max = groupMax(g);
      const inputs = [...document.querySelectorAll(`#sheetOptions input[name="opt-${gi}"]`)];
      if (inputs[0] && inputs[0].type === "radio") return;
      const full = inputs.filter(i => i.checked).length >= max && max > 1;
      inputs.forEach((i, ci) => {
        const soldOut = !!g.choices[ci].soldOut;
        i.disabled = soldOut || (full && !i.checked);
        i.closest(".opt-row").classList.toggle("disabled", i.disabled);
      });
    });
  }

  function updateSheetFoot() {
    const price = unitPrice(sheet.item, readSheetChoices()) * sheet.qty;
    $("sheetQty").textContent = sheet.qty;
    $("sheetMinus").disabled = sheet.qty <= 1;
    $("sheetAdd").textContent = `${sheet.editKey ? "Update" : "Add"} · ${money(price)}`;
  }

  $("sheetOptions").addEventListener("change", e => {
    const input = e.target;
    const group = input.closest(".opt-group");
    const g = sheet.item.options[Number(group.dataset.group)];
    // Single-choice optional groups behave like radios you can untick.
    if (input.type === "checkbox" && input.checked && groupMax(g) === 1) {
      group.querySelectorAll("input").forEach(i => { if (i !== input) i.checked = false; });
    }
    group.classList.remove("invalid");
    applyGroupLimits();
    updateSheetFoot();
  });

  $("sheetMinus").addEventListener("click", () => { sheet.qty = Math.max(1, sheet.qty - 1); updateSheetFoot(); });
  $("sheetPlus").addEventListener("click", () => { sheet.qty = Math.min(99, sheet.qty + 1); updateSheetFoot(); });

  $("sheetAdd").addEventListener("click", () => {
    const { item } = sheet;
    const choices = readSheetChoices();
    const missing = (item.options || []).findIndex(g => g.required && !(choices[g.name] || []).length);
    if (missing >= 0) {
      const el = document.querySelector(`#sheetOptions [data-group="${missing}"]`);
      el.classList.add("invalid");
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      toast(`Please choose ${item.options[missing].name.toLowerCase()}`);
      return;
    }
    if (sheet.editKey) cart = cart.filter(l => l.key !== sheet.editKey);
    addLine({ itemId: item.id, qty: sheet.qty, choices: normalizeChoices(item, choices), note: $("sheetNote").value.trim() });
    const edited = !!sheet.editKey;
    closeOverlay();
    cartChanged(item.id);
    toast(edited ? "Order updated" : `Added ${item.name}`);
  });

  /* ---------- OVERLAYS ---------- */
  let openId = null;
  let returnFocus = null;

  function openOverlay(id) {
    if (openId) $(openId).classList.remove("open");
    else {
      returnFocus = document.activeElement;
      history.pushState({ foodstoreOverlay: true }, "");
    }
    openId = id;
    $(id).classList.add("open");
    document.body.classList.add("locked");
    setTimeout(() => { const x = $(id).querySelector("[data-close]"); if (x) x.focus({ preventScroll: true }); }, 50);
  }

  function hideOverlay() {
    if (!openId) return;
    $(openId).classList.remove("open");
    openId = null;
    document.body.classList.remove("locked");
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
  }

  function closeOverlay() {
    if (history.state && history.state.foodstoreOverlay) history.back();
    else hideOverlay();
  }

  // Phone "back" closes the sheet instead of leaving the page.
  window.addEventListener("popstate", hideOverlay);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && openId) closeOverlay(); });
  document.querySelectorAll(".overlay").forEach(o => {
    o.addEventListener("click", e => { if (e.target === o || e.target.closest("[data-close]")) closeOverlay(); });
  });

  /* ---------- PICKUP / DELIVERY ---------- */
  function modesEnabled() {
    return ["pickup", "delivery"].filter(m => S[m] && S[m].enabled);
  }

  function renderMode() {
    const modes = modesEnabled();
    if (!modes.includes(mode)) mode = modes[0];
    $("modeSeg").hidden = modes.length < 2;
    $("fulfilTitle").textContent = modes.length < 2 ? (mode === "delivery" ? "Delivery" : "Pickup") : "Pickup or delivery";
    $("modeSeg").querySelectorAll("button").forEach(b => {
      const on = b.dataset.mode === mode;
      b.classList.toggle("active", on);
      b.setAttribute("aria-checked", on);
    });
    if (mode === "delivery") {
      const d = S.delivery;
      const bits = [`Delivery fee ${money(cents(d.fee))}`];
      if (d.freeAbove) bits.push(`free from ${money(cents(d.freeAbove))}`);
      if (d.minOrder) bits.push(`minimum order ${money(cents(d.minOrder))}`);
      $("modeInfo").innerHTML = `${esc(bits.join(" · "))}${d.note ? `<br>${esc(d.note)}` : ""}`;
    } else {
      $("modeInfo").innerHTML = `Collect from <a href="${esc(S.mapsUrl || "#")}" target="_blank" rel="noopener">${esc(S.address || "our shop")}</a>`;
    }
    $("addressField").hidden = mode !== "delivery";
    $("whenTitle").textContent = mode === "delivery" ? "Delivery time" : "Pickup time";
  }

  $("modeSeg").addEventListener("click", e => {
    const b = e.target.closest("[data-mode]");
    if (!b || b.dataset.mode === mode) return;
    mode = b.dataset.mode;
    renderMode();
    renderReview();
    renderBar();
    saveCustomer();
  });

  /* ---------- DATE & TIME ---------- */
  function renderWhen() {
    const days = availableDays();
    if (!days.length) {
      $("dateRow").innerHTML = "";
      $("slotGrid").innerHTML = `<p class="hint">Sorry, there are no times available right now. Please check back later.</p>`;
      slot = null;
      return;
    }
    if (slot && !slotStillOpen(slot)) {
      slot = null;
      setError("slot", "Sorry, the time you picked is no longer available. Please pick another.");
    }
    if (!pickDate || !days.some(d => d.date === pickDate)) pickDate = slot ? slot.date : days[0].date;

    $("dateRow").innerHTML = days.map(day => {
      const on = day.date === pickDate;
      return `<button type="button" role="radio" aria-checked="${on}" class="date-chip${on ? " active" : ""}" data-date="${day.date}">
        <span>${dayName(day.d)}</span><strong>${day.d.getDate()} ${MONTHS[day.d.getMonth()]}</strong></button>`;
    }).join("");
    const day = days.find(d => d.date === pickDate);
    $("slotGrid").innerHTML = day.slots.map(t => {
      const on = slot && slot.date === day.date && slot.time === t;
      return `<button type="button" role="radio" aria-checked="${!!on}" class="slot${on ? " active" : ""}" data-time="${t}">${fmtTime(t)}</button>`;
    }).join("");
  }

  $("dateRow").addEventListener("click", e => {
    const b = e.target.closest("[data-date]");
    if (!b) return;
    pickDate = b.dataset.date;
    renderWhen();
  });

  $("slotGrid").addEventListener("click", e => {
    const b = e.target.closest("[data-time]");
    if (!b) return;
    slot = { date: pickDate, time: Number(b.dataset.time) };
    clearError("slot");
    renderWhen();
  });

  const slotText = s => `${fullDate(dateFromYmd(s.date))}, ${fmtTime(s.time)}`;

  /* ---------- PAYMENT ---------- */
  function renderPayments() {
    const list = S.payments || [];
    $("payList").hidden = !list.length;
    $("payTitle").textContent = list.length ? "Payment & notes" : "Notes";
    if (list.length === 1) payment = list[0].id;
    if (!list.some(p => p.id === payment)) payment = undefined;
    $("payList").innerHTML = list.map(p => {
      const on = p.id === payment;
      return `<button type="button" role="radio" aria-checked="${on}" class="pay${on ? " active" : ""}" data-pay="${esc(p.id)}">
        <span class="pay-dot" aria-hidden="true"></span>
        <span class="pay-text"><strong>${esc(p.label)}</strong>${on && p.details ? `<span>${esc(p.details)}</span>` : ""}</span>
      </button>`;
    }).join("");
  }

  $("payList").addEventListener("click", e => {
    const b = e.target.closest("[data-pay]");
    if (!b) return;
    payment = b.dataset.pay;
    clearError("payment");
    renderPayments();
    saveCustomer();
  });

  /* ---------- REVIEW ---------- */
  function renderReview() {
    const el = $("review");
    if (!cart.length) {
      el.innerHTML = `<p class="empty">Nothing in your order yet. Add something from the menu above.</p>`;
      $("submitBtn").disabled = true;
      return;
    }
    const t = totals();
    const lines = cart.map((l, i) => {
      const item = itemsById.get(l.itemId);
      const opts = choiceSummary(item, l.choices);
      return `<div class="line">
        <div class="line-info">
          <strong>${esc(item.name)}</strong>
          ${opts.map(o => `<span>${esc(o)}</span>`).join("")}
          ${l.note ? `<span class="line-note">“${esc(l.note)}”</span>` : ""}
          ${(item.options || []).length || l.note ? `<button type="button" class="link-btn" data-edit="${i}">Edit</button>` : ""}
        </div>
        <div class="line-right">
          <span class="line-price">${money(unitPrice(item, l.choices) * l.qty)}</span>
          ${stepperHtml(l.qty, `data-line="${i}"`)}
        </div>
      </div>`;
    }).join("");

    let nudge = "";
    if (t.subtotal < t.minOrder) {
      nudge = `<p class="nudge warn">Minimum order for ${mode} is ${money(t.minOrder)}. Add ${money(t.minOrder - t.subtotal)} more.</p>`;
    } else if (mode === "delivery" && t.fee && S.delivery.freeAbove) {
      nudge = `<p class="nudge">Add ${money(cents(S.delivery.freeAbove) - t.subtotal)} more for free delivery.</p>`;
    }

    el.innerHTML = `
      <div class="lines">${lines}</div>
      <div class="sums">
        <div class="sum-row"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
        ${mode === "delivery" ? `<div class="sum-row"><span>Delivery</span><span>${t.fee ? money(t.fee) : "Free"}</span></div>` : ""}
        <div class="sum-row total"><span>Total</span><span>${money(t.total)}</span></div>
      </div>
      ${nudge}`;
    $("submitBtn").disabled = false;
  }

  $("review").addEventListener("click", e => {
    const step = e.target.closest("[data-step][data-line]");
    if (step) {
      const line = cart[Number(step.dataset.line)];
      if (!line) return;
      line.qty += Number(step.dataset.step);
      if (line.qty < 1) cart = cart.filter(l => l !== line);
      else line.qty = Math.min(line.qty, 99);
      cartChanged(line.itemId);
      return;
    }
    const edit = e.target.closest("[data-edit]");
    if (edit) {
      const line = cart[Number(edit.dataset.edit)];
      if (line) openItemSheet(line.itemId, line.key);
    }
  });

  /* ---------- STICKY BAR ---------- */
  function renderBar() {
    const t = totals();
    $("cartBar").hidden = !cart.length || reviewInView;
    $("cartCount").textContent = t.count;
    $("cartTotal").textContent = money(t.total);
    renderInstall();
  }

  $("cartBar").addEventListener("click", () => {
    $("stepReview").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      reviewInView = entry.isIntersecting;
      renderBar();
    }, { rootMargin: "0px 0px -30% 0px" }).observe($("stepReview"));
  }

  /* ---------- ORDER AGAIN ---------- */
  function renderReorder() {
    const last = load(K.lastOrder, null);
    const lines = last && Array.isArray(last.lines) ? last.lines.filter(validLine) : [];
    const box = $("reorder");
    if (!lines.length || cart.length) { box.hidden = true; return; }
    const first = (customer.name || "").split(" ")[0];
    $("reorderTitle").textContent = first ? `Welcome back, ${first}!` : "Welcome back!";
    $("reorderItems").textContent = "Last time: " + lines.map(l => `${l.qty}× ${itemsById.get(l.itemId).name}`).join(", ");
    box.hidden = false;
  }

  $("reorderBtn").addEventListener("click", () => {
    const last = load(K.lastOrder, null);
    (last && last.lines || []).filter(validLine).forEach(l => addLine({ itemId: l.itemId, qty: l.qty, choices: l.choices, note: l.note || "" }));
    cartChanged();
    toast("Added your last order");
    $("stepMenu").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ---------- VALIDATION ---------- */
  function normalizePhone(dial, raw) {
    let digits = String(raw || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith(dial) && digits.length >= dial.length + 8) digits = digits.slice(dial.length);
    digits = digits.replace(/^0+/, "");
    return digits.length >= 7 && digits.length <= 12 ? dial + digits : null;
  }

  function setFieldError(name, msg) {
    const f = document.querySelector(`[data-field="${name}"]`);
    f.classList.toggle("invalid", !!msg);
    f.querySelector(".field-error").textContent = msg || "";
  }
  function setError(name, msg) {
    const el = document.querySelector(`[data-error="${name}"]`);
    el.textContent = msg || "";
    el.classList.toggle("show", !!msg);
  }
  function clearError(name) { setError(name, ""); }

  [["custName", "name"], ["custPhone", "phone"], ["recPhone", "recipient"], ["custAddress", "address"]].forEach(([id, field]) => {
    $(id).addEventListener("input", () => { setFieldError(field, ""); clearError("form"); });
  });
  ["custName", "custCc", "custPhone", "custAddress"].forEach(id => $(id).addEventListener("change", saveCustomer));

  function validate() {
    const problems = [];
    const name = $("custName").value.trim();
    const phone = normalizePhone($("custCc").value, $("custPhone").value);
    const rec = normalizePhone($("recCc").value, $("recPhone").value);
    const address = $("custAddress").value.trim();

    setFieldError("name", name ? "" : "Please enter your name.");
    if (!name) problems.push($("custName"));

    setFieldError("phone", phone ? "" : phone === "" ? "Please enter your WhatsApp number." : "That number doesn't look right.");
    if (!phone) problems.push($("custPhone"));

    setFieldError("recipient", rec === null ? "That number doesn't look right." : "");
    if (rec === null) problems.push($("recPhone"));

    const t = totals();
    if (!cart.length) { setError("menu", "Please add at least one item."); problems.push($("stepMenu")); }
    else if (t.subtotal < t.minOrder) { setError("menu", `Minimum order for ${mode} is ${money(t.minOrder)}.`); problems.push($("stepMenu")); }
    else clearError("menu");

    const needAddress = mode === "delivery" && !address;
    setFieldError("address", needAddress ? "Please enter your delivery address." : "");
    if (needAddress) problems.push($("custAddress"));

    if (!slot) {
      setError("slot", `Please choose a ${mode} time.`);
      problems.push($("stepWhen"));
    } else if (!slotStillOpen(slot)) {
      slot = null;
      renderWhen();
      setError("slot", "Sorry, that time is no longer available. Please pick another.");
      problems.push($("stepWhen"));
    } else clearError("slot");

    const needPayment = (S.payments || []).length && !payment;
    setError("payment", needPayment ? "Please choose how you'd like to pay." : "");
    if (needPayment) problems.push($("stepPay"));

    return { problems, name, phone, rec, address };
  }

  /* ---------- PLACE ORDER ---------- */
  function orderId() {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const d = new Date();
    const rnd = crypto.getRandomValues(new Uint32Array(4));
    return `${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${[...rnd].map(n => chars[n % chars.length]).join("")}`;
  }

  function buildMessage(o) {
    const L = [`Hi ${S.name}! I'd like to place an order.`, "", `*Order #${o.id}*`, `*${o.mode === "delivery" ? "Delivery" : "Pickup"}:* ${o.when}`, ""];
    o.lines.forEach(l => {
      L.push(`${l.qty}x ${l.name} - ${money(l.total)}`);
      l.options.forEach(opt => L.push(`   ${opt}`));
      if (l.note) L.push(`   Note: ${l.note}`);
    });
    L.push("", `Subtotal: ${money(o.subtotal)}`);
    if (o.mode === "delivery") L.push(`Delivery: ${o.fee ? money(o.fee) : "Free"}`);
    L.push(`*Total: ${money(o.total)}*`, "");
    L.push(`Name: ${o.name}`, `WhatsApp: +${o.phone}`);
    if (o.recipient) L.push(`Recipient: +${o.recipient}`);
    if (o.address) L.push(`Address: ${o.address}`);
    if (o.payment) L.push(`Payment: ${o.payment}`);
    if (o.notes) L.push(`Notes: ${o.notes}`);
    return L.join("\n");
  }

  $("orderForm").addEventListener("submit", e => {
    e.preventDefault();
    const v = validate();
    if (v.problems.length) {
      setError("form", "Please fix the highlighted details above.");
      const first = v.problems[0];
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      if (first.matches("input, textarea")) first.focus({ preventScroll: true });
      return;
    }
    clearError("form");

    const t = totals();
    const pay = (S.payments || []).find(p => p.id === payment);
    const order = {
      id: orderId(),
      mode,
      when: slotText(slot),
      lines: cart.map(l => {
        const item = itemsById.get(l.itemId);
        return { name: item.name, qty: l.qty, options: choiceSummary(item, l.choices), note: l.note, total: unitPrice(item, l.choices) * l.qty };
      }),
      subtotal: t.subtotal,
      fee: t.fee,
      total: t.total,
      name: v.name,
      phone: v.phone,
      recipient: v.rec && v.rec !== v.phone ? v.rec : "",
      address: mode === "delivery" ? v.address : "",
      payment: pay ? pay.label : "",
      notes: $("orderNotes").value.trim()
    };
    const message = buildMessage(order);
    const waNumber = String(S.whatsapp || "").replace(/\D/g, "");
    const url = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}` : "";

    if (url) window.open(url, "_blank", "noopener");

    saveCustomer();
    save(K.lastOrder, { at: Date.now(), lines: cart.map(({ key, ...l }) => l) });
    customer.name = v.name;
    cart = [];
    $("orderNotes").value = "";
    $("recPhone").value = "";
    slot = null;
    renderWhen();
    cartChanged();

    showDone(order, message, url);
  });

  function showDone(order, message, url) {
    $("doneText").innerHTML = url
      ? `WhatsApp should open with order <strong>#${esc(order.id)}</strong> (${esc(money(order.total))}). Tap <strong>send</strong> so we get it. We'll confirm your order and payment there.`
      : `Order <strong>#${esc(order.id)}</strong> (${esc(money(order.total))}) is ready.`;
    $("doneWa").hidden = !url;
    if (url) $("doneWa").href = url;
    $("donePreview").hidden = !!url;
    $("doneMessage").textContent = message;
    openOverlay("doneSheet");
  }

  /* ---------- INSTALL BANNER ---------- */
  let installPrompt = null;
  let installOffered = false;
  function renderInstall() {
    $("installBanner").hidden = !installOffered || cart.length > 0 || !canOfferInstall();
  }
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const canOfferInstall = () => !standalone && !load(K.installHidden, false);

  function showInstall(ios) {
    if (!canOfferInstall()) return;
    $("installTitle").textContent = `Add ${S.name} to your home screen`;
    $("installSub").textContent = ios
      ? "Tap the Share button, then “Add to Home Screen” for one-tap ordering."
      : "One tap to order again, without hunting back through WhatsApp.";
    $("installBtn").hidden = ios;
    installOffered = true;
    renderInstall();
  }

  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    installPrompt = e;
    showInstall(false);
  });
  window.addEventListener("appinstalled", () => { installOffered = false; renderInstall(); });

  $("installBtn").addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installOffered = false;
    renderInstall();
  });

  $("installClose").addEventListener("click", () => {
    save(K.installHidden, true);
    renderInstall();
  });

  if (isIOS) setTimeout(() => showInstall(true), 1500);

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  /* ---------- INIT ---------- */
  function fillCustomer() {
    $("custName").value = customer.name || "";
    $("custPhone").value = customer.phone || "";
    $("custAddress").value = customer.address || "";
    if (customer.cc) $("custCc").value = customer.cc;
  }

  renderStore();
  fillCustomer();
  renderMenu();
  renderMode();
  renderWhen();
  renderPayments();
  renderReview();
  renderBar();
  renderReorder();

  // Keep times and "open now" fresh if the page is left open.
  setInterval(() => {
    const st = storeStatus();
    $("storeStatus").textContent = st.text;
    $("storeStatus").classList.toggle("open", st.open);
    renderWhen();
  }, 60000);
})();
