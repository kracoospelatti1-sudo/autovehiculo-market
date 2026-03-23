# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        errors = []
        page.on("console", lambda m: errors.append(f"[{m.type}] {m.text}") if m.type in ("error","warning") else None)
        page.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))

        # 1. Cargar home y esperar vehiculos
        page.goto(BASE)
        page.wait_for_load_state("domcontentloaded")
        page.wait_for_timeout(1000)

        # 2. Ir a vehiculos
        page.click("a[onclick*=\"vehicles\"]")
        page.wait_for_timeout(2000)

        # 3. Intentar abrir primer vehiculo con click normal
        card = page.locator(".vehicle-card[onclick*='viewVehicle']").first
        if card.count() == 0:
            print("ERROR: no hay tarjetas de vehiculos")
            browser.close()
            return

        onclick = card.get_attribute("onclick") or ""
        print(f"Card onclick: {onclick}")

        # Click directo en la tarjeta (no en el boton favorito)
        # Hacer click en el titulo o precio para evitar el boton favorito
        title = card.locator(".vehicle-title, .vehicle-info").first
        if title.count() > 0:
            title.click()
        else:
            card.click()

        page.wait_for_timeout(2000)

        current_visible = page.evaluate("""
            () => {
                const sections = document.querySelectorAll('.section');
                for (const s of sections) {
                    if (s.style.display === 'block') return s.id;
                }
                return 'none';
            }
        """)
        print(f"Seccion visible despues del click: {current_visible}")

        if current_visible != 'vehicle-detail':
            print("BUG: no navego a vehicle-detail")
            # Screenshot para debug
            page.screenshot(path="tests/debug_click.png", full_page=False)
            print("Screenshot guardado en tests/debug_click.png")

        # 4. Probar viewVehicle directo via JS
        page.click("a[onclick*=\"vehicles\"]")
        page.wait_for_timeout(1500)

        card2 = page.locator(".vehicle-card[onclick*='viewVehicle']").first
        onclick2 = card2.get_attribute("onclick") or ""
        print(f"\nProbando evaluate directo: {onclick2}")
        page.evaluate(f"() => {{ {onclick2} }}")
        page.wait_for_timeout(2000)

        current2 = page.evaluate("""
            () => {
                const sections = document.querySelectorAll('.section');
                for (const s of sections) {
                    if (s.style.display === 'block') return s.id;
                }
                return 'none';
            }
        """)
        print(f"Seccion visible despues del evaluate: {current2}")

        # 5. Errores de consola
        if errors:
            print("\nErrores/warnings de consola:")
            for e in errors[:20]:
                print(f"  {e}")
        else:
            print("\nSin errores de consola")

        browser.close()

if __name__ == "__main__":
    run()
