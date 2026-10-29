// Builds the sample files: a year of made up bank activity for one person in Toronto.
// The service names are real so the cancel links work in the demo; every amount and
// date is invented. Run: node scripts/make-sample.mjs
import { writeFileSync } from "node:fs";

let seed = 20261029;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const ref = () => Array.from({ length: 6 }, () => pick("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")).join("");
const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const START = D(2025, 10, 29), END = D(2026, 10, 28);
const rows = [];
const add = (date, desc, amount) => { if (date <= END) rows.push({ date, desc, amount }); };
const monthly = (day, from, to, fn) => { for (let y = from.getUTCFullYear(), m = from.getUTCMonth() + 1; D(y, m, day) <= to; m === 12 ? (y++, m = 1) : m++) { const dt = D(y, m, Math.min(day, 28)); if (dt >= from) fn(dt, y, m); } };
const every = (days, first, to, fn) => { for (let t = first.getTime(), i = 0; t <= to.getTime(); t += days * 86400000, i++) fn(new Date(t), i); };

// Subscriptions
monthly(12, START, END, (d, y, m) => add(d, "NETFLIX.COM 866-579-7172 ON", (y === 2025 || m < 4) ? 18.99 : 20.99));
monthly(3, START, END, (d, y, m) => add(d, `SPOTIFY P${ref()}`, (y === 2025 || m < 6) ? 11.99 : 12.99));
monthly(21, START, END, (d, y, m) => add(d, "PAYPAL *SPOTIFY", (y === 2025 || m < 6) ? 11.99 : 12.99));
monthly(26, START, END, (d, y, m) => add(d, "ROGERS ******5678", y === 2025 || m < 2 ? 85.0 : m < 8 ? 90.0 : 95.0));
every(14, D(2025, 10, 31), END, (d) => add(d, "GOODLIFE FITNESS CLUBS", d < D(2026, 1, 15) ? 29.99 : 32.99));
add(D(2024, 11, 18), "AMAZON PRIME MEMBER AMAZON.CA", 99.0);
add(D(2025, 11, 18), "AMAZON PRIME MEMBER AMAZON.CA", 99.0);
const fx = [27.41, 27.88, 27.62, 28.1, 27.35, 27.96, 27.7, 28.21, 27.49, 27.83, 27.58, 28.04];
monthly(9, START, END, (d, y, m) => add(d, "OPENAI *CHATGPT SUBSCR USD 20.00", fx[(m + 1) % 12]));
monthly(14, START, END, (d) => add(d, "APPLE.COM/BILL 866-712-7753 ON", 4.49));
monthly(22, START, END, (d) => add(d, "APPLE.COM/BILL 866-712-7753 ON", 14.99));
add(D(2026, 7, 20), `AUDIBLE*${ref()}`, 0.99);
[D(2026, 8, 20), D(2026, 9, 20), D(2026, 10, 20)].forEach((d) => add(d, `AUDIBLE*${ref()}`, 14.95));
[D(2026, 8, 30), D(2026, 9, 30)].forEach((d) => add(d, "CRAVE BELL MEDIA", 22.0));
monthly(7, START, END, (d) => add(d, "GOOGLE *YouTubePremium", 13.99));
every(7, D(2025, 11, 3), D(2026, 6, 15), (d) => add(d, "HELLO FRESH CANADA", 79.99));

// Everyday spending that should NOT be called a subscription
every(14, D(2025, 10, 30), END, (d) => add(d, "PAYROLL DEPOSIT", -2450.0));
monthly(1, START, END, (d) => add(d, "INTERAC E-TRANSFER RENT", 1850.0));
for (let t = START.getTime(); t <= END.getTime(); t += (1 + Math.floor(rnd() * 4)) * 86400000) add(new Date(t), `TIM HORTONS #${1000 + Math.floor(rnd() * 8999)}`, +(2 + rnd() * 7).toFixed(2));
for (let t = START.getTime(); t <= END.getTime(); t += (3 + Math.floor(rnd() * 6)) * 86400000) add(new Date(t), pick(["LOBLAWS 1012", "NO FRILLS 3321", "METRO 0456", "FARM BOY 22"]), +(25 + rnd() * 140).toFixed(2));
for (let t = START.getTime(); t <= END.getTime(); t += (5 + Math.floor(rnd() * 15)) * 86400000) add(new Date(t), `PRESTO AUTOLD ${Math.floor(rnd() * 900000)}`, pick([20, 40, 50]));
for (let t = START.getTime(); t <= END.getTime(); t += (4 + Math.floor(rnd() * 20)) * 86400000) add(new Date(t), "UBER CANADA/UBERTRIP", +(9 + rnd() * 30).toFixed(2));
for (let t = START.getTime(); t <= END.getTime(); t += (9 + Math.floor(rnd() * 25)) * 86400000) add(new Date(t), "SHOPPERS DRUG MART #0789", +(8 + rnd() * 70).toFixed(2));
for (let t = START.getTime(); t <= END.getTime(); t += (10 + Math.floor(rnd() * 30)) * 86400000) add(new Date(t), "LCBO/RAO #0217", +(15 + rnd() * 50).toFixed(2));

rows.sort((a, b) => a.date - b.date || a.desc.localeCompare(b.desc));
const iso = (d) => d.toISOString().slice(0, 10);
const csv = ["Date,Description,Amount", ...rows.map((r) => `${iso(r.date)},${r.desc.includes(",") ? `"${r.desc}"` : r.desc},${(-r.amount).toFixed(2)}`)].join("\n") + "\n";
writeFileSync(new URL("../src/sample.csv", import.meta.url), csv);

// The last two months as text copied from a credit card PDF statement.
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const md = (d) => `${MON[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, "0")}`;
const recent = rows.filter((r) => r.date >= D(2026, 8, 29) && r.amount > 0 && !/TRANSFER/.test(r.desc));
const txt = ["CARD STATEMENT  Aug 29 to Oct 28, 2026", "TRANS   POST    DESCRIPTION                                AMOUNT ($)", ...recent.map((r) => { const post = new Date(r.date.getTime() + 86400000); return `${md(r.date)}  ${md(post)}  ${r.desc.padEnd(42)} ${r.amount.toFixed(2).padStart(9)}`; }), "OCT 15  OCT 15  PAYMENT RECEIVED THANK YOU                    1,200.00 CR"].join("\n") + "\n";
writeFileSync(new URL("../docs/sample-statement.txt", import.meta.url), txt);

// The same two months as an OFX/QFX download.
const ofx = ["OFXHEADER:100", "DATA:OFXSGML", "VERSION:102", "", "<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>CAD<BANKTRANLIST>",
  ...recent.map((r, i) => `<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>${iso(r.date).replace(/-/g, "")}120000<TRNAMT>-${r.amount.toFixed(2)}<FITID>QC${i}<NAME>${r.desc.slice(0, 32)}</STMTTRN>`),
  "</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>"].join("\n") + "\n";
writeFileSync(new URL("../docs/sample.qfx", import.meta.url), ofx);
console.log(`${rows.length} rows, ${recent.length} in the statement and QFX samples`);
