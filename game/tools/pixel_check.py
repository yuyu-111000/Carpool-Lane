# pixel_check.py —— 程序化视觉验证（替代人眼看图）：采样 canvas 像素确认关键元素被绘制
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 480, "height": 720})
    pg.goto("file:///E:/Program/Game%20260831/dist/index.html")
    pg.wait_for_timeout(800)
    pg.locator(".level-btn").first.click()
    pg.wait_for_timeout(600)

    stats = pg.evaluate("""() => {
      const c = document.getElementById('game');
      const ctx = c.getContext('2d');
      const w = c.width, h = c.height;
      const data = ctx.getImageData(0, 0, w, h).data;
      let red = 0, blue = 0, dark = 0, yellow = 0, total = w * h;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], bl = data[i+2];
        if (r > 180 && g < 110 && bl < 110) red++;
        else if (bl > 150 && r < 130) blue++;
        else if (r < 60 && g < 60 && bl < 70) dark++;
        else if (r > 200 && g > 160 && bl < 100) yellow++;
      }
      return { red, blue, dark, yellow, total };
    }""")
    print(stats)
    ok = (
        stats["red"] > 500      # 红色英雄车存在
        and stats["dark"] > stats["total"] * 0.2   # 沥青底盘占相当面积
    )
    print("pixel check:", "PASS" if ok else "FAIL")

    # 第 4 关（捎人关）：乘客黄色光环应存在
    pg.locator("#btn-back").click()
    pg.wait_for_timeout(300)
    pg.locator(".level-btn").nth(3).click()
    pg.wait_for_timeout(600)
    stats2 = pg.evaluate("""() => {
      const c = document.getElementById('game');
      const ctx = c.getContext('2d');
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let yellow = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 200 && data[i+1] > 160 && data[i+2] < 100) yellow++;
      }
      return yellow;
    }""")
    print("pickup halo pixels:", stats2)
    print("pickup check:", "PASS" if stats2 > 200 else "FAIL")
    b.close()
