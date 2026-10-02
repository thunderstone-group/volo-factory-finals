// Replace this example with the initial records explicitly required by GIVEN.
// Preserve required identities, relationships, permissions and absences. Inputs a user types later,
// rejected examples and validation messages are not extra startup records or reference-data tables.
window.SEED = {
  session: null,
  users: [{ id: 'u1', name: 'Demo User', email: 'demo@example.com', password: 'password' }],
  items: [{ id: 'i1', title: 'First item', body: 'Seeded row' }]
};
