from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page()
    page.goto('http://127.0.0.1:3000/?section=profile', wait_until='domcontentloaded')
    page.wait_for_timeout(1200)
    home_visible = page.locator('#home').evaluate("el => getComputedStyle(el).display !== 'none'")
    profile_visible = page.locator('#profile').evaluate("el => getComputedStyle(el).display !== 'none'")
    print(f'HOME_VISIBLE={home_visible}')
    print(f'PROFILE_VISIBLE={profile_visible}')
    print(f'URL={page.url}')
    b.close()
