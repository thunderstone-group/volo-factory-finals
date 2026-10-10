const { test, expect } = require('@playwright/test');
const { named, field, visible, activate, button, fill, choose, selected, checked, text, order } = require('./light-helpers.cjs');
test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.1: Filter search results by note type", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The public workspace contains \"Text EV-1.1\" (ordinary text, no reminder), \"List EV-1.1\" (checklist with Milk, no reminder), \"Reminder EV-1.1\" (text with Tomorrow reminder), and \"Placement EV-1.2\" (checklist with Passport and Charger, no reminder)."
  // WHEN: "The user activates \"Notes\" in the current page."
  await activate(page, "Notes");
  // WHEN: "The user focuses the textbox labelled Search."
  await field(page, "Search").focus();
  // THEN: "The region named \"Search filters\" is visible."
  const scope0 = named(page, "region", "Search filters");
  await visible(scope0);
  // WHEN: "The user activates \"Lists\" in the region named \"Search filters\"."
  await button(scope0, "Lists");
  // THEN: "The region named \"Notes\" is visible."
  const scope1 = named(page, "region", "Notes");
  await visible(scope1);
  // THEN: "The \"Note titles\" list in the region named \"Notes\" contains exactly these entries in order: [\"Placement EV-1.2\", \"List EV-1.1\"]."
  await order(scope1, "Note titles", ["Placement EV-1.2", "List EV-1.1"]);
  // THEN: "The region named \"Text EV-1.1\" is absent in the region named \"Notes\"."
  await expect(named(scope1, "region", "Text EV-1.1")).toHaveCount(0);
  // THEN: "The region named \"Reminder EV-1.1\" is absent in the region named \"Notes\"."
  await expect(named(scope1, "region", "Reminder EV-1.1")).toHaveCount(0);
  // WHEN: "The user focuses the textbox labelled Search again."
  await field(page, "Search").focus();
  // WHEN: "The user activates \"Reminders\" in the region named \"Search filters\"."
  await button(scope0, "Reminders");
  // THEN: "The \"Note titles\" list in the region named \"Notes\" contains exactly these entries in order: [\"Reminder EV-1.1\"]."
  await order(scope1, "Note titles", ["Reminder EV-1.1"]);
  // THEN: "The region named \"List EV-1.1\" is absent in the region named \"Notes\"."
  await expect(named(scope1, "region", "List EV-1.1")).toHaveCount(0);
  // THEN: "The region named \"Text EV-1.1\" is absent in the region named \"Notes\"."
  await expect(named(scope1, "region", "Text EV-1.1")).toHaveCount(0);
});

test("EV-1.2: Keep checked checklist items in place when the setting is disabled", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The public workspace has \"Placement EV-1.2\" with unchecked items Passport then Charger; Move checked items to bottom is initially checked."
  // WHEN: "The user activates \"Notes\" in the current page."
  await activate(page, "Notes");
  // WHEN: "The user activates \"Settings\" in the current page."
  await button(page, "Settings");
  // THEN: "The dialog named \"Settings\" is visible."
  const scope0 = named(page, "dialog", "Settings");
  await visible(scope0);
  // THEN: "The \"Move checked items to bottom\" checkbox is checked in the dialog named \"Settings\"."
  await expect(named(scope0, "checkbox", "Move checked items to bottom")).toBeChecked({ checked: true });
  // WHEN: "The user unchecks \"Move checked items to bottom\" in the dialog named \"Settings\"."
  await checked(scope0, "Move checked items to bottom", false);
  // WHEN: "The user activates \"Save\" in the dialog named \"Settings\"."
  await button(scope0, "Save");
  // THEN: "The region named \"Placement EV-1.2\" is visible."
  const scope1 = named(page, "region", "Placement EV-1.2");
  await visible(scope1);
  // WHEN: "The user checks \"Passport\" in the region named \"Placement EV-1.2\"."
  await checked(scope1, "Passport", true);
  // THEN: "The \"Passport\" checkbox is checked in the region named \"Placement EV-1.2\"."
  await expect(named(scope1, "checkbox", "Passport")).toBeChecked({ checked: true });
  // THEN: "The \"Checklist items\" list in the region named \"Placement EV-1.2\" contains exactly these entries in order: [\"Passport\", \"Charger\"]."
  await order(scope1, "Checklist items", ["Passport", "Charger"]);
  // WHEN: "The user activates \"Settings\" in the current page."
  await button(page, "Settings");
  // THEN: "The \"Move checked items to bottom\" checkbox is unchecked in the dialog named \"Settings\"."
  await expect(named(scope0, "checkbox", "Move checked items to bottom")).toBeChecked({ checked: false });
  // WHEN: "The user checks \"Move checked items to bottom\" in the dialog named \"Settings\"."
  await checked(scope0, "Move checked items to bottom", true);
  // WHEN: "The user activates \"Save\" in the dialog named \"Settings\"."
  await button(scope0, "Save");
  // WHEN: "The user unchecks \"Passport\" in the region named \"Placement EV-1.2\"."
  await checked(scope1, "Passport", false);
  // WHEN: "The user checks \"Passport\" in the region named \"Placement EV-1.2\"."
  await checked(scope1, "Passport", true);
  // THEN: "The \"Passport\" checkbox is checked in the region named \"Placement EV-1.2\"."
  await expect(named(scope1, "checkbox", "Passport")).toBeChecked({ checked: true });
  // THEN: "The \"Checklist items\" list in the region named \"Placement EV-1.2\" contains exactly these entries in order: [\"Charger\", \"Passport\"]."
  await order(scope1, "Checklist items", ["Charger", "Passport"]);
});

