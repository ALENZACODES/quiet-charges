import { parseCSV, toTransactions, findRecurring, summarize, toICS } from "./engine.js";

const $ = (id) => document.getElementById(id);
const money = (n, d = 0) => n.toLocaleString("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: d, maximumFractionDigits: d });
const day = (d) => d.toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
const LABEL = { weekly: "Every week", biweekly: "Every 2 weeks", monthly: "Monthly", quarterly: "Every 3 months", yearly: "Yearly" };
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let subs = [], ticked = new Set(), today = new Date();

function load(text, label) {
  const tx = toTransactions(parseCSV(text));
  if (!tx.length) { $("status").textContent = "I couldn't find dated charges in that file. Check that it has a date, a description and an amount column."; $("out").hidden = true; return; }
  const latest = tx.reduce((m, t) => (t.date > m ? t.date : m), tx[0].date);
  today = new Date(Math.max(latest.getTime(), label === "sample" ? latest.getTime() : Date.now()));
  subs = findRecurring(tx, { today });
  ticked = new Set();
  $("status").textContent = `Read ${tx.length} charges${label === "sample" ? " from the sample file" : ""}. Found ${subs.filter((s) => s.active).length} that repeat.`;
  render();
  $("out").hidden = false;
  $("out").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

function render() {
  const sum = summarize(subs);
  $("sCount").textContent = sum.count;
  $("sMonthly").textContent = money(sum.monthly);
  $("sAnnual").textContent = money(sum.annual);
  $("sRaised").textContent = sum.raised;
  $("raisedLine").textContent = sum.raised
    ? `${sum.raised} of your subscriptions went up in price while you weren't looking. Those increases alone cost you ${money(sum.raisedCost)} a year.`
    : "";
  const active = subs.filter((s) => s.active);
  const soon = active.filter((s) => (s.nextDate - today) / 86400000 <= 30).sort((a, b) => a.nextDate - b.nextDate);
  $("upcoming").innerHTML = soon.length
    ? soon.map((s) => `<li><span class="when">${day(s.nextDate)}</span><span>${escapeHtml(s.name)}</span><strong>${money(s.last, 2)}</strong></li>`).join("")
    : "<li>Nothing due in the next 30 days.</li>";
  $("rows").innerHTML = active.map((s, i) => {
    const up = s.increases.length ? `<span class="tag">up ${money(s.last - s.first, 2)} since ${s.increases[0].date.toLocaleDateString("en-CA", { month: "short", year: "numeric", timeZone: "UTC" })}</span>` : "";
    return `<tr class="${ticked.has(s.key) ? "ticked" : ""}">
      <td><input type="checkbox" data-k="${escapeHtml(s.key)}" ${ticked.has(s.key) ? "checked" : ""} aria-label="Plan to cancel ${escapeHtml(s.name)}"></td>
      <td>${escapeHtml(s.name)}${up}<br><span class="conf">${s.count} charges seen</span></td>
      <td>${LABEL[s.cadence]}</td><td>${money(s.last, 2)}</td><td>${money(s.annual)}</td><td>${day(s.nextDate)}</td></tr>`;
  }).join("");
  $("stopped").innerHTML = subs.filter((s) => !s.active).map((s) => `<li>${escapeHtml(s.name)}: last charged ${day(s.lastDate)}. Looks cancelled.</li>`).join("") || "<li>None.</li>";
  updateSave();
}

function updateSave() {
  const amt = subs.filter((s) => ticked.has(s.key) && s.active).reduce((t, s) => t + s.annual, 0);
  $("saveAmt").textContent = `${money(amt)} a year`;
}

function download(name, type, data) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$("rows").addEventListener("change", (e) => {
  const k = e.target.dataset.k; if (!k) return;
  e.target.checked ? ticked.add(k) : ticked.delete(k);
  e.target.closest("tr").classList.toggle("ticked", e.target.checked);
  updateSave();
});
$("file").addEventListener("change", async (e) => { const f = e.target.files[0]; if (f) load(await f.text(), f.name); });
$("sample").addEventListener("click", async () => load(await (await fetch("src/sample.csv")).text(), "sample"));
const drop = $("drop");
["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", async (e) => { const f = e.dataTransfer.files[0]; if (f) load(await f.text(), f.name); });
drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("file").click(); } });
$("ics").addEventListener("click", () => download("quiet-charges-reminders.ics", "text/calendar", toICS(subs.filter((s) => !ticked.has(s.key)))));
$("csv").addEventListener("click", () => {
  const head = "merchant,how_often,last_charge,per_year,next_charge,price_went_up,plan_to_cancel";
  const body = subs.filter((s) => s.active).map((s) => [`"${s.name.replace(/"/g, '""')}"`, s.cadence, s.last.toFixed(2), s.annual.toFixed(2), s.nextDate.toISOString().slice(0, 10), s.increases.length ? "yes" : "no", ticked.has(s.key) ? "yes" : "no"].join(","));
  download("quiet-charges.csv", "text/csv", [head, ...body].join("\n"));
});
if (new URLSearchParams(location.search).has("sample")) $("sample").click();
