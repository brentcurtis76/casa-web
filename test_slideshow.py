from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1024, 'height': 768})

    page.goto('http://localhost:8080/anuncios', timeout=60000)
    page.wait_for_load_state('networkidle', timeout=60000)

    # Take title slide screenshot
    page.wait_for_timeout(3000)
    page.screenshot(path='/tmp/slideshow_title.png', full_page=False)
    print("Screenshot 1 saved - title slide")

    # Wait for transition to photo slide with animated quote
    page.wait_for_timeout(12000)
    page.screenshot(path='/tmp/slideshow_photo.png', full_page=False)
    print("Screenshot 2 saved - photo with animated quote")

    browser.close()
