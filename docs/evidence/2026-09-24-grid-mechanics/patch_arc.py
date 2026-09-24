import sys, re
PATCH = r"""
  // --- Presses: the browser sends `click`, and `dblclick` on a second press, only to an element still in the
  // document when the button is released. A render inside a mousedown/mouseup handler replaces that element and
  // silently drops the click and the double-click. While a left-button press is in progress, ARC.render() waits
  // for the end of its click sequence (after `click`, or after `dblclick` on a second press) in the same task.
  let pressing = false, postponed = false;
  const settle = () => { pressing = false; if (postponed) { postponed = false; ARC.render(); } };
  const press = (ev) => { if (ev.button === 0) pressing = true; };
  for (const type of ['pointerdown', 'mousedown']) window.addEventListener(type, press, true);
  for (const type of ['pointerup', 'mouseup']) window.addEventListener(type, (ev) => { if (ev.button === 0) { pressing = true; setTimeout(settle, 0); } }, true);
  window.addEventListener('click', (ev) => { if (ev.detail < 2) settle(); });
  // A double-click handler that opened an editor itself (focus now in a text field of the screen) keeps it:
  // the render postponed from the second press would wipe it.
  window.addEventListener('dblclick', () => {
    const a = document.activeElement, app = document.getElementById('app');
    if (a && app && app.contains(a) && a.matches('input, textarea, [contenteditable="true"]')) postponed = false;
    settle();
  });
  ARC._postpone = () => { if (!pressing) return false; postponed = true; return true; };
"""
src = open(sys.argv[1], encoding='utf-8').read()
m = re.search(r"\n(\s*)ARC\.render = function \(\) \{\n", src)
assert m, 'no ARC.render'
src = src[:m.start()] + "\n" + PATCH + src[m.start():m.end()] + m.group(1) + "  if (ARC._postpone()) return;\n" + src[m.end():]
open(sys.argv[1], 'w', encoding='utf-8').write(src)
print('patched', sys.argv[1])
