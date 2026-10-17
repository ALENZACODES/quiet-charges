// Quiet Charges engine: parse bank CSV exports, group charges by merchant,
// detect recurring patterns, flag price increases, and project the next charge.

// ---------- CSV ----------
export function parseCSV(text) {
  const rows = [];
  let row = [],
    field = "",
    q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const DATE_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})$|^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
export function parseDate(s) {
  const m = String(s).trim().match(DATE_RE);
  if (!m) return null;
  // ISO, or M/D/YYYY (the order RBC and TD exports use)
  const [y, mo, d] = m[1] ? [+m[1], +m[2], +m[3]] : [+m[6], +m[4], +m[5]];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCMonth() === mo - 1 ? dt : null;
}

export function parseAmount(s) {
  if (s === undefined || s === null) return null;
  let t = String(s).trim();
  if (!t) return null;
  const neg = /^\(.*\)$/.test(t) || t.startsWith("-");
  t = t.replace(/[()$,\s-]/g, "");
  if (!/^\d*\.?\d+$/.test(t)) return null;
  return neg ? -+t : +t;
}

// Works out which columns hold the date, description and amount.
// Handles a header row (any order) or headerless TD-style rows: date, description, debit, credit, balance.
export function toTransactions(rows) {
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.toLowerCase().trim());
  const has = (re) => head.findIndex((h) => re.test(h));
  let start = 0,
    di,
    de,
    am,
    debit = -1,
    credit = -1;
  if (head.some((h) => /date/.test(h))) {
    start = 1;
    di = has(/date/);
    de = has(/desc|merchant|payee|name|details/);
    am = has(/^amount|cad\$|^cad/);
    debit = has(/debit|withdraw/);
    credit = has(/credit|deposit/);
    if (de < 0) de = has(/memo|narrative/);
  } else {
    di = 0;
    de = 1;
    debit = 2;
    credit = 3;
    am = -1;
  }
  const out = [];
  for (const r of rows.slice(start)) {
    const date = parseDate(r[di]);
    if (!date) continue;
    let amount;
    if (am >= 0 && r[am] !== undefined && r[am].trim() !== "") amount = parseAmount(r[am]);
    else {
      const d = parseAmount(r[debit]),
        c = parseAmount(r[credit]);
      amount = d ? -Math.abs(d) : c ? Math.abs(c) : null;
    }
    if (amount === null) continue;
    out.push({ date, desc: String(r[de] ?? "").trim(), amount });
  }
  // Treat money going out as positive "charges".
  const spends = out.filter((t) => t.amount < 0).length;
  const sign = spends >= out.length / 2 ? -1 : 1;
  return out.map((t) => ({ ...t, charge: t.amount * sign })).filter((t) => t.charge > 0);
}

// ---------- Merchant names ----------
const NOISE =
  /\b(pos|purchase|pre-?auth(orized)?|recurring|payment|pymt|debit|visa|mc|interac|e-?transfer|www|com|ca|inc|ltd|llc|corp|the|online|bill|pay)\b/g;
