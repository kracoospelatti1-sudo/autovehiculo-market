from playwright.sync_api import sync_playwright

IPHONE = {
    "viewport": {"width": 390, "height": 844},
    "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "device_scale_factor": 3,
    "is_mobile": True,
    "has_touch": True,
}

BASE = "http://localhost:3000"

def shot(page, name):
    page.screenshot(path=f"C:/tmp/iphone_{name}.png", full_page=True)
    print(f"  [screenshot] {name}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(**IPHONE)
    page = ctx.new_page()

    errors = []
    page.on("console", lambda msg: errors.append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None)

    print("1. Home page")
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    shot(page, "01_home")

    print("2. Mobile menu")
    menu_btn = page.locator("#mobileMenuBtn, .mobile-menu-btn, [onclick*='toggleMobileMenu']").first
    if menu_btn.is_visible():
        menu_btn.click()
        page.wait_for_timeout(500)
        shot(page, "02_mobile_menu")
        # Cerrar menu
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
    else:
        print("  [warn] No se encontro el boton de menu movil")

    print("3. Register form")
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    page.evaluate("showSection('register')")
    page.wait_for_timeout(600)
    shot(page, "03_register")

    print("4. Login form")
    page.evaluate("showSection('login')")
    page.wait_for_timeout(400)
    shot(page, "04_login")

    print("5. Forgot password")
    page.evaluate("showSection('forgot-password')")
    page.wait_for_timeout(400)
    shot(page, "05_forgot_password")

    print("6. Vehicles list")
    page.evaluate("showSection('vehicles')")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    shot(page, "06_vehicles")

    print("7. Vehicle detail (if any)")
    first_card = page.locator(".vehicle-card").first
    if first_card.is_visible():
        first_card.click()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(800)
        shot(page, "07_vehicle_detail")
    else:
        print("  [warn] No hay vehiculos publicados")

    print("8. Reset password form")
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    page.evaluate("""
        document.getElementById('resetToken').value = 'test-token';
        showSection('reset-password');
    """)
    page.wait_for_timeout(400)
    shot(page, "08_reset_password")

    browser.close()

    print("\n--- Errores de consola ---")
    if errors:
        for e in errors:
            print(" ", e)
    else:
        print("  ✅ Sin errores de consola")
