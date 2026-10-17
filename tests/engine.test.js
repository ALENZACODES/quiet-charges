import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  displayName,
  parseCSV,
  parseDate,
  parseAmount,
  toTransactions,
  merchantKey,
  detectCadence,
  findRecurring,
  summarize,
  toICS,
} from "../src/engine.js";

const d = (s) => new Date(s + "T00:00:00Z");

test("CSV handles quotes, commas and CRLF", () => {
  assert.deepEqual(parseCSV('a,"b, c","say ""hi"""\r\n1,2,3\r\n'), [
    ["a", "b, c", 'say "hi"'],
    ["1", "2", "3"],
  ]);
});

test("dates: ISO and M/D/YYYY, rejects impossible dates", () => {
  assert.equal(parseDate("2026-03-05").toISOString().slice(0, 10), "2026-03-05");
  assert.equal(parseDate("3/5/2026").toISOString().slice(0, 10), "2026-03-05");
  assert.equal(parseDate("2026-02-30"), null);
  assert.equal(parseDate("hello"), null);
});

test("amounts: signs, brackets, dollar signs, thousands", () => {
  assert.equal(parseAmount("-12.99"), -12.99);
  assert.equal(parseAmount("($1,234.50)"), -1234.5);
  assert.equal(parseAmount("$7"), 7);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("abc"), null);
});

test("header layout with a single amount column", () => {
  const tx = toTransactions(
    parseCSV("Date,Description,Amount\n2026-01-01,GYM,-50\n2026-01-02,PAY,2000\n2026-01-03,CAFE,-4"),
  );
  assert.deepEqual(
    tx.map((t) => t.charge),
    [50, 4],
  );
});

test("headerless TD-style layout: date, description, debit, credit, balance", () => {
  const tx = toTransactions(parseCSV("01/05/2026,GYM,50.00,,1000\n01/06/2026,PAYROLL,,2000.00,3000\n"));
  assert.equal(tx.length, 1);
  assert.equal(tx[0].charge, 50);
});

test("merchant names ignore reference numbers and noise", () => {
  assert.equal(merchantKey("NORTHWAVE MUSIC* #4821"), merchantKey("NORTHWAVE MUSIC* #1177"));
  assert.equal(merchantKey("POS PURCHASE FITLAB GYM 00231"), "fitlab gym");
});

test("cadence detection", () => {
  const monthly = ["2026-01-03", "2026-02-03", "2026-03-03", "2026-04-03"].map(d);
  assert.equal(detectCadence(monthly).id, "monthly");
  const weekly = Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + 7 * i)));
  assert.equal(detectCadence(weekly).id, "weekly");
  assert.equal(detectCadence(["2025-05-01", "2026-05-02"].map(d)).id, "yearly");
  assert.equal(detectCadence(["2026-01-01", "2026-01-04", "2026-02-20", "2026-02-21"].map(d)), null);
  assert.equal(detectCadence(["2026-01-03", "2026-02-03"].map(d)), null, "two monthly charges are not enough");
});

test("finds price increases and stopped subscriptions", () => {
  const rows = [];
  for (let m = 0; m < 8; m++)
    rows.push({ date: new Date(Date.UTC(2026, m, 5)), desc: "STREAM TV", charge: m < 4 ? 18.99 : 20.99 });
  for (let m = 0; m < 4; m++) rows.push({ date: new Date(Date.UTC(2026, m, 9)), desc: "OLD APP", charge: 5 });
  const subs = findRecurring(rows, { today: d("2026-09-10") });
  const tv = subs.find((s) => s.key === "stream tv");
  assert.equal(tv.increases.length, 1);
  assert.equal(tv.active, true);
  assert.ok(Math.abs(tv.annual - 20.99 * 12) < 1e-9);
  assert.equal(subs.find((s) => s.key === "old app").active, false);
});

test("groceries at random intervals are not subscriptions", () => {
  const rows = [3, 9, 10, 22, 40, 41, 70, 95].map((n, i) => ({
    date: new Date(Date.UTC(2026, 0, n)),
    desc: "FRESHMART " + i,
    charge: 20 + i * 13,
  }));
  assert.equal(findRecurring(rows).length, 0);
});

test("sample file end to end", () => {
  const tx = toTransactions(parseCSV(readFileSync(new URL("../src/sample.csv", import.meta.url), "utf8")));
  const subs = findRecurring(tx, { today: d("2026-10-15") });
  const keys = subs.map((s) => s.key).sort();
  assert.deepEqual(keys, [
    "cloudbox storage",
    "fitlab gym",
    "mealkit weekly",
    "newsdesk annual",
    "northwave music",
    "phoneco wireless",
    "streamnorth tv",
  ]);
  const sum = summarize(subs);
  assert.equal(sum.count, 6);
  assert.equal(sum.raised, 4);
});

test("calendar file is valid enough for calendar apps", () => {
  const subs = findRecurring(
    [0, 1, 2, 3].map((m) => ({ date: new Date(Date.UTC(2026, m, 5)), desc: "GYM, DOWNTOWN", charge: 50 })),
    { today: d("2026-04-10") },
  );
  const ics = toICS(subs, d("2026-04-10"));
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:2026050\d/);
  assert.match(ics, /Gym\\, Downtown/);
  assert.match(ics, /END:VCALENDAR$/);
});

test("display names are tidy", () => {
  assert.equal(displayName("FITLAB GYM PRE-AUTH #7101"), "Fitlab Gym");
  assert.equal(displayName("NORTHWAVE MUSIC* #2408"), "Northwave Music");
});
