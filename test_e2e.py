"""
E2E Test Suite — AutoVehículo Market
Usa login (sin captcha) con credenciales de admin para flujos autenticados.
Flujos probados:
  1.  Home carga correctamente
  2.  Listado de vehículos
  3.  Búsqueda de vehículos
  4.  Mapa de vehículos
  5.  Login con contraseña incorrecta (debe mostrar error)
  6.  Login correcto (nav cambia a modo auth)
  7.  Register bloqueado si ya está logueado
  8.  Login bloqueado si ya está logueado
  9.  Acceso a Mis Vehículos
  10. Acceso a Favoritos
  11. Acceso a Notificaciones
  12. Publicar — validación HTML5 (campos requeridos)
  13. Ver detalle de vehículo (si hay alguno)
  14. Mensajes — sección carga
  15. Perfil — sección carga
  16. Logout
"""

import sys
import subprocess

try:
    import requests as req_lib
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "-q"])
    import requests as req_lib  # type: ignore

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright", "-q"])
    subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
    from playwright.sync_api import sync_playwright  # type: ignore

BASE_URL = "http://localhost:3000"
# Credenciales de usuario admin existente en la DB
ADMIN_EMAIL = "admin@autovehiculo.com"
ADMIN_PASS = "admin123"

RESULTS = []


def ok(name):
    print(f"  \033[92m[PASS]\033[0m {name}")
    RESULTS.append((name, True, None))


def fail(name, reason):
    # Acortar mensajes largos de Playwright
    short = str(reason).split("\n")[0][:120]
    print(f"  \033[91m[FAIL]\033[0m {name}: {short}")
    RESULTS.append((name, False, short))


def skip(name, reason=""):
    print(f"  \033[93m[SKIP]\033[0m {name}{': ' + reason if reason else ''}")
    RESULTS.append((name, None, reason))


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def login_via_api():
    """Obtiene un JWT real via API (no hay captcha en login)."""
    try:
        r = req_lib.post(
            f"{BASE_URL}/api/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
            timeout=10,
        )
        if r.status_code == 200:
            return r.json().get("token"), r.json().get("user")
        return None, None
    except Exception:
        return None, None


def inject_token(page, token, user):
    """Inyecta el token en localStorage y recarga el estado de la app."""
    page.evaluate(f"""
        localStorage.setItem('token', '{token}');
    """)
    # Recargar para que la app inicialice con el token
    page.reload()
    page.wait_for_load_state("networkidle")


# ──────────────────────────────────────────────────────────────────────────────
# Tests sin auth
# ──────────────────────────────────────────────────────────────────────────────

def test_home_loads(page):
    name = "Home carga correctamente"
    try:
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        page.wait_for_selector("nav", timeout=5000)
        section = page.locator("#home")
        assert section.is_visible(), "Sección home no visible"
        ok(name)
    except Exception as e:
        fail(name, e)


def test_vehicles_section(page):
    name = "Listado de vehículos navega correctamente"
    try:
        page.click("#navVehicles")
        page.wait_for_load_state("networkidle")
        page.wait_for_selector("#vehicles", state="visible", timeout=5000)
        ok(name)
    except Exception as e:
        fail(name, e)


def test_search(page):
    name = "Búsqueda de vehículos (debounce)"
    try:
        page.wait_for_selector("#searchInput", timeout=5000)
        page.fill("#searchInput", "Toyota")
        page.wait_for_timeout(1500)
        page.wait_for_load_state("networkidle")
        ok(name)
    except Exception as e:
        fail(name, e)


def test_map_section(page):
    name = "Sección mapa de vehículos carga"
    try:
        page.click("#navMap")
        page.wait_for_load_state("networkidle")
        page.wait_for_selector("#vehicle-map", state="visible", timeout=5000)
        ok(name)
    except Exception as e:
        fail(name, e)


# ──────────────────────────────────────────────────────────────────────────────
# Tests de Auth
# ──────────────────────────────────────────────────────────────────────────────

