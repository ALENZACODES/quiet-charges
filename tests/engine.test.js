import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  displayName, parseCSV, parseDate, parseAmount, toTransactions, merchantKey, detectCadence, findRecurring,
  summarize, toICS, parseOFX, parsePasted, readAny, mergeTransactions, inflationCheck, cancelMessage, negotiationScript,
} from "../src/engine.js";
import { identify, CATALOG } from "../src/catalog.js";
import { CPI } from "../src/cpi.js";

const d = (s) => new Date(s + "T00:00:00Z");
const file = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const SAMPLE_TODAY = d("2026-10-28");
const monthlyRows = (desc, n, price, startMonth = 0, day = 5) => Array.from({ length: n }, (_, m) => ({ date: new Date(Date.UTC(2026, startMonth + m, day)), desc, charge: typeof price === "function" ? price(m) : price }));

// ---------- Reading files ----------
test("CSV handles quotes, commas and CRLF", () => {
  assert.deepEqual(parseCSV('a,"b, c","say ""hi"""\r\n1,2,3\r\n'), [["a", "b, c", 'say "hi"'], ["1", "2", "3"]]);
});

test("CSV with semicolons is read too", () => {
  assert.deepEqual(parseCSV("Date;Description;Amount\n2026-01-01;GYM;-50"), [["Date", "Description", "Amount"], ["2026-01-01", "GYM", "-50"]]);
});

test("dates: ISO, M/D/YYYY, D/M/YYYY, named months and OFX, rejects impossible dates", () => {
  const iso = (x) => x.toISOString().slice(0, 10);
  assert.equal(iso(parseDate("2026-03-05")), "2026-03-05");
  assert.equal(iso(parseDate("3/5/2026")), "2026-03-05");
  assert.equal(iso(parseDate("5/3/2026", "dmy")), "2026-03-05");
  assert.equal(iso(parseDate("Oct 3, 2026")), "2026-10-03");
  assert.equal(iso(parseDate("03-Oct-2026")), "2026-10-03");
  assert.equal(iso(parseDate("20261003120000[-5:EST]")), "2026-10-03");
  assert.equal(parseDate("2026-02-30"), null);
  assert.equal(parseDate("hello"), null);
});

test("a file with a day over 12 in the first slot is read day first", () => {
  const tx = toTransactions(parseCSV("Date,Description,Amount\n25/01/2026,GYM,-50\n03/02/2026,GYM,-50"));
  assert.equal(tx[1].date.toISOString().slice(0, 10), "2026-02-03");
});

test("amounts: signs, brackets, dollar signs, thousands, trailing minus", () => {
  assert.equal(parseAmount("-12.99"), -12.99);
  assert.equal(parseAmount("($1,234.50)"), -1234.5);
  assert.equal(parseAmount("$7"), 7);
  assert.equal(parseAmount("12.99-"), -12.99);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("abc"), null);
});

test("header layout with a single amount column", () => {
  const tx = toTransactions(parseCSV("Date,Description,Amount\n2026-01-01,GYM,-50\n2026-01-02,PAY,2000\n2026-01-03,CAFE,-4"));
  assert.deepEqual(tx.map((t) => t.charge), [50, 4]);
});

test("headerless layout: date, description, debit, credit, balance", () => {
  const tx = toTransactions(parseCSV("01/05/2026,GYM,50.00,,1000\n01/06/2026,PAYROLL,,2000.00,3000\n"));
  assert.equal(tx.length, 1);
  assert.equal(tx[0].charge, 50);
});

test("OFX and QFX downloads", () => {
  const ofx = "OFXHEADER:100\n<OFX><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261003120000<TRNAMT>-20.99<NAME>NETFLIX.COM</STMTTRN><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261004<TRNAMT>2450.00<NAME>PAYROLL</STMTTRN></OFX>";
  const tx = parseOFX(ofx);
  assert.equal(tx.length, 1);
  assert.equal(tx[0].charge, 20.99);
  assert.equal(readAny(ofx).format, "OFX");
});

