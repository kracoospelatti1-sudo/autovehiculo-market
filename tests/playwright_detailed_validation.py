from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

BASE = "http://localhost:3000"
ARTIFACTS = Path("test_screenshots") / "playwright_detailed"
ARTIFACTS.mkdir(parents=True, exist_ok=True)

results = []


def record(name: str, ok: bool, detail: str = ""):
    results.append((ok, name, detail))
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {name}" + (f" -> {detail}" if detail else ""))


def safe_check(name: str, fn):
    try:
        fn()
    except Exception as exc:
        record(name, False, str(exc))


def check_home_structure(page):
    page.goto(BASE, wait_until="networkidle")
    page.screenshot(path=str(ARTIFACTS / "01_desktop_home.png"), full_page=True)

    links = page.evaluate("""
      () => Array.from(document.querySelectorAll('link[rel="stylesheet"], link[as="style"]')).map(l => l.getAttribute('href') || '')
    """)
    uses_styles_css = any("styles.css?v=43" in href for href in links)
    no_styles_min = not any("styles.min.css" in href for href in links)
    record("Runtime CSS source of truth", uses_styles_css and no_styles_min, f"links={links}")

    nav_labels = page.evaluate("""
      () => Array.from(document.querySelectorAll('nav')).map(n => n.getAttribute('aria-label') || '')
    """)
    has_main = any("Navegacion principal" in n for n in nav_labels)
    has_mobile = any("Navegacion inferior movil" in n for n in nav_labels)
    record("Nav landmarks con aria-label", has_main and has_mobile, f"labels={nav_labels}")


def check_filter_semantics(page):
    page.evaluate("showSection('vehicles')")
    page.wait_for_timeout(700)

    initial = page.evaluate("""
      () => {
        const btn = document.getElementById('filterToggleBtn');
        const panel = document.getElementById('filtersPanel');
        return {
          expanded: btn?.getAttribute('aria-expanded'),
          hidden: panel?.getAttribute('aria-hidden'),
          open: panel?.classList.contains('open')
        };
      }
    """)
    initial_ok = initial["expanded"] == "false" and initial["hidden"] == "true" and initial["open"] is False

    page.click("#filterToggleBtn")
    page.wait_for_timeout(250)
    opened = page.evaluate("""
      () => {
        const btn = document.getElementById('filterToggleBtn');
        const panel = document.getElementById('filtersPanel');
        return {
          expanded: btn?.getAttribute('aria-expanded'),
          hidden: panel?.getAttribute('aria-hidden'),
          open: panel?.classList.contains('open')
        };
      }
    """)
    opened_ok = opened["expanded"] == "true" and opened["hidden"] == "false" and opened["open"] is True

    page.screenshot(path=str(ARTIFACTS / "02_filters_open.png"), full_page=True)

    page.click("#filterToggleBtn")
    page.wait_for_timeout(250)
    closed = page.evaluate("""
      () => {
        const btn = document.getElementById('filterToggleBtn');
        const panel = document.getElementById('filtersPanel');
        return {
          expanded: btn?.getAttribute('aria-expanded'),
          hidden: panel?.getAttribute('aria-hidden'),
          open: panel?.classList.contains('open')
        };
      }
    """)
    closed_ok = closed["expanded"] == "false" and closed["hidden"] == "true" and closed["open"] is False

    record("Filters panel a11y state machine", initial_ok and opened_ok and closed_ok, f"initial={initial}, opened={opened}, closed={closed}")


