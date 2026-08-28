from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 480, "height": 860})
    pg.goto("file:///E:/Program/Game%20260831/dist/index.html")
    pg.wait_for_timeout(800)
    pg.screenshot(path="shots/v2-title.png", full_page=True)

    pg.locator(".level-btn").first.click()
    pg.wait_for_timeout(600)
    pg.screenshot(path="shots/v2-level1.png")

    pg.locator("#btn-back").click()
    pg.wait_for_timeout(400)
    pg.locator(".level-btn").nth(3).click()
    pg.wait_for_timeout(600)
    pg.screenshot(path="shots/v2-pickup.png")
    b.close()
print("shots saved")
