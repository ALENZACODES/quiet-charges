"""Records a captioned screen demo of Quiet Charges (no sound) to docs/demo.webm.
The captions follow VIDEO_SCRIPT.md, so a voice-over can be laid on top.
Run: python3 scripts/record_demo.py   (needs playwright and Chrome, like browser_check.py)
"""
import asyncio, functools, http.server, os, shutil, socketserver, threading
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    httpd = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{httpd.server_address[1]}/"

CAPTION_JS = """(t) => {
  let c = document.getElementById('cap');
  if (!c) { c = document.createElement('div'); c.id = 'cap';
    Object.assign(c.style, {position:'fixed',left:'50%',bottom:'26px',transform:'translateX(-50%)',maxWidth:'1040px',width:'calc(100% - 80px)',
      background:'rgba(5,10,15,.92)',color:'#fff',font:'600 24px/1.35 system-ui,sans-serif',padding:'14px 22px',borderRadius:'14px',
      border:'1px solid #7dd3a8',zIndex:99999,textAlign:'center',boxShadow:'0 10px 30px rgba(0,0,0,.5)'});
    document.body.appendChild(c); }
  c.textContent = t; c.style.display = t ? 'block' : 'none';
}"""

async def main():
    httpd, url = serve()
    async with async_playwright() as p:
        chrome = shutil.which("google-chrome")
        b = await p.chromium.launch(executable_path=chrome, args=["--disable-gpu", "--disable-dev-shm-usage"]) if chrome else await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1280, "height": 720}, record_video_dir=f"{ROOT}/docs/_video", record_video_size={"width": 1280, "height": 720}, bypass_csp=True)
        pg = await ctx.new_page()
        cap = lambda t: pg.evaluate(CAPTION_JS, t)
        wait = pg.wait_for_timeout
        scroll = lambda sel, off=0: pg.evaluate(f"(() => {{ const e = document.querySelector({sel!r}); window.scrollTo({{top: e.getBoundingClientRect().top + scrollY - 20 + {off}, behavior: 'smooth'}}); }})()")
        await pg.goto(url); await wait(500)
        await cap("What did your subscriptions cost you this year? Prices rise quietly and free trials turn into charges."); await wait(6500)
        await cap("Quiet Charges reads your bank statement and finds all of it."); await wait(5000)
        await pg.hover("#lock"); await cap("It runs only in your browser. A security policy blocks the page from contacting any other server."); await wait(6500)
        await cap("Here is a made up year of bank activity for someone in Toronto: 488 charges."); await wait(3500)
        await pg.click("#sample"); await wait(1200); await scroll(".stats")
        await cap("12 subscriptions. $320 a month, $3,839 a year. Five of them raised their price."); await wait(7000)
        await scroll("#alerts", -40); await wait(600)
        await cap("Audible started as a 99 cent trial, then switched to full price."); await wait(6000)
        await cap("Spotify is billed twice, once directly and once through PayPal. That's a forgotten second account."); await wait(6500)
        await cap("Price rises are checked against Statistics Canada inflation data. Rogers rose 11.8% while prices rose 2.8%."); await wait(7500)
        await scroll("#upcoming", -40); await cap("Everything coming out in the next 30 days."); await wait(4500)
        await scroll(".filters", -60); await cap("Every recurring charge, with flags. Tick what you plan to cancel."); await wait(3000)
        for k in ["audible", "spotify@paypal", "crave"]:
            await pg.check(f"input[data-k='{k}']"); await wait(700)
        await scroll(".save", -300); await cap("Three ticks keep $599 a year."); await wait(4500)
        await pg.click("[data-kit='audible']"); await wait(500)
        await cap("The cancel kit: the official help page, the steps, and a message ready to send."); await wait(6500)
        await cap("Because it began as a trial, the message also asks for a refund."); await wait(5000)
        await pg.click("#kitCopy"); await wait(1200); await pg.keyboard.press("Escape"); await wait(400)
        await pg.click("[data-kit='rogers']"); await wait(500)
        await cap("Phone and internet bills get a script to ask for a lower price instead."); await wait(6500)
        await pg.keyboard.press("Escape"); await wait(300)
        await pg.goto(url); await wait(400)
        await pg.click(".paste summary"); await pg.click("#pasteSample"); await wait(300); await scroll("#drop")
        await cap("No CSV? Copy the lines from a PDF statement and paste them. OFX and QFX files work too."); await wait(6000)
        await pg.click("#pasteGo"); await wait(1200); await scroll(".stats")
        await cap("The same monthly subscriptions, found from two months of pasted text."); await wait(5000)
        await scroll(".actions", -200)
        await cap("Calendar reminders land three days before each charge, with the cancel link inside."); await wait(6000)
        await cap("How it works: it finds the rhythm in the gaps between charges, peels off trial charges and ignores exchange rate wobble."); await wait(8000)
        await cap("36 automated tests plus a browser check. Plain JavaScript, no server, free on GitHub Pages."); await wait(6500)
        await pg.evaluate("window.scrollTo({top: 0, behavior: 'smooth'})")
        await cap("Quiet Charges. Find what you forgot, and keep your money. Made by John Khan in Toronto, Ontario."); await wait(6000)
        path = await pg.video.path()
        await ctx.close(); await b.close()
    httpd.shutdown()
    os.replace(path, f"{ROOT}/docs/demo.webm")
    shutil.rmtree(f"{ROOT}/docs/_video", ignore_errors=True)
    print("saved docs/demo.webm")

asyncio.run(main())
