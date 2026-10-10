const { test, expect } = require('@playwright/test');
const { named, field, visible, activate, button, fill, choose, selected, checked, text, order } = require('./light-helpers.cjs');
test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.1: Reject invalid credentials", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The account \"bookstack.ev-1.1@example.com\" has password \"Benchmark123!\"; \"unknown.ev-1.1@example.com\" is not registered."
  // WHEN: "The user activates \"Login\" in the current page."
  await activate(page, "Login");
  // THEN: "The form named \"Login\" is visible."
  const scope0 = named(page, "form", "Login");
  await visible(scope0);
  // WHEN: "The user enters \"unknown.ev-1.1@example.com\" in the \"Email\" field in the form named \"Login\"."
  await fill(scope0, "Email", "unknown.ev-1.1@example.com");
  // WHEN: "The user enters \"Wrong123!\" in the \"Password\" field in the form named \"Login\"."
  await fill(scope0, "Password", "Wrong123!");
  // WHEN: "The user activates \"Login\" in the form named \"Login\"."
  await button(scope0, "Login");
  // THEN: "The alert named \"Invalid email or password\" is visible exactly once in the current page."
  await visible(named(page, "alert", "Invalid email or password"));
  // THEN: "The form named \"Login\" is visible exactly once in the current page."
  await visible(named(page, "form", "Login"));
  // THEN: "The status named \"Signed in\" is absent in the current page."
  await expect(named(page, "status", "Signed in")).toHaveCount(0);
  // WHEN: "The user enters \"bookstack.ev-1.1@example.com\" in the \"Email\" field in the form named \"Login\"."
  await fill(scope0, "Email", "bookstack.ev-1.1@example.com");
  // WHEN: "The user enters \"Wrong123!\" in the \"Password\" field in the form named \"Login\"."
  await fill(scope0, "Password", "Wrong123!");
  // WHEN: "The user activates \"Login\" in the form named \"Login\"."
  await button(scope0, "Login");
  // THEN: "The alert named \"Invalid email or password\" is visible exactly once in the current page."
  await visible(named(page, "alert", "Invalid email or password"));
  // WHEN: "The user enters \"Benchmark123!\" in the \"Password\" field in the form named \"Login\"."
  await fill(scope0, "Password", "Benchmark123!");
  // WHEN: "The user activates \"Login\" in the form named \"Login\"."
  await button(scope0, "Login");
  // THEN: "The status named \"Signed in\" is visible exactly once in the current page."
  await visible(named(page, "status", "Signed in"));
});

test("EV-1.2: Sort pages and chapters inside a book", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The account owns \"Sorting EV-1.2\" with top-level entries initially in this order: \"Zulu page\" (page), \"Alpha chapter\" (chapter), \"Beta page\" (page)."
  // GIVEN: "The application provides the account \"bookstack.ev-1.2@example.com\" with password \"Benchmark123!\"; its isolated records and permissions are those stated in this scenario."
  // WHEN: "The user activates \"Login\" in the current page."
  await activate(page, "Login");
  // THEN: "The form named \"Login\" is visible."
  const scope0 = named(page, "form", "Login");
  await visible(scope0);
  // WHEN: "The user enters \"bookstack.ev-1.2@example.com\" in the \"Email\" field in the form named \"Login\"."
  await fill(scope0, "Email", "bookstack.ev-1.2@example.com");
  // WHEN: "The user enters \"Benchmark123!\" in the \"Password\" field in the form named \"Login\"."
  await fill(scope0, "Password", "Benchmark123!");
  // THEN: "The Password input masks the password."
  await expect(field(scope0, "Password")).toHaveAttribute("type", "password");
  // WHEN: "The user activates \"Login\" in the form named \"Login\"."
  await button(scope0, "Login");
  // THEN: "The status named \"Signed in\" is visible exactly once in the current page."
  await visible(named(page, "status", "Signed in"));
  // WHEN: "The user activates \"Books\" in the current page."
  await activate(page, "Books");
  // THEN: "The region named \"Book list\" is visible."
  const scope1 = named(page, "region", "Book list");
  await visible(scope1);
  // WHEN: "The user activates \"Sorting EV-1.2\" in the region named \"Book list\"."
  await activate(scope1, "Sorting EV-1.2");
  // THEN: "The heading named \"Sorting EV-1.2\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Sorting EV-1.2"));
  // THEN: "The region named \"Book contents\" is visible."
  const scope2 = named(page, "region", "Book contents");
  await visible(scope2);
  // THEN: "The \"Contents\" list in the region named \"Book contents\" contains exactly these entries in order: [\"Zulu page\", \"Alpha chapter\", \"Beta page\"]."
  await order(scope2, "Contents", ["Zulu page", "Alpha chapter", "Beta page"]);
  // WHEN: "The user activates \"Sort\" in the current page."
  await button(page, "Sort");
  // THEN: "The dialog named \"Sort book\" is visible."
  const scope3 = named(page, "dialog", "Sort book");
  await visible(scope3);
  // WHEN: "The user selects \"Name ascending\" in the \"Order\" combobox in the dialog named \"Sort book\"."
  await choose(scope3, "Order", "Name ascending");
  // WHEN: "The user activates \"Save\" in the dialog named \"Sort book\"."
  await button(scope3, "Save");
  // THEN: "The heading named \"Sorting EV-1.2\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Sorting EV-1.2"));
  // THEN: "The \"Contents\" list in the region named \"Book contents\" contains exactly these entries in order: [\"Alpha chapter\", \"Beta page\", \"Zulu page\"]."
  await order(scope2, "Contents", ["Alpha chapter", "Beta page", "Zulu page"]);
  // WHEN: "The user activates \"Books\" in the current page."
  await activate(page, "Books");
  // WHEN: "The user activates \"Sorting EV-1.2\" in the region named \"Book list\"."
  await activate(scope1, "Sorting EV-1.2");
  // THEN: "The \"Contents\" list in the region named \"Book contents\" contains exactly these entries in order: [\"Alpha chapter\", \"Beta page\", \"Zulu page\"]."
  await order(scope2, "Contents", ["Alpha chapter", "Beta page", "Zulu page"]);
});