export function merchantKey(desc) {
  let s = String(desc).toLowerCase();
  s = s
    .replace(/https?:\/\//g, " ")
    .replace(/\*+/g, " ")
    .replace(/[#]\s*\d+/g, " ");
  s = s.replace(/\b[a-z]*\d[a-z\d]*\b/g, " "); // reference numbers like 12345 or ab12cd
  s = s.replace(/[^a-z& ]+/g, " ").replace(NOISE, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s.split(" ").slice(0, 2).join(" ") || "unknown";
}

// ---------- Recurrence ----------
const DAY = 86400000;
export const CADENCES = [
  { id: "weekly", days: 7, tol: 1.5, perYear: 52 },
  { id: "biweekly", days: 14, tol: 2.5, perYear: 26 },
  { id: "monthly", days: 30.44, tol: 4, perYear: 12 },
  { id: "quarterly", days: 91.3, tol: 8, perYear: 4 },
  { id: "yearly", days: 365.25, tol: 12, perYear: 1 },
];

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function detectCadence(dates) {
  if (dates.length < 2) return null;
  const sorted = [...dates].sort((a, b) => a - b);
  const gaps = sorted.slice(1).map((d, i) => (d - sorted[i]) / DAY);
  const med = median(gaps);
  const c = CADENCES.find((c) => Math.abs(med - c.days) <= c.tol);
  if (!c) return null;
  const fit = gaps.filter((g) => Math.abs(g - c.days) <= c.tol * 1.5).length / gaps.length;
  const needed = c.id === "yearly" ? 2 : 3;
  if (sorted.length < needed || fit < 0.75) return null;
  return { ...c, fit, medianGap: med };
}

export function displayName(desc) {
  const s = String(desc)
    .replace(/[#*]\s*\d*/g, " ")
    .replace(/\b(pre-?auth(orized)?|pos|purchase)\b/gi, " ")
    .replace(/\s+\d{3,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s ? s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : String(desc);
}

export function findRecurring(txns, { today = new Date() } = {}) {
  const groups = new Map();
  for (const t of txns) {
    const k = merchantKey(t.desc);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  const out = [];
  for (const [key, list] of groups) {
    list.sort((a, b) => a.date - b.date);
    const cad = detectCadence(list.map((t) => t.date));
    if (!cad) continue;
    const amounts = list.map((t) => t.charge);
    const lastAmt = amounts[amounts.length - 1];
    const firstAmt = amounts[0];
    const typical = median(amounts);
    const spread = Math.max(...amounts) / Math.min(...amounts);
    if (spread > 3) continue; // too variable to be a subscription (groceries, gas)
    const increases = [];
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1].charge,
        b = list[i].charge;
      if (b > a * 1.02 && b - a >= 0.5) increases.push({ date: list[i].date, from: a, to: b });
    }
    const last = list[list.length - 1].date;
    const next = new Date(last.getTime() + cad.days * DAY);
    const stale = (today - last) / DAY > cad.days * 2 + cad.tol;
    out.push({
      key,
      name: displayName(list[list.length - 1].desc),
      cadence: cad.id,
      count: list.length,
      typical,
      last: lastAmt,
      first: firstAmt,
      annual: lastAmt * cad.perYear,
      increases,
      lastDate: last,
      nextDate: next,
      active: !stale,
      confidence: Math.round(Math.min(1, cad.fit * Math.min(1, list.length / 4)) * 100),
    });
  }
  return out.sort((a, b) => b.annual - a.annual);
}

export function summarize(subs) {
  const active = subs.filter((s) => s.active);
  return {
    count: active.length,
    monthly: active.reduce((t, s) => t + s.annual / 12, 0),
    annual: active.reduce((t, s) => t + s.annual, 0),
    raised: active.filter((s) => s.increases.length).length,
    raisedCost: active.reduce((t, s) => t + (s.last - s.first) * CADENCES.find((c) => c.id === s.cadence).perYear, 0),
  };
}

// ---------- Calendar reminders ----------
const icsDate = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
const esc = (s) =>
  String(s)
    .replace(/[\\;,]/g, (m) => "\\" + m)
    .replace(/\n/g, " ");
export function toICS(subs, stamp = new Date()) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//John Khan//Quiet Charges//EN", "CALSCALE:GREGORIAN"];
  for (const s of subs.filter((x) => x.active)) {
    const remind = new Date(s.nextDate.getTime() - 3 * DAY);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${s.key.replace(/\s/g, "-")}-${icsDate(s.nextDate)}@quiet-charges`,
      `DTSTAMP:${stamp.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      `DTSTART;VALUE=DATE:${icsDate(remind)}`,
      `SUMMARY:${esc(`Decide: keep ${s.name}? Charge of $${s.last.toFixed(2)} in 3 days`)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