test("pasted statement text: two dates, phone numbers, no year, credits skipped", () => {
  const txt = [
    "TRANS   POST    DESCRIPTION   AMOUNT",
    "OCT 03  OCT 04  NETFLIX.COM 866-579-7172 ON   20.99",
    "Sep 28 SPOTIFY P3A1B2 $12.99",
    "DEC 30  DEC 31  GOODLIFE FITNESS CLUBS 32.99",
    "OCT 15  OCT 15  PAYMENT RECEIVED THANK YOU   1,200.00 CR",
    "OCT 16  REFUND AMAZON.CA  -25.00",
    "just some header text",
  ].join("\n");
  const tx = parsePasted(txt, { today: d("2026-10-29") });
  assert.deepEqual(tx.map((t) => [t.date.toISOString().slice(0, 10), t.desc, t.charge]), [
    ["2026-10-03", "NETFLIX.COM 866-579-7172 ON", 20.99],
    ["2026-09-28", "SPOTIFY P3A1B2", 12.99],
    ["2025-12-30", "GOODLIFE FITNESS CLUBS", 32.99], // December is last year, not two months from now
  ]);
  assert.equal(readAny(txt, { today: d("2026-10-29") }).format, "pasted text");
});

test("overlapping exports are merged without double counting", () => {
  const a = toTransactions(parseCSV("Date,Description,Amount\n2026-01-01,GYM,-50\n2026-01-02,CAFE,-4"));
  const b = toTransactions(parseCSV("Date,Description,Amount\n2026-01-02,CAFE,-4\n2026-01-03,BOOKS,-30"));
  assert.equal(mergeTransactions(a, b).length, 3);
});

// ---------- Names and the service list ----------
test("merchant names ignore reference numbers and noise", () => {
  assert.equal(merchantKey("NORTHWAVE MUSIC* #4821"), merchantKey("NORTHWAVE MUSIC* #1177"));
  assert.equal(merchantKey("POS PURCHASE FITLAB GYM 00231"), "fitlab gym");
});

test("display names are tidy", () => {
  assert.equal(displayName("FITLAB GYM PRE-AUTH #7101"), "Fitlab Gym");
  assert.equal(displayName("NORTHWAVE MUSIC* #2408"), "Northwave Music");
  assert.equal(displayName("CORNER BOOKS 416-555-0199 ON"), "Corner Books");
});

test("known services are recognised, including inside PayPal and Google wrappers", () => {
  assert.equal(identify("NETFLIX.COM 866-579-7172 ON").id, "netflix");
  assert.equal(identify("PAYPAL *SPOTIFY").id, "spotify");
  assert.equal(identify("PAYPAL *SPOTIFY").billedVia, "PAYPAL");
  assert.equal(identify("SPOTIFY P1A2B3").billedVia, null);
  assert.equal(identify("GOOGLE *YouTubePremium").id, "youtube");
  assert.equal(identify("GOOGLE *YouTubePremium").billedVia, null, "Google billing YouTube is normal");
  assert.equal(identify("APPLE.COM/BILL 866-712-7753 ON").id, "apple");
  assert.equal(identify("OPENAI *CHATGPT SUBSCR").id, "openai");
  assert.equal(identify("ROGERS ******5678").telco, true);
  assert.equal(identify("FRESHMART GROCERY 100"), null);
});

test("every service in the list has an https link and either steps or a phone script", () => {
  const ids = new Set();
  for (const c of CATALOG) {
    assert.ok(!ids.has(c.id), `duplicate id ${c.id}`); ids.add(c.id);
    assert.match(c.url, /^https:\/\//, c.id);
    assert.ok(c.telco || (Array.isArray(c.steps) && c.steps.length >= 2), c.id);
  }
  assert.ok(CATALOG.length >= 30);
});

// ---------- Finding subscriptions ----------
test("cadence detection", () => {
  const monthly = ["2026-01-03", "2026-02-03", "2026-03-03", "2026-04-03"].map(d);
  assert.equal(detectCadence(monthly).id, "monthly");
  const weekly = Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + 7 * i)));
  assert.equal(detectCadence(weekly).id, "weekly");
  assert.equal(detectCadence(["2025-05-01", "2026-05-02"].map(d)).id, "yearly");
  assert.equal(detectCadence(["2026-01-01", "2026-01-04", "2026-02-20", "2026-02-21"].map(d)), null);
  assert.equal(detectCadence(["2026-01-03", "2026-02-03"].map(d)), null, "two monthly charges are not enough for an unknown merchant");
  assert.equal(detectCadence(["2026-01-03", "2026-02-03"].map(d), { minCount: 2 }).id, "monthly");
});

