const { test, expect } = require('@playwright/test');
const { named, field, visible, activate, button, fill, choose, selected, checked, text, order } = require('./light-helpers.cjs');
test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.1: Search using operators", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "Public questions include exactly one match: \"Node retry without answers EV-1.1\" tagged node.js, 0 answers. Exclusions are \"Node retry answered EV-1.1\" tagged node.js, 1 answer; \"Python retry EV-1.1\" tagged python, 0 answers; \"Node networking EV-1.1\" tagged node.js, 0 answers with retry only in its body. No other question matches this full query."
  // WHEN: "The user enters \"in:title retry [node.js] answers:0\" in the \"Search\" field in the current page."
  await fill(page, "Search", "in:title retry [node.js] answers:0");
  // WHEN: "The user presses Enter in Search."
  await field(page, "Search").press("Enter");
  // THEN: "The \"Search\" field in the current page displays \"in:title retry [node.js] answers:0\"."
  await expect(field(page, "Search")).toHaveValue("in:title retry [node.js] answers:0");
  // THEN: "The region named \"Search results\" is visible."
  const scope0 = named(page, "region", "Search results");
  await visible(scope0);
  // THEN: "The \"Question titles\" list in the region named \"Search results\" contains exactly these entries in order: [\"Node retry without answers EV-1.1\"]."
  await order(scope0, "Question titles", ["Node retry without answers EV-1.1"]);
  // THEN: "The region named \"Node retry without answers EV-1.1\" is visible."
  const scope1 = named(page, "region", "Node retry without answers EV-1.1");
  await visible(scope1);
  // THEN: "The exact text \"node.js\" is visible exactly once in the region named \"Node retry without answers EV-1.1\"."
  await text(scope1, "node.js");
  // THEN: "The exact text \"0 answers\" is visible exactly once in the region named \"Node retry without answers EV-1.1\"."
  await text(scope1, "0 answers");
  // THEN: "The region named \"Node retry answered EV-1.1\" is absent in the region named \"Search results\"."
  await expect(named(scope0, "region", "Node retry answered EV-1.1")).toHaveCount(0);
  // THEN: "The region named \"Python retry EV-1.1\" is absent in the region named \"Search results\"."
  await expect(named(scope0, "region", "Python retry EV-1.1")).toHaveCount(0);
  // THEN: "The region named \"Node networking EV-1.1\" is absent in the region named \"Search results\"."
  await expect(named(scope0, "region", "Node networking EV-1.1")).toHaveCount(0);
});