test("EV-2.1: Create and check a checklist note", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The public workspace has no note named \"Packing EV-2.1\"; its Move checked items to bottom setting is enabled."
  // WHEN: "The user activates \"Notes\" in the current page."
  await activate(page, "Notes");
  // WHEN: "The user activates \"New list\" in the current page."
  await button(page, "New list");
  // THEN: "The dialog named \"Note editor\" is visible."
  const scope0 = named(page, "dialog", "Note editor");
  await visible(scope0);
  // WHEN: "The user enters \"Packing EV-2.1\" in the \"Title\" field in the dialog named \"Note editor\"."
  await fill(scope0, "Title", "Packing EV-2.1");
  // WHEN: "The user enters \"Passport\" in the \"New item\" field in the dialog named \"Note editor\"."
  await fill(scope0, "New item", "Passport");
  // WHEN: "The user activates \"Add item\" in the dialog named \"Note editor\"."
  await button(scope0, "Add item");
  // WHEN: "The user enters \"Charger\" in the \"New item\" field in the dialog named \"Note editor\"."
  await fill(scope0, "New item", "Charger");
  // WHEN: "The user activates \"Add item\" in the dialog named \"Note editor\"."
  await button(scope0, "Add item");
  // WHEN: "The user activates \"Save\" in the dialog named \"Note editor\"."
  await button(scope0, "Save");
  // THEN: "The region named \"Packing EV-2.1\" is visible."
  const scope1 = named(page, "region", "Packing EV-2.1");
  await visible(scope1);
  // THEN: "The \"Checklist items\" list in the region named \"Packing EV-2.1\" contains exactly these entries in order: [\"Passport\", \"Charger\"]."
  await order(scope1, "Checklist items", ["Passport", "Charger"]);
  // THEN: "The \"Passport\" checkbox is unchecked in the region named \"Packing EV-2.1\"."
  await expect(named(scope1, "checkbox", "Passport")).toBeChecked({ checked: false });
  // THEN: "The \"Charger\" checkbox is unchecked in the region named \"Packing EV-2.1\"."
  await expect(named(scope1, "checkbox", "Charger")).toBeChecked({ checked: false });
  // WHEN: "The user checks \"Passport\" in the region named \"Packing EV-2.1\"."
  await checked(scope1, "Passport", true);
  // THEN: "The \"Passport\" checkbox is checked in the region named \"Packing EV-2.1\"."
  await expect(named(scope1, "checkbox", "Passport")).toBeChecked({ checked: true });
  // THEN: "The \"Charger\" checkbox is unchecked in the region named \"Packing EV-2.1\"."
  await expect(named(scope1, "checkbox", "Charger")).toBeChecked({ checked: false });
  // THEN: "The \"Checklist items\" list in the region named \"Packing EV-2.1\" contains exactly these entries in order: [\"Charger\", \"Passport\"]."
  await order(scope1, "Checklist items", ["Charger", "Passport"]);
});

