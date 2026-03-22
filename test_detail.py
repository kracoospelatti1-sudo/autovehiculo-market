from playwright.sync_api import sync_playwright
import os
os.makedirs("test_screenshots", exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})

    # Go to vehicles list
    page.goto("http://localhost:3000")
    page.wait_for_load_state("networkidle")
    page.locator("#navVehicles").click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)

    cards = page.locator(".vehicle-card")
    count = cards.count()
    print(f"Vehículos encontrados: {count}")

    if count == 0:
        print("❌ No hay vehículos en el listado")
        browser.close()
        exit()

    # Click first card
    cards.first.click()
    page.wait_for_timeout(2000)
    page.screenshot(path="test_screenshots/detail_seller.png", full_page=True)

    # Check seller section HTML
    html = page.content()

    checks = {
        "tel: link (teléfono clickeable)": 'href="tel:' in html,
        "instagram.com link": 'instagram.com' in html or 'href="https://instagram' in html,
        "📍 dirección": '📍' in html,
        "📞 teléfono": '📞' in html,
        "📸 instagram": '📸' in html,
        "🏢 concesionaria": '🏢' in html,
    }

    print("\n── Seller card en detalle del vehículo ──")
    for label, present in checks.items():
        icon = "✅" if present else "⚠️  no encontrado"
        print(f"  {icon}  {label}")

    # Also print the seller section specifically
    seller_section = page.locator(".seller-info, .seller-card, [class*='seller']").first
    if seller_section.count() > 0 or True:
        # Get inner HTML of the seller block
        try:
            inner = page.locator(".seller-info").inner_html()
            print(f"\n── HTML del bloque vendedor ──\n{inner[:800]}")
        except:
            pass

    browser.close()
    print("\n📸 Screenshot: test_screenshots/detail_seller.png")