test("EV-1.2: Sort answers by newest", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "Public question \"Answer sorting EV-1.2\" has body \"Compare retry strategies.\" and three answers: \"Old answer EV-1.2\", score 10, created 2030-09-01 09:00 UTC, accepted; \"Middle answer EV-1.2\", score 30, created 2030-09-02 09:00 UTC; \"New answer EV-1.2\", score 20, created 2030-09-03 09:00 UTC. Initial sort is Highest score. The signed-in account may answer and vote and has not voted on this question."
  // GIVEN: "The application provides the account \"stackoverflow.ev-1.2@example.com\" with password \"Benchmark123!\"; its isolated records and permissions are those stated in this scenario."
  // WHEN: "The user activates \"Login\" in the current page."
  await activate(page, "Login");
  // THEN: "The form named \"Login\" is visible."
  const scope0 = named(page, "form", "Login");
  await visible(scope0);
  // WHEN: "The user enters \"stackoverflow.ev-1.2@example.com\" in the \"Email\" field in the form named \"Login\"."
  await fill(scope0, "Email", "stackoverflow.ev-1.2@example.com");
  // WHEN: "The user enters \"Benchmark123!\" in the \"Password\" field in the form named \"Login\"."
  await fill(scope0, "Password", "Benchmark123!");
  // THEN: "The Password input masks the password."
  await expect(field(scope0, "Password")).toHaveAttribute("type", "password");
  // WHEN: "The user activates \"Login\" in the form named \"Login\"."
  await button(scope0, "Login");
  // THEN: "The status named \"Signed in\" is visible exactly once in the current page."
  await visible(named(page, "status", "Signed in"));
  // WHEN: "The user activates \"Questions\" in the current page."
  await activate(page, "Questions");
  // THEN: "The region named \"Question list\" is visible."
  const scope1 = named(page, "region", "Question list");
  await visible(scope1);
  // WHEN: "The user activates \"Answer sorting EV-1.2\" in the region named \"Question list\"."
  await activate(scope1, "Answer sorting EV-1.2");
  // THEN: "The heading named \"Answer sorting EV-1.2\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Answer sorting EV-1.2"));
  // THEN: "The region named \"Question\" is visible."
  const scope2 = named(page, "region", "Question");
  await visible(scope2);
  // THEN: "The region named \"Answers\" is visible."
  const scope3 = named(page, "region", "Answers");
  await visible(scope3);
  // THEN: "The \"Answer order\" list in the region named \"Answers\" contains exactly these entries in order: [\"Middle answer EV-1.2\", \"New answer EV-1.2\", \"Old answer EV-1.2\"]."
  await order(scope3, "Answer order", ["Middle answer EV-1.2", "New answer EV-1.2", "Old answer EV-1.2"]);
  // WHEN: "The user selects \"Newest\" in the \"Answer sort\" combobox in the current page."
  await choose(page, "Answer sort", "Newest");
  // THEN: "The \"Answer order\" list in the region named \"Answers\" contains exactly these entries in order: [\"New answer EV-1.2\", \"Middle answer EV-1.2\", \"Old answer EV-1.2\"]."
  await order(scope3, "Answer order", ["New answer EV-1.2", "Middle answer EV-1.2", "Old answer EV-1.2"]);
  // WHEN: "The user selects \"Oldest\" in the \"Answer sort\" combobox in the current page."
  await choose(page, "Answer sort", "Oldest");
  // THEN: "The \"Answer order\" list in the region named \"Answers\" contains exactly these entries in order: [\"Old answer EV-1.2\", \"Middle answer EV-1.2\", \"New answer EV-1.2\"]."
  await order(scope3, "Answer order", ["Old answer EV-1.2", "Middle answer EV-1.2", "New answer EV-1.2"]);
  // WHEN: "The user selects \"Highest score\" in the \"Answer sort\" combobox in the current page."
  await choose(page, "Answer sort", "Highest score");
  // THEN: "The \"Answer order\" list in the region named \"Answers\" contains exactly these entries in order: [\"Middle answer EV-1.2\", \"New answer EV-1.2\", \"Old answer EV-1.2\"]."
  await order(scope3, "Answer order", ["Middle answer EV-1.2", "New answer EV-1.2", "Old answer EV-1.2"]);
  // THEN: "The heading named \"Answer sorting EV-1.2\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Answer sorting EV-1.2"));
  // THEN: "The exact text \"Compare retry strategies.\" is visible exactly once in the region named \"Question\"."
  await text(scope2, "Compare retry strategies.");
  // THEN: "The button named \"Upvote\" is visible exactly once in the region named \"Question\"."
  await visible(named(scope2, "button", "Upvote"));
  // THEN: "The button named \"Downvote\" is visible exactly once in the region named \"Question\"."
  await visible(named(scope2, "button", "Downvote"));
  // THEN: "The region named \"Old answer EV-1.2\" is visible."
  const scope4 = named(page, "region", "Old answer EV-1.2");
  await visible(scope4);
  // THEN: "The exact text \"Accepted\" is visible exactly once in the region named \"Old answer EV-1.2\"."
  await text(scope4, "Accepted");
  // THEN: "The textbox labelled Your answer remains visible."
  await visible(field(page, "Your answer"));
});

