from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:3000'
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page(viewport={"width": 1366, "height": 900})
    page.goto(BASE+'/', wait_until='domcontentloaded')
    page.wait_for_timeout(4200)
    first = page.locator('#homeRecentVehicles .vehicle-card[onclick]').first
    if first.count() == 0:
        print('NO_CARD')
    else:
        print('HAS_VIEWS=' + str(first.locator('.vehicle-views').count() > 0))
        print('HAS_SELLER_INFO=' + str(first.locator('.vehicle-seller-info').count() > 0))
        print('HAS_META=' + str(first.locator('.vehicle-meta').count() > 0))
    b.close()
