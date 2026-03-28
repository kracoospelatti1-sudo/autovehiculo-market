from playwright.sync_api import sync_playwright
import json
import urllib.request

BASE = 'http://127.0.0.1:3000'


def go(page, url, pause_ms=900):
    page.goto(url, wait_until='domcontentloaded', timeout=60000)
    page.wait_for_timeout(pause_ms)


def fetch_first_vehicle():
    with urllib.request.urlopen(f'{BASE}/api/vehicles?page=1&limit=1', timeout=20) as resp:
        data = json.loads(resp.read().decode('utf-8'))
    vehicles = data.get('vehicles') or []
    return vehicles[0] if vehicles else None


def run_desktop(browser):
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    findings = []

    page_errors = []
    console_errors = []
    network_issues = []

    page.on('pageerror', lambda e: page_errors.append(str(e)))

    def on_console(msg):
        if msg.type == 'error':
            text = msg.text or ''
            if 'Failed to load resource' in text and ('googlesyndication' in text or 'doubleclick' in text):
                return
            if 'violates the following Content Security Policy directive' in text:
                return
            console_errors.append(text)

    def on_response(resp):
        url = resp.url
        if not url.startswith(BASE):
            return
        status = resp.status
        rtype = resp.request.resource_type
        if status >= 500:
            network_issues.append(f'{status} {rtype} {url}')
        elif status >= 400 and rtype in ('script', 'stylesheet'):
            network_issues.append(f'{status} {rtype} {url}')

    page.on('console', on_console)
    page.on('response', on_response)

    def is_visible(selector):
        try:
            return page.locator(selector).evaluate("el => getComputedStyle(el).display !== 'none'")
        except Exception:
            return False

    # Home + public sections
    go(page, BASE + '/', 900)
    findings.append(('home_visible', is_visible('#home')))

    for sec in ['terms', 'login', 'register', 'forgot-password', 'vehicles']:
        go(page, BASE + f'/?section={sec}', 900)
        findings.append((f'section_{sec}_visible', is_visible(f'#{sec}')))

    cards = page.locator('.vehicle-card:visible').count()
    findings.append(('vehicles_cards_visible_gt_0', cards > 0))

    # Detail/profile deep-links using real vehicle data
    profile_url = ''
    first_vehicle = fetch_first_vehicle()
    if first_vehicle:
        vid = first_vehicle.get('id')
        seller_id = first_vehicle.get('user_id')

        go(page, BASE + f'/?vehicle={vid}', 1200)
        try:
            page.wait_for_selector('#vehicleDetailContent .seller-card', timeout=12000)
        except Exception:
            pass
        findings.append(('vehicle_detail_visible', is_visible('#vehicle-detail')))
        findings.append(('vehicle_detail_has_content', page.locator('#vehicleDetailContent .seller-card').count() > 0))

        if seller_id:
            go(page, BASE + f'/?section=profile&profile={seller_id}', 1000)
            try:
                page.wait_for_function("() => window.location.search.includes('section=profile')", timeout=12000)
            except Exception:
                pass
            try:
                page.wait_for_selector('#profileHeader h2', timeout=12000)
            except Exception:
                pass
            page.wait_for_timeout(600)

            title_before = page.locator('#profileHeader h2').first.inner_text().strip() if page.locator('#profileHeader h2').count() > 0 else ''
            findings.append(('profile_title_before_reload_not_empty', bool(title_before)))
            profile_url = page.url

            page.reload(wait_until='domcontentloaded', timeout=60000)
            try:
                page.wait_for_function("() => window.location.search.includes('section=profile')", timeout=12000)
            except Exception:
                pass
            try:
                page.wait_for_selector('#profileHeader h2', timeout=12000)
            except Exception:
                pass
            page.wait_for_timeout(800)

            title_after = page.locator('#profileHeader h2').first.inner_text().strip() if page.locator('#profileHeader h2').count() > 0 else ''
            findings.append(('profile_title_after_reload_not_empty', bool(title_after)))
            findings.append(('profile_url_has_profile_query', 'profile=' in page.url or 'profile=' in profile_url))

    page.close()

    return {
        'findings': findings,
        'page_errors': page_errors,
        'console_errors': console_errors,
        'network_issues': network_issues,
        'profile_url': profile_url,
    }


def run_mobile(browser):
    page = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    findings = []

    go(page, BASE + '/?section=vehicles', 1400)

    sort_sel = page.locator('#filterSort')
    findings.append(('mobile_sort_visible', sort_sel.count() > 0 and sort_sel.first.is_visible()))

    changed = False
    if sort_sel.count() > 0:
        try:
            current = sort_sel.input_value()
            candidate = 'price_asc' if current != 'price_asc' else 'recent'
            sort_sel.select_option(candidate)
            page.wait_for_timeout(700)
            changed = sort_sel.input_value() == candidate
        except Exception:
            changed = False
    findings.append(('mobile_sort_change_works', changed))

    page.close()
    return findings


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    desktop = run_desktop(browser)
    mobile_findings = run_mobile(browser)

    browser.close()

    print('DESKTOP_FINDINGS_BEGIN')
    for k, ok in desktop['findings']:
        print(f'{k}={ok}')
    print('DESKTOP_FINDINGS_END')

    print('MOBILE_FINDINGS_BEGIN')
    for k, ok in mobile_findings:
        print(f'{k}={ok}')
    print('MOBILE_FINDINGS_END')

    print(f"PROFILE_URL={desktop['profile_url']}")

    if desktop['page_errors']:
        print('PAGE_ERRORS_BEGIN')
        for e in desktop['page_errors'][:30]:
            print(e)
        print('PAGE_ERRORS_END')

    if desktop['console_errors']:
        print('CONSOLE_ERRORS_BEGIN')
        for e in desktop['console_errors'][:30]:
            print(e)
        print('CONSOLE_ERRORS_END')

    if desktop['network_issues']:
        print('NETWORK_ISSUES_BEGIN')
        for e in desktop['network_issues'][:30]:
            print(e)
        print('NETWORK_ISSUES_END')