def check_labels(page):
    page.evaluate("showSection('login')")
    page.wait_for_timeout(300)
    login_missing = page.evaluate("""
      () => Array.from(document.querySelectorAll('#login .form-group label')).filter(l => !l.getAttribute('for')).length
    """)

    page.evaluate("showSection('register')")
    page.wait_for_timeout(300)
    register_missing = page.evaluate("""
      () => Array.from(document.querySelectorAll('#register .form-group label')).filter(l => !l.getAttribute('for')).length
    """)

    page.evaluate("showSection('vehicles')")
    page.wait_for_timeout(300)
    filter_missing = page.evaluate("""
      () => Array.from(document.querySelectorAll('#filtersPanel .form-group label')).filter(l => !l.getAttribute('for')).length
    """)

    record("Labels asociados a campos", login_missing == 0 and register_missing == 0 and filter_missing == 0, f"login={login_missing}, register={register_missing}, filters={filter_missing}")


def check_bottom_nav_mapping(page):
    mapping = {
        "home": 0,
        "vehicles": 1,
        "vehicle-detail": 1,
        "messages": 2,
        "publish": 3,
        "favorites": 4,
        "following-feed": 4,
        "my-vehicles": 4,
        "notifications": 4,
        "profile": 4,
        "admin": 4,
    }

    all_ok = True
    bad = []
    for section, expected in mapping.items():
      data = page.evaluate(
          """
          ({section}) => {
            showSection(section);
            const items = Array.from(document.querySelectorAll('.bottom-nav .bottom-nav-item'));
            const idx = items.findIndex(i => i.classList.contains('active'));
            return {idx, count: items.length};
          }
          """,
          {"section": section},
      )
      ok = data["idx"] == expected
      if not ok:
        all_ok = False
        bad.append(f"{section}->{data['idx']} (exp {expected})")
    record("Bottom nav active mapping", all_ok, ", ".join(bad) if bad else "ok")


def check_lightbox_modal(page):
    page.evaluate("showSection('vehicles')")
    page.wait_for_timeout(1400)

    cards = page.locator(".vehicle-card[onclick*='viewVehicle']")
    if cards.count() == 0:
        record("Lightbox modal integration", False, "No hay tarjetas para abrir detalle")
        return

    visible_cards = page.locator(".vehicle-card[onclick*='viewVehicle']:visible")
    if visible_cards.count() > 0:
        visible_cards.first.click()
    else:
        onclick = cards.first.get_attribute("onclick") or ""
        if onclick.strip():
            page.evaluate(f"() => {{ {onclick} }}")
        else:
            record("Lightbox modal integration", False, "No hay tarjeta visible ni onclick utilizable")
            return
    page.wait_for_timeout(1800)
    images_count = page.evaluate("() => (window._detailImages || []).length")
    if images_count <= 0:
        record("Lightbox modal integration", False, "Detalle sin imagenes")
        return

    page.evaluate("openLightbox(window._detailImages, 0)")
    page.wait_for_timeout(350)
    page.screenshot(path=str(ARTIFACTS / "03_lightbox_open.png"), full_page=True)

    open_data = page.evaluate("""
      () => {
        const modal = document.getElementById('lightboxModal');
        const overlay = document.getElementById('modalOverlay');
        const visible = !!modal && getComputedStyle(modal).display !== 'none';
        const active = document.activeElement;
        return {
          visible,
          activeClass: active ? active.className : '',
          overlayVisible: !!overlay && getComputedStyle(overlay).display !== 'none',
          bodyOverflow: getComputedStyle(document.body).overflow
        };
      }
    """)

    page.keyboard.press("Escape")
    page.wait_for_timeout(350)
    closed = page.evaluate("""
      () => {
        const modal = document.getElementById('lightboxModal');
        return !!modal && getComputedStyle(modal).display === 'none';
      }
    """)

    ok = open_data["visible"] and open_data["overlayVisible"] and open_data["bodyOverflow"] == "hidden" and closed
    record("Lightbox usa modal accesible + cierre con Escape", ok, f"open={open_data}, closed={closed}")


