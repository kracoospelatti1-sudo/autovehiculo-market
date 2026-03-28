from playwright.sync_api import sync_playwright
import sys

BASE = 'http://127.0.0.1:3000'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    errors = []
    page.on('pageerror', lambda e: errors.append(f'PAGEERROR: {e}'))

    page.goto(BASE + '/?section=vehicles', wait_until='networkidle')
    page.wait_for_timeout(1500)

    cards = page.locator('.vehicle-card:visible')
    count = cards.count()
    print(f'VISIBLE_VEHICLE_CARDS={count}')
    if count == 0:
        print('NO_VEHICLES_TO_TEST_PROFILE_RELOAD')
        browser.close()
        sys.exit(0)

    cards.first.click()
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1500)

    seller = page.locator('#vehicleDetailContent .seller-info h4:visible')
    if seller.count() == 0:
        print('SELLER_LINK_NOT_FOUND')
        browser.close()
        sys.exit(0)

    seller.first.click()
    page.wait_for_load_state('networkidle')
    page.wait_for_selector('#profileHeader h2', timeout=15000)
    page.wait_for_timeout(1000)

    before_url = page.url
    before_title = page.locator('#profileHeader h2').first.inner_text().strip()

    page.reload(wait_until='networkidle')
    page.wait_for_timeout(1500)

    after_section_visible = page.locator('#profile').evaluate("el => getComputedStyle(el).display !== 'none'")
    after_title_count = page.locator('#profileHeader h2').count()
    after_title = page.locator('#profileHeader h2').first.inner_text().strip() if after_title_count > 0 else ''

    print(f'PROFILE_URL_BEFORE={before_url}')
    print(f'PROFILE_TITLE_BEFORE={before_title}')
    print(f'PROFILE_VISIBLE_AFTER_RELOAD={after_section_visible}')
    print(f'PROFILE_TITLE_COUNT_AFTER_RELOAD={after_title_count}')
    print(f'PROFILE_TITLE_AFTER_RELOAD={after_title}')

    if errors:
        print('ERRORS_BEGIN')
        for e in errors[:20]:
            print(e)
        print('ERRORS_END')

    browser.close()
