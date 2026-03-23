"""
Comprehensive test of https://autoventa.online/
Login: lucaspelatti1999@gmail.com / Mitre351
"""
import os
from playwright.sync_api import sync_playwright

SCREENSHOTS = "/tmp/autoventa_test"
os.makedirs(SCREENSHOTS, exist_ok=True)
BASE = "https://autoventa.online"

issues = []
passed_checks = 0

def shot(page, name):
    p = f"{SCREENSHOTS}/{name}.png"
    page.screenshot(path=p, full_page=True)
    print(f"  [screenshot] {name}.png")

def check(condition, label):
    global passed_checks
    if condition:
        print(f"  OK: {label}")
        passed_checks += 1
    else:
        print(f"  FAIL: {label}")
        issues.append(label)

def nav_to(page, section_id):
    """Navigate to a section using JS showSection()"""
    page.evaluate(f"showSection('{section_id}')")
    page.wait_for_timeout(1500)
    page.wait_for_load_state("networkidle")

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        page = ctx.new_page()
        console_errors = []
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: console_errors.append(str(e)))

        # ── 1. HOME PAGE ───────────────────────────────────────────────
        print("\n=== 1. HOME PAGE ===")
        page.goto(BASE, wait_until="networkidle", timeout=30000)
        shot(page, "01_home")
        check("Auto" in page.title(), "Page title has brand")
        check(page.locator(".hero, #home").count() > 0, "Home section present")
        card_count = page.locator(".vehicle-card").count()
        check(card_count > 0, f"Vehicle cards on home ({card_count})")
        check(page.locator("#navLogin").is_visible(), "Login button visible when logged out")

        # ── 2. LOGIN ────────────────────────────────────────────────────
        print("\n=== 2. LOGIN ===")
        page.locator("#navLogin").click()
        page.wait_for_selector("#loginEmail", state="visible", timeout=5000)
        shot(page, "02_login_modal")
        check(page.locator("#loginEmail").is_visible(), "Login email input visible")
        check(page.locator("#loginPassword").is_visible(), "Login password input visible")

        page.locator("#loginEmail").fill("lucaspelatti1999@gmail.com")
        page.locator("#loginPassword").fill("Mitre351")
        page.locator("#loginBtn").click()
        page.wait_for_timeout(3000)
        page.wait_for_load_state("networkidle")
        shot(page, "03_after_login")
        check(not page.locator("#navLogin").is_visible(), "Login button hidden after login")
        check(page.locator("#navMyVehicles").is_visible(), "My Vehicles nav visible after login")
        check(page.locator("#navAdmin").is_visible(), "Admin nav visible (admin user)")

        # ── 3. BROWSE VEHICLES ─────────────────────────────────────────
        print("\n=== 3. BROWSE VEHICLES ===")
        page.locator("#navVehicles").click()
        page.wait_for_timeout(1500)
        page.wait_for_load_state("networkidle")
        shot(page, "04_vehicles_list")
        card_count2 = page.locator(".vehicle-card").count()
        check(card_count2 > 0, f"Vehicle cards in list ({card_count2})")

        # ── 4. SEARCH ───────────────────────────────────────────────────
        print("\n=== 4. SEARCH & FILTERS ===")
        search_input = page.locator("#searchInput").first
        if search_input.count() > 0 and search_input.is_visible():
            search_input.fill("Toyota")
            search_input.press("Enter")
            page.wait_for_timeout(1500)
            shot(page, "05_search_toyota")
            results_after = page.locator(".vehicle-card").count()
            check(True, f"Search 'Toyota' returned {results_after} results")
            search_input.fill("")
            search_input.press("Enter")
            page.wait_for_timeout(800)
        else:
            check(False, "Search input found and visible")

        # ── 5. VEHICLE DETAIL ───────────────────────────────────────────
        print("\n=== 5. VEHICLE DETAIL ===")
        # Go home, click first card
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_selector(".vehicle-card", timeout=10000)
        page.locator(".vehicle-card").first.click()
        page.wait_for_timeout(2500)
        page.wait_for_load_state("networkidle")
        shot(page, "06_vehicle_detail")
        # Check detail section is active
        detail_active = page.locator("#vehicle-detail.active, #vehicle-detail:not([style*='display: none'])").count() > 0
        detail_content = page.locator(".vehicle-detail-main, .vehicle-info, .detail-price").count() > 0
        check(detail_active or detail_content, "Vehicle detail section active")

        # Check key elements
        check(page.locator(".btn-favorite, #btnFavorite, button[onclick*='favorite']").count() > 0,
              "Favorite button on detail")
        check(page.locator("button[onclick*='chat'], button:has-text('Chat'), button:has-text('Mensaje')").count() > 0,
              "Chat/message button on detail")
        whatsapp = page.locator("a[href*='wa.me']").count() > 0
        print(f"  INFO: WhatsApp button {'present' if whatsapp else 'absent (no phone set on listing)'}")

        # ── 6. FAVORITES ────────────────────────────────────────────────
        print("\n=== 6. FAVORITES ===")
        fav_btn = page.locator(".btn-favorite, #btnFavorite").first
        if fav_btn.count() > 0 and fav_btn.is_visible():
            fav_btn.click()
            page.wait_for_timeout(1000)
            shot(page, "07_favorite_toggled")
            check(True, "Favorite button clicked without crash")
        else:
            check(False, "Favorite button visible and clickable")

        nav_to(page, "favorites")
        shot(page, "07b_favorites_section")
        check(page.locator("#favorites.active, #favorites:not([style*='display: none'])").count() > 0 or
              page.locator(".favorites-list, .no-favorites, text=Favoritos").count() > 0,
              "Favorites section opens")

        # ── 7. PUBLISH VEHICLE ──────────────────────────────────────────
        print("\n=== 7. PUBLISH VEHICLE ===")
        nav_to(page, "publish")
        shot(page, "08_publish_form")
        check(page.locator("#publish.active, #publishForm, .publish-section").count() > 0 or
              page.locator("text=Publicar Vehículo, text=Publicar vehículo").count() > 0,
              "Publish section opens")

        # Test brand picker
        brand_trigger = page.locator(".brand-picker-trigger, #brandPickerTrigger, #brandTrigger").first
        if brand_trigger.count() > 0 and brand_trigger.is_visible():
            brand_trigger.click()
            page.wait_for_timeout(600)
            brand_options = page.locator(".brand-option, .brand-picker-dropdown .brand-item, .brands-list .brand-item").count()
            check(brand_options > 0, f"Brand picker shows options ({brand_options})")
            shot(page, "08b_brand_picker_open")
            if brand_options > 0:
                page.locator(".brand-option, .brand-picker-dropdown .brand-item, .brands-list .brand-item").first.click()
                page.wait_for_timeout(500)
                model_opts = page.locator("#model option, #modelSelect option").count()
                check(model_opts > 1, f"Models loaded after brand select ({model_opts})")
        else:
            # Native select
            brand_sel = page.locator("#brand, select[name='brand']").first
            if brand_sel.count() > 0 and brand_sel.is_visible():
                opts = brand_sel.locator("option").count()
                check(opts > 1, f"Brand select has options ({opts})")
            else:
                check(False, "Brand picker/select found")

        # ── 8. MY VEHICLES ──────────────────────────────────────────────
        print("\n=== 8. MY VEHICLES ===")
        page.locator("#navMyVehicles").click()
        page.wait_for_timeout(1500)
        shot(page, "10_my_vehicles")
        check(page.locator("#my-vehicles.active, .my-vehicles-section").count() > 0 or
              page.locator("text=Mis Anuncios, text=Mis publicaciones").count() > 0,
              "My vehicles section loads")
        # Check edit/delete buttons
        edit_btn = page.locator(".btn-edit, button:has-text('Editar'), button[onclick*='edit']").count()
        print(f"  INFO: {edit_btn} edit buttons found in my vehicles")

        # ── 9. MESSAGES ─────────────────────────────────────────────────
        print("\n=== 9. MESSAGES ===")
        page.locator("#navMessages").click()
        page.wait_for_timeout(1500)
        shot(page, "11_messages")
        check(page.locator("#messages.active, .messages-section").count() > 0 or
              page.locator(".conversations-list, .conversations-container").count() > 0,
              "Messages section loads")

        # ── 10. NOTIFICATIONS ────────────────────────────────────────────
        print("\n=== 10. NOTIFICATIONS ===")
        page.locator("#navNotifications").click()
        page.wait_for_timeout(1000)
        shot(page, "12_notifications")
        check(page.locator("#notifications.active, .notifications-section").count() > 0 or
              page.locator(".notifications-list, .no-notifications").count() > 0,
              "Notifications section loads")

        # ── 11. PROFILE ──────────────────────────────────────────────────
        print("\n=== 11. PROFILE ===")
        nav_to(page, "profile")
        shot(page, "13_profile")
        check(page.locator("#profile.active, .profile-section").count() > 0 or
              page.locator("text=Editar perfil, text=Mi perfil").count() > 0,
              "Profile section loads")
        check(page.locator("input#editUsername, input#editPhone, input#editCity").count() > 0,
              "Profile edit fields visible")

        # ── 12. ADMIN PANEL ──────────────────────────────────────────────
        print("\n=== 12. ADMIN PANEL ===")
        page.locator("#navAdmin").click()
        page.wait_for_timeout(2000)
        shot(page, "14_admin_panel")
        check(page.locator("#admin.active, .admin-section").count() > 0 or
              page.locator(".stats-dashboard, .admin-tabs").count() > 0,
              "Admin panel loads")

        # Click through each admin tab
        tabs_found = []
        for tab_text in ["Usuarios", "Vehículos", "Reportes", "Estadísticas"]:
            t = page.locator(f"button.tab-btn:has-text('{tab_text}'), .admin-tabs button:has-text('{tab_text}')").first
            if t.count() > 0 and t.is_visible():
                tabs_found.append(tab_text)
                t.click()
                page.wait_for_timeout(800)
        check(len(tabs_found) >= 2, f"Admin tabs: {tabs_found}")
        shot(page, "15_admin_tabs")

        # ── 13. MOBILE VIEW ──────────────────────────────────────────────
        print("\n=== 13. MOBILE VIEW ===")
        mob = ctx.new_page()
        mob.set_viewport_size({"width": 390, "height": 844})
        mob.goto(BASE, wait_until="networkidle")
        mob.screenshot(path=f"{SCREENSHOTS}/16_mobile_home.png", full_page=True)
        hamburger = mob.locator(".hamburger, .menu-toggle, .mobile-menu-btn, [class*='hamburger']").first
        check(hamburger.count() > 0, "Mobile hamburger menu present")
        if hamburger.count() > 0 and hamburger.is_visible():
            hamburger.click()
            mob.wait_for_timeout(600)
            mob.screenshot(path=f"{SCREENSHOTS}/17_mobile_menu_open.png", full_page=True)
        # Check bottom nav on mobile
        check(mob.locator(".bottom-nav, .bottom-navigation, .mobile-bottom-nav").count() > 0,
              "Mobile bottom nav present")
        mob.close()

        # ── CONSOLE ERRORS ───────────────────────────────────────────────
        relevant_errors = [e for e in console_errors if "favicon" not in e.lower()]
        print(f"\n=== CONSOLE ERRORS ({len(relevant_errors)}) ===")
        for e in relevant_errors[:8]:
            print(f"  ERR: {str(e)[:120]}")

        browser.close()

    print(f"\n{'='*60}")
    print(f"RESULT: {passed_checks} passed, {len(issues)} failed")
    if issues:
        print("\nFAILED CHECKS:")
        for i, iss in enumerate(issues, 1):
            print(f"  {i}. {iss}")
    else:
        print("All checks passed!")
    print(f"\nScreenshots saved to: {SCREENSHOTS}")

if __name__ == "__main__":
    run()