test("finds price increases and stopped subscriptions", () => {
  const rows = [...monthlyRows("STREAM TV", 8, (m) => (m < 4 ? 18.99 : 20.99)), ...monthlyRows("OLD APP", 4, 5, 0, 9)];
  const subs = findRecurring(rows, { today: d("2026-09-10") });
  const tv = subs.find((s) => s.key === "stream tv");
  assert.equal(tv.increases.length, 1);
  assert.equal(tv.active, true);
  assert.ok(Math.abs(tv.annual - 20.99 * 12) < 1e-9);
  assert.equal(subs.find((s) => s.key === "old app").active, false);
});

test("groceries, coffee and rides at random intervals are not subscriptions", () => {
  const rows = [3, 9, 10, 22, 40, 41, 70, 95].map((n, i) => ({ date: new Date(Date.UTC(2026, 0, n)), desc: "FRESHMART " + i, charge: 20 + i * 13 }));
  const rides = [0, 14, 28, 42].map((n, i) => ({ date: new Date(Date.UTC(2026, 0, 1 + n)), desc: "UBER CANADA/UBERTRIP", charge: [12.4, 31.9, 18.75, 9.6][i] }));
  assert.equal(findRecurring([...rows, ...rides]).length, 0);
});

test("rent and transfers repeat but are not subscriptions", () => {
  const rows = [...monthlyRows("INTERAC E-TRANSFER RENT", 6, 1850, 0, 1), ...monthlyRows("TFR TO SAVINGS", 6, 200, 0, 2)];
  assert.equal(findRecurring(rows, { today: d("2026-06-10") }).length, 0);
});

test("a cheap first charge followed by full price is a free trial that converted", () => {
  const rows = [{ date: d("2026-07-20"), desc: "AUDIBLE*AB12CD", charge: 0.99 }, ...[8, 9, 10].map((m) => ({ date: new Date(Date.UTC(2026, m - 1, 20)), desc: "AUDIBLE*ZZ" + m, charge: 14.95 })),
    { date: d("2026-01-02"), desc: "LOBLAWS", charge: 80 }];
  const [s] = findRecurring(rows, { today: d("2026-10-28") });
  assert.equal(s.service.id, "audible");
  assert.deepEqual(s.trial, { date: d("2026-07-20"), amount: 0.99 });
  assert.equal(s.count, 3);
  assert.equal(s.isNew, true);
  assert.equal(s.increases.length, 0, "the trial price is not a price increase");
});

test("a known service with two recent charges counts as a new subscription", () => {
  const rows = [{ date: d("2026-01-02"), desc: "LOBLAWS", charge: 80 }, { date: d("2026-08-30"), desc: "CRAVE BELL MEDIA", charge: 22 }, { date: d("2026-09-30"), desc: "CRAVE BELL MEDIA", charge: 22 }];
  const [s] = findRecurring(rows, { today: d("2026-10-28") });
  assert.equal(s.service.id, "crave");
  assert.equal(s.isNew, true);
});

test("nothing is called new when the file is too short to know", () => {
  const subs = findRecurring(monthlyRows("NETFLIX.COM", 3, 20.99, 7), { today: d("2026-10-28") });
  assert.equal(subs[0].isNew, false);
});

test("the same service billed directly and through PayPal is flagged as paying twice", () => {
  const rows = [...monthlyRows("SPOTIFY P1", 5, 12.99, 0, 3), ...monthlyRows("PAYPAL *SPOTIFY", 5, 12.99, 0, 21)];
  const subs = findRecurring(rows, { today: d("2026-05-25") });
  assert.equal(subs.length, 2);
  assert.ok(subs.every((s) => s.duplicateOf));
  assert.equal(summarize(subs).duplicates, 1);
});

test("two different Apple subscriptions on one Apple bill are kept apart and not called duplicates", () => {
  const rows = [...monthlyRows("APPLE.COM/BILL", 5, 4.49, 0, 14), ...monthlyRows("APPLE.COM/BILL", 5, 14.99, 0, 22)];
  const subs = findRecurring(rows, { today: d("2026-05-25") });
  assert.deepEqual(subs.map((s) => s.last).sort(), [14.99, 4.49]);
  assert.ok(subs.every((s) => !s.duplicateOf));
});

