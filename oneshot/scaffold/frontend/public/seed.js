// Seed data: every quoted title, account and value the requirement names exists here verbatim, one
// dedicated row per mutating requirement. Replace this object entirely. Only shared domain data
// belongs in SEED; transient presentation defaults belong in VIEW_SEED below.
window.SEED = {
  session: null,
  users: [{ id: 'u1', name: 'Demo User', email: 'demo@example.com', password: 'password' }],
  items: [{ id: 'i1', title: 'First item', body: 'Seeded row' }]
};

// Optional, page-local defaults. Each page gets an independent deep copy, never written to /api/state.
// Add view flags here (collapsed panels, grid/list choice, filters), not to window.SEED.
window.VIEW_SEED = { query: '' };
