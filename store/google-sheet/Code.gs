/**
 * ORDER LOG FOR YOUR STORE
 *
 * Paste this into your Google Sheet (Extensions → Apps Script) and deploy it
 * as a web app. Each order from the order page is added to the "Orders" tab,
 * each item to the "Items" tab, and the "Sales" tab adds up your sales.
 * Full steps: store/README.md → "Save orders to Google Sheets".
 */

const TIMEZONE = "Asia/Kuala_Lumpur";
const MONEY = '"RM "#,##0.00';
const STATUSES = ["New", "Paid", "Completed", "Cancelled"];

const ORDER_COLUMNS = ["Order ID", "Placed at", "Date", "Time", "Type", "Customer", "WhatsApp", "Recipient",
  "Address", "Items", "Subtotal", "Delivery fee", "Total", "Payment", "Notes", "Status"];
const ITEM_COLUMNS = ["Order ID", "Date", "Item", "Options", "Qty", "Amount", "Status"];

/** Run once from the editor (choose "setup", press Run) to create the tabs and allow access. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheets(ss);
  ss.getSheets().forEach(sh => {
    const ours = ["Sales", "Orders", "Items"].includes(sh.getName());
    if (!ours && sh.getLastRow() === 0 && sh.getLastColumn() === 0) ss.deleteSheet(sh);
  });
}

/** Opening the web app link in a browser shows this, so you can check it's live. */
function doGet() {
  return reply({ ok: true, message: "Your order log is running. Put this link in ordersSheetUrl in config.js." });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const body = e && e.postData ? e.postData.contents : "";
    if (!body || body.length > 50000) throw new Error("Empty or oversized order");
    return reply({ ok: true, result: saveOrder(JSON.parse(body)) });
  } catch (err) {
    return reply({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

function saveOrder(o) {
  const id = String(o.id || "");
  if (!/^[0-9A-Z-]{4,20}$/.test(id)) throw new Error("Invalid order id");
  const date = String(o.date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const time = String(o.time || "").match(/^(\d{2}):(\d{2})$/);
  if (!date || !time) throw new Error("Invalid date or time");
  const lines = Array.isArray(o.lines) ? o.lines.slice(0, 100) : [];
  if (!lines.length) throw new Error("Order has no items");

  const subtotal = money(o.subtotal);
  const fee = money(o.fee);
  const total = money(o.total);
  const itemsSum = lines.reduce((sum, l) => sum + money(l.total), 0);
  if (Math.abs(itemsSum - subtotal) > 0.01 || Math.abs(subtotal + fee - total) > 0.01) {
    throw new Error("Totals don't add up");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const { orders, items } = ensureSheets(ss);

  // The order page may resend an order after a dropped connection.
  if (orders.getLastRow() > 1 &&
      orders.getRange(2, 1, orders.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).findNext()) {
    return "already saved";
  }

  // Formulas keep the date and time exact whatever the sheet's time zone.
  const day = `=DATE(${Number(date[1])},${Number(date[2])},${Number(date[3])})`;
  const at = `=TIME(${Number(time[1])},${Number(time[2])},0)`;
  const summary = lines.map(l =>
    `${qty(l.qty)}x ${l.name}${l.options ? ` (${l.options})` : ""}${l.note ? ` - "${l.note}"` : ""}`).join("\n");

  const row = nextFreeRow(orders, 1, styleOrders);
  orders.getRange(row, 1, 1, ORDER_COLUMNS.length).setValues([[
    text(id), new Date(), day, at, text(o.mode), text(o.name), text(o.phone), text(o.recipient),
    text(o.address), text(summary, 5000), subtotal, fee, total, text(o.payment), text(o.notes), "New"
  ]]);

  const first = nextFreeRow(items, lines.length, styleItems);
  items.getRange(first, 1, lines.length, ITEM_COLUMNS.length).setValues(lines.map((l, i) => [
    text(id), day, text(l.name), text(l.options), qty(l.qty), money(l.total),
    // Follows the order's status, so cancelled orders drop out of the item totals.
    `=IFERROR(INDEX(Orders!P:P, MATCH(A${first + i}, Orders!A:A, 0)), "")`
  ]));
  return "saved";
}

/* ---------- SHEETS ---------- */

function ensureSheets(ss) {
  if (!ss.getSheetByName("Orders")) ss.setSpreadsheetTimeZone(TIMEZONE);
  const orders = ss.getSheetByName("Orders") || makeSheet(ss, "Orders", ORDER_COLUMNS, styleOrders);
  const items = ss.getSheetByName("Items") || makeSheet(ss, "Items", ITEM_COLUMNS, styleItems);
  if (!ss.getSheetByName("Sales")) makeSales(ss);
  return { orders, items };
}

function makeSheet(ss, name, columns, style) {
  const sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, columns.length).setValues([columns]).setFontWeight("bold").setBackground("#F1F1EC");
  sh.setFrozenRows(1);
  style(sh);
  return sh;
}

// Adds more blank rows when the sheet is nearly full, keeping formats and dropdowns.
function nextFreeRow(sh, count, style) {
  const row = sh.getLastRow() + 1;
  if (row + count - 1 > sh.getMaxRows()) {
    sh.insertRowsAfter(sh.getMaxRows(), Math.max(count, 500));
    style(sh);
  }
  return row;
}

function styleOrders(sh) {
  const n = sh.getMaxRows() - 1;
  sh.getRange(2, 2, n, 1).setNumberFormat("d mmm yyyy, h:mm am/pm");
  sh.getRange(2, 3, n, 1).setNumberFormat("ddd, d mmm yyyy");
  sh.getRange(2, 4, n, 1).setNumberFormat("h:mm am/pm");
  sh.getRange(2, 10, n, 1).setWrap(true);
  sh.getRange(2, 11, n, 3).setNumberFormat(MONEY);

  const status = sh.getRange(2, 16, n, 1);
  status.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build());
  const colour = (value, bg, fg) => SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(value).setBackground(bg).setFontColor(fg).setRanges([status]).build();
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$P2="Cancelled"').setFontColor("#9E9E9E").setStrikethrough(true)
      .setRanges([sh.getRange(2, 1, n, ORDER_COLUMNS.length)]).build(),
    colour("New", "#FFF4D6", "#7A4F00"),
    colour("Paid", "#DCEBFF", "#1B4F9C"),
    colour("Completed", "#DFF3E4", "#1E6B34")
  ]);

  [100, 150, 130, 80, 80, 140, 130, 130, 220, 280, 95, 95, 95, 170, 200, 110]
    .forEach((w, i) => sh.setColumnWidth(i + 1, w));
}

function styleItems(sh) {
  const n = sh.getMaxRows() - 1;
  sh.getRange(2, 2, n, 1).setNumberFormat("ddd, d mmm yyyy");
  sh.getRange(2, 6, n, 1).setNumberFormat(MONEY);
  [100, 130, 200, 260, 60, 95, 110].forEach((w, i) => sh.setColumnWidth(i + 1, w));
}

function makeSales(ss) {
  const sh = ss.insertSheet("Sales", 0);
  const ok = 'Orders!P:P, "<>Cancelled"';
  const monthStart = "DATE(YEAR(TODAY()), MONTH(TODAY()), 1)";
  const weekStart = "(TODAY() - WEEKDAY(TODAY(), 3))";
  const period = (from, to) => [
    `=SUMIFS(Orders!M:M, Orders!C:C, ">="&${from}, Orders!C:C, "<"&${to}, ${ok})`,
    `=COUNTIFS(Orders!C:C, ">="&${from}, Orders!C:C, "<"&${to}, ${ok}) & " orders"`
  ];

  sh.getRange("A1").setValue("Sales").setFontSize(18).setFontWeight("bold");
  sh.getRange("A2").setValue("By pickup/delivery date. Counts every order except Cancelled, so cancel orders that didn't go ahead in the Orders tab.")
    .setFontColor("#777777");

  sh.getRange("A4:C7").setValues([
    ["Today", ...period("TODAY()", "(TODAY()+1)")],
    ["This week", ...period(weekStart, `(${weekStart}+7)`)],
    ["This month", ...period(monthStart, `EDATE(${monthStart}, 1)`)],
    ["Waiting to confirm", '=SUMIFS(Orders!M:M, Orders!P:P, "New")', '=COUNTIF(Orders!P:P, "New") & " orders"']
  ]);
  sh.getRange("A4:A7").setFontWeight("bold");
  sh.getRange("B4:B7").setNumberFormat(MONEY).setFontWeight("bold").setFontSize(12);
  sh.getRange("C4:C7").setFontColor("#777777");

  sh.getRange("A9").setValue("Daily sales").setFontSize(13).setFontWeight("bold");
  sh.getRange("A10:E10").setValues([["Date", "Orders", "Sales", "Waiting to confirm", "Delivery fees"]])
    .setFontWeight("bold").setBackground("#F1F1EC");
  sh.getRange("A11:E11").setFormulas([[
    '=IFERROR(SORT(UNIQUE(FILTER(Orders!C2:C, Orders!C2:C<>"", Orders!P2:P<>"Cancelled")), 1, FALSE), "")',
    '=ARRAYFORMULA(IF(A11:A="", "", COUNTIFS(Orders!C:C, A11:A, Orders!P:P, "<>Cancelled")))',
    '=ARRAYFORMULA(IF(A11:A="", "", SUMIFS(Orders!M:M, Orders!C:C, A11:A, Orders!P:P, "<>Cancelled")))',
    '=ARRAYFORMULA(IF(A11:A="", "", SUMIFS(Orders!M:M, Orders!C:C, A11:A, Orders!P:P, "New")))',
    '=ARRAYFORMULA(IF(A11:A="", "", SUMIFS(Orders!L:L, Orders!C:C, A11:A, Orders!P:P, "<>Cancelled")))'
  ]]);
  sh.getRange("A11:A").setNumberFormat("ddd, d mmm yyyy");
  sh.getRange("C11:E").setNumberFormat(MONEY);

  sh.getRange("G9").setValue("Today's items to prepare").setFontSize(13).setFontWeight("bold");
  sh.getRange("G10").setFormula(
    `=IFERROR(QUERY(Items!A:G, "select C, sum(E) where B = date '"&TEXT(TODAY(), "yyyy-mm-dd")&"' and G <> 'Cancelled' ` +
    `group by C order by sum(E) desc label C 'Item', sum(E) 'Qty'", 1), "Nothing for today yet")`);

  sh.getRange("J9").setValue("Best sellers").setFontSize(13).setFontWeight("bold");
  sh.getRange("J10").setFormula(
    `=IFERROR(QUERY(Items!A:G, "select C, sum(E), sum(F) where C is not null and G <> 'Cancelled' ` +
    `group by C order by sum(E) desc label C 'Item', sum(E) 'Qty sold', sum(F) 'Sales'", 1), "No sales yet")`);
  sh.getRange("L11:L").setNumberFormat(MONEY);
  sh.getRangeList(["G10:H10", "J10:L10"]).setFontWeight("bold").setBackground("#F1F1EC");

  [150, 80, 110, 150, 110, 30, 200, 60, 30, 200, 80, 110].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  return sh;
}

/* ---------- HELPERS ---------- */

// The leading apostrophe keeps customer text as plain text, so "+60…" or "=…" is never read as a formula.
function text(v, max) {
  const s = String(v == null ? "" : v).slice(0, max || 500);
  return s ? "'" + s : "";
}

function money(v) {
  const n = Number(v);
  return isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function qty(v) {
  return Math.min(999, Math.max(1, Math.round(Number(v)) || 1));
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