def check_error_states(page):
    # Conversations error UI
    page.route("**/conversations?*", lambda route: route.fulfill(status=500, content_type="application/json", body='{"error":"forced-conversations"}'))
    page.evaluate("loadConversations(1)")
    page.wait_for_timeout(500)
    conv_err = page.locator("text=No pudimos cargar tus chats").count() > 0
    page.unroute("**/conversations?*")

    # Notifications error UI
    page.route("**/notifications?*", lambda route: route.fulfill(status=500, content_type="application/json", body='{"error":"forced-notifications"}'))
    page.evaluate("showSection('notifications')")
    page.wait_for_timeout(700)
    notif_err = page.locator("text=No pudimos cargar notificaciones").count() > 0
    page.unroute("**/notifications?*")

    # Home recent error UI
    page.route("**/vehicles?limit=6&sort=newest", lambda route: route.fulfill(status=500, content_type="application/json", body='{"error":"forced-home-recent"}'))
    page.evaluate("homeRecentLoadedAt = 0; loadHomeRecent()")
    page.wait_for_timeout(700)
    home_err = page.locator("text=No pudimos cargar los destacados").count() > 0
    page.unroute("**/vehicles?limit=6&sort=newest")

    record("Estados de error visibles + retry", conv_err and notif_err and home_err, f"conversations={conv_err}, notifications={notif_err}, homeRecent={home_err}")


def check_mobile_behavior(browser):
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        device_scale_factor=3,
        is_mobile=True,
        has_touch=True,
    )
    page = context.new_page()
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(500)
    page.screenshot(path=str(ARTIFACTS / "04_mobile_home.png"), full_page=True)

    nav_state = page.evaluate("""
      () => {
        const bottom = document.querySelector('.bottom-nav');
        const desktop = document.querySelector('.nav-links');
        return {
          bottomVisible: !!bottom && getComputedStyle(bottom).display !== 'none',
          desktopVisible: !!desktop && getComputedStyle(desktop).display !== 'none'
        };
      }
    """)
    nav_ok = nav_state["bottomVisible"] and not nav_state["desktopVisible"]
    record("Mobile nav: solo bottom-nav visible", nav_ok, str(nav_state))

    overflow_ok = True
    overflow_details = []
    for section in ["home", "vehicles", "login", "register"]:
      page.evaluate("(s) => showSection(s)", section)
      page.wait_for_timeout(350)
      ov = page.evaluate("""
        () => {
          const root = document.documentElement;
          return {
            scrollWidth: root.scrollWidth,
            innerWidth: window.innerWidth,
            ok: root.scrollWidth <= (window.innerWidth + 1)
          };
        }
      """)
      if not ov["ok"]:
        overflow_ok = False
        overflow_details.append(f"{section}: {ov}")
    record("Mobile sin overflow horizontal en secciones clave", overflow_ok, " | ".join(overflow_details) if overflow_details else "ok")

    page.evaluate("toggleMobileMenu()")
    page.wait_for_timeout(320)
    menu_open = page.evaluate("""
      () => {
        const menu = document.getElementById('mobileAccountMenu');
        return {
          openClass: menu?.classList.contains('is-open'),
          ariaHidden: menu?.getAttribute('aria-hidden'),
          display: menu ? getComputedStyle(menu).display : null
        };
      }
    """)
    page.screenshot(path=str(ARTIFACTS / "05_mobile_menu_open.png"), full_page=True)

    page.keyboard.press("Escape")
    page.wait_for_timeout(420)
    menu_closed = page.evaluate("""
      () => {
        const menu = document.getElementById('mobileAccountMenu');
        return {
          openClass: menu?.classList.contains('is-open'),
          ariaHidden: menu?.getAttribute('aria-hidden'),
          display: menu ? getComputedStyle(menu).display : null
        };
      }
    """)

    menu_ok = menu_open["openClass"] is True and menu_open["ariaHidden"] == "false" and menu_closed["openClass"] is False and menu_closed["ariaHidden"] == "true"
    record("Menu movil por clase + aria + Escape", menu_ok, f"open={menu_open}, closed={menu_closed}")

    context.close()


