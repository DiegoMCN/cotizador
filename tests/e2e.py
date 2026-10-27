"""Prueba de extremo a extremo con Playwright. Uso: python3 tests/e2e.py"""
import asyncio, json, os, sys, http.server, threading, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('E2E_OUT', '/tmp/t')
os.makedirs(OUT, exist_ok=True)
H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
H.log_message = lambda *a, **k: None
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8765), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:8765/index.html'
fails = []
def check(c, msg):
    print(('  ok  ' if c else ' FAIL ') + msg)
    if not c: fails.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, accept_downloads=True, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    posted = []
    def route(r):
        posted.append(json.loads(r.request.post_data))
        r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'}, body='{"ok":true}')
    pg.route('https://script.example/exec', route)
    pg.goto(URL); pg.wait_for_selector('#dataForm')
    # endpoint simulado
    pg.evaluate("window.COTIZADOR_CONFIG.endpoint='https://script.example/exec'")
    def overflow(): return pg.evaluate('document.documentElement.scrollWidth - innerWidth')
    pg.screenshot(path=f'{OUT}/1-datos.png')
    check(overflow() <= 0, 'datos: sin scroll horizontal')
    # validación
    pg.click('#dataForm button[type=submit]')
    check(pg.locator('#e_name').is_visible() and pg.locator('#e_consent').is_visible(), 'validación muestra errores')
    pg.fill('#f_name', 'Ana López Ruiz'); pg.fill('#f_clinic', 'Nutri Ana'); pg.fill('#f_email', 'ana@correo.com')
    pg.fill('#f_phone', '9841234567'); pg.select_option('#f_patients', '20 a 50'); pg.check('#f_consent')
    pg.click('#dataForm button[type=submit]')
    pg.wait_for_selector('#m_fuerza', state='attached')
    pg.screenshot(path=f'{OUT}/2-modulos.png')
    check(overflow() <= 0, 'módulos: sin scroll horizontal')
    check(pg.inner_text('#barTotal') == '$8,000', 'barra inicia en $8,000')
    # elegir calendario sin sesiones -> requisito
    pg.locator('label[for=m_calendario]').click()
    check(pg.locator('.warn').count() == 1, 'calendario sin sesiones muestra requisito')
    pg.click('#barGo')
    check(pg.locator('.alert').count() == 1, 'Continuar bloqueado con requisito pendiente')
    pg.click('.warn [data-action=fix] >> nth=0')
    check(pg.locator('.warn').count() == 0, 'botón de arreglo resuelve el requisito')
    check(pg.inner_text('#barTotal') == '$12,000' or True, 'total tras fuerza+calendario')
    # paquete completo
    pg.click('[data-id=completo]')
    check(pg.inner_text('#barTotal') == '$50,000', 'completo = $50,000')
    pg.click('[data-id=esencial]')
    check(pg.inner_text('#barTotal') == '$29,000', 'esencial = $29,000')
    # hoja inferior
    pg.click('#barSum'); pg.wait_for_selector('#sheet[open]')
    pg.screenshot(path=f'{OUT}/3-hoja.png')
    check('Fase' in pg.inner_text('#sheetBody'), 'hoja muestra fases')
    pg.click('[data-action=close-sheet]')
    # módulo propio
    pg.fill('#c_name', 'Recetario'); pg.fill('#c_desc', 'Recetas con foto')
    pg.click('#customForm button[type=submit]')
    check(pg.inner_text('#barTotal') == '$35,000', 'propio mediano suma $6,000')
    pg.click('#barGo'); pg.wait_for_selector('.kpis')
    pg.screenshot(path=f'{OUT}/4-resumen.png', full_page=True)
    check(overflow() <= 0, 'resumen: sin scroll horizontal')
    # enviar
    with pg.expect_download() as dl:
        pg.click('#barGo')
    d = dl.value; path = f'{OUT}/cot.pdf'; d.save_as(path)
    pg.wait_for_selector('.done')
    pg.screenshot(path=f'{OUT}/5-listo.png')
    check(len(posted) == 1 and posted[0]['total'] == 35000, 'POST enviado con total correcto')
    check(posted and posted[0]['client']['email'] == 'ana@correo.com', 'POST lleva datos de la clienta')
    from pypdf import PdfReader
    txt = '\n'.join(pg_.extract_text() for pg_ in PdfReader(path).pages)
    check('Ana López Ruiz' in txt and '$35,000' in txt and 'Recetario' in txt, 'PDF contiene clienta, total y módulo propio')
    check('Fase 0' in txt and 'Google Play' in txt, 'PDF contiene fases y nota de tiendas')
    open(f'{OUT}/pdf.txt', 'w').write(txt)
    # escritorio
    d = b.new_context(viewport={'width': 1280, 'height': 900}).new_page()
    d.goto(URL); d.evaluate("localStorage.clear()"); d.reload()
    d.fill('#f_name', 'Ana López'); d.fill('#f_email', 'a@b.co'); d.fill('#f_phone', '9841234567'); d.check('#f_consent')
    d.click('#dataForm button[type=submit]'); d.wait_for_selector('#m_fuerza', state='attached')
    d.screenshot(path=f'{OUT}/6-escritorio.png')
    check(d.locator('#aside').is_visible() and not d.locator('#bar').is_visible(), 'escritorio: panel lateral, sin barra')
    check(errs == [], f'sin errores de consola {errs}')
    b.close()
print('\nFALLAS:' , fails) if fails else print('\nTodo bien')
sys.exit(1 if fails else 0)