def test_login_wrong_password(page):
    name = "Login con contraseña incorrecta muestra error toast"
    try:
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        page.click("#navLogin")
        page.wait_for_selector("#login", state="visible", timeout=5000)
        page.fill("#loginEmail", ADMIN_EMAIL)
        page.fill("#loginPassword", "contraseña_incorrecta_xyz")
        page.click("#loginBtn")
        page.wait_for_selector(".toast", timeout=6000)
        toast = page.locator(".toast").first
        assert toast.is_visible(), "Toast de error no apareció"
        ok(name)
    except Exception as e:
        fail(name, e)


def test_login_correct(page):
    name = "Login correcto — nav cambia a modo autenticado"
    try:
        page.click("#navLogin")
        page.wait_for_selector("#login", state="visible", timeout=5000)
        page.fill("#loginEmail", ADMIN_EMAIL)
        page.fill("#loginPassword", ADMIN_PASS)
        page.click("#loginBtn")
        page.wait_for_load_state("networkidle")
        page.wait_for_selector("#navLogout", state="visible", timeout=7000)
        ok(name)
    except Exception as e:
        fail(name, e)


def test_register_blocked_when_logged(page):
    name = "Register bloqueado si ya está logueado"
    try:
        page.evaluate("showSection('register')")
        page.wait_for_timeout(400)
        assert not page.locator("#register").is_visible(), \
            "Sección register fue visible estando logueado"
        ok(name)
    except Exception as e:
        fail(name, e)


def test_login_section_blocked_when_logged(page):
    name = "Login bloqueado si ya está logueado"
    try:
        page.evaluate("showSection('login')")
        page.wait_for_timeout(400)
        assert not page.locator("#login").is_visible(), \
            "Sección login fue visible estando logueado"
        ok(name)
    except Exception as e:
        fail(name, e)


# ──────────────────────────────────────────────────────────────────────────────
# Tests con auth (inyección de token)
# ──────────────────────────────────────────────────────────────────────────────

def test_my_vehicles(page):
    name = "Mis Vehículos — sección carga"
    try:
        page.click("#navMyVehicles")
        page.wait_for_load_state("networkidle")
        page.wait_for_selector("#my-vehicles", state="visible", timeout=5000)
        ok(name)
    except Exception as e:
        fail(name, e)


def test_favorites(page):
    name = "Favoritos — sección carga"
    try:
        page.click("#navFavorites")
        page.wait_for_load_state("networkidle")
        page.wait_for_selector("#favorites", state="visible", timeout=5000)
        ok(name)
    except Exception as e:
        fail(name, e)


def test_notifications(page):
    name = "Notificaciones — sección carga"
    try:
        page.click("#navNotifications")
        page.wait_for_load_state("networkidle")
        page.wait_for_selector("#notifications", state="visible", timeout=5000)
        ok(name)
    except Exception as e:
        fail(name, e)


def test_messages(page):
    name = "Mensajes — sección carga"
    try:
        page.click("#navMessages")
        page.wait_for_load_state("networkidle")
        page.wait_for_selector("#messages", state="visible", timeout=5000)
        ok(name)
    except Exception as e:
        fail(name, e)


def test_publish_validation(page):
    name = "Publicar — campos requeridos bloquean submit"
    try:
        # Ir a publish via JS para evitar redirect
        page.evaluate("showSection('publish')")
        page.wait_for_selector("#publish", state="visible", timeout=5000)
        # Intentar submit sin datos — HTML5 required debe prevenir el envío
        submit_handled = page.evaluate("""
            () => {
                const form = document.querySelector('#publish form');
                if (!form) return 'no-form';
                const valid = form.checkValidity();
                return valid ? 'valid' : 'invalid';
            }
        """)
        assert submit_handled == "invalid", \
            f"El form debería ser inválido sin datos, retornó: {submit_handled}"
        ok(name)
    except Exception as e:
        fail(name, e)


def test_vehicle_detail(page):
    name = "Ver detalle de vehículo (si hay alguno)"
    try:
        page.click("#navVehicles")
        page.wait_for_load_state("networkidle")
        # Limpiar search por si quedó filtrado de tests anteriores
        search = page.locator("#searchInput")
        search.fill("")
        page.wait_for_timeout(1500)
        page.wait_for_load_state("networkidle")
        cards = page.locator(".vehicle-card")
        page.wait_for_timeout(1000)
        count = cards.count()
        if count == 0:
            skip(name, "No hay vehículos publicados en la DB")
            return
        cards.first.click()
        page.wait_for_selector("#vehicle-detail", state="visible", timeout=6000)
        ok(name)
    except Exception as e:
        fail(name, e)