test("EV-2.1: Add a comment to a page", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The account owns \"Comments EV-2.1\" containing \"Review EV-2.1\" with body \"Review the release checklist.\" and no comments."
  // GIVEN: "The application provides the account \"bookstack.ev-2.1@example.com\" with password \"Benchmark123!\"; its isolated records and permissions are those stated in this scenario."
  // WHEN: "The user activates \"Login\" in the current page."
  await activate(page, "Login");
  // THEN: "The form named \"Login\" is visible."
  const scope0 = named(page, "form", "Login");
  await visible(scope0);
  // WHEN: "The user enters \"bookstack.ev-2.1@example.com\" in the \"Email\" field in the form named \"Login\"."
  await fill(scope0, "Email", "bookstack.ev-2.1@example.com");
  // WHEN: "The user enters \"Benchmark123!\" in the \"Password\" field in the form named \"Login\"."
  await fill(scope0, "Password", "Benchmark123!");
  // THEN: "The Password input masks the password."
  await expect(field(scope0, "Password")).toHaveAttribute("type", "password");
  // WHEN: "The user activates \"Login\" in the form named \"Login\"."
  await button(scope0, "Login");
  // THEN: "The status named \"Signed in\" is visible exactly once in the current page."
  await visible(named(page, "status", "Signed in"));
  // WHEN: "The user activates \"Books\" in the current page."
  await activate(page, "Books");
  // THEN: "The region named \"Book list\" is visible."
  const scope1 = named(page, "region", "Book list");
  await visible(scope1);
  // WHEN: "The user activates \"Comments EV-2.1\" in the region named \"Book list\"."
  await activate(scope1, "Comments EV-2.1");
  // THEN: "The heading named \"Comments EV-2.1\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Comments EV-2.1"));
  // THEN: "The region named \"Book contents\" is visible."
  const scope2 = named(page, "region", "Book contents");
  await visible(scope2);
  // WHEN: "The user activates \"Review EV-2.1\" in the region named \"Book contents\"."
  await activate(scope2, "Review EV-2.1");
  // THEN: "The heading named \"Review EV-2.1\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Review EV-2.1"));
  // THEN: "The region named \"Comments\" is visible."
  const scope3 = named(page, "region", "Comments");
  await visible(scope3);
  // WHEN: "The user enters \"Please verify the release checklist.\" in the \"Comment\" field in the region named \"Comments\"."
  await fill(scope3, "Comment", "Please verify the release checklist.");
  // WHEN: "The user activates \"Submit comment\" in the region named \"Comments\"."
  await button(scope3, "Submit comment");
  // THEN: "The exact text \"Please verify the release checklist.\" is visible exactly once in the region named \"Comments\"."
  await text(scope3, "Please verify the release checklist.");
  // THEN: "The heading named \"Review EV-2.1\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Review EV-2.1"));
  // THEN: "The region named \"Page content\" is visible."
  const scope4 = named(page, "region", "Page content");
  await visible(scope4);
  // THEN: "The exact text \"Review the release checklist.\" is visible exactly once in the region named \"Page content\"."
  await text(scope4, "Review the release checklist.");
  // WHEN: "The user activates \"Books\" in the current page."
  await activate(page, "Books");
  // WHEN: "The user activates \"Comments EV-2.1\" in the region named \"Book list\"."
  await activate(scope1, "Comments EV-2.1");
  // WHEN: "The user activates \"Review EV-2.1\" in the region named \"Book contents\"."
  await activate(scope2, "Review EV-2.1");
  // THEN: "The exact text \"Please verify the release checklist.\" is visible exactly once in the region named \"Comments\"."
  await text(scope3, "Please verify the release checklist.");
});