test("a US dollar charge that wobbles with the exchange rate is not a price increase", () => {
  const fx = [27.41, 27.88, 27.62, 28.1, 27.35, 27.96];
  const [s] = findRecurring(monthlyRows("OPENAI *CHATGPT SUBSCR USD 20.00", 6, (m) => fx[m]), { today: d("2026-06-20") });
  assert.equal(s.fx, true);
  assert.equal(s.increases.length, 0);
  assert.equal(s.annual, Math.round(((27.62 + 27.88) / 2) * 12 * 100) / 100);
});

// ---------- Inflation ----------
test("inflation data is monthly, recent and plausible", () => {
  const keys = Object.keys(CPI).sort();
  assert.ok(keys.length >= 36);
  assert.equal(keys[keys.length - 1], "2026-09");
  for (const k of keys) assert.ok(CPI[k] > 140 && CPI[k] < 200, k);
});

test("price rise compared with inflation over the same months", () => {
  const [s] = findRecurring(monthlyRows("NETFLIX.COM", 12, (m) => (m < 3 ? 18.99 : 20.99), -2, 12), { today: d("2026-10-20") });
  const inf = inflationCheck(s);
  assert.equal(inf.fromMonth, "2025-11");
  assert.equal(inf.toMonth, "2026-09", "clamped to the latest month published");
  assert.equal(inf.cpiPct, Math.round((CPI["2026-09"] / CPI["2025-11"] - 1) * 10000) / 100);
  assert.equal(inf.pricePct, 10.53);
  assert.ok(inf.times > 3);
  assert.ok(inf.fairPrice > 18.99 && inf.fairPrice < 20.99);
  assert.ok(inf.overPerYear > 0);
});

// ---------- The whole sample ----------
test("sample year end to end", () => {
  const { format, txns } = readAny(file("src/sample.csv"));
  assert.equal(format, "CSV");
  const subs = findRecurring(txns, { today: SAMPLE_TODAY });
  const active = subs.filter((s) => s.active).map((s) => s.key).sort();
  assert.deepEqual(active, ["apple:14.99", "apple:4.49", "audible", "crave", "goodlife", "netflix", "openai", "prime", "rogers", "spotify", "spotify@paypal", "youtube"]);
  assert.deepEqual(subs.filter((s) => !s.active).map((s) => s.key), ["hellofresh"]);
  const sum = summarize(subs);
  assert.equal(sum.count, 12);
  assert.equal(sum.raised, 5);
  assert.equal(sum.trials, 1);
  assert.equal(sum.duplicates, 1);
  assert.equal(sum.fresh, 2);
  assert.equal(sum.raisedCost, 246);
});

test("the pasted statement and QFX samples find the same subscriptions", () => {
  const a = findRecurring(readAny(file("docs/sample-statement.txt"), { today: SAMPLE_TODAY }).txns, { today: SAMPLE_TODAY }).map((s) => s.key).sort();
  const b = findRecurring(readAny(file("docs/sample.qfx")).txns, { today: SAMPLE_TODAY }).map((s) => s.key).sort();
  assert.deepEqual(a, b);
  assert.ok(a.includes("netflix") && a.includes("spotify@paypal"));
  assert.ok(!a.includes("uber canada"));
});

// ---------- Outputs ----------
test("cancel message names the dates and asks for a refund after a trial", () => {
  const rows = [{ date: d("2026-07-20"), desc: "AUDIBLE*AB", charge: 0.99 }, ...[8, 9, 10].map((m) => ({ date: new Date(Date.UTC(2026, m - 1, 20)), desc: "AUDIBLE*AB", charge: 14.95 }))];
  const [s] = findRecurring(rows, { today: d("2026-10-28") });
  const msg = cancelMessage(s, { name: "Sam" });
  assert.match(msg, /^Hello Audible support,/);
  assert.match(msg, /\$14\.95 on October 20, 2026/);
  assert.match(msg, /\$0\.99 trial on July 20, 2026/);
  assert.match(msg, /refund/);
  assert.match(msg, /Sam$/);
  assert.doesNotMatch(msg, / [\u2013\u2014] /, "no dashes as punctuation");
});

