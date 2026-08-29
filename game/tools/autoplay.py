# autoplay.py —— 全关卡自动通关测试（Python 独立规则实现，含转向/乘客障碍/按序接送）
from collections import deque
from playwright.sync_api import sync_playwright

def cells(dir_, px, py, length):
    return [(px + i, py) if dir_ == "h" else (px, py + i) for i in range(length)]

def cdir(level, state, cid):
    return state["cars"][cid].get("dir") or next(c for c in level["cars"] if c["id"] == cid)["dir"]

def grid_of(level, state, exclude_id=None):
    g = {}
    for w in level.get("walls", []):
        g[(w["x"], w["y"])] = "#"
    for pk in level.get("pickups", []):
        if pk["id"] not in state["picked"]:
            g[(pk["x"], pk["y"])] = "P"
    for c in level["cars"]:
        if c["id"] == exclude_id:
            continue
        p = state["cars"][c["id"]]
        for cell in cells(cdir(level, state, c["id"]), p["x"], p["y"], c["len"]):
            g[cell] = c["id"]
    return g

def slide_targets(level, state, cid):
    car = next(c for c in level["cars"] if c["id"] == cid)
    if car.get("bus"):
        return []
    pos = state["cars"][cid]
    d = cdir(level, state, cid)
    g = grid_of(level, state, cid)
    isH = d == "h"
    fixed = pos["y"] if isH else pos["x"]
    cur = pos["x"] if isH else pos["y"]
    mx = level["w"] if isH else level["h"]
    out = []
    for t in range(cur - 1, -1, -1):
        body = [(t + i, fixed) if isH else (fixed, t + i) for i in range(car["len"])]
        if any(c in g for c in body):
            break
        out.append(t)
    for t in range(cur + 1, mx - car["len"] + 1):
        body = [(t + i, fixed) if isH else (fixed, t + i) for i in range(car["len"])]
        if any(c in g for c in body):
            break
        out.append(t)
    return out

def rot_result(level, state, cid, code):
    car = next(c for c in level["cars"] if c["id"] == cid)
    if not level.get("turn") or car.get("role") != "hero" or car["len"] != 2 or car.get("bus"):
        return None
    pos = state["cars"][cid]
    d = cdir(level, state, cid)
    pivot = 1 if code[1] == "1" else 0
    sign = 1 if code[2] == "+" else -1
    cs = cells(d, pos["x"], pos["y"], 2)
    P = cs[pivot]
    swing = (P[0], P[1] + sign) if d == "h" else (P[0] + sign, P[1])
    if not (0 <= swing[0] < level["w"] and 0 <= swing[1] < level["h"]):
        return None
    g = grid_of(level, state, cid)
    if swing in g:
        return None
    if d == "h":
        return {"x": P[0], "y": min(P[1], swing[1]), "dir": "v"}
    return {"x": min(P[0], swing[0]), "y": P[1], "dir": "h"}

def rot_targets(level, state, cid):
    return [c for c in ["r0+", "r0-", "r1+", "r1-"] if rot_result(level, state, cid, c)]

def apply(level, state, cid, target):
    car = next(c for c in level["cars"] if c["id"] == cid)
    ns = {"cars": {k: dict(v) for k, v in state["cars"].items()}, "picked": list(state["picked"])}
    if isinstance(target, str):
        rr = rot_result(level, state, cid, target)
        ns["cars"][cid] = dict(rr)
    else:
        isH = cdir(level, state, cid) == "h"
        ns["cars"][cid]["x" if isH else "y"] = target
    hero = next(c for c in level["cars"] if c.get("role") == "hero")
    hp = ns["cars"][hero["id"]]
    hd = ns["cars"][hero["id"]].get("dir") or hero["dir"]
    for pk in level.get("pickups", []):
        if pk["id"] in ns["picked"]:
            continue
        if pk.get("order") is not None:
            pending = sorted([q for q in level["pickups"] if q["id"] not in ns["picked"]], key=lambda q: q["order"])
            if pending[0]["id"] != pk["id"]:
                continue
        if any(abs(cx - pk["x"]) + abs(cy - pk["y"]) == 1 for cx, cy in cells(hd, hp["x"], hp["y"], hero["len"])):
            ns["picked"].append(pk["id"])
    for c in level["cars"]:
        if not c.get("bus"):
            continue
        bp = ns["cars"][c["id"]]
        nx, ny = bp["x"] + c["bus"].get("dx", 0), bp["y"] + c["bus"].get("dy", 0)
        g = grid_of(level, ns, c["id"])
        body = cells(cdir(level, ns, c["id"]), nx, ny, c["len"])
        inb = all(0 <= x < level["w"] and 0 <= y < level["h"] for x, y in body)
        blocked = any(b in g for b in body)
        if inb and not blocked:
            ns["cars"][c["id"]] = {"x": nx, "y": ny, "dir": bp.get("dir") or c["dir"]}
    return ns

def won(level, state):
    if any(pk["id"] not in state["picked"] for pk in level.get("pickups", [])):
        return False
    hero = next(c for c in level["cars"] if c.get("role") == "hero")
    hp = state["cars"][hero["id"]]
    if cdir(level, state, hero["id"]) != "h" or hp["y"] != level["exit"]["y"]:
        return False
    gx = max(0, min(level["exit"]["x"], level["w"] - 1))
    return any((gx, level["exit"]["y"]) == c for c in cells("h", hp["x"], hp["y"], hero["len"]))

def skey(level, state):
    a = ",".join(f"{state['cars'][c['id']]['x']}.{state['cars'][c['id']]['y']}.{cdir(level,state,c['id'])}" for c in level["cars"])
    return a + "|" + ",".join(sorted(state["picked"]))

def solve(level):
    start = {"cars": {c["id"]: {"x": c["x"], "y": c["y"], "dir": c["dir"]} for c in level["cars"]}, "picked": []}
    if won(level, start):
        return []
    q = deque([(start, [])])
    seen = {skey(level, start)}
    while q:
        s, path = q.popleft()
        for car in level["cars"]:
            for t in slide_targets(level, s, car["id"]) + rot_targets(level, s, car["id"]):
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
        pg.wait_for_timeout(120)
        for car_id, t in path:
            tg = f"'{t}'" if isinstance(t, str) else t
            pg.evaluate(f"window.__CL.move('{car_id}', {tg})")
            pg.wait_for_timeout(30)
        pg.wait_for_timeout(300)
        game = pg.evaluate("({won: window.__CL.game.won, moves: window.__CL.game.moves, par: window.__CL.game.def.par})")
        ok = game["won"] and game["moves"] == len(path)
        if not (ok and game["moves"] <= game["par"]):
            all_pass = False
        print(f"L{lv['id']}: won={game['won']} moves={game['moves']} solver={len(path)} par={game['par']} turn={bool(lv.get('turn'))} -> {'PASS' if ok else 'FAIL'}")
    print("page errors:", errors if errors else "NONE")
    print("AUTOPLAY:", "ALL PASS" if all_pass and not errors else "FAIL")
    b.close()
