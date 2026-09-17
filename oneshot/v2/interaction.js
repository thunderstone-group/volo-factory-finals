/* Small shared editor and row-action implementation. No application vocabulary. */
(function () {
  'use strict';
  let serial = 0;
  const popovers = new WeakMap();
  function label(value) {
    if (typeof value !== 'string' || !value.trim()) throw new TypeError('A visible name is required');
    return value; // Preserve the supplied wording, including punctuation.
  }
  function button(name, action) {
    const node = document.createElement('button');
    node.type = 'button'; node.textContent = label(name); node.setAttribute('aria-label', name);
    if (action) node.addEventListener('click', action);
    return node;
  }
  function field(spec) {
    if (typeof spec.name !== 'string' || !spec.name.trim()) throw new TypeError('A field key is required');
    const wrapper = document.createElement('label');
    const caption = document.createElement('span');
    caption.textContent = label(spec.label); caption.id = 'volo-field-label-' + (++serial);
    const input = document.createElement(spec.type === 'textarea' ? 'textarea' : spec.type === 'richtext' ? 'div' : 'input');
    input.id = 'volo-field-' + serial; input.name = spec.name;
    if (spec.type === 'richtext') {
      input.contentEditable = 'true'; input.setAttribute('role', 'textbox'); input.setAttribute('aria-multiline', 'true');
    } else if (input.tagName === 'INPUT') input.type = spec.type || 'text';
    input.setAttribute('aria-labelledby', caption.id);
    if (spec.required) input.required = true;
    if (spec.placeholder) input.setAttribute('placeholder', spec.placeholder);
    wrapper.htmlFor = input.id; wrapper.append(caption, input);
    return {node: wrapper, input, spec};
  }
  function richValue(input, value) {
    const template = document.createElement('template'); template.innerHTML = String(value);
    const allowed = new Set(['P','DIV','BR','B','STRONG','I','EM','U','S','UL','OL','LI','CODE','PRE','SPAN']);
    for (const node of template.content.querySelectorAll('*')) {
      if (!allowed.has(node.tagName)) node.replaceWith(document.createTextNode(node.textContent));
      else for (const attr of [...node.attributes]) node.removeAttribute(attr.name);
    }
    input.replaceChildren(template.content);
  }
  function editor({name, formName = name, fields, saveLabel, cancelLabel, onSave, owner = document.body, presentation = 'dialog'}) {
    if (!['dialog','inline'].includes(presentation)) throw new TypeError('Editor presentation must be dialog or inline');
    const modal = presentation === 'dialog';
    const dialog = document.createElement(modal ? 'dialog' : 'section');
    if (!modal) { dialog.hidden = true; dialog.setAttribute('role','region'); }
    const heading = document.createElement('h2');
    heading.id = 'volo-editor-' + (++serial); heading.textContent = label(name);
    dialog.setAttribute('aria-labelledby', heading.id);
    const form = document.createElement('form'); form.setAttribute('aria-label', label(formName));
    const entries = fields.map(field);
    if (new Set(fields.map(f => f.name)).size !== fields.length) throw new Error('Duplicate field name');
    const error = document.createElement('p'); error.setAttribute('role', 'alert'); error.hidden = true;
    const save = button(saveLabel); save.type = 'submit';
    const close = reason => { if (modal) dialog.close(reason); else dialog.hidden = true; };
    const cancel = button(cancelLabel, () => { if (!busy) close('cancel'); });
    form.append(...entries.map(e => e.node), error, save, cancel); dialog.append(heading, form); owner.append(dialog);
    let record = null, busy = false;
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    async function submit(event) {
      event.preventDefault(); if (busy || !form.reportValidity()) return;
      busy = true; save.disabled = cancel.disabled = true; error.hidden = true;
      const values = Object.fromEntries(entries.map(({input, spec}) => [spec.name,
        spec.type === 'checkbox' ? input.checked : spec.type === 'richtext' ? input.innerHTML : input.value]));
      try {
        await onSave(values, record);
        close('saved');
      } catch (failure) {
        error.textContent = String(failure.message || failure); error.hidden = false;
      } finally { busy = false; save.disabled = cancel.disabled = false; }
    }
    form.addEventListener('submit', submit);
    function open(values = {}, identity = null) {
      if (busy) throw new Error('Editor save is still pending');
      record = identity; error.hidden = true;
      for (const {input, spec} of entries) {
        const value = values[spec.name] ?? '';
        if (spec.type === 'checkbox') input.checked = Boolean(value);
        else if (spec.type === 'richtext') richValue(input, value);
        else input.value = String(value);
      }
      if (modal) { if (!dialog.open) dialog.showModal(); } else dialog.hidden = false;
      entries[0]?.input.focus();
    }
    return Object.freeze({open, element: dialog, form,
      fields: Object.freeze(Object.fromEntries(entries.map(e => [e.spec.name, e.input])))});
  }
  function rowActions(owner, name, actions) {
    const names = actions.map(a => label(a.label).toLowerCase());
    if (new Set(names).size !== names.length) throw new Error('Duplicate action name in the same row');
    const group = document.createElement('div'); group.setAttribute('role', 'group'); group.setAttribute('aria-label', label(name));
    for (const action of actions) group.append(button(action.label, action.onClick));
    owner.append(group); return group;
  }
  function popover(owner, name, content) {
    popovers.get(owner)?.close();
    const panel = document.createElement('div'); panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', label(name));
    panel.append(content); owner.append(panel); // Keep the popup in its invoking row/editor's DOM scope.
    function close() { panel.remove(); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); popovers.delete(owner); }
    function outside(event) { if (!owner.contains(event.target)) close(); }
    function escape(event) { if (event.key === 'Escape') close(); }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    const instance = Object.freeze({element: panel, close}); popovers.set(owner, instance); return instance;
  }
  Object.defineProperty(globalThis, 'VoloInteraction', {value: Object.freeze({button, field, editor, rowActions, popover})});
})();
