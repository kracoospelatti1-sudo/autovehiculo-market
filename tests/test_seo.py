import sys
import os
import requests
import json
import re
from playwright.sync_api import sync_playwright

# Fix encoding for Windows console
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

BASE = 'http://localhost:3000'

def check(label, condition, detail=''):
    status = 'OK' if condition else 'FAIL'
    msg = f"  [{status}] {label}"
    if detail:
        msg += f" -- {str(detail)[:80]}"
    print(msg)
    return condition

def run_static_checks():
    print("\n-- robots.txt --")
    r = requests.get(f'{BASE}/robots.txt')
    check('Status 200', r.status_code == 200)
    check('User-agent: *', 'User-agent: *' in r.text)
    check('Allow: /', 'Allow: /' in r.text)
    check('Sitemap presente', 'sitemap.xml' in r.text)

    print("\n-- sitemap.xml --")
    r = requests.get(f'{BASE}/sitemap.xml')
    check('Status 200', r.status_code == 200)
    check('Content-Type XML', 'xml' in r.headers.get('Content-Type', ''))
    check('Tiene <urlset>', '<urlset' in r.text)
    vehicle_urls = re.findall(r'\?vehicle=(\d+)', r.text)
    check('Tiene URLs de vehiculos', len(vehicle_urls) > 0, f'{len(vehicle_urls)} vehiculos indexados')
    return vehicle_urls

def run_browser_checks(vehicle_ids):
    print("\n-- Meta tags base (home) --")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(BASE)
        page.wait_for_load_state('networkidle')

        base_title = page.title()
        check('Title no vacio', bool(base_title), base_title)
        check('Title contiene Autoventa', 'Autoventa' in base_title or 'autoventa' in base_title.lower(), base_title)

        og_title = page.get_attribute('meta[property="og:title"]', 'content') or ''
        check('og:title presente', bool(og_title), og_title)

        og_image = page.get_attribute('meta[property="og:image"]', 'content') or ''
        check('og:image presente', bool(og_image), og_image)

        og_url = page.get_attribute('meta[property="og:url"]', 'content') or ''
        check('og:url presente', bool(og_url), og_url)

        canonical = page.get_attribute('link[rel="canonical"]', 'href') or ''
        check('canonical presente', bool(canonical), canonical)

        tw_card = page.get_attribute('meta[name="twitter:card"]', 'content') or ''
        check('twitter:card presente', bool(tw_card), tw_card)

        jsonld_els = page.locator('script[type="application/ld+json"]')
        check('JSON-LD base presente', jsonld_els.count() > 0)
        try:
            data = json.loads(jsonld_els.first.inner_text())
            types = [n.get('@type') for n in data.get('@graph', [])]
            check('WebSite schema', 'WebSite' in types, str(types))
            check('Organization schema', 'Organization' in types, str(types))
        except Exception as e:
            check('JSON-LD base valido', False, str(e))

        # --- Meta dinamico por vehiculo ---
        print("\n-- Meta tags dinamicos por vehiculo --")
        if not vehicle_ids:
            check('Vehiculo disponible para test', False, 'Sitemap sin vehiculos')
            browser.close()
            return

        vid = vehicle_ids[0]
        page.goto(f'{BASE}/?vehicle={vid}')
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1500)

        dyn_title = page.title()
        check('Title cambia al vehiculo', dyn_title != base_title, dyn_title)

        dyn_og_title = page.get_attribute('meta[property="og:title"]', 'content') or ''
        check('og:title dinamico', dyn_og_title != og_title, dyn_og_title)

        dyn_og_img = page.get_attribute('meta[property="og:image"]', 'content') or ''
        check('og:image dinamico', bool(dyn_og_img), dyn_og_img)

        dyn_og_url = page.get_attribute('meta[property="og:url"]', 'content') or ''
        check('og:url contiene vehicle ID', f'vehicle={vid}' in dyn_og_url, dyn_og_url)

        dyn_canonical = page.get_attribute('link[rel="canonical"]', 'href') or ''
        check('canonical dinamico', f'vehicle={vid}' in dyn_canonical, dyn_canonical)

        current_url = page.url
        check('URL pushState con ?vehicle=', f'vehicle={vid}' in current_url, current_url)

        vehicle_jsonld = page.locator('script#vehicle-jsonld')
        has_vj = vehicle_jsonld.count() > 0
        check('JSON-LD vehiculo inyectado', has_vj)
        if has_vj:
            try:
                vdata = json.loads(vehicle_jsonld.inner_text())
                check('Car schema type', vdata.get('@type') == 'Car', vdata.get('@type'))
                check('Offer presente', 'offers' in vdata)
                check('priceCurrency ARS', vdata.get('offers', {}).get('priceCurrency') == 'ARS')
            except Exception as e:
                check('JSON-LD vehiculo valido', False, str(e))

        # --- Reset al volver a home ---
        print("\n-- resetSEOMeta al navegar a home --")
        page.evaluate("showSection('home')")
        page.wait_for_timeout(600)

        reset_title = page.title()
        check('Title restaurado', reset_title == base_title, reset_title)

        reset_og_url = page.get_attribute('meta[property="og:url"]', 'content') or ''
        check('og:url restaurado', 'vehicle=' not in reset_og_url, reset_og_url)

        check('JSON-LD vehiculo removido', page.locator('script#vehicle-jsonld').count() == 0)

        browser.close()

def run_bot_prerender(vehicle_ids):
    print("\n-- Prerender para bots --")
    if not vehicle_ids:
        check('Sin vehiculos para testear prerender', False)
        return
    vid = vehicle_ids[0]
    bot_ua = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    r = requests.get(f'{BASE}/?vehicle={vid}', headers={'User-Agent': bot_ua})
    check('Status 200', r.status_code == 200)
    check('og:title en HTML crudo', 'og:title' in r.text)
    check('og:image en HTML crudo', 'og:image' in r.text)
    title_match = re.search(r'<title>([^<]+)</title>', r.text)
    bot_title = title_match.group(1) if title_match else ''
    generic = 'Autoventa -- Compra y Vende'
    check('Title especifico del vehiculo', bool(bot_title) and 'Autoventa' in bot_title and '$' in bot_title, bot_title)

if __name__ == '__main__':
    print("=" * 52)
    print("  SEO TEST SUITE -- autovehiculo-market")
    print("=" * 52)
    vehicle_ids = run_static_checks()
    run_browser_checks(vehicle_ids)
    run_bot_prerender(vehicle_ids)
    print("\n" + "=" * 52)