def test_profile(page):
    name = "Perfil — sección carga"
    try:
        page.evaluate("if(currentUser) viewProfile(currentUser.id)")
        page.wait_for_load_state("networkidle")
        page.wait_for_selector("#profile", state="visible", timeout=5000)
        ok(name)
    except Exception as e:
        fail(name, e)


def test_logout(page):
    name = "Logout — vuelve a modo no autenticado"
    try:
        page.click("#navLogout")
        page.wait_for_load_state("networkidle")
        page.wait_for_selector("#navLogin", state="visible", timeout=5000)
        page.wait_for_selector("#navRegister", state="visible", timeout=5000)
        # Nav de usuarios autenticados debe estar oculta
        assert not page.locator("#navLogout").is_visible(), \
            "navLogout sigue visible después de logout"
        ok(name)
    except Exception as e:
        fail(name, e)


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def run_all():
    print("\n" + "=" * 50)
    print("  AutoVehículo Market — E2E Test Suite")
    print("=" * 50 + "\n")

    # Verificar que el login admin funciona via API antes de lanzar browser
    print("[Setup] Verificando credenciales admin via API...")
    token, user = login_via_api()
    if not token:
        print("  [WARN] No se pudo obtener token de admin. Los tests de auth usarán login por UI.")
    else:
        print(f"  [OK] Token obtenido para: {user.get('username', 'admin')}\n")

    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

        # ── Grupo 1: Sin auth ─────────────────────────────────────────────────
        print("[Grupo 1] Carga inicial (sin auth)")
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        test_home_loads(page)
        test_vehicles_section(page)
        test_search(page)
        test_map_section(page)

        # ── Grupo 2: Login / Logout ───────────────────────────────────────────
        print("\n[Grupo 2] Autenticación")
        test_login_wrong_password(page)
        test_login_correct(page)
        test_register_blocked_when_logged(page)
        test_login_section_blocked_when_logged(page)

        # ── Grupo 3: Secciones autenticadas ───────────────────────────────────
        print("\n[Grupo 3] Secciones autenticadas")
        test_my_vehicles(page)
        test_favorites(page)
        test_notifications(page)
        test_messages(page)
        test_publish_validation(page)
        test_vehicle_detail(page)
        test_profile(page)

        # ── Grupo 4: Logout ───────────────────────────────────────────────────
        print("\n[Grupo 4] Logout")
        test_logout(page)

        browser.close()

    # ── Resumen ────────────────────────────────────────────────────────────────
    print("\n" + "=" * 50)
    passed  = [r for r in RESULTS if r[1] is True]
    failed  = [r for r in RESULTS if r[1] is False]
    skipped = [r for r in RESULTS if r[1] is None]
    total   = len(RESULTS)

    print(f"  Pasaron : {len(passed)}/{total}")
    print(f"  Fallaron: {len(failed)}/{total}")
    if skipped:
        print(f"  Saltados: {len(skipped)}/{total}")

    if failed:
        print("\n  Detalles de fallos:")
        for name, _, reason in failed:
            print(f"    [x] {name}")
            if reason:
                print(f"      {reason}")

    if console_errors:
        import itertools
        unique_errors = list(itertools.islice(dict.fromkeys(console_errors), 8))
        print(f"\n  Errores JS en consola ({len(console_errors)} total, mostrando {len(unique_errors)}):")
        for e in unique_errors:
            print(f"    • {e[:120]}")

    print()
    return len(failed) == 0


if __name__ == "__main__":
    # Instalar requests si no está disponible
    try:
        import requests as req_lib
    except ImportError:
        import subprocess, sys as _sys
        subprocess.check_call([_sys.executable, "-m", "pip", "install", "requests", "-q"])
        import requests as req_lib

    success = run_all()
    sys.exit(0 if success else 1)
