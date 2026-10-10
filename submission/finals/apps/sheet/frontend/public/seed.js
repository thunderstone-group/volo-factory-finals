// Initial records for the Online Spreadsheet Data Workspace.
// Only records explicitly required by a GIVEN clause live here; everything a user creates later
// (workbooks, worksheets, filters, filter views, validation rules, pivot tables, named ranges,
// conditional formatting rules, cell notes) is created at runtime through the UI.
(function () {
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function colName(c) {
    let n = c + 1, s = '';
    while (n > 0) { const m = (n - 1) % 26; s = LETTERS.charAt(m) + s; n = (n - 1 - m) / 26; }
    return s;
  }
  function ref(c, r) { return colName(c) + (r + 1); }

  function sheet(id, name, cells, extra) {
    const s = {
      id: id, name: name, cells: cells || {},
      selection: { r0: 0, c0: 0, r1: 0, c1: 0 },
      validations: [], filter: null, pivot: null,
      formats: [], notes: {}, freeze: { rows: 0, cols: 0 }
    };
    if (extra) for (const k of Object.keys(extra)) s[k] = extra[k];
    return s;
  }
  function wb(id, name, sheets, active, extra) {
    const w = {
      id: id, name: name, updatedAt: '2024-10-16T09:00:00.000Z',
      activeSheetId: null, sheets: sheets, filterViews: [], namedRanges: []
    };
    const a = sheets.filter((s) => s.name === active)[0] || sheets[0];
    w.activeSheetId = a.id;
    if (extra) for (const k of Object.keys(extra)) w[k] = extra[k];
    return w;
  }
  function workloadSheet(id) {
    return sheet(id, 'Workload', {
      D3: 'Workstream', E3: 'Phase', F3: 'Load',
      D4: 'Atlas', E4: 'Queued', F4: '17',
      D5: 'Atlas', E5: 'Active', F5: '31',
      D6: 'Beacon', E6: 'Queued', F6: '22',
      D7: 'Cirrus', E7: 'Queued', F7: '9'
    });
  }
  function queuedView(sheetId) {
    return {
      id: 'fv-' + sheetId, name: 'Queued lanes', sheetId: sheetId,
      range: { r0: 2, c0: 3, r1: 6, c1: 5 },
      conditions: [{ col: 4, kind: 'values', values: ['Queued'] }]
    };
  }
  function scrollLedger(id, rows, cols) {
    const cells = {};
    const headers = ['Entry', 'Clerk', 'Dock', 'Status', 'Shift', 'Zone', 'Ref'];
    for (let c = 0; c < cols; c++) cells[ref(c, 0)] = headers[c % headers.length];
    for (let r = 1; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells[ref(c, r)] = c === 0 ? 'E' + (r + 1) : String((r * 7 + c * 3) % 97);
      }
    }
    return cells;
  }

  const workbooks = [
    {
      id: 'wb-q3-sales',
      name: 'Q3 Sales',
      updatedAt: '2024-10-01T09:15:00.000Z',
      activeSheetId: 'sh-q3-1',
      sheets: [
        {
          id: 'sh-q3-1',
          name: 'Sheet1',
          cells: { A1: 'Region' },
          selection: { r0: 0, c0: 0, r1: 0, c1: 0 },
          validations: [],
          filter: null,
          pivot: null
        },
        {
          id: 'sh-q3-2',
          name: 'Sheet2',
          cells: { A1: 'Item', B1: 'Qty', A2: 'Pen', B2: '4' },
          selection: { r0: 0, c0: 0, r1: 0, c1: 0 },
          validations: [],
          filter: null,
          pivot: null
        }
      ]
    },

    wb('wb-evo-m01-rename-ok', 'EVO-M01-RENAME-OK',
      [sheet('sh-evo-m01-rename-ok-1', 'IdentityLog', { F3: 'unreviewed' })], 'IdentityLog'),

    wb('wb-evo-m01-rename-dup', 'EVO-M01-RENAME-DUP',
      [sheet('sh-evo-m01-rename-dup-1', 'IdentityLog', {})], 'IdentityLog'),

    wb('wb-evo-m01-archive-reserved', 'EVO-M01-ARCHIVE-RESERVED',
      [sheet('sh-evo-m01-archive-reserved-1', 'Sheet1', {})], 'Sheet1'),

    wb('wb-evo-m01-rename-limit', 'EVO-M01-RENAME-LIMIT',
      [sheet('sh-evo-m01-rename-limit-1', 'LimitProbe', { C2: 'limit sentinel' })], 'LimitProbe'),

    wb('wb-evo-m02-sheet-ok', 'EVO-M02-SHEET-OK', [
      sheet('sh-evo-m02-sheet-ok-1', 'HarborDraft', { D5: 'dock marker' }),
      sheet('sh-evo-m02-sheet-ok-2', 'LedgerView', {})
    ], 'HarborDraft'),

    wb('wb-evo-m02-sheet-dup', 'EVO-M02-SHEET-DUP', [
      sheet('sh-evo-m02-sheet-dup-1', 'Meridian', {}),
      sheet('sh-evo-m02-sheet-dup-2', 'ArchiveBay', {})
    ], 'ArchiveBay'),

    wb('wb-evo-m02-sheet-limit', 'EVO-M02-SHEET-LIMIT',
      [sheet('sh-evo-m02-sheet-limit-1', 'LengthGauge', { G4: 'sheet sentinel' })], 'LengthGauge'),

    wb('wb-evo-m03-clear-text', 'EVO-M03-CLEAR-TEXT',
      [sheet('sh-evo-m03-clear-text-1', 'Staging', { H4: 'obsolete tag' })], 'Staging'),

    wb('wb-evo-m03-clear-formula', 'EVO-M03-CLEAR-FORMULA',
      [sheet('sh-evo-m03-clear-formula-1', 'Calculations', { B7: '13', C7: '=B7*5', D7: '=C7+2' })], 'Calculations'),

    wb('wb-evo-m03-clear-range', 'EVO-M03-CLEAR-RANGE',
      [sheet('sh-evo-m03-clear-range-1', 'Matrix', {
        H4: 'Amber', I4: 'Delta', H5: 'Kite', I5: 'Orchid'
      })], 'Matrix'),

    wb('wb-evo-m04-filter-save', 'EVO-M04-FILTER-SAVE',
      [workloadSheet('sh-evo-m04-filter-save-1')], 'Workload'),

    wb('wb-evo-m04-filter-apply', 'EVO-M04-FILTER-APPLY',
      [workloadSheet('sh-evo-m04-filter-apply-1')], 'Workload',
      { filterViews: [queuedView('sh-evo-m04-filter-apply-1')] }),

    wb('wb-evo-m04-filter-delete', 'EVO-M04-FILTER-DELETE',
      [workloadSheet('sh-evo-m04-filter-delete-1')], 'Workload',
      { filterViews: [queuedView('sh-evo-m04-filter-delete-1')] }),

    wb('wb-evo-m05-validation-formula', 'EVO-M05-VALIDATION-FORMULA',
      [sheet('sh-evo-m05-validation-formula-1', 'Thresholds', { J6: '37' }, {
        validations: [{
          id: 'vr-evo-m05-formula', range: { r0: 5, c0: 9, r1: 5, c1: 9 },
          type: 'number', min: 25, max: 75, errorMessage: 'Capacity must be from 25 to 75'
        }]
      })], 'Thresholds'),

    wb('wb-evo-m05-validation-grid', 'EVO-M05-VALIDATION-GRID',
      [sheet('sh-evo-m05-validation-grid-1', 'Thresholds', { K8: 'Ready' }, {
        validations: [{
          id: 'vr-evo-m05-grid', range: { r0: 7, c0: 10, r1: 7, c1: 10 },
          type: 'dropdown', values: ['Ready', 'Holding', 'Released'],
          raw: 'Ready, Holding, Released', errorMessage: 'Choose a queue state'
        }]
      })], 'Thresholds'),

    wb('wb-evo-m05-validation-edit', 'EVO-M05-VALIDATION-EDIT',
      [sheet('sh-evo-m05-validation-edit-1', 'Thresholds', { L4: '42' }, {
        validations: [{
          id: 'vr-evo-m05-edit', range: { r0: 3, c0: 11, r1: 3, c1: 11 },
          type: 'number', min: 25, max: 75, errorMessage: 'Capacity must be from 25 to 75'
        }]
      })], 'Thresholds'),

    wb('wb-evo-n01-freeze-row', 'EVO-N01-FREEZE-ROW',
      [sheet('sh-evo-n01-freeze-row-1', 'ScrollLedger', scrollLedger('sh-evo-n01-freeze-row-1', 40, 4))],
      'ScrollLedger'),

    wb('wb-evo-n01-freeze-column', 'EVO-N01-FREEZE-COLUMN',
      [sheet('sh-evo-n01-freeze-column-1', 'ScrollLedger', scrollLedger('sh-evo-n01-freeze-column-1', 20, 12))],
      'ScrollLedger'),

    wb('wb-evo-n01-freeze-both', 'EVO-N01-FREEZE-BOTH',
      [sheet('sh-evo-n01-freeze-both-1', 'ScrollLedger', scrollLedger('sh-evo-n01-freeze-both-1', 40, 12))],
      'ScrollLedger'),

    wb('wb-evo-n02-find-next', 'EVO-N02-FIND-NEXT',
      [sheet('sh-evo-n02-find-next-1', 'Narrative', { E4: 'Cobalt', E7: 'Cobalt', E11: 'Cobalt' })],
      'Narrative'),

    wb('wb-evo-n02-replace-all', 'EVO-N02-REPLACE-ALL',
      [sheet('sh-evo-n02-replace-all-1', 'Narrative', {
        F3: 'Cobalt', F6: 'Cobalt', F9: 'Cobalt', F12: 'Copper'
      })], 'Narrative'),

    wb('wb-evo-n02-case-sensitive', 'EVO-N02-CASE-SENSITIVE',
      [sheet('sh-evo-n02-case-sensitive-1', 'Narrative', {
        G3: 'Cobalt', G4: 'cobalt', G5: 'Cobalt-7'
      })], 'Narrative'),

    wb('wb-evo-n03-named-create', 'EVO-N03-NAMED-CREATE',
      [sheet('sh-evo-n03-named-create-1', 'ForecastModel', { J3: '18', J4: '24', J5: '31' })],
      'ForecastModel'),

    wb('wb-evo-n03-named-invalid', 'EVO-N03-NAMED-INVALID',
      [sheet('sh-evo-n03-named-invalid-1', 'ForecastModel', { K2: '6', K3: '14' })],
      'ForecastModel'),

    wb('wb-evo-n03-named-update', 'EVO-N03-NAMED-UPDATE',
      [sheet('sh-evo-n03-named-update-1', 'ForecastModel', {
        K2: '5', K3: '8', K4: '12', M2: '=SUM(MarginBase)'
      })], 'ForecastModel',
      { namedRanges: [{ id: 'nr-evo-margin-base', name: 'MarginBase', range: 'ForecastModel!K2:K3' }] }),

    wb('wb-evo-n04-format-number', 'EVO-N04-FORMAT-NUMBER',
      [sheet('sh-evo-n04-format-number-1', 'Signals', { J4: '11', J5: '29', J6: '46' })],
      'Signals'),

    wb('wb-evo-n04-format-text', 'EVO-N04-FORMAT-TEXT',
      [sheet('sh-evo-n04-format-text-1', 'Signals', { K4: 'Watch', K5: 'Stable', K6: 'Elevated' })],
      'Signals'),

    wb('wb-evo-n04-format-edit', 'EVO-N04-FORMAT-EDIT',
      [sheet('sh-evo-n04-format-edit-1', 'Signals', { L3: '16', L4: '28', L5: '39' }, {
        formats: [{
          id: 'cf-evo-format-edit-1',
          range: { r0: 2, c0: 11, r1: 4, c1: 11 },
          condition: 'Greater than', value: '20', style: 'Red fill'
        }]
      })], 'Signals'),

    wb('wb-evo-n05-note-create', 'EVO-N05-NOTE-CREATE',
      [sheet('sh-evo-n05-note-create-1', 'ReviewQueue', { D8: 'Manifest R41' })],
      'ReviewQueue'),

    wb('wb-evo-n05-note-edit', 'EVO-N05-NOTE-EDIT',
      [sheet('sh-evo-n05-note-edit-1', 'ReviewQueue', { F6: 'Gate Rho' },
        { notes: { F6: 'Awaiting controller sign-off' } })],
      'ReviewQueue'),

    wb('wb-evo-n05-note-delete', 'EVO-N05-NOTE-DELETE',
      [sheet('sh-evo-n05-note-delete-1', 'ReviewQueue', { J3: 'Route Zeta' },
        { notes: { J3: 'Retire after audit' } })],
      'ReviewQueue')
  ];

  window.SEED = { session: null, workbooks: workbooks };
})();
