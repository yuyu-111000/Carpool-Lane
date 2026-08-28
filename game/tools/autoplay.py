# autoplay.py —— 全关卡自动通关测试：用求解器路径驱动游戏（?debug=1 钩子）
# 求解逻辑在 Python 侧独立实现（不信任 JS 求解器自己验自己）：
# 简化贪心 BFS —— 直接在浏览器里用 JS 钩子做状态转移 + Python 端广度搜索太重，
# 改为：Python 端实现同构规则（横竖滑块 + 相邻接人），BFS 出路径，再逐步调用 __CL.move。
# 若与游戏内规则不一致会立刻暴露（move 拒绝或 win 不触发）。

from collections import deque
from playwright.sync_api import sync_playwright

# ---- Python 侧独立规则实现 ----
def cells(car, px, py):
    return [(px + i, py) if car["dir"] == "h" else (px, py + i) for i in range(car["len"])]

def grid_of(level, state, exclude_id=None):
    g = {}
    for w in level.get("walls", []):
        g[(w["x"], w["y"])] = "#"
    for c in level["cars"]:
        if c["id"] == exclude_id:
            continue
        p = state["cars"][c["id"]]
        for cell in cells(c, p["x"], p["y"]):
            g[cell] = c["id"]
    return g

def targets_of(level, state, car_id):
    car = next(c for c in level["cars"] if c["id"] == car_id)
    if car.get("bus"):
        return []
    pos = state["cars"][car_id]
    g = grid_of(level, state, exclude_id=car_id)
    out = []
    isH = car["dir"] == "h"
    axis = "x" if isH else "y"
    fixed = pos["y"] if isH else pos["x"]
    cur = pos[axis]
    for t in range(cur - 1, -1, -1):
        body = [(t + i, fixed) if isH else (fixed, t + i) for i in range(car["len"])]
        if any(c in g for c in body):
            break
        out.append(t)
    lim = (level["w"] if isH else level["h"]) - car["len"]
    for t in range(cur + 1, lim + 1):
        body = [(t + i, fixed) if isH else (fixed, t + i) for i in range(car["len"])]
        if any(c in g for c in body):
            break
        out.append(t)
    return out

def apply(level, state, car_id, t):
    car = next(c for c in level["cars"] if c["id"] == car_id)
    isH = car["dir"] == "h"
    ns = {"cars": {k: dict(v) for k, v in state["cars"].items()}, "picked": list(state["picked"])}
    ns["cars"][car_id]["x" if isH else "y"] = t
    # 接人：英雄车任一格与未接乘客曼哈顿距离 1
    hero = next(c for c in level["cars"] if c.get("role") == "hero")
    hp = ns["cars"][hero["id"]]
    for pk in level.get("pickups", []):
        if pk["id"] in ns["picked"]:
            continue
        if any(abs(cx - pk["x"]) + abs(cy - pk["y"]) == 1 for cx, cy in cells(hero, hp["x"], hp["y"])):
            ns["picked"].append(pk["id"])
    # 班车推进
    for c in level["cars"]:
        if not c.get("bus"):
            continue
        bp = ns["cars"][c["id"]]
        nx, ny = bp["x"] + c["bus"].get("dx", 0), bp["y"] + c["bus"].get("dy", 0)
        g = grid_of(level, ns)
        body = cells(c, nx, ny)
        inb = all(0 <= x < level["w"] and 0 <= y < level["h"] for x, y in body)
        blocked = any(cell in g and g[cell] != c["id"] for cell in body)
        if inb and not blocked:
            ns["cars"][c["id"]] = {"x": nx, "y": ny}
    return ns

def won(level, state):
    if any(pk["id"] not in state["picked"] for pk in level.get("pickups", [])):
        return False
    hero = next(c for c in level["cars"] if c.get("role") == "hero")
    hp = state["cars"][hero["id"]]
    gx = max(0, min(level["exit"]["x"], level["w"] - 1))
    gy = max(0, min(level["exit"]["y"], level["h"] - 1))
    return any((gx, gy) == cell for cell in cells(hero, hp["x"], hp["y"]))

def skey(level, state):
    a = ",".join(f"{state['cars'][c['id']]['x']}.{state['cars'][c['id']]['y']}" for c in level["cars"])
    return a + "|" + ",".join(sorted(state["picked"]))

def solve(level):
    start = {"cars": {c["id"]: {"x": c["x"], "y": c["y"]} for c in level["cars"]}, "picked": []}
    if won(level, start):
        return []
    q = deque([(start, [])])
    seen = {skey(level, start)}
    while q:
        s, path = q.popleft()
        for car in level["cars"]:
            for t in targets_of(level, s, car["id"]):
                ns = apply(level, s, car["id"], t)
                k = skey(level, ns)
                if k in seen:
                    continue
                np_ = path + [(car["id"], t)]
                if won(level, ns):
                    return np_
                seen.add(k)
                q.append((ns, np_))
    return None

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 480, "height": 720})
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto("file:///E:/Program/Game%20260831/dist/index.html?debug=1")
    pg.wait_for_timeout(600)

    levels = pg.evaluate("window.__CL.levels")
    all_pass = True
    for lv in levels:
        path = solve(lv)
        assert path is not None, f"Python solver: level {lv['id']} unsolvable!"
        pg.evaluate(f"window.__CL.start(window.__CL.levels[{lv['id'] - 1}])")
        pg.wait_for_timeout(200)
        for car_id, t in path:
            pg.evaluate(f"window.__CL.move('{car_id}', {t})")
            pg.wait_for_timeout(60)
        pg.wait_for_timeout(500)
        game = pg.evaluate("({won: window.__CL.game.won, moves: window.__CL.game.moves, par: window.__CL.game.def.par})")
        ok = game["won"] and game["moves"] == len(path)
        star3 = game["moves"] <= game["par"]
        print(f"L{lv['id']}: won={game['won']} moves={game['moves']} solver={len(path)} par={game['par']} 3star={star3} -> {'PASS' if ok and star3 else 'FAIL'}")
        if not (ok and star3):
            all_pass = False
    print("page errors:", errors if errors else "NONE")
    print("AUTOPLAY:", "ALL PASS" if all_pass and not errors else "FAIL")
    b.close()
