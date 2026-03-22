from playwright.sync_api import sync_playwright
import os

SS = "c:/Users/Lucas Pelatti/Documents/GitHub/autovehiculo-market/test_screenshots"
os.makedirs(SS, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})

    page.goto("http://localhost:3000", wait_until="networkidle")
    page.screenshot(path=f"{SS}/recon_01_home.png", full_page=True)

    # Dump visible interactive elements
    elements = page.evaluate("""() => {
        const sel = ['button', 'a', 'select', 'input', '[onclick]'];
        return sel.flatMap(s => [...document.querySelectorAll(s)])
            .filter(el => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0 && r.top < 900;
            })
            .map(el => ({
                tag: el.tagName,
                id: el.id,
                cls: el.className.toString().slice(0,40),
                text: el.textContent.trim().slice(0,30),
                visible: r => r.width > 0
            }));
    }""")
    for el in elements[:40]:
        print(f"  {el['tag']:<8} id={el['id']:<25} text={el['text']}")

    # Check filter panel visibility
    fp = page.locator("#filtersPanel, .filters-panel, .filters-sidebar, [id*='filter']").all()
    print(f"\nFilter-related elements: {len(fp)}")
    for el in fp:
        try:
            print(f"  id={el.get_attribute('id')} visible={el.is_visible()} class={el.get_attribute('class','')[:40]}")
        except: pass

    browser.close()
print("Done")