def check_navbar_mid_breakpoint(browser):
    context = browser.new_context(viewport={"width": 1000, "height": 800})
    page = context.new_page()
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(500)

    # Simular estado autenticado visual para estresar navbar
    page.evaluate("""
      () => {
        ['navFavorites','navFollowing','navMyVehicles','navMessages','navNotifications','navPublish','navProfile','navAdmin','navLogout'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.style.display = 'flex';
        });
        const login = document.getElementById('navLogin');
        const register = document.getElementById('navRegister');
        if (login) login.style.display = 'none';
        if (register) register.style.display = 'none';
      }
    """)

    data = page.evaluate("""
      () => {
        const navbar = document.querySelector('.navbar');
        const center = document.querySelector('.nav-links-center');
        const right = document.querySelector('.nav-links-right');
        const check = (el) => !!el && el.scrollWidth <= (el.clientWidth + 1);
        const overflowMode = (el) => el ? getComputedStyle(el).overflowX : null;
        return {
          navbarFits: check(navbar),
          centerFits: check(center),
          rightFits: check(right),
          centerOverflowX: overflowMode(center),
          rightOverflowX: overflowMode(right),
          navbar: navbar ? {scrollWidth: navbar.scrollWidth, clientWidth: navbar.clientWidth} : null,
          center: center ? {scrollWidth: center.scrollWidth, clientWidth: center.clientWidth} : null,
          right: right ? {scrollWidth: right.scrollWidth, clientWidth: right.clientWidth} : null,
        };
      }
    """)
    page.screenshot(path=str(ARTIFACTS / "06_navbar_1000px_stress.png"), full_page=True)
    center_ok = data["centerFits"] or data["centerOverflowX"] in ("auto", "scroll")
    right_ok = data["rightFits"] or data["rightOverflowX"] in ("auto", "scroll")
    record("Navbar robusta en breakpoint intermedio", data["navbarFits"] and center_ok and right_ok, str(data))

    context.close()


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        console_errors = []
        page_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        safe_check("Desktop base + landmarks + css", lambda: check_home_structure(page))
        safe_check("Filters semantics", lambda: check_filter_semantics(page))
        safe_check("Label associations", lambda: check_labels(page))
        safe_check("Bottom nav mapping", lambda: check_bottom_nav_mapping(page))
        safe_check("Lightbox modal", lambda: check_lightbox_modal(page))
        safe_check("Error state UI", lambda: check_error_states(page))

        context.close()

        safe_check("Mobile behavior", lambda: check_mobile_behavior(browser))
        safe_check("Navbar at 1000px", lambda: check_navbar_mid_breakpoint(browser))

        # Consolidar errores de consola
        unique_console = list(dict.fromkeys(console_errors))
        unique_page = list(dict.fromkeys(page_errors))
        known_noise = [
            "adtrafficquality.google",
            "https://www.google.com/",
            "Warning: localhost detected.",
            "status of 401 (Unauthorized)",
            "status of 500 (Internal Server Error)",
        ]
        unknown_console = [e for e in unique_console if not any(token in e for token in known_noise)]
        if unknown_console:
            record("Console errors", False, " | ".join(unknown_console[:8]))
        else:
            detail = "none" if not unique_console else f"solo ruido esperado ({len(unique_console)})"
            record("Console errors", True, detail)

        if unique_page:
            record("Page errors", False, " | ".join(unique_page[:8]))
        else:
            record("Page errors", True, "none")

        browser.close()

    total = len(results)
    passed = sum(1 for ok, _, _ in results if ok)
    failed = total - passed

    print("\n" + "=" * 72)
    print(f"Detailed Playwright validation: {passed}/{total} PASS")
    if failed:
        print(f"Failures: {failed}")
        for ok, name, detail in results:
            if not ok:
                print(f" - {name}: {detail}")
    print(f"Artifacts: {ARTIFACTS.resolve()}")
    print("=" * 72)

    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
