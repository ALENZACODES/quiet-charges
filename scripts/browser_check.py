"""Browser check for Quiet Charges.

Serves the site, loads it in headless Chrome and checks that:
  * the sample year renders 12 subscriptions with no console errors,
  * the pasted statement path works,
  * a cancel kit opens with the official link,
  * the page cannot reach any outside server (the network lock).
With --shots it also saves the gallery screenshots into docs/.

Needs: pip install playwright, then either Chrome installed or `playwright install chromium`.
Run:  python3 scripts/browser_check.py [--shots]
"""
import asyncio, functools, http.server, os, shutil, socketserver, sys, threading
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = "--shots" in sys.argv

def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args): pass
    handler = functools.partial(Quiet, directory=ROOT)
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{httpd.server_address[1]}/"

async def main():
    httpd, url = serve()
    failures = []
    def check(ok, what):
        print(("PASS " if ok else "FAIL ") + what)
        if not ok: failures.append(what)
    async with async_playwright() as p:
        chrome = shutil.which("google-chrome")
        b = await p.chromium.launch(executable_path=chrome, args=["--disable-gpu", "--disable-dev-shm-usage"]) if chrome else await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1500, "height": 1000})
        errors = []
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append(str(e)))
        await pg.goto(url)
        if SHOTS: await pg.screenshot(path=f"{ROOT}/docs/gallery-1-start.png")
        await pg.click("#sample"); await pg.wait_for_selector("#out:not([hidden])")
        check((await pg.inner_text("#sCount")) == "12", "sample year shows 12 active subscriptions")
        alerts = await pg.inner_text("#alerts")
        check("trial" in alerts and "twice" in alerts and "inflation" in alerts, "alerts cover the trial, the duplicate and inflation")
        if SHOTS:
            await pg.evaluate("document.querySelector('.stats').scrollIntoView()"); await pg.evaluate("window.scrollBy(0,-20)")
            await pg.screenshot(path=f"{ROOT}/docs/gallery-2-alerts.png")
            await pg.evaluate("document.querySelector('.filters').previousElementSibling.previousElementSibling.scrollIntoView()")
            await pg.screenshot(path=f"{ROOT}/docs/gallery-3-table.png")
        await pg.click("[data-kit='audible']")
        link = await pg.get_attribute("#kitBody a.btn", "href")
        check(link == "https://help.audible.ca/", "cancel kit links to the official Audible help page")
        check("refund" in await pg.inner_text("#kitText"), "cancel message asks for a refund after a trial")
        if SHOTS: await pg.screenshot(path=f"{ROOT}/docs/gallery-4-cancel-kit.png")
        await pg.keyboard.press("Escape")
        await pg.click("[data-kit='rogers']")
        check("retention" in await pg.inner_text("#kitText"), "phone bill gets a lower-price script")
        if SHOTS: await pg.screenshot(path=f"{ROOT}/docs/gallery-5-phone-bill.png")
        await pg.keyboard.press("Escape")
        blocked = await pg.evaluate("""async () => { try { await fetch('https://example.com/collect', {method: 'POST', body: 'test'}); return false } catch (e) { return true } }""")
        check(blocked, "network lock: a request to an outside server is blocked")
        errors = [e for e in errors if "Content Security Policy" not in e and "Refused to connect" not in e and "Failed to fetch" not in e]
        check(not errors, "no console errors" + (f": {errors}" if errors else ""))
        await pg.goto(url)
        await pg.click(".paste summary"); await pg.click("#pasteSample"); await pg.wait_for_timeout(200)
        if SHOTS:
            await pg.evaluate("document.querySelector('#drop').scrollIntoView()")
            await pg.screenshot(path=f"{ROOT}/docs/gallery-6-paste.png")
        await pg.click("#pasteGo"); await pg.wait_for_selector("#out:not([hidden])")
        check("pasted text" in await pg.inner_text("#status"), "pasted statement text is read")
        if SHOTS:
            m = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True)
            await m.goto(url + "?sample"); await m.wait_for_selector("#out:not([hidden])")
            await m.evaluate("document.querySelector('#status').scrollIntoView()")
            await m.screenshot(path=f"{ROOT}/docs/gallery-7-phone.png")
        await b.close()
    httpd.shutdown()
    print(f"\n{'All browser checks passed' if not failures else str(len(failures)) + ' failed'}")
    sys.exit(1 if failures else 0)

asyncio.run(main())