test("EV-2.2: Set a Tomorrow reminder on a note", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The public workspace has \"Reminder EV-2.2\" with body \"Send the report.\", label Work, pinned state, Blue color and no reminder. Its isolated Reminders view is initially empty. Tomorrow is a stored relative reminder preset; its visible label stays Tomorrow throughout this scenario."
  // WHEN: "The user activates \"Notes\" in the current page."
  await activate(page, "Notes");
  // THEN: "The region named \"Reminder EV-2.2\" is visible."
  const scope0 = named(page, "region", "Reminder EV-2.2");
  await visible(scope0);
  // WHEN: "The user activates \"Remind me\" in the region named \"Reminder EV-2.2\"."
  await button(scope0, "Remind me");
  // THEN: "The dialog named \"Reminder\" is visible."
  const scope1 = named(page, "dialog", "Reminder");
  await visible(scope1);
  // WHEN: "The user activates \"Tomorrow\" in the dialog named \"Reminder\"."
  await button(scope1, "Tomorrow");
  // THEN: "The exact text \"Tomorrow\" is visible exactly once in the region named \"Reminder EV-2.2\"."
  await text(scope0, "Tomorrow");
  // THEN: "The exact text \"Send the report.\" is visible exactly once in the region named \"Reminder EV-2.2\"."
  await text(scope0, "Send the report.");
  // THEN: "The status named \"Work; Pinned; Blue\" is visible exactly once in the region named \"Reminder EV-2.2\"."
  await visible(named(scope0, "status", "Work; Pinned; Blue"));
  // WHEN: "The user activates \"Reminders\" in the current page."
  await activate(page, "Reminders");
  // THEN: "The region named \"Reminders\" is visible."
  const scope2 = named(page, "region", "Reminders");
  await visible(scope2);
  // THEN: "The region named \"Reminder EV-2.2\" is visible exactly once in the region named \"Reminders\"."
  await visible(named(scope2, "region", "Reminder EV-2.2"));
  // THEN: "The exact text \"Tomorrow\" is visible exactly once in the region named \"Reminder EV-2.2\"."
  await text(scope0, "Tomorrow");
  // THEN: "The exact text \"Send the report.\" is visible exactly once in the region named \"Reminder EV-2.2\"."
  await text(scope0, "Send the report.");
  // THEN: "The status named \"Work; Pinned; Blue\" is visible exactly once in the region named \"Reminder EV-2.2\"."
  await visible(named(scope0, "status", "Work; Pinned; Blue"));
});

test("EV-3.1: Add a collaborator to a note", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The public workspace contains \"Shared EV-3.1\" with body \"Planning notes.\" and no collaborators. The collaborator address \"teammate.ev-3.1@example.com\" is available to add."
  // WHEN: "The user activates \"Notes\" in the current page."
  await activate(page, "Notes");
  // THEN: "The region named \"Shared EV-3.1\" is visible."
  const scope0 = named(page, "region", "Shared EV-3.1");
  await visible(scope0);
  // WHEN: "The user activates \"Note actions\" in the region named \"Shared EV-3.1\"."
  await button(scope0, "Note actions");
  // WHEN: "The user activates \"Collaborator\" in the region named \"Shared EV-3.1\"."
  await button(scope0, "Collaborator");
  // THEN: "The dialog named \"Collaborators\" is visible."
  const scope1 = named(page, "dialog", "Collaborators");
  await visible(scope1);
  // WHEN: "The user enters \"teammate.ev-3.1@example.com\" in the \"Email\" field in the dialog named \"Collaborators\"."
  await fill(scope1, "Email", "teammate.ev-3.1@example.com");
  // WHEN: "The user activates \"Save\" in the dialog named \"Collaborators\"."
  await button(scope1, "Save");
  // THEN: "The exact text \"teammate.ev-3.1@example.com\" is visible exactly once in the region named \"Shared EV-3.1\"."
  await text(scope0, "teammate.ev-3.1@example.com");
  // THEN: "The exact text \"Planning notes.\" is visible exactly once in the region named \"Shared EV-3.1\"."
  await text(scope0, "Planning notes.");
  // WHEN: "The user activates \"Note actions\" in the region named \"Shared EV-3.1\"."
  await button(scope0, "Note actions");
  // WHEN: "The user activates \"Collaborator\" in the region named \"Shared EV-3.1\"."
  await button(scope0, "Collaborator");
  // THEN: "The exact text \"teammate.ev-3.1@example.com\" is visible exactly once in the dialog named \"Collaborators\"."
  await text(scope1, "teammate.ev-3.1@example.com");
});