test("EV-2.1: Copy a question share link", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "Public question \"Sharing EV-2.1\" has body \"How do I share this question?\", score 3, 0 answers and 0 comments. It has an implementation-defined permalink."
  // WHEN: "The user activates \"Questions\" in the current page."
  await activate(page, "Questions");
  // THEN: "The region named \"Question list\" is visible."
  const scope0 = named(page, "region", "Question list");
  await visible(scope0);
  // WHEN: "The user activates \"Sharing EV-2.1\" in the region named \"Question list\"."
  await activate(scope0, "Sharing EV-2.1");
  // THEN: "The heading named \"Sharing EV-2.1\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Sharing EV-2.1"));
  // THEN: "The region named \"Question\" is visible."
  const scope1 = named(page, "region", "Question");
  await visible(scope1);
  // WHEN: "The user activates \"Share\" in the region named \"Question\"."
  await button(scope1, "Share");
  // THEN: "The dialog named \"Share question\" is visible."
  const scope2 = named(page, "dialog", "Share question");
  await visible(scope2);
  // THEN: "Question link is a readonly input containing an absolute HTTP(S) permalink."
  await visible(field(scope2, "Question link"));
  await expect(field(scope2, "Question link")).toHaveAttribute("readonly", /.*/);
  const permalink0 = await field(scope2, "Question link").inputValue();
  expect(new URL(permalink0).protocol).toMatch(/^https?:$/);
  // WHEN: "The user activates \"Copy link\" in the dialog named \"Share question\"."
  await button(scope2, "Copy link");
  // THEN: "The status named \"Link copied\" is visible exactly once in the dialog named \"Share question\"."
  await visible(named(scope2, "status", "Link copied"));
  // THEN: "The browser clipboard contains exactly the displayed Question link."
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(permalink0);
  // WHEN: "The user activates \"Open question\" in the dialog named \"Share question\"."
  await activate(scope2, "Open question");
  // THEN: "The heading named \"Sharing EV-2.1\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Sharing EV-2.1"));
  // THEN: "The exact text \"How do I share this question?\" is visible exactly once in the region named \"Question\"."
  await text(scope1, "How do I share this question?");
  // THEN: "The exact text \"Score: 3\" is visible exactly once in the region named \"Question\"."
  await text(scope1, "Score: 3");
  // THEN: "The exact text \"0 answers\" is visible exactly once in the region named \"Question\"."
  await text(scope1, "0 answers");
  // THEN: "The exact text \"0 comments\" is visible exactly once in the region named \"Question\"."
  await text(scope1, "0 comments");
});

test("EV-2.2: Follow a question", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The account has no followed questions. Public question \"Follow EV-2.2\" has body \"Track this question.\" and is not followed by this account."
  // GIVEN: "The application provides the account \"stackoverflow.ev-2.2@example.com\" with password \"Benchmark123!\"; its isolated records and permissions are those stated in this scenario."
  // WHEN: "The user activates \"Login\" in the current page."
  await activate(page, "Login");
  // THEN: "The form named \"Login\" is visible."
  const scope0 = named(page, "form", "Login");
  await visible(scope0);
  // WHEN: "The user enters \"stackoverflow.ev-2.2@example.com\" in the \"Email\" field in the form named \"Login\"."
  await fill(scope0, "Email", "stackoverflow.ev-2.2@example.com");
  // WHEN: "The user enters \"Benchmark123!\" in the \"Password\" field in the form named \"Login\"."
  await fill(scope0, "Password", "Benchmark123!");
  // THEN: "The Password input masks the password."
  await expect(field(scope0, "Password")).toHaveAttribute("type", "password");
  // WHEN: "The user activates \"Login\" in the form named \"Login\"."
  await button(scope0, "Login");
  // THEN: "The status named \"Signed in\" is visible exactly once in the current page."
  await visible(named(page, "status", "Signed in"));
  // WHEN: "The user activates \"Questions\" in the current page."
  await activate(page, "Questions");
  // THEN: "The region named \"Question list\" is visible."
  const scope1 = named(page, "region", "Question list");
  await visible(scope1);
  // WHEN: "The user activates \"Follow EV-2.2\" in the region named \"Question list\"."
  await activate(scope1, "Follow EV-2.2");
  // THEN: "The heading named \"Follow EV-2.2\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Follow EV-2.2"));
  // THEN: "The region named \"Question\" is visible."
  const scope2 = named(page, "region", "Question");
  await visible(scope2);
  // THEN: "Follow is initially unpressed."
  await expect(named(scope2, "button", "Follow")).toHaveAttribute("aria-pressed", "false");
  // WHEN: "The user activates \"Follow\" in the region named \"Question\"."
  await button(scope2, "Follow");
  // THEN: "The button named \"Following\" is visible exactly once in the region named \"Question\"."
  await visible(named(scope2, "button", "Following"));
  // THEN: "Following is pressed."
  await expect(named(scope2, "button", "Following")).toHaveAttribute("aria-pressed", "true");
  // WHEN: "The user activates \"Profile\" in the current page."
  await activate(page, "Profile");
  // THEN: "The region named \"Followed questions\" is visible."
  const scope3 = named(page, "region", "Followed questions");
  await visible(scope3);
  // WHEN: "The user activates \"Follow EV-2.2\" in the region named \"Followed questions\"."
  await activate(scope3, "Follow EV-2.2");
  // THEN: "The button named \"Following\" is visible exactly once in the region named \"Question\"."
  await visible(named(scope2, "button", "Following"));
  // WHEN: "The user activates \"Following\" in the region named \"Question\"."
  await button(scope2, "Following");
  // THEN: "The button named \"Follow\" is visible exactly once in the region named \"Question\"."
  await visible(named(scope2, "button", "Follow"));
  // THEN: "Follow is unpressed."
  await expect(named(scope2, "button", "Follow")).toHaveAttribute("aria-pressed", "false");
  // WHEN: "The user activates \"Profile\" in the current page."
  await activate(page, "Profile");
  // THEN: "Follow EV-2.2 is absent from Followed questions."
  await expect(named(scope3, "link", "Follow EV-2.2").or(named(scope3, "button", "Follow EV-2.2"))).toHaveCount(0);
});

