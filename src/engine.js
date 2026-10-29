// Quiet Charges engine. Reads bank exports (CSV, OFX/QFX or pasted statement text),
// groups charges by merchant, finds what repeats, and explains it: price increases
// compared with inflation, free trials that turned into charges, services paid twice,
// and the next charge date. Everything here is pure functions, so it runs the same in
// the browser and in Node tests.

import { identify } from "./catalog.js";
import { CPI } from "./cpi.js";

const DAY = 86400000;
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const utc = (y, m, d) => { const dt = new Date(Date.UTC(y, m - 1, d)); return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt : null; };
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const round2 = (n) => Math.round(n * 100) / 100;

// ---------- CSV ----------
export function parseCSV(text) {
  const rows = [];
  let row = [], field = "", q = false;
  const delim = sniffDelimiter(text);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function sniffDelimiter(text) {
  const first = text.split(/\r?\n/).find((l) => l.trim()) || "";
  const count = (c) => first.split(c).length - 1;
  return count(";") > count(",") ? ";" : count("\t") > count(",") ? "\t" : ",";
}

// ---------- Dates and amounts ----------
// order is "mdy" (the default for most Canadian bank CSVs) or "dmy".
export function parseDate(s, order = "mdy") {
  const t = String(s ?? "").trim();
  let m;
  if ((m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return utc(+m[1], +m[2], +m[3]);
  if ((m = t.match(/^(\d{8})/))) return utc(+t.slice(0, 4), +t.slice(4, 6), +t.slice(6, 8)); // OFX 20261003
  if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) return order === "dmy" ? utc(+m[3], +m[2], +m[1]) : utc(+m[3], +m[1], +m[2]);
  if ((m = t.match(/^([a-z]{3,4})\.?\s+(\d{1,2}),?\s+(\d{4})$/i)) && MONTHS[m[1].toLowerCase()]) return utc(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
  if ((m = t.match(/^(\d{1,2})[\s-]([a-z]{3,4})\.?[\s-],?(\d{4})$/i)) && MONTHS[m[2].toLowerCase()]) return utc(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
  return null;
}

export function parseAmount(s) {
  if (s === undefined || s === null) return null;
  let t = String(s).trim();
  if (!t) return null;
  const neg = /^\(.*\)$/.test(t) || /^\$?-/.test(t) || /-$/.test(t);
  t = t.replace(/[()$,\s-]|CAD|USD/gi, "");
  if (!/^\d*\.?\d+$/.test(t)) return null;
  return neg ? -+t : +t;
}

// Works out which columns hold the date, description and amount.
// Handles a header row (any order) or headerless rows: date, description, debit, credit, balance.
export function toTransactions(rows) {
  if (!rows.length) return [];
  // Some banks put a line or two of account details above the header row.
  const hi = rows.slice(0, 6).findIndex((r) => r.some((c) => /date/i.test(c)) && r.length >= 3);
  if (hi > 0) rows = rows.slice(hi);
  const head = rows[0].map((h) => h.toLowerCase().trim());
  const has = (re) => head.findIndex((h) => re.test(h));
  let start = 0, di, de, am, debit = -1, credit = -1;
  if (head.some((h) => /date/.test(h))) {
    start = 1;
    di = has(/date/);
    de = has(/desc|merchant|payee|name|details/);
    am = has(/amount|cad\$|^cad/);
    debit = has(/debit|withdraw/);
    credit = has(/credit|deposit/);
    if (de < 0) de = has(/memo|narrative/);
  } else {
    di = 0; de = 1; debit = 2; credit = 3; am = -1;
  }
  const body = rows.slice(start);
  // If any slash date has a first part over 12, the file is day first.
  const order = body.some((r) => { const m = String(r[di] ?? "").trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-]\d{4}$/); return m && +m[1] > 12; }) ? "dmy" : "mdy";
  const out = [];
  for (const r of body) {
    const date = parseDate(r[di], order);
    if (!date) continue;
    let amount;
    if (am >= 0 && r[am] !== undefined && r[am].trim() !== "") amount = parseAmount(r[am]);
    else {
      const d = parseAmount(r[debit]), c = parseAmount(r[credit]);
      amount = d ? -Math.abs(d) : c ? Math.abs(c) : null;
    }
    if (amount === null) continue;
    out.push({ date, desc: String(r[de] ?? "").trim(), amount });
  }
  return toCharges(out);
}

// Money going out becomes a positive "charge", whichever sign the bank uses.
function toCharges(out) {
  const spends = out.filter((t) => t.amount < 0).length;
  const sign = spends >= out.length / 2 ? -1 : 1;
  return out.map((t) => ({ ...t, charge: round2(t.amount * sign) })).filter((t) => t.charge > 0);
}

// ---------- OFX / QFX (Quicken and most Canadian bank "Money" downloads) ----------
export function parseOFX(text) {
  const out = [];
  const blocks = String(text).split(/<STMTTRN>/i).slice(1);
  const tag = (b, name) => { const m = b.match(new RegExp(`<${name}>([^<\\r\\n]*)`, "i")); return m ? m[1].trim() : ""; };
  for (const b of blocks) {
    const date = parseDate(tag(b, "DTPOSTED"));
    const amount = parseAmount(tag(b, "TRNAMT"));
    if (!date || amount === null) continue;
    const desc = [tag(b, "NAME"), tag(b, "MEMO")].filter(Boolean).join(" ").trim();
    out.push({ date, desc, amount });
  }
  // OFX always uses negative numbers for money out.
  return out.filter((t) => t.amount < 0).map((t) => ({ ...t, charge: round2(-t.amount) }));
}

// ---------- Pasted statement text ----------
// Copying from a PDF statement or online banking gives lines like
//   "OCT 03  OCT 04  NETFLIX.COM 866-579-7172 ON   20.99"
//   "2026-10-03 SPOTIFY P3A1B2 12.99"
// A date at the start, an amount at the end, the merchant in between.
const MON = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\\.?";
const LEAD_DATE = new RegExp(`^\\s*(?:(\\d{4}-\\d{1,2}-\\d{1,2})|(\\d{1,2}/\\d{1,2}/\\d{4})|${MON}\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?|(\\d{1,2})\\s+${MON}(?:\\s+(\\d{4}))?)\\s+`, "i");
const SECOND_DATE = new RegExp(`^(?:${MON}\\s+\\d{1,2}|\\d{1,2}\\s+${MON}|\\d{4}-\\d{1,2}-\\d{1,2})\\s+`, "i");
const TRAIL_AMOUNT = /\s+(-?\(?\$?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?-?)(?:\s*(CR))?\s*$/i;

export function parsePasted(text, { today = new Date() } = {}) {
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    const d = line.match(LEAD_DATE);
    if (!d) continue;
    let rest = line.slice(d[0].length);
    const a = rest.match(TRAIL_AMOUNT);
    if (!a) continue;
    rest = rest.slice(0, a.index).replace(SECOND_DATE, "").trim();
    let date;
    if (d[1]) date = parseDate(d[1]);
    else if (d[2]) date = parseDate(d[2]);
    else {
      const mon = MONTHS[(d[3] || d[7]).toLowerCase().replace(".", "")];
      const dayNum = +(d[4] || d[6]);
      const year = d[5] || d[8];
      if (year) date = utc(+year, mon, dayNum);
      else {
        // No year on most card statements: use this year, or last year if that lands in the future.
        const y = today.getUTCFullYear();
        date = utc(y, mon, dayNum);
        if (date && date - today > 2 * DAY) date = utc(y - 1, mon, dayNum);
      }
    }
    const amt = parseAmount(a[1]);
    if (!date || amt === null || !rest) continue;
    // A trailing CR or a minus sign means money coming back (a refund or payment).
    const credit = a[2] || amt < 0;
    if (credit || /payment\s*(received|thank)/i.test(rest)) continue;
    out.push({ date, desc: rest.replace(/\s{2,}/g, " "), amount: -Math.abs(amt), charge: Math.abs(amt) });
  }
  return out;
}

// Reads any supported input and says which format it was.
export function readAny(text, opts = {}) {
  const t = String(text);
  if (/<OFX>|OFXHEADER/i.test(t)) return { format: "OFX", txns: parseOFX(t) };
  const rows = parseCSV(t);
  const csvLike = rows.length > 1 && rows.filter((r) => r.length >= 3).length >= rows.length * 0.8;
  if (csvLike) {
    const txns = toTransactions(rows);
    if (txns.length) return { format: "CSV", txns };
  }
  return { format: "pasted text", txns: parsePasted(t, opts) };
}

// Several exports often overlap by a few days. Drop exact repeats.
export function mergeTransactions(...lists) {
  const seen = new Set(), out = [];
  for (const t of lists.flat()) {
    const k = `${t.date.toISOString().slice(0, 10)}|${t.charge.toFixed(2)}|${t.desc.toLowerCase().replace(/\s+/g, " ")}`;
    if (seen.has(k)) continue;
    seen.add(k); out.push(t);
  }
  return out.sort((a, b) => a.date - b.date);
}

// ---------- Merchant names ----------
const NOISE = /\b(pos|purchase|pre-?auth(orized)?|recurring|payment|pymt|debit|visa|mc|interac|e-?transfer|www|com|ca|inc|ltd|llc|corp|the|online|bill|pay|on|qc|bc|ab)\b/g;
export function merchantKey(desc) {
  let s = String(desc).toLowerCase();
  s = s.replace(/https?:\/\//g, " ").replace(/\*+/g, " ").replace(/[#]\s*\d+/g, " ");
  s = s.replace(/\b[a-z]*\d[a-z\d]*\b/g, " "); // reference numbers like 12345 or ab12cd
  s = s.replace(/[^a-z& ]+/g, " ").replace(NOISE, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s.split(" ").slice(0, 2).join(" ") || "unknown";
}

export function displayName(desc) {
  const s = String(desc).replace(/\b\d{3}[- ]\d{3}[- ]\d{4}\b/g, " ").replace(/\s+(on|qc|bc|ab|mb|sk|ns|nb|nl|pe)\s*$/i, "").replace(/[#*]\s*\d*/g, " ").replace(/\b(pre-?auth(orized)?|pos|purchase)\b/gi, " ").replace(/\s+\d{3,}\b/g, " ").replace(/\s+/g, " ").trim();
  return s ? s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : String(desc);
}

// ---------- Recurrence ----------
export const CADENCES = [
  { id: "weekly", days: 7, tol: 1.5, perYear: 52 },
  { id: "biweekly", days: 14, tol: 2.5, perYear: 26 },
  { id: "monthly", days: 30.44, tol: 4, perYear: 12 },
  { id: "quarterly", days: 91.3, tol: 8, perYear: 4 },
  { id: "yearly", days: 365.25, tol: 12, perYear: 1 },
];

export function detectCadence(dates, { minCount } = {}) {
  if (dates.length < 2) return null;
  const sorted = [...dates].sort((a, b) => a - b);
  const gaps = sorted.slice(1).map((d, i) => (d - sorted[i]) / DAY);
  const med = median(gaps);
  const c = CADENCES.find((c) => Math.abs(med - c.days) <= c.tol);
  if (!c) return null;
  const fit = gaps.filter((g) => Math.abs(g - c.days) <= c.tol * 1.5).length / gaps.length;
  const needed = minCount ?? (c.id === "yearly" ? 2 : 3);
  if (sorted.length < needed || fit < 0.75) return null;
  return { ...c, fit, medianGap: med };
}

// Split off a cheap first charge (a $0.99 or $1 trial) that came before the regular price.
function peelTrial(list) {
  if (list.length < 3) return { trial: null, list };
  const rest = list.slice(1);
  const typical = median(rest.map((t) => t.charge));
  const first = list[0];
  const gap = (rest[0].date - first.date) / DAY;
  if (first.charge <= typical * 0.25 && gap >= 3 && gap <= 45) return { trial: { date: first.date, amount: first.charge }, list: rest };
  return { trial: null, list };
}

// Count how often the price changes direction. Foreign currency charges wobble up and down;
// real price increases step up and stay there.
function wobbles(amounts) {
  let turns = 0, dir = 0;
  for (let i = 1; i < amounts.length; i++) {
    const d = Math.sign(round2(amounts[i] - amounts[i - 1]));
    if (d && dir && d !== dir) turns++;
    if (d) dir = d;
  }
  return turns;
}

const PAYERS = { PAYPAL: "PayPal", PP: "PayPal", SQ: "Square", SP: "Shopify", GOOGLE: "Google Play", TST: "Toast" };
export const payer = (v) => PAYERS[String(v).toUpperCase()] || String(v);

export function groupKey(t) {
  const svc = identify(t.desc);
  if (!svc) return { key: merchantKey(t.desc), svc: null };
  // App stores bill many apps under one name, so split those by price.
  if (svc.via) return { key: `${svc.id}:${t.charge.toFixed(2)}`, svc };
  return { key: svc.billedVia ? `${svc.id}@${svc.billedVia.toLowerCase()}` : svc.id, svc };
}

// Money moved between people or accounts repeats too, but it isn't a subscription.
export const NOT_A_SUBSCRIPTION = /transfer|\btfr\b|\batm\b|withdrawal|cheque|\brent\b|payroll|deposit|credit card payment|payment received/i;

export function findRecurring(txns, { today = new Date() } = {}) {
  const groups = new Map();
  const dataStart = txns.reduce((m, t) => (t.date < m ? t.date : m), txns[0]?.date ?? today);
  for (const t of txns) {
    if (NOT_A_SUBSCRIPTION.test(t.desc)) continue;
    const { key, svc } = groupKey(t);
    if (!groups.has(key)) groups.set(key, { svc, list: [] });
    groups.get(key).list.push(t);
  }
  const out = [];
  for (const [key, { svc, list: all }] of groups) {
    all.sort((a, b) => a.date - b.date);
    const { trial, list } = peelTrial(all);
    // A known subscription service, or one that started with a trial, needs only two regular charges.
    const minCount = svc || trial ? 2 : undefined;
    const cad = detectCadence(list.map((t) => t.date), { minCount });
    if (!cad) continue;
    if (cad.id === "weekly" && !svc && list.length < 5) continue;
    const amounts = list.map((t) => t.charge);
    const spread = Math.max(...amounts) / Math.min(...amounts);
    if (spread > 3) continue; // too variable to be a subscription (groceries, gas)
    // An unknown merchant has to charge close to the same amount most of the time.
    // Price steps are fine (most charges still match the one before), random amounts are not.
    if (!svc) { const same = amounts.slice(1).filter((a, i) => Math.abs(a - amounts[i]) <= amounts[i] * 0.03).length; if (same < (amounts.length - 1) / 2) continue; }
    const lastAmt = amounts[amounts.length - 1];
    const firstAmt = amounts[0];
    const fx = wobbles(amounts) >= 2 && spread < 1.12;
    const increases = [];
    if (!fx) for (let i = 1; i < list.length; i++) {
      const a = list[i - 1].charge, b = list[i].charge;
      if (b > a * 1.02 && b - a >= 0.5) increases.push({ date: list[i].date, from: a, to: b });
    }
    const last = list[list.length - 1].date;
    const next = new Date(last.getTime() + cad.days * DAY);
    const stale = (today - last) / DAY > cad.days * 2 + cad.tol;
    const startedDaysAgo = (today - list[0].date) / DAY;
    out.push({
      key,
      service: svc ? { id: svc.id, name: svc.name, cat: svc.cat, url: svc.url, steps: svc.steps || null, telco: !!svc.telco } : null,
      billedVia: svc?.billedVia || null,
      name: svc ? (svc.via ? `${svc.name.split(" (")[0]} subscription at $${median(amounts).toFixed(2)}` : svc.billedVia ? `${svc.name} through ${payer(svc.billedVia)}` : svc.name) : displayName(list[list.length - 1].desc),
      category: svc?.cat || "Other",
      cadence: cad.id,
      count: list.length,
      typical: median(amounts),
      last: lastAmt,
      first: firstAmt,
      firstDate: list[0].date,
      annual: round2((fx ? median(amounts) : lastAmt) * cad.perYear),
      increases,
      fx,
      trial,
      // Only call it new if the file reaches back far enough to have shown an earlier charge.
      isNew: startedDaysAgo <= 100 && ((trial?.date ?? list[0].date) - dataStart) / DAY > cad.days + cad.tol,
      lastDate: last,
      nextDate: next,
      active: !stale,
      confidence: Math.round(Math.min(1, cad.fit * Math.min(1, list.length / 4)) * 100),
    });
  }
  markDuplicates(out);
  return out.sort((a, b) => b.annual - a.annual);
}

// The same service billed two ways at once, say directly and through PayPal, is usually
// a second account nobody remembers.
function markDuplicates(subs) {
  const by = new Map();
  for (const s of subs.filter((x) => x.active && x.service && !x.service.telco && !/:/.test(x.key))) {
    if (!by.has(s.service.id)) by.set(s.service.id, []);
    by.get(s.service.id).push(s);
  }
  for (const list of by.values()) if (list.length > 1) for (const s of list) s.duplicateOf = list.filter((o) => o !== s).map((o) => o.key);
}

// ---------- Inflation check ----------
const ym = (d) => d.toISOString().slice(0, 7);
const cpiMonths = Object.keys(CPI).sort();
function cpiAt(d) {
  const k = ym(d);
  if (CPI[k]) return { month: k, value: CPI[k] };
  const latest = cpiMonths[cpiMonths.length - 1];
  if (k > latest) return { month: latest, value: CPI[latest] };
  return null;
}

// How much faster than overall prices did this subscription go up?
export function inflationCheck(sub) {
  if (!sub.increases.length) return null;
  const from = cpiAt(sub.firstDate), to = cpiAt(sub.lastDate);
  if (!from || !to || from.month >= to.month) return null;
  const pricePct = (sub.last / sub.first - 1) * 100;
  const cpiPct = (to.value / from.value - 1) * 100;
  const fairPrice = sub.first * (to.value / from.value);
  return {
    pricePct: round2(pricePct),
    cpiPct: round2(cpiPct),
    times: cpiPct > 0 ? round2(pricePct / cpiPct) : null,
    fromMonth: from.month,
    toMonth: to.month,
    fairPrice: round2(fairPrice),
    overPerYear: round2(Math.max(0, sub.last - fairPrice) * CADENCES.find((c) => c.id === sub.cadence).perYear),
  };
}

export function summarize(subs) {
  const active = subs.filter((s) => s.active);
  const per = (s) => CADENCES.find((c) => c.id === s.cadence).perYear;
  return {
    count: active.length,
    monthly: round2(active.reduce((t, s) => t + s.annual / 12, 0)),
    annual: round2(active.reduce((t, s) => t + s.annual, 0)),
    raised: active.filter((s) => s.increases.length).length,
    raisedCost: round2(active.reduce((t, s) => t + (s.increases.length ? (s.last - s.first) * per(s) : 0), 0)),
    overInflation: round2(active.reduce((t, s) => t + (inflationCheck(s)?.overPerYear || 0), 0)),
    trials: active.filter((s) => s.trial).length,
    fresh: active.filter((s) => s.isNew).length,
    duplicates: new Set(active.filter((s) => s.duplicateOf).map((s) => s.service.id)).size,
  };
}

// ---------- Cancel kit ----------
const money = (n) => `$${n.toFixed(2)}`;
const longDate = (d) => d.toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

// A short message to send by email or support chat.
export function cancelMessage(sub, { name = "" } = {}) {
  const who = sub.service?.name || sub.name;
  const lines = [
    `Hello ${who} support,`,
    "",
    `Please cancel my subscription and turn off automatic renewal, effective right away. My last charge was ${money(sub.last)} on ${longDate(sub.lastDate)}, and I do not want to be charged on ${longDate(sub.nextDate)} or after.`,
  ];
  if (sub.trial) lines.push("", `This started as a ${money(sub.trial.amount)} trial on ${longDate(sub.trial.date)}. I did not mean for it to continue at full price, so I am also asking for a refund of the charges since then.`);
  if (sub.duplicateOf) lines.push("", "I seem to have two separate subscriptions with you. Please close the duplicate and refund any overlap.");
  lines.push("", "Please reply with a confirmation that the subscription is cancelled.", "", "Thank you,", name || "[your name]");
  return lines.join("\n");
}

// Phone and internet: a script for asking for a better price before cancelling.
export function negotiationScript(sub) {
  const who = sub.service?.name || sub.name;
  const up = sub.increases.length ? ` It went from ${money(sub.first)} to ${money(sub.last)} a month since ${longDate(sub.firstDate)}.` : "";
  return [
    `Call ${who} and ask for the loyalty or retention department.`,
    `Say: "I've been a customer for a while and my bill is now ${money(sub.last)} a month.${up} I'm comparing other providers. What can you do to bring it down?"`,
    "If the first offer is small, say you will think about it and ask if there is anything better. Ask for the new price in writing.",
    "Check the next bill to make sure the new price shows up.",
  ].join("\n");
}

// ---------- Calendar reminders ----------
const icsDate = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
const esc = (s) => String(s).replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
export function toICS(subs, stamp = new Date()) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//John Khan//Quiet Charges//EN", "CALSCALE:GREGORIAN"];
  for (const s of subs.filter((x) => x.active)) {
    const remind = new Date(s.nextDate.getTime() - 3 * DAY);
    lines.push("BEGIN:VEVENT",
      `UID:${s.key.replace(/[^a-z0-9]/gi, "-")}-${icsDate(s.nextDate)}@quiet-charges`,
      `DTSTAMP:${stamp.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      `DTSTART;VALUE=DATE:${icsDate(remind)}`,
      `SUMMARY:${esc(`Decide: keep ${s.name}? Charge of $${s.last.toFixed(2)} in 3 days`)}`,
      ...(s.service?.url ? [`URL:${s.service.url}`, `DESCRIPTION:${esc(`Cancel or manage it here: ${s.service.url}`)}`] : []),
      "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n");
}

// iCalendar lines longer than 75 characters must wrap onto lines that start with a space.
function fold(line) {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(" " + line.slice(i, i + 74));
  return parts.join("\r\n");
}
