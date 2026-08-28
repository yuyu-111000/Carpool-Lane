from playwright.sync_api import sync_playwright

msgs = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 480, "height": 720})
    pg.on("console", lambda m: msgs.append(f"{m.type}: {m.text}"))
    pg.on("pageerror", lambda e: msgs.append(f"PAGEERROR: {e}"))
    pg.goto("file:///E:/Program/Game%20260831/dist/index.html")
    pg.wait_for_timeout(1500)
    n = pg.evaluate("document.querySelectorAll('.level-btn').length")
    print("level buttons:", n)
    b.close()

print("\n".join(msgs) if msgs else "no console output")
