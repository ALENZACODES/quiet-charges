import { payer, readAny, mergeTransactions, findRecurring, summarize, inflationCheck, cancelMessage, negotiationScript, toICS } from "./engine.js";
import { CPI, CPI_SOURCE } from "./cpi.js";

const $ = (id) => document.getElementById(id);
const money = (n, d = 0) => n.toLocaleString("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: d, maximumFractionDigits: d });
const day = (d) => d.toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
const monthYear = (d) => d.toLocaleDateString("en-CA", { month: "short", year: "numeric", timeZone: "UTC" });
const ymLabel = (k) => monthYear(new Date(k + "-01T00:00:00Z"));
const LABEL = { weekly: "Every week", biweekly: "Every 2 weeks", monthly: "Monthly", quarterly: "Every 3 months", yearly: "Yearly" };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let subs = [], ticked = new Set(), today = new Date(), filter = "all";

const months = Object.keys(CPI).sort();
$("cpiSource").textContent = CPI_SOURCE;
$("cpiLatest").textContent = ymLabel(months[months.length - 1]);

function load(parts, label) {
  const txns = mergeTransactions(...parts.map((p) => p.txns));
  if (!txns.length) {
    $("status").textContent = "I couldn't find dated charges in that. A CSV needs a date, a description and an amount column; pasted lines need a date at the start and an amount at the end.";
    $("out").hidden = true; return;
  }
  const latest = txns[txns.length - 1].date;
  today = label === "sample" ? latest : new Date(Math.max(latest.getTime(), Date.now()));
  subs = findRecurring(txns, { today });
  ticked = new Set();
  const fmts = [...new Set(parts.map((p) => p.format))].join(" and ");
  const span = `${day(txns[0].date)} ${txns[0].date.getUTCFullYear()} to ${day(latest)} ${latest.getUTCFullYear()}`;
  $("status").textContent = `Read ${txns.length} charges (${fmts}, ${span}). Found ${subs.filter((s) => s.active).length} that repeat.`;
  render();
  $("out").hidden = false;
  $("out").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

function flagsFor(s) {
  const f = [];
  if (s.trial) f.push({ cls: "bad", text: `trial ${money(s.trial.amount, 2)} on ${day(s.trial.date)}, then full price` });
  if (s.duplicateOf) f.push({ cls: "bad", text: "paying twice" });
  const inf = inflationCheck(s);
  if (inf) f.push({ cls: "warn", text: `up ${inf.pricePct.toFixed(0)}% since ${monthYear(s.firstDate)}` });
  if (s.isNew && !s.trial) f.push({ cls: "info", text: `new since ${day(s.firstDate)}` });
  if (s.fx) f.push({ cls: "info", text: "foreign currency, amount varies" });
  if (s.billedVia) f.push({ cls: "info", text: `billed through ${payer(s.billedVia)}` });
  return f;
}

function render() {
  const sum = summarize(subs);
  $("sCount").textContent = sum.count;
  $("sMonthly").textContent = money(sum.monthly);
  $("sAnnual").textContent = money(sum.annual);
  $("sRaised").textContent = sum.raised;
  const active = subs.filter((s) => s.active);

  const alerts = [];
  for (const s of active.filter((x) => x.trial)) alerts.push({ cls: "bad", k: s.key, html: `<strong>${esc(s.name)}</strong> started as a ${money(s.trial.amount, 2)} trial on ${day(s.trial.date)}, then switched to ${money(s.last, 2)} ${LABEL[s.cadence].toLowerCase()}. That's ${money(s.last * s.count, 2)} so far. If you didn't mean to keep it, cancel now and ask for a refund.` });
  const dupSeen = new Set();
  for (const s of active.filter((x) => x.duplicateOf)) {
    if (dupSeen.has(s.service.id)) continue; dupSeen.add(s.service.id);
    const both = active.filter((o) => o.service?.id === s.service.id);
    alerts.push({ cls: "bad", k: s.key, html: `<strong>You pay for ${esc(s.service.name)} twice.</strong> ${both.map((o) => `${money(o.last, 2)} ${o.billedVia ? "through " + esc(payer(o.billedVia)) : "directly"}`).join(" and ")}, every month. That's ${money(both.slice(1).reduce((t, o) => t + o.annual, 0))} a year for a second account.` });
  }
  const infl = active.map((s) => ({ s, inf: inflationCheck(s) })).filter((x) => x.inf).sort((a, b) => b.inf.overPerYear - a.inf.overPerYear);
  if (infl.length) {
    const worst = infl[0];
    alerts.push({ cls: "warn", k: worst.s.key, html: `<strong>${infl.length} prices rose faster than inflation.</strong> ${esc(worst.s.name)} went from ${money(worst.s.first, 2)} to ${money(worst.s.last, 2)}, up ${worst.inf.pricePct.toFixed(1)}%, while prices in Canada rose ${worst.inf.cpiPct.toFixed(1)}% from ${ymLabel(worst.inf.fromMonth)} to ${ymLabel(worst.inf.toMonth)}${worst.inf.times ? `, ${worst.inf.times.toFixed(1)} times as fast` : ""}. Across all of them you pay ${money(sum.overInflation)} a year more than inflation alone explains.` });
  }
  for (const s of active.filter((x) => x.isNew && !x.trial)) alerts.push({ cls: "info", k: s.key, html: `<strong>${esc(s.name)}</strong> is new. The first charge was ${day(s.firstDate)}. Did you mean to sign up, or was this a free trial that ended?` });
  for (const s of active.filter((x) => x.service?.telco && x.increases.length)) alerts.push({ cls: "info", k: s.key, html: `<strong>${esc(s.name)}</strong> went up ${s.increases.length} times, to ${money(s.last, 2)} a month. Phone and internet bills often come down if you call and ask. The cancel kit has a script.` });
  $("alerts").innerHTML = alerts.map((a) => `<li class="${a.cls}"><p>${a.html}</p><button class="btn small alt" type="button" data-kit="${esc(a.k)}">Open the kit</button></li>`).join("") || `<li class="info"><p>Nothing unusual. Every subscription charged the same price it started at.</p></li>`;

  const soon = active.filter((s) => s.nextDate - today <= 30 * 86400000 && s.nextDate >= new Date(today.getTime() - 3 * 86400000)).sort((a, b) => a.nextDate - b.nextDate);
  $("upcoming").innerHTML = soon.map((s) => `<li><span class="when">${day(s.nextDate)}</span><span class="what">${esc(s.name)}</span><span>${money(s.last, 2)}</span></li>`).join("") || "<li>Nothing in the next 30 days.</li>";
  renderRows();
  $("stopped").innerHTML = subs.filter((s) => !s.active).map((s) => `<li>${esc(s.name)}: ${money(s.last, 2)} ${LABEL[s.cadence].toLowerCase()}, last charged ${day(s.lastDate)} ${s.lastDate.getUTCFullYear()}. Looks cancelled.</li>`).join("") || "<li>None.</li>";
  updateSave();
}

function renderRows() {
  const active = subs.filter((s) => s.active).filter((s) =>
    filter === "all" || (filter === "flag" && flagsFor(s).some((f) => f.cls !== "info")) || (filter === "raised" && s.increases.length) || (filter === "known" && s.service));
  $("rows").innerHTML = active.map((s) => {
    const tags = flagsFor(s).map((f) => `<span class="tag ${f.cls}">${esc(f.text)}</span>`).join("");
    return `<tr class="${ticked.has(s.key) ? "ticked" : ""}">
      <td><input type="checkbox" data-k="${esc(s.key)}" ${ticked.has(s.key) ? "checked" : ""} aria-label="Plan to cancel ${esc(s.name)}"></td>
      <td><span class="svc">${esc(s.name)}</span> <span class="cat">${esc(s.category)}</span><br>${tags}<span class="conf">${s.count} charges seen</span></td>
      <td>${LABEL[s.cadence]}</td><td>${money(s.last, 2)}</td><td>${money(s.annual)}</td><td>${day(s.nextDate)}</td>
      <td><button class="btn small alt" type="button" data-kit="${esc(s.key)}">${s.service?.telco ? "Lower it" : "Cancel kit"}</button></td></tr>`;
  }).join("") || `<tr><td colspan="7">Nothing matches this filter.</td></tr>`;
}

function openKit(key) {
  const s = subs.find((x) => x.key === key); if (!s) return;
  const inf = inflationCheck(s);
  const parts = [`<p class="kitmeta">${money(s.last, 2)} ${LABEL[s.cadence].toLowerCase()}, ${money(s.annual)} a year. Next charge ${day(s.nextDate)}.</p>`];
  if (inf) parts.push(`<p class="callout">The price went from ${money(s.first, 2)} to ${money(s.last, 2)}. If it had only kept up with inflation it would be about ${money(inf.fairPrice, 2)}.</p>`);
  if (s.service?.telco) {
    parts.push(`<h3>Ask for a better price</h3><pre id="kitText">${esc(negotiationScript(s))}</pre>`);
  } else {
    if (s.service?.steps) parts.push(`<h3>How to cancel</h3><ol>${s.service.steps.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>`);
    if (!s.service) parts.push(`<p>I don't have this merchant in my list yet. Search your email for its name and "receipt" to find the account, or call the number on your statement.</p>`);
    parts.push(`<h3>Message to send</h3><pre id="kitText">${esc(cancelMessage(s))}</pre>`);
  }
  parts.push(`<div class="actions"><button id="kitCopy" class="btn" type="button">Copy the text</button>${s.service?.url ? `<a class="btn alt" href="${esc(s.service.url)}" target="_blank" rel="noopener noreferrer">Open the official page</a>` : ""}</div>`);
  $("kitTitle").textContent = `${s.service?.telco ? "Lower your bill" : "Cancel kit"}: ${s.name}`;
  $("kitBody").innerHTML = parts.join("");
  $("kitCopy").addEventListener("click", () => copy($("kitText").textContent, $("kitCopy")));
  $("kit").showModal();
}

async function copy(text, btn) {
  try { await navigator.clipboard.writeText(text); } catch { const t = document.createElement("textarea"); t.value = text; document.body.append(t); t.select(); document.execCommand("copy"); t.remove(); }
  const old = btn.textContent; btn.textContent = "Copied"; setTimeout(() => (btn.textContent = old), 1500);
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

function plainSummary() {
  const sum = summarize(subs);
  const lines = [`Quiet Charges summary, ${day(today)} ${today.getUTCFullYear()}`, `${sum.count} active subscriptions, ${money(sum.monthly)} a month, ${money(sum.annual)} a year.`];
  if (sum.raised) lines.push(`${sum.raised} raised their price, costing ${money(sum.raisedCost)} more a year.`);
  lines.push("");
  for (const s of subs.filter((x) => x.active)) lines.push(`${ticked.has(s.key) ? "[cancel] " : ""}${s.name}: ${money(s.last, 2)} ${LABEL[s.cadence].toLowerCase()}, next ${day(s.nextDate)}${flagsFor(s).length ? " (" + flagsFor(s).map((f) => f.text).join("; ") + ")" : ""}`);
  return lines.join("\n");
}

async function readFiles(files) {
  const parts = [];
  for (const f of files) parts.push(readAny(await f.text(), { today: new Date() }));
  load(parts, [...files].map((f) => f.name).join(", "));
}

document.addEventListener("click", (e) => {
  const k = e.target.closest("[data-kit]")?.dataset.kit; if (k) openKit(k);
  const f = e.target.closest("[data-f]")?.dataset.f;
  if (f) { filter = f; document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c.dataset.f === f)); renderRows(); }
});
$("rows").addEventListener("change", (e) => {
  const k = e.target.dataset.k; if (!k) return;
  e.target.checked ? ticked.add(k) : ticked.delete(k);
  e.target.closest("tr").classList.toggle("ticked", e.target.checked);
  updateSave();
});
$("file").addEventListener("change", (e) => e.target.files.length && readFiles(e.target.files));
$("sample").addEventListener("click", async () => load([readAny(await (await fetch("src/sample.csv")).text())], "sample"));
$("pasteSample").addEventListener("click", async () => { $("pasteBox").value = await (await fetch("docs/sample-statement.txt")).text(); });
$("pasteGo").addEventListener("click", () => {
  const txt = $("pasteBox").value;
  const isSample = txt.startsWith("CARD STATEMENT  Aug 29 to Oct 28, 2026");
  load([readAny(txt, { today: isSample ? new Date(Date.UTC(2026, 9, 28)) : new Date() })], isSample ? "sample" : "pasted");
});
const drop = $("drop");
["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => e.dataTransfer.files.length && readFiles(e.dataTransfer.files));
drop.addEventListener("keydown", (e) => { if (e.target === drop && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); $("file").click(); } });
$("ics").addEventListener("click", () => download("quiet-charges-reminders.ics", "text/calendar", toICS(subs.filter((s) => !ticked.has(s.key)))));
$("csv").addEventListener("click", () => {
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const head = "service,category,how_often,last_charge,per_year,next_charge,flags,cancel_link,plan_to_cancel";
  const body = subs.filter((s) => s.active).map((s) => [q(s.name), q(s.category), s.cadence, s.last.toFixed(2), s.annual.toFixed(2), s.nextDate.toISOString().slice(0, 10), q(flagsFor(s).map((f) => f.text).join("; ")), q(s.service?.url || ""), ticked.has(s.key) ? "yes" : "no"].join(","));
  download("quiet-charges.csv", "text/csv", [head, ...body].join("\n"));
});
$("copySummary").addEventListener("click", (e) => copy(plainSummary(), e.target));
const params = new URLSearchParams(location.search);
if (params.has("sample")) $("sample").click();
if (params.has("kit")) setTimeout(() => openKit(params.get("kit")), 400);