test("EV-3.1: Search child pages inside a book", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "Public book \"Search EV-3.1\" contains page \"Deployment guide EV-3.1\" with body \"Deploy with a rollback plan.\", chapter \"Deployment chapter EV-3.1\", and page \"Billing EV-3.1\" with body \"Invoice guide.\" Another book \"Outside EV-3.1\" contains page \"Deployment outside EV-3.1\". Only the first two entries match deployment within the current book."
  // WHEN: "The user activates \"Books\" in the current page."
  await activate(page, "Books");
  // THEN: "The region named \"Book list\" is visible."
  const scope0 = named(page, "region", "Book list");
  await visible(scope0);
  // WHEN: "The user activates \"Search EV-3.1\" in the region named \"Book list\"."
  await activate(scope0, "Search EV-3.1");
  // THEN: "The heading named \"Search EV-3.1\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Search EV-3.1"));
  // WHEN: "The user enters \"deployment\" in the \"Search within book\" field in the current page."
  await fill(page, "Search within book", "deployment");
  // WHEN: "The user activates \"Search book\" in the current page."
  await button(page, "Search book");
  // THEN: "The region named \"Book search results\" is visible."
  const scope1 = named(page, "region", "Book search results");
  await visible(scope1);
  // THEN: "The \"Search matches\" list in the region named \"Book search results\" contains exactly these entries in order: [\"Deployment guide EV-3.1\", \"Deployment chapter EV-3.1\"]."
  await order(scope1, "Search matches", ["Deployment guide EV-3.1", "Deployment chapter EV-3.1"]);
  // THEN: "The exact text \"Billing EV-3.1\" is absent in the region named \"Book search results\"."
  await expect(scope1.getByText("Billing EV-3.1", { exact: true })).toHaveCount(0);
  // THEN: "The exact text \"Deployment outside EV-3.1\" is absent in the region named \"Book search results\"."
  await expect(scope1.getByText("Deployment outside EV-3.1", { exact: true })).toHaveCount(0);
  // THEN: "The heading named \"Search EV-3.1\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Search EV-3.1"));
});

test("EV-3.2: Open revisions for a page", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The public book \"History EV-3.2\" contains page \"History page EV-3.2\" with current body \"Current revision content.\" Saved revisions, newest first, are \"Version 2 - Riley - 2030-09-30 12:00 UTC\" and \"Version 1 - Riley - 2030-09-29 09:00 UTC\"."
  // WHEN: "The user activates \"Books\" in the current page."
  await activate(page, "Books");
  // THEN: "The region named \"Book list\" is visible."
  const scope0 = named(page, "region", "Book list");
  await visible(scope0);
  // WHEN: "The user activates \"History EV-3.2\" in the region named \"Book list\"."
  await activate(scope0, "History EV-3.2");
  // THEN: "The heading named \"History EV-3.2\" is visible exactly once in the current page."
  await visible(named(page, "heading", "History EV-3.2"));
  // THEN: "The region named \"Book contents\" is visible."
  const scope1 = named(page, "region", "Book contents");
  await visible(scope1);
  // WHEN: "The user activates \"History page EV-3.2\" in the region named \"Book contents\"."
  await activate(scope1, "History page EV-3.2");
  // THEN: "The heading named \"History page EV-3.2\" is visible exactly once in the current page."
  await visible(named(page, "heading", "History page EV-3.2"));
  // WHEN: "The user activates \"Page actions\" in the current page."
  await button(page, "Page actions");
  // WHEN: "The user activates \"Revisions\" in the current page."
  await activate(page, "Revisions");
  // THEN: "The region named \"Page revisions\" is visible."
  const scope2 = named(page, "region", "Page revisions");
  await visible(scope2);
  // THEN: "The \"Revisions\" list in the region named \"Page revisions\" contains exactly these entries in order: [\"Version 2 - Riley - 2030-09-30 12:00 UTC\", \"Version 1 - Riley - 2030-09-29 09:00 UTC\"]."
  await order(scope2, "Revisions", ["Version 2 - Riley - 2030-09-30 12:00 UTC", "Version 1 - Riley - 2030-09-29 09:00 UTC"]);
  // WHEN: "The user activates \"Back to page\" in the current page."
  await activate(page, "Back to page");
  // THEN: "The heading named \"History page EV-3.2\" is visible exactly once in the current page."
  await visible(named(page, "heading", "History page EV-3.2"));
  // THEN: "The region named \"Page content\" is visible."
  const scope3 = named(page, "region", "Page content");
  await visible(scope3);
  // THEN: "The exact text \"Current revision content.\" is visible exactly once in the region named \"Page content\"."
  await text(scope3, "Current revision content.");
});
