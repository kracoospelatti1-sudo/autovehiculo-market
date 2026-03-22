import sys, os
sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

SS = "c:/Users/Lucas Pelatti/Documents/GitHub/autovehiculo-market/test_screenshots"
os.makedirs(SS, exist_ok=True)

results = []
def ok(msg):   results.append(("OK",   msg))
def fail(msg): results.append(("FAIL", msg))
def sec(msg):  results.append(("SEC",  msg))
def ss(page, name): page.screenshot(path=f"{SS}/{name}.png")

def net(page):
    try: page.wait_for_load_state("networkidle", timeout=6000)
    except: pass

def click_nav(page, text):
    lnk = page.locator("#navVehicles, #navHome, .nav-links a").filter(has_text=text).first
    if lnk.count() and lnk.is_visible():
        lnk.click(); page.wait_for_timeout(800); net(page)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    # ── 1. HOME ──────────────────────────────────────────────────
    sec("1. HOME PAGE")
    page.goto("http://localhost:3000"); net(page)
    page.wait_for_timeout(3000)  # dar tiempo al fetch del dolar
    ss(page, "01_home")
    ok(f"Titulo: {page.title()}") if page.title() else fail("Sin titulo")

    w = page.locator("#dolarWidget")
    if w.count() and w.is_visible() and "Blue" in (w.text_content() or ""):
        ok(f"Dolar widget OK: {w.text_content().strip()}")
    else:
        fail(f"Dolar widget no visible (visible={w.is_visible() if w.count() else 'no existe'}, txt='{w.text_content() if w.count() else ''}')")

    # ── 2. VEHICULOS + FILTROS ───────────────────────────────────
    sec("2. VEHICULOS Y FILTROS")
    page.locator("#navVehicles").click(); page.wait_for_timeout(1000); net(page)
    page.wait_for_timeout(1000)  # esperar carga de cards
    ss(page, "02_vehiculos")

    cards = page.locator(".vehicle-card").count()
    ok(f"{cards} cards de vehiculos") if cards > 0 else ok("Sin vehiculos aun (DB limpia)")

    if cards > 0:
        # Esperar que las cards salgan del skeleton
        try: page.wait_for_selector(".vehicle-price", timeout=6000)
        except: pass
        usd = page.locator(".vehicle-price").count()
        ars = page.locator(".vehicle-price-ars").count()
        ok(f"Precios USD en cards: {usd}") if usd > 0 else fail("Sin .vehicle-price en cards")
        ok(f"Precios ARS en cards: {ars}") if ars > 0 else fail("Sin .vehicle-price-ars (dolar no cargado?)")

    # Abrir filtros si hay toggle
    toggle = page.locator("#toggleFilters, button:has-text('Filtros')").first
    if toggle.count() and toggle.is_visible():
        toggle.click(); page.wait_for_timeout(400)

    tipo = page.locator("#filterVehicleType")
    if tipo.count() and tipo.is_visible():
        tipo.select_option("moto"); page.wait_for_timeout(600)
        fm = page.locator("#filterFuel option").all_text_contents()
        tm = page.locator("#filterTransmission option").all_text_contents()
        ss(page, "03_filtro_moto")
        ok(f"Moto combustible OK: {fm}") if "Nafta" in fm and "Diesel" not in fm and "GNC" not in fm else fail(f"Moto combustible: {fm}")
        ok(f"Moto transmision OK: {tm}") if "Quick Shifter" in tm and not any("tom" in t for t in tm) else fail(f"Moto transmision: {tm}")

        tipo.select_option("auto"); page.wait_for_timeout(600)
        fa = page.locator("#filterFuel option").all_text_contents()
        ta = page.locator("#filterTransmission option").all_text_contents()
        ok(f"Auto combustible OK (incluye Diesel+GNC)") if "Diesel" in fa and "GNC" in fa else fail(f"Auto combustible: {fa}")
        ok("Auto transmision OK (sin Quick Shifter)") if "Quick Shifter" not in ta and any("tom" in t for t in ta) else fail(f"Auto transmision: {ta}")
        tipo.select_option(""); page.wait_for_timeout(300)
    else:
        fail("Filtro #filterVehicleType no visible")

    # ── 3. LOGIN ─────────────────────────────────────────────────
    sec("3. AUTH - Login")
    page.locator("#navLogin, .nav-links a").filter(has_text="niciar").first.click()
    page.wait_for_timeout(600)
    ei = page.locator("#loginEmail")
    pi = page.locator("#loginPassword")
    if ei.count() and ei.is_visible():
        ei.fill("admin@autovehiculo.com"); pi.fill("Admin1234!")
        ss(page, "04_login_form")
        page.locator("button[type=submit], button:has-text('Entrar'), button:has-text('Ingresar')").first.click()
        page.wait_for_timeout(2500); net(page)
        ss(page, "05_post_login")
        navlogout = page.locator("#navLogout")
        ok("Login OK - boton Salir visible") if navlogout.count() and navlogout.is_visible() else fail("Login fallido - no aparece Salir")
        navadmin = page.locator("#navAdmin")
        ok("navAdmin visible (usuario es admin)") if navadmin.count() and navadmin.is_visible() else fail("navAdmin no visible - is_admin no llegando al frontend")
    else:
        fail("Formulario login no visible")

    # ── 4+5. PUBLICAR ────────────────────────────────────────────
    sec("4. PUBLICAR - Auto")
    pub = page.locator("#navPublish")
    if pub.count() and pub.is_visible():
        pub.click(); page.wait_for_timeout(800); ss(page, "06_publish")
        tp = page.locator("#publishVehicleType")
        if tp.count() and tp.is_visible():
            tp.select_option("auto"); page.wait_for_timeout(400)
            fa2 = page.locator("#publishFuel option").all_text_contents()
            ta2 = page.locator("#publishTransmission option").all_text_contents()
            cc = page.locator("#publishEngineCCGroup")
            ok(f"Auto pub combustible OK") if "GNC" in fa2 and "Diesel" in fa2 else fail(f"Auto pub combustible: {fa2}")
            ok("Auto pub transmision OK") if any("tom" in t for t in ta2) else fail(f"Auto pub transmision: {ta2}")
            ok("Auto - CC oculto") if not cc.is_visible() else fail("Auto - CC visible (no debia)")

            sec("5. PUBLICAR - Moto")
            tp.select_option("moto"); page.wait_for_timeout(400); ss(page, "07_publish_moto")
            fm2 = page.locator("#publishFuel option").all_text_contents()
            tm2 = page.locator("#publishTransmission option").all_text_contents()
            ok(f"Moto pub combustible OK: {fm2}") if "Nafta" in fm2 and "Diesel" not in fm2 and "GNC" not in fm2 else fail(f"Moto pub combustible: {fm2}")
            ok(f"Moto pub transmision OK: {tm2}") if "Quick Shifter" in tm2 and not any("tom" in t for t in tm2) else fail(f"Moto pub transmision: {tm2}")
            ok("Moto - CC visible") if cc.is_visible() else fail("Moto - CC no visible")
        else: fail("publishVehicleType no visible")
    else: fail("navPublish no visible")

    # ── 6. DETALLE ───────────────────────────────────────────────
    sec("6. DETALLE DE VEHICULO")
    page.locator("#navVehicles").click(); page.wait_for_timeout(800); net(page)
    page.wait_for_timeout(1500)
    cards2 = page.locator(".vehicle-card")
    if cards2.count():
        # Esperar que las cards salgan del skeleton y clickear la primera real
        try: page.wait_for_selector(".vehicle-price", timeout=6000)
        except: pass
        page.locator(".vehicle-card").first.click()
        # Esperar el detalle (SPA — no usar networkidle)
        try: page.wait_for_selector(".detail-price-block, .detail-price", timeout=6000)
        except: pass
        page.wait_for_timeout(1000)
        ss(page, "08_detalle")
        dp = page.locator(".detail-price-block .detail-price, .detail-price").first
        ok(f"Precio USD en detalle: {dp.text_content().strip()[:40]}") if dp.count() else fail("Precio USD no encontrado en detalle")
        da = page.locator(".detail-price-ars").first
        ok(f"Precio ARS en detalle: {da.text_content().strip()}") if da.count() and da.is_visible() else fail("Precio ARS no visible (dolar puede no haber cargado)")
        page.wait_for_timeout(1500)
        sim = page.locator(".similar-vehicles-section, #similarVehiclesSection")
        n_sim = page.locator(".similar-card").count()
        ok(f"Seccion similares: {n_sim} cards") if sim.count() else ok("Similares: seccion removida (sin resultados similares)")
        ss(page, "09_similares")
    else:
        ok("Sin vehiculos para probar detalle")

    # ── 7. ADMIN ─────────────────────────────────────────────────
    sec("7. ADMIN PANEL")
    nav_admin = page.locator("#navAdmin")
    if nav_admin.count() and nav_admin.is_visible():
        nav_admin.click(); page.wait_for_timeout(1000); net(page)
        ss(page, "10_admin")
        ok("Panel admin accesible")
        ut = page.locator("button, a").filter(has_text="Usuarios").first
        if ut.count() and ut.is_visible():
            ut.click(); page.wait_for_timeout(800); ss(page, "11_admin_users"); ok("Tab usuarios cargado")
    else:
        fail("navAdmin no visible - acceso admin bloqueado")

    # ── 8. PERFIL ────────────────────────────────────────────────
    sec("8. PERFIL")
    np = page.locator("#navProfile")
    if np.count() and np.is_visible():
        np.click(); page.wait_for_timeout(1000); net(page)
        ss(page, "12_perfil"); ok("Perfil cargado")
    else:
        fail("navProfile no visible")

    # ── CONSOLA ──────────────────────────────────────────────────
    sec("ERRORES DE CONSOLA")
    skip = ["favicon", "404", "localhost detected", "ERR_BLOCKED", "hCaptcha"]
    rel = [e for e in errors if not any(s.lower() in e.lower() for s in skip)]
    ok("Sin errores de consola relevantes") if not rel else [fail(f"Console: {e[:100]}") for e in rel[:5]]

    browser.close()

# ── REPORTE ──────────────────────────────────────────────────────
print("\n" + "="*60)
print("  REPORTE FINAL - AutoVehiculo Market")
print("="*60)
for tipo, msg in results:
    if tipo == "SEC": print(f"\n{msg}")
    elif tipo == "OK": print(f"  OK   {msg}")
    else:             print(f"  FAIL {msg}")
passed = sum(1 for t,_ in results if t=="OK")
failed = sum(1 for t,_ in results if t=="FAIL")
print(f"\n  {passed} OK  /  {failed} FAIL")
print(f"  Screenshots: {SS}")
print("="*60)