test("EV-3.1: Start a bounty", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The account has 200 reputation, no active bounty, and permission to start a bounty on public question \"Bounty EV-3.1\" (body \"Explain retry trade-offs.\", created 2030-09-01 09:00 UTC, not authored by this account, eligible for a bounty). The visible application date is 2030-10-01. The 50 reputation option is available."
  // GIVEN: "The application provides the account \"stackoverflow.ev-3.1@example.com\" with password \"Benchmark123!\"; its isolated records and permissions are those stated in this scenario."
  // WHEN: "The user activates \"Login\" in the current page."
  await activate(page, "Login");
  // THEN: "The form named \"Login\" is visible."
  const scope0 = named(page, "form", "Login");
  await visible(scope0);
  // WHEN: "The user enters \"stackoverflow.ev-3.1@example.com\" in the \"Email\" field in the form named \"Login\"."
  await fill(scope0, "Email", "stackoverflow.ev-3.1@example.com");
  // WHEN: "The user enters \"Benchmark123!\" in the \"Password\" field in the form named \"Login\"."
  await fill(scope0, "Password", "Benchmark123!");
  // THEN: "The Password input masks the password."
  await expect(field(scope0, "Password")).toHaveAttribute("type", "password");
  // WHEN: "The user activates \"Login\" in the form named \"Login\"."
  await button(scope0, "Login");
  // THEN: "The status named \"Signed in\" is visible exactly once in the current page."
  await visible(named(page, "status", "Signed in"));
  // WHEN: "The user activates \"Questions\" in the current page."
  await activate(page, "Questions");
  // THEN: "The region named \"Question list\" is visible."
  const scope1 = named(page, "region", "Question list");
  await visible(scope1);
  // WHEN: "The user activates \"Bounty EV-3.1\" in the region named \"Question list\"."
  await activate(scope1, "Bounty EV-3.1");
  // THEN: "The heading named \"Bounty EV-3.1\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Bounty EV-3.1"));
  // THEN: "The region named \"Question\" is visible."
  const scope2 = named(page, "region", "Question");
  await visible(scope2);
  // WHEN: "The user activates \"Start bounty\" in the region named \"Question\"."
  await button(scope2, "Start bounty");
  // THEN: "The dialog named \"Start bounty\" is visible."
  const scope3 = named(page, "dialog", "Start bounty");
  await visible(scope3);
  // WHEN: "The user selects \"50\" in the \"Reputation amount\" combobox in the dialog named \"Start bounty\"."
  await choose(scope3, "Reputation amount", "50");
  // WHEN: "The user enters \"Rewarding a clearer solution with concrete trade-offs.\" in the \"Bounty reason\" field in the dialog named \"Start bounty\"."
  await fill(scope3, "Bounty reason", "Rewarding a clearer solution with concrete trade-offs.");
  // WHEN: "The user activates \"Confirm bounty\" in the dialog named \"Start bounty\"."
  await button(scope3, "Confirm bounty");
  // THEN: "The region named \"Active bounty\" is visible."
  const scope4 = named(page, "region", "Active bounty");
  await visible(scope4);
  // THEN: "The exact text \"50 reputation\" is visible exactly once in the region named \"Active bounty\"."
  await text(scope4, "50 reputation");
  // THEN: "The exact text \"Rewarding a clearer solution with concrete trade-offs.\" is visible exactly once in the region named \"Active bounty\"."
  await text(scope4, "Rewarding a clearer solution with concrete trade-offs.");
  // THEN: "The heading named \"Bounty EV-3.1\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Bounty EV-3.1"));
  // THEN: "The exact text \"Explain retry trade-offs.\" is visible exactly once in the region named \"Question\"."
  await text(scope2, "Explain retry trade-offs.");
  // WHEN: "The user activates \"Profile\" in the current page."
  await activate(page, "Profile");
  // THEN: "The exact text \"Reputation: 150\" is visible exactly once in the current page."
  await text(page, "Reputation: 150");
});

