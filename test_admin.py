import json, time, os
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:3000'
SCREENSHOTS = '/tmp/admin_test'
os.makedirs(SCREENSHOTS, exist_ok=True)

# Credenciales admin — ajustar si son distintas
ADMIN_EMAIL = 'admin@admin.com'
ADMIN_PASS = 'admin123'

def shot(page, name):
    path = f'{SCREENSHOTS}/{name}.png'
    page.screenshot(path=path, full_page=True)
    print(f'  [screenshot] {path}')

def log(msg):
    print(f'>> {msg}')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    errors = []
    page.on('console', lambda m: errors.append(f'[{m.type}] {m.text}') if m.type == 'error' else None)

    # 1. Home
    log('Navegando a home...')
    page.goto(BASE)
    page.wait_for_load_state('networkidle')
    shot(page, '01_home')

    # 2. Login
    log('Abriendo modal de login...')
    try:
        page.click('text=Ingresar', timeout=5000)
    except:
        page.click('[data-section="login"], #btnLogin, .btn-login', timeout=5000)
    page.wait_for_load_state('networkidle')
    shot(page, '02_login_modal')

    log('Completando credenciales...')
    # Buscar inputs de email y password
    page.fill('input[type="email"], input[name="email"], #loginEmail', ADMIN_EMAIL)
    page.fill('input[type="password"], input[name="password"], #loginPassword', ADMIN_PASS)
    shot(page, '03_login_filled')

    # Submit
    page.click('button[type="submit"], #btnLoginSubmit, .btn-login-submit', timeout=5000)
    page.wait_for_load_state('networkidle')
    time.sleep(1)
    shot(page, '04_after_login')

    # Verificar login exitoso
    content = page.content()
    if 'admin' in content.lower() or 'panel' in content.lower():
        log('Login exitoso (detectado texto admin/panel)')
    else:
        log('ADVERTENCIA: No se detectó sesión admin claramente')

    # 3. Navegar a panel admin
    log('Buscando enlace al panel admin...')
    try:
        page.click('text=Admin, text=Panel Admin, [data-section="admin"]', timeout=5000)
        page.wait_for_load_state('networkidle')
        time.sleep(1)
        shot(page, '05_admin_panel')
        log('Panel admin cargado')
    except Exception as e:
        log(f'No se encontró enlace admin directo: {e}')
        # Intentar navegación directa por JS
        page.evaluate("showSection && showSection('admin')")
        time.sleep(1)
        shot(page, '05_admin_panel_js')

    # 4. Stats admin
    log('Revisando stats...')
    try:
        page.click('text=Estadísticas, text=Stats, [data-tab="stats"]', timeout=3000)
        time.sleep(1)
        shot(page, '06_admin_stats')
    except:
        log('No se encontró tab de stats (puede estar inline)')

    # 5. Usuarios admin
    log('Revisando usuarios...')
    try:
        page.click('text=Usuarios, [data-tab="users"]', timeout=3000)
        time.sleep(1)
        shot(page, '07_admin_users')
    except:
        log('No se encontró tab de usuarios')

    # 6. Vehículos admin
    log('Revisando vehículos...')
    try:
        page.click('text=Vehículos, [data-tab="vehicles"]', timeout=3000)
        time.sleep(1)
        shot(page, '08_admin_vehicles')
    except:
        log('No se encontró tab de vehículos')

    # 7. Reportes admin
    log('Revisando reportes...')
    try:
        page.click('text=Reportes, [data-tab="reports"]', timeout=3000)
        time.sleep(1)
        shot(page, '09_admin_reports')
    except:
        log('No se encontró tab de reportes')

    # 8. Sección de vehículos pública
    log('Revisando listado de vehículos...')
    try:
        page.click('text=Vehículos, nav text=Vehículos', timeout=3000)
        page.wait_for_load_state('networkidle')
        time.sleep(1)
        shot(page, '10_vehicles_list')
    except Exception as e:
        log(f'Error en listado: {e}')

    # 9. Mis vehículos
    log('Revisando mis vehículos...')
    try:
        page.click('text=Mis Vehículos, text=Mis vehículos', timeout=3000)
        page.wait_for_load_state('networkidle')
        time.sleep(1)
        shot(page, '11_my_vehicles')
    except Exception as e:
        log(f'Error en mis vehículos: {e}')

    # 10. Notificaciones
    log('Revisando notificaciones...')
    try:
        page.click('text=Notificaciones, #btnNotifications, .btn-notifications', timeout=3000)
        page.wait_for_load_state('networkidle')
        time.sleep(1)
        shot(page, '12_notifications')
    except Exception as e:
        log(f'Error en notificaciones: {e}')

    # Reporte final de errores JS
    log(f'\n=== ERRORES JS DETECTADOS ({len(errors)}) ===')
    for e in errors:
        print(f'  {e}')

    browser.close()
    log('\nTest completado. Screenshots en: ' + SCREENSHOTS)