test("phone bill script quotes the real increase", () => {
  const [s] = findRecurring(monthlyRows("ROGERS ******5678", 6, (m) => (m < 3 ? 85 : 95)), { today: d("2026-06-10") });
  const script = negotiationScript(s);
  assert.match(script, /from \$85\.00 to \$95\.00/);
  assert.match(script, /retention/);
});

test("calendar file is valid for calendar apps: escaped, folded, with the cancel link", () => {
  const subs = findRecurring([0, 1, 2, 3].map((m) => ({ date: new Date(Date.UTC(2026, m, 5)), desc: "NETFLIX.COM", charge: 20.99 })), { today: d("2026-04-10") });
  const ics = toICS(subs, d("2026-04-10"));
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:2026050\d/);
  assert.match(ics, /URL:https:\/\/help\.netflix\.com/);
  assert.match(ics, /END:VCALENDAR$/);
  for (const line of ics.split("\r\n")) assert.ok(line.length <= 75, `line too long: ${line}`);
  const plain = toICS(findRecurring([0, 1, 2, 3].map((m) => ({ date: new Date(Date.UTC(2026, m, 5)), desc: "GYM, DOWNTOWN", charge: 50 })), { today: d("2026-04-10") }));
  assert.match(plain, /Gym\\, Downtown/);
});

// ---------- Real bank layouts (column names as the banks export them, made up rows) ----------
test("RBC layout: Transaction Date, Description 1, CAD$", () => {
  const tx = toTransactions(parseCSV('"Account Type","Account Number","Transaction Date","Cheque Number","Description 1","Description 2","CAD$","USD$"\nChequing,01234,10/3/2026,,"NETFLIX.COM",,-20.99,\nChequing,01234,10/4/2026,,"PAYROLL",,2450.00,'));
  assert.deepEqual(tx.map((t) => [t.desc, t.charge]), [["NETFLIX.COM", 20.99]]);
});

test("BMO layout: a preamble line, then Transaction Amount with purchases as positive numbers", () => {
  const tx = toTransactions(parseCSV("Following data is valid as of 20261028\nItem #,Card #,Transaction Date,Posting Date,Transaction Amount,Description\n1,'5191,20261003,20261004,20.99,NETFLIX.COM\n2,'5191,20261005,20261006,12.99,SPOTIFY P1\n3,'5191,20261010,20261010,-500.00,PAYMENT RECEIVED"));
  assert.deepEqual(tx.map((t) => [t.date.toISOString().slice(0, 10), t.charge]), [["2026-10-03", 20.99], ["2026-10-05", 12.99]]);
});

test("Tangerine layout: Transaction date, Transaction, Name, Memo, Amount", () => {
  const tx = toTransactions(parseCSV("Transaction date,Transaction,Name,Memo,Amount\n10/3/2026,DEBIT,NETFLIX.COM,Rewards earned: 0.21,-20.99"));
  assert.equal(tx[0].desc, "NETFLIX.COM");
  assert.equal(tx[0].charge, 20.99);
});

test("CIBC layout: headerless date, description, debit, credit, card", () => {
  const tx = toTransactions(parseCSV("2026-10-03,NETFLIX.COM,20.99,,4500********1234\n2026-10-10,PAYMENT THANK YOU,,500.00,4500********1234"));
  assert.deepEqual(tx.map((t) => t.charge), [20.99]);
});

// ---------- No false alarms ----------
test("a thousand random everyday purchases never look like a subscription", () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const shops = ["LOBLAWS", "METRO", "TIM HORTONS", "UBER CANADA/UBERTRIP", "SHOPPERS DRUG MART", "LCBO", "PETRO CANADA", "DOLLARAMA", "WINNERS", "CANADIAN TIRE"];
  const rows = [];
  let t = Date.UTC(2025, 9, 1);
  for (let i = 0; i < 1000; i++) { t += Math.floor(rnd() * 3) * 86400000; rows.push({ date: new Date(t), desc: shops[Math.floor(rnd() * shops.length)] + " #" + Math.floor(rnd() * 9999), charge: Math.round((3 + rnd() * 120) * 100) / 100 }); }
  assert.deepEqual(findRecurring(rows, { today: new Date(t) }).map((s) => s.name), []);
});