test("EV-3.2: Flag a question", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The account has permission to flag public question \"Flag EV-3.2\", body \"An incomplete technical question.\", score 4, 0 answers, and 1 comment \"Please include an example.\" No flag from this account exists initially."
  // GIVEN: "The application provides the account \"stackoverflow.ev-3.2@example.com\" with password \"Benchmark123!\"; its isolated records and permissions are those stated in this scenario."
  // WHEN: "The user activates \"Login\" in the current page."
  await activate(page, "Login");
  // THEN: "The form named \"Login\" is visible."
  const scope0 = named(page, "form", "Login");
  await visible(scope0);
  // WHEN: "The user enters \"stackoverflow.ev-3.2@example.com\" in the \"Email\" field in the form named \"Login\"."
  await fill(scope0, "Email", "stackoverflow.ev-3.2@example.com");
  // WHEN: "The user enters \"Benchmark123!\" in the \"Password\" field in the form named \"Login\"."
  await fill(scope0, "Password", "Benchmark123!");
  // THEN: "The Password input masks the password."
  await expect(field(scope0, "Password")).toHaveAttribute("type", "password");
  // WHEN: "The user activates \"Login\" in the form named \"Login\"."
  await button(scope0, "Login");
  // THEN: "The status named \"Signed in\" is visible exactly once in the current page."
  await visible(named(page, "status", "Signed in"));
  // WHEN: "The user activates \"Questions\" in the current page."
  await activate(page, "Questions");
  // THEN: "The region named \"Question list\" is visible."
  const scope1 = named(page, "region", "Question list");
  await visible(scope1);
  // WHEN: "The user activates \"Flag EV-3.2\" in the region named \"Question list\"."
  await activate(scope1, "Flag EV-3.2");
  // THEN: "The heading named \"Flag EV-3.2\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Flag EV-3.2"));
  // THEN: "The region named \"Question\" is visible."
  const scope2 = named(page, "region", "Question");
  await visible(scope2);
  // WHEN: "The user activates \"Flag\" in the region named \"Question\"."
  await button(scope2, "Flag");
  // THEN: "The dialog named \"Flag question\" is visible."
  const scope3 = named(page, "dialog", "Flag question");
  await visible(scope3);
  // WHEN: "The user selects \"Needs details\" in the \"Reason\" combobox in the dialog named \"Flag question\"."
  await choose(scope3, "Reason", "Needs details");
  // WHEN: "The user activates \"Submit flag\" in the dialog named \"Flag question\"."
  await button(scope3, "Submit flag");
  // THEN: "The status named \"Flag recorded for moderator review\" is visible exactly once in the current page."
  await visible(named(page, "status", "Flag recorded for moderator review"));
  // THEN: "The heading named \"Flag EV-3.2\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Flag EV-3.2"));
  // THEN: "The exact text \"An incomplete technical question.\" is visible exactly once in the region named \"Question\"."
  await text(scope2, "An incomplete technical question.");
  // THEN: "The exact text \"Score: 4\" is visible exactly once in the region named \"Question\"."
  await text(scope2, "Score: 4");
  // THEN: "The exact text \"0 answers\" is visible exactly once in the region named \"Question\"."
  await text(scope2, "0 answers");
  // THEN: "The exact text \"1 comment\" is visible exactly once in the region named \"Question\"."
  await text(scope2, "1 comment");
  // THEN: "The exact text \"Please include an example.\" is visible exactly once in the current page."
  await text(page, "Please include an example.");
});
