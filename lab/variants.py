"""Generate ablation variants of the E057 app from lab/variants/baseline.

Each variant is expressed as an explicit patch over the baseline single file so the
change under measurement stays auditable. Public test bytes are never touched.
"""
from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent / 'variants'
BASE = ROOT / 'baseline'


def patch(text: str, old: str, new: str) -> str:
    if old not in text:
        raise SystemExit('patch anchor missing: ' + old[:80])
    return text.replace(old, new, 1)


# --- a: minimal register-route DOM -------------------------------------------------
# The register route no longer paints the brand bar or the gradient card head; it keeps
# every label, role, option text and the exact "账户信息" heading the tests read.
def variant_a(text: str) -> str:
    text = patch(
        text,
        "    app.innerHTML = renderTopbar() + '<div class=\"container\"><div class=\"card-head\">账户信息</div><div class=\"card-body\">'",
        "    app.innerHTML = '<div class=\"container\"><div class=\"card-head\">账户信息</div><div class=\"card-body\">'",
    )
    return text


# --- b: no decorative paint --------------------------------------------------------
# Removes the gradient, box-shadow, rounded corners, hover rules and the CJK font stack.
# Playwright's actionability check waits for two stable animation frames before every
# fill/check/click, so per-frame paint cost is charged ~30 times in this one test.
def variant_b(text: str) -> str:
    css_old = text[text.index('<style>'):text.index('</style>') + len('</style>')]
    css_new = """<style>
  * { box-sizing: border-box; }
  body { margin:0; background:#fff; color:#222; }
  .topbar { background:#0b5ed7; color:#fff; padding:12px 24px; display:flex; justify-content:space-between; align-items:center; }
  .topbar nav a { color:#fff; text-decoration:none; margin-left:18px; padding:6px 10px; }
  .container { max-width:720px; margin:32px auto; background:#fff; }
  .card-head { background:#0b5ed7; color:#fff; padding:18px 24px; font-size:20px; font-weight:700; }
  .card-body { padding:24px; }
  .field { margin-bottom:16px; }
  .field label { display:block; font-weight:600; margin-bottom:6px; }
  .field .req { color:#e02424; }
  .field input, .field select { width:100%; padding:10px 12px; border:1px solid #cbd5e1; font-size:14px; }
  .btn { width:100%; padding:12px; background:#f97316; color:#fff; border:none; font-size:16px; font-weight:700; cursor:pointer; }
  .terms label { display:flex; align-items:flex-start; gap:8px; font-size:13px; }
  .alert { display:none; background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; padding:10px 12px; margin-bottom:16px; }
  .alert.show { display:block; }
  .strength-wrap { display:flex; align-items:center; gap:6px; margin-top:6px; }
  .strength-seg { width:26px; height:6px; background:#d8dee6; }
  meter { height:16px; width:80px; margin-left:auto; }
  .home-intro { padding:40px 24px; text-align:center; color:#0b5ed7; }
  .home-intro p { color:#475569; }
  .form-row { display:flex; gap:10px; }
  .form-row .code { flex:0 0 130px; }
  .form-row .phone { flex:1; }
</style>"""
    return text.replace(css_old, css_new, 1)


# --- d: session fetch no longer blocks first paint ---------------------------------
# boot() awaits GET /api/session before any markup exists, so every document load costs
# a round trip before the first locator can match. Render synchronously, then patch the
# top bar when the session answer arrives.
def variant_d(text: str) -> str:
    return patch(text, """  async function boot() {
    currentUser = await getSession();
    const path = location.pathname;
    if (path === '/register') renderRegister();
    else if (path === '/login') renderLogin();
    else renderHome();
  }""", """  function render() {
    const path = location.pathname;
    if (path === '/register') renderRegister();
    else if (path === '/login') renderLogin();
    else renderHome();
  }

  async function boot() {
    render();
    const resolved = await getSession();
    if (resolved !== currentUser) { currentUser = resolved; render(); }
  }""")


# --- e: one document load per route change ------------------------------------------
# openRegister()/openLogin() click a real anchor, which costs a second full document
# load (parse, script, session fetch). Intercept the click and swap the view in place.
def variant_e(text: str) -> str:
    text = patch(text, """  window.__app = { signOut: signOut };""", """  function route() {
    const path = location.pathname;
    if (path === '/register') renderRegister();
    else if (path === '/login') renderLogin();
    else renderHome();
  }

  function navigate(path) {
    history.pushState(null, '', path);
    route();
  }

  document.addEventListener('click', function (ev) {
    const link = ev.target.closest && ev.target.closest('a[href="/register"], a[href="/login"], a[href="/"]');
    if (!link || ev.defaultPrevented || ev.button !== 0) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
    ev.preventDefault();
    navigate(link.getAttribute('href'));
  });

  window.addEventListener('popstate', route);

  window.__app = { signOut: signOut };""")
    return text


# --- f: no location.href hand-off after a submit ------------------------------------
# submitRegister/submitLogin/signOut assign window.location.href after an awaited fetch.
# That navigation starts while the test is already issuing its next action, which both
# costs a document load and races page.goto (observed as net::ERR_ABORTED).
def variant_f(text: str) -> str:
    for old in ("      currentUser = data.username;\n      window.location.href = '/';",):
        text = text.replace(old, "      currentUser = data.username;\n      goHome();", 2)
    text = patch(text, """    currentUser = null;
    window.location.href = '/';""", """    currentUser = null;
    goHome();""")
    text = patch(text, """  window.__app = { signOut: signOut };""", """  function goHome() {
    history.replaceState(null, '', '/');
    renderHome();
  }

  window.__app = { signOut: signOut };""")
    return text


def variant_de(text: str) -> str:
    return variant_e(variant_d(text))


def variant_combined(text: str) -> str:
    return variant_f(variant_e(variant_d(variant_b(variant_a(text)))))


VARIANTS = {
    'a-minimal-dom': variant_a,
    'b-no-decoration': variant_b,
    'd-nonblocking-session': variant_d,
    'e-client-routing': variant_e,
    'f-no-location-href': variant_f,
    'combined': variant_combined,
}


def build() -> None:
    source = (BASE / 'index.html').read_text()
    api = (BASE / 'api.cjs').read_bytes()
    for name, fn in VARIANTS.items():
        target = ROOT / name
        target.mkdir(parents=True, exist_ok=True)
        (target / 'index.html').write_text(fn(source))
        (target / 'api.cjs').write_bytes(api)
        print('built', name)


if __name__ == '__main__':
    build()
