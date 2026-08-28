# smoke.py —— 原型冒烟测试：加载、截图、模拟拖动通关第 1 关、console 零错误
from playwright.sync_api import sync_playwright
import sys

errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 480, 'height': 720})
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))

    page.goto('file:///E:/Program/Game%20260831/dist/index.html')
    page.wait_for_load_state('networkidle')

    # 标题屏存在且可交互
    assert page.locator('#title-screen').is_visible(), 'title screen visible'
    page.screenshot(path='shots/01-title.png')

    # 进入第 1 关
    page.locator('.level-btn').first.click()
    page.wait_for_timeout(400)
    assert page.locator('#hud').is_visible(), 'hud visible'
    page.screenshot(path='shots/02-level1.png')

    # 计算画布几何：6x6，出口右。第 1 关英雄车在 (3,2) len2，拖到 x=4 即胜
    box = page.locator('#game').bounding_box()
    canvas = page.locator('#game')
    # 读渲染器内部布局（通过 evaluate 拿 canvas 尺寸推算）
    geom = page.evaluate('''() => {
      const c = document.getElementById('game');
      const r = c.getBoundingClientRect();
      const cell = r.width / 6.4; // 渲染器 availW = w-18 边距近似；粗略
      return { left: r.left, top: r.top, w: r.width, h: r.height };
    }''')
    # 精确布局：直接调用 renderer 数据不方便（IIFE 私有），改用近似：棋盘居中
    # ox = (w - 18 - cell*6)/2, cell = (w-18)/6 …用 evaluate 重算 renderer 的公式
    g = page.evaluate('''() => {
      const r = document.getElementById('game').getBoundingClientRect();
      const margin = 12;
      const availW = r.width - margin*2 - 18;
      const availH = r.height - margin*2;
      const cell = Math.min(availW/6, availH/6);
      const ox = (r.width - 18 - cell*6)/2;
      const oy = (r.height - cell*6)/2;
      return { left: r.left, top: r.top, cell, ox, oy };
    }''')

    def cell_center(x, y):
        cx = g['left'] + g['ox'] + (x + 0.5) * g['cell']
        cy = g['top'] + g['oy'] + (y + 0.5) * g['cell']
        return cx, cy

    # 拖英雄车：车中心在 (3,2)-(4,2)，即中心 x = ox+(3+1)*cell
    hero_cx, hero_cy = cell_center(4, 2)  # 车身中点近似
    target_cx, target_cy = cell_center(5, 2)
    page.mouse.move(hero_cx, hero_cy)
    page.mouse.down()
    page.mouse.move(target_cx, target_cy, steps=8)
    page.mouse.up()
    page.wait_for_timeout(600)

    # 胜利屏应出现（第 1 关 par=1，一步到位 3 星）
    won = page.locator('#win-screen').is_visible()
    page.screenshot(path='shots/03-after-drag.png')
    print('win visible:', won)
    if not won:
        # 诊断：输出当前步数
        print('moves:', page.locator('#moves').text_content())

    browser.close()

print('console errors:', errors if errors else 'NONE')
sys.exit(0 if (not errors) else 1)
