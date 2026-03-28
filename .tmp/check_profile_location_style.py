from playwright.sync_api import sync_playwright
import json, urllib.request
BASE='http://127.0.0.1:3000'
with urllib.request.urlopen(BASE + '/api/vehicles?page=1&limit=1', timeout=20) as r:
    v=(json.loads(r.read().decode('utf-8')).get('vehicles') or [None])[0]
uid = v.get('user_id') if v else None
if not uid:
    print('NO_USER')
    raise SystemExit(0)
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page(viewport={"width": 1366, "height": 900})
    page.goto(f'{BASE}/?section=profile&profile={uid}', wait_until='domcontentloaded')
    page.wait_for_timeout(1800)
    loc = page.locator('.profile-header .profile-location')
    if loc.count() == 0:
        print('NO_LOCATION_BLOCK')
    else:
        align = loc.evaluate("el => getComputedStyle(el).textAlign")
        items = loc.evaluate("el => getComputedStyle(el).alignItems")
        print('TEXT_ALIGN=' + str(align))
        print('ALIGN_ITEMS=' + str(items))
    b.close()
