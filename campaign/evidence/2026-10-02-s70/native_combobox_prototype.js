  // A native form control with the browser's customizable picker. Its options are
  // exposed only while that picker is open, including when several fields share labels.
  ARC.combobox = function (o) {
    if (!document.getElementById('arc-native-combobox-style')) {
      const style = document.createElement('style');
      style.id = 'arc-native-combobox-style';
      style.textContent = '@supports (appearance: base-select) {' +
        'select.arc-native-combobox,select.arc-native-combobox::picker(select){appearance:base-select;}' +
        'select.arc-native-combobox:not(:open) option{display:none;}' +
        'select.arc-native-combobox::picker(select){background:white;color:#171717;border:1px solid #ddd;border-radius:6px;padding:4px;}' +
        'select.arc-native-combobox option{padding:4px 10px;}' +
        '}';
      document.head.appendChild(style);
      document.addEventListener('input', (event) => {
        const el = event.target.closest('select.arc-native-combobox[data-cb-change]');
        if (!el) return;
        const app = window.APP || {};
        const fn = app.actions && app.actions[el.dataset.cbChange];
        if (typeof fn !== 'function') return;
        ARC.shareHelpers(app);
        fn.call(app.actions, { value: el.value, name: el.name, el, event });
      });
    }
    const id = 'cb-' + String(o.name || o.label).replace(/[^A-Za-z0-9_-]/g, '_') + '-' + (ARC._cbSeq = (ARC._cbSeq || 0) + 1);
    const options = (o.options || []).map((x) => typeof x === 'object'
      ? { value: String(x.value), label: String(x.label != null ? x.label : x.value) }
      : { value: String(x), label: String(x) });
    const current = options.find((x) => x.value === String(o.value == null ? '' : o.value));
    return `<span class="combobox" data-combobox="${id}">` +
      `<label id="${id}-label" for="${id}">${ARC.esc(o.label)}</label> ` +
      `<select class="arc-native-combobox" id="${id}" role="combobox" name="${ARC.esc(o.name || '')}"` +
      ` aria-labelledby="${id}-label"${o.change ? ` data-cb-change="${ARC.esc(o.change)}"` : ''}>` +
      (current ? '' : `<option value="" hidden selected>${ARC.esc(o.placeholder || 'Select')}</option>`) +
      options.map((x) => `<option value="${ARC.esc(x.value)}"${x === current ? ' selected' : ''}>${ARC.esc(x.label)}</option>`).join('') +
      '</select></span>';
  };
