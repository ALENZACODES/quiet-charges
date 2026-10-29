# Devpost submission: Quiet Charges (Next Byte Hacks V5)

Paste each block into the matching field. Only [YOUTUBE_URL] is left to fill.

**Project name**
Quiet Charges

**Elevator pitch** (200 characters max)
Drop in your bank statement. Find forgotten subscriptions, trials that became charges and price hikes above inflation, then get the cancel link and a message to send. Nothing leaves your browser.

**Built with**
javascript, html5, css3, node.js, playwright, github-pages, statistics-canada, ofx, icalendar

**Try it out links**
* https://alenzacodes.github.io/quiet-charges/?sample
* https://github.com/ALENZACODES/quiet-charges

**Video demo link**
[YOUTUBE_URL]

**Image gallery** (in this order; all are in docs/)
1. gallery-2-alerts.png: "Look at these first: a trial that converted, a service paid twice, prices above inflation"
2. gallery-3-table.png: "Every recurring charge with flags, filters and savings"
3. gallery-4-cancel-kit.png: "The cancel kit: official link, steps and a message that asks for a refund"
4. gallery-5-phone-bill.png: "Phone bills get a script to ask for a lower price"
5. gallery-6-paste.png: "Paste lines straight from a PDF statement"
6. gallery-7-phone.png: "Works on a phone"
7. gallery-1-start.png: "Network locked: the page cannot contact any other server"

---

## About the project (story field)

## Inspiration
Subscriptions don't announce themselves. A streaming plan goes from $18.99 to $20.99 and the email goes unread. A $0.99 trial turns into $14.95 a month. A partner's old Spotify account keeps billing through PayPal. Each one is small, so nobody notices, and together they cost hundreds of dollars a year.

The tools that catch this usually want your bank login. I wanted one that never sees your password or your data at all.

## What it does
You drop in a bank or credit card export, or paste the lines from a PDF statement. Quiet Charges:

* finds every charge that repeats, weekly to yearly
* flags **free trials that turned into charges**
* flags **services you pay for twice**, such as Spotify billed directly and again through PayPal
* compares every **price increase with inflation**, using Statistics Canada's Consumer Price Index for the same months, and shows what the price would be if it had only kept up
* lists what's coming out in the next 30 days and adds up what you keep by cancelling what you tick
* opens a **cancel kit** for 36 common Canadian subscriptions with the official help page, short steps and a message ready to send (after a trial it asks for a refund too)
* for phone and internet bills, gives you a **script to ask for a lower price** that quotes your own increases
* exports calendar reminders three days before each charge, with the cancel link inside

On the sample year it finds 12 subscriptions costing $3,839 a year, a trial that converted, a doubled Spotify account and five price increases, $181 a year of them above inflation.

## How I built it
Plain JavaScript modules, HTML and CSS. No framework, no server, no build step, hosted free on GitHub Pages.

* **Readers** for CSV (header detection, preamble lines, debit and credit columns, semicolons, day first dates, tested against RBC, BMO, Tangerine and CIBC style layouts), OFX and QFX, and text pasted from PDF statements, where lines carry two dates, phone numbers and no year.
* **A service list** of 36 subscriptions common in Canada with statement patterns, categories, official cancel pages (each one opened and checked) and steps. It sees through wrappers like `PAYPAL *SPOTIFY`.
* **Recurrence detection** from the median gap between charges, with a 75% fit rule and an amount steadiness rule so groceries, coffee and rides stay out. Rent and transfers are excluded.
* **Trial peeling**: a cheap first charge shortly before the regular price is split off as a trial instead of counting as a price increase.
* **Exchange rate wobble**: a US dollar charge that goes up and down is labelled foreign currency instead of a price hike.
* **Inflation check** with the all items CPI for Canada, January 2023 to September 2026, from Statistics Canada table 18-10-0004-01.
* **A network lock**: a Content Security Policy in the page blocks every request to any other server. The browser check proves it by trying to send data out and confirming it fails.
* **Tests**: 36 Node tests, including a full sample year end to end and a thousand random purchases that must produce zero false subscriptions, plus a headless Chrome check of the real page.

## Challenges I ran into
False alarms. Coffee every few days looks a lot like a weekly charge, and a US dollar subscription looks like it changes price every month. The fixes were rules that work on the shape of the data: median gaps, an amount steadiness test, and counting how often the price changes direction.

Trials were tricky too. A $0.99 first charge breaks every "same amount each month" rule, so it has to be found and split off before the rhythm is measured.

Pasted statement text was the messiest input: two dates per line, phone numbers in the middle, no year, and payments marked CR mixed in.

## Accomplishments that I'm proud of
It catches the three things people actually miss (trials, doubles and quiet price hikes) and tells you what to do about each one, without ever sending your data anywhere. The privacy promise is enforced by the browser, not just written in a footer.

## What I learned
Most of the work in a "simple" money tool is cleaning messy bank data. Comparing price rises with real inflation data changes the conversation from "it went up a dollar" to "it went up four times as fast as everything else", which is the number that makes people act.

## What's next for Quiet Charges
* French interface and French cancel messages
* more services in the cancel list, with community submissions
* reading the PDF file directly in the browser instead of copy and paste
* a printable one page summary to bring to a phone company call

---

## Submission form answers

**Team**: John Khan (solo), Toronto, Ontario
**Built during the event**: yes. Work started October 15, 2026 and the hackathon ran October 6 to 31, 2026.
**Open source libraries**: none in the app. Playwright is used only for the optional browser check and demo recording.

## Before submitting (checklist for John)
1. Done: the repo is public and GitHub Pages serves it from the master branch root.
2. Open the live link with `?sample` and click through once.
3. Upload docs/demo-captioned.mp4 to YouTube as Public or Unlisted (2:15), or record a voice-over with VIDEO_SCRIPT.md. The rules page asks for 2 to 5 minutes; the overview says 1 to 3, so 2:15 to 2:45 satisfies both.
4. Replace [YOUTUBE_URL] above.
5. Upload the seven gallery images.
