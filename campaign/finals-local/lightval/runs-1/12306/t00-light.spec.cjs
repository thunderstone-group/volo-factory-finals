const { test, expect } = require('@playwright/test');
const { named, field, visible, activate, button, fill, choose, selected, checked, text, order } = require('./light-helpers.cjs');
test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.1: Search only high-speed trains from home", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The public schedule for Beijingnan to Shanghaihongqiao on 2030-10-08 contains exactly G531 (high-speed), D701 (high-speed), and T109 (conventional). The application calendar uses the visible benchmark date \"Today: 2030-10-01\", independent of the machine clock."
  // THEN: "The form named \"Ticket search\" is visible."
  const scope0 = named(page, "form", "Ticket search");
  await visible(scope0);
  // WHEN: "The user enters \"Beijingnan\" in the \"From\" field in the form named \"Ticket search\"."
  await fill(scope0, "From", "Beijingnan");
  // WHEN: "The user enters \"Shanghaihongqiao\" in the \"To\" field in the form named \"Ticket search\"."
  await fill(scope0, "To", "Shanghaihongqiao");
  // WHEN: "The user enters \"2030-10-08\" in the \"Date\" field in the form named \"Ticket search\"."
  await fill(scope0, "Date", "2030-10-08");
  // WHEN: "The user checks \"High-speed trains only\" in the form named \"Ticket search\"."
  await checked(scope0, "High-speed trains only", true);
  // WHEN: "The user activates \"Search\" in the form named \"Ticket search\"."
  await button(scope0, "Search");
  // THEN: "The region named \"Train results\" is visible."
  const scope1 = named(page, "region", "Train results");
  await visible(scope1);
  // THEN: "The \"High-speed trains only\" checkbox is checked in the current page."
  await expect(named(page, "checkbox", "High-speed trains only")).toBeChecked({ checked: true });
  // THEN: "The \"Trains\" list in the region named \"Train results\" contains exactly these entries in order: [\"G531\", \"D701\"]."
  await order(scope1, "Trains", ["G531", "D701"]);
  // WHEN: "The user unchecks \"High-speed trains only\" in the current page."
  await checked(page, "High-speed trains only", false);
  // WHEN: "The user activates \"Search\" in the current page."
  await button(page, "Search");
  // THEN: "The \"Trains\" list in the region named \"Train results\" contains exactly these entries in order: [\"G531\", \"D701\", \"T109\"]."
  await order(scope1, "Trains", ["G531", "D701", "T109"]);
});

test("EV-1.2: View public service-hours notice", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // THEN: "The region named \"Service hours\" is visible."
  const scope0 = named(page, "region", "Service hours");
  await visible(scope0);
  // THEN: "The exact text \"Information queries and ticket refunds: 24 hours daily.\" is visible exactly once in the region named \"Service hours\"."
  await text(scope0, "Information queries and ticket refunds: 24 hours daily.");
  // THEN: "The exact text \"Ticket sales and endorsements: 05:00-23:30 daily.\" is visible exactly once in the region named \"Service hours\"."
  await text(scope0, "Ticket sales and endorsements: 05:00-23:30 daily.");
  // THEN: "The form named \"Ticket search\" is visible."
  const scope1 = named(page, "form", "Ticket search");
  await visible(scope1);
  // WHEN: "The user enters \"Beijingnan\" in the \"From\" field in the form named \"Ticket search\"."
  await fill(scope1, "From", "Beijingnan");
  // THEN: "The \"From\" field in the form named \"Ticket search\" displays \"Beijingnan\"."
  await expect(field(scope1, "From")).toHaveValue("Beijingnan");
});

test("EV-2.1: Switch public site language", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The initial language is English and the visible calendar date is \"Today: 2030-10-01\". In Chinese mode the Home heading is U+9996 U+9875 and the Login control is U+767B U+5F55."
  // THEN: "The form named \"Ticket search\" is visible."
  const scope0 = named(page, "form", "Ticket search");
  await visible(scope0);
  // WHEN: "The user enters \"Beijingnan\" in the \"From\" field in the form named \"Ticket search\"."
  await fill(scope0, "From", "Beijingnan");
  // WHEN: "The user enters \"Shanghaihongqiao\" in the \"To\" field in the form named \"Ticket search\"."
  await fill(scope0, "To", "Shanghaihongqiao");
  // WHEN: "The user enters \"2030-10-09\" in the \"Date\" field in the form named \"Ticket search\"."
  await fill(scope0, "Date", "2030-10-09");
  // WHEN: "The user activates \"Language\" in the current page."
  await button(page, "Language");
  // WHEN: "The user activates \"Chinese\" in the current page."
  await button(page, "Chinese");
  // THEN: "The Chinese Home heading (U+9996 U+9875) and Login navigation control (U+767B U+5F55) are visible."
  await visible(named(page, "heading", "\u9996\u9875"));
  await visible(named(page, "link", "\u767b\u5f55").or(named(page, "button", "\u767b\u5f55")));
  // THEN: "The \"From\" field in the form named \"Ticket search\" displays \"Beijingnan\"."
  await expect(field(scope0, "From")).toHaveValue("Beijingnan");
  // THEN: "The \"To\" field in the form named \"Ticket search\" displays \"Shanghaihongqiao\"."
  await expect(field(scope0, "To")).toHaveValue("Shanghaihongqiao");
  // THEN: "The \"Date\" field in the form named \"Ticket search\" displays \"2030-10-09\"."
  await expect(field(scope0, "Date")).toHaveValue("2030-10-09");
  // WHEN: "The user activates \"Language\" in the current page."
  await button(page, "Language");
  // WHEN: "The user activates \"English\" in the current page."
  await button(page, "English");
  // THEN: "The heading named \"Home\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Home"));
  // THEN: "The \"Date\" field in the form named \"Ticket search\" displays \"2030-10-09\"."
  await expect(field(scope0, "Date")).toHaveValue("2030-10-09");
});

test("EV-2.2: Open public contact information", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // WHEN: "The user activates \"Contact us\" in the current page."
  await activate(page, "Contact us");
  // THEN: "The heading named \"Contact us\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Contact us"));
  // THEN: "The region named \"Customer service\" is visible."
  const scope0 = named(page, "region", "Customer service");
  await visible(scope0);
  // THEN: "The exact text \"Hotline: 12306\" is visible exactly once in the region named \"Customer service\"."
  await text(scope0, "Hotline: 12306");
  // THEN: "The exact text \"Support: 24 hours daily\" is visible exactly once in the region named \"Customer service\"."
  await text(scope0, "Support: 24 hours daily");
  // THEN: "The navigation named \"Global navigation\" is visible exactly once in the current page."
  await visible(named(page, "navigation", "Global navigation"));
  // WHEN: "The user activates \"Home\" in the current page."
  await activate(page, "Home");
  // THEN: "The heading named \"Home\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Home"));
});

test("EV-3.1: Expand train stop details from results", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The public schedule for Beijingnan to Shanghaihongqiao on 2030-10-10 contains exactly G531 (high-speed), D701 (high-speed), and T109 (conventional). The application calendar uses the visible benchmark date \"Today: 2030-10-01\", independent of the machine clock."
  // THEN: "The form named \"Ticket search\" is visible."
  const scope0 = named(page, "form", "Ticket search");
  await visible(scope0);
  // WHEN: "The user enters \"Beijingnan\" in the \"From\" field in the form named \"Ticket search\"."
  await fill(scope0, "From", "Beijingnan");
  // WHEN: "The user enters \"Shanghaihongqiao\" in the \"To\" field in the form named \"Ticket search\"."
  await fill(scope0, "To", "Shanghaihongqiao");
  // WHEN: "The user enters \"2030-10-10\" in the \"Date\" field in the form named \"Ticket search\"."
  await fill(scope0, "Date", "2030-10-10");
  // WHEN: "The user checks \"High-speed trains only\" in the form named \"Ticket search\"."
  await checked(scope0, "High-speed trains only", true);
  // WHEN: "The user activates \"Search\" in the form named \"Ticket search\"."
  await button(scope0, "Search");
  // THEN: "The region named \"Train results\" is visible."
  const scope1 = named(page, "region", "Train results");
  await visible(scope1);
  // GIVEN: "G531 has these ordered departure-time entries: Beijingnan 07:00; Cangzhouxi 07:52; Dezhoudong 08:20; Jinanxi 08:47; Tengzhoudong 09:31; Xuzhoudong 09:58; Suzhoudong 10:19."
  // THEN: "The \"Trains\" list in the region named \"Train results\" contains exactly these entries in order: [\"G531\", \"D701\"]."
  await order(scope1, "Trains", ["G531", "D701"]);
  // WHEN: "The user activates \"Show stops G531\" in the region named \"Train results\"."
  await button(scope1, "Show stops G531");
  // THEN: "The dialog named \"G531 stops\" is visible."
  const scope2 = named(page, "dialog", "G531 stops");
  await visible(scope2);
  // THEN: "The \"Stop timeline\" list in the dialog named \"G531 stops\" contains exactly these entries in order: [\"Beijingnan 07:00\", \"Cangzhouxi 07:52\", \"Dezhoudong 08:20\", \"Jinanxi 08:47\", \"Tengzhoudong 09:31\", \"Xuzhoudong 09:58\", \"Suzhoudong 10:19\"]."
  await order(scope2, "Stop timeline", ["Beijingnan 07:00", "Cangzhouxi 07:52", "Dezhoudong 08:20", "Jinanxi 08:47", "Tengzhoudong 09:31", "Xuzhoudong 09:58", "Suzhoudong 10:19"]);
  // WHEN: "The user activates \"Close\" in the dialog named \"G531 stops\"."
  await button(scope2, "Close");
  // THEN: "The dialog named \"G531 stops\" is absent in the current page."
  await expect(named(page, "dialog", "G531 stops")).toHaveCount(0);
  // THEN: "The \"From\" field in the current page displays \"Beijingnan\"."
  await expect(field(page, "From")).toHaveValue("Beijingnan");
  // THEN: "The \"To\" field in the current page displays \"Shanghaihongqiao\"."
  await expect(field(page, "To")).toHaveValue("Shanghaihongqiao");
  // THEN: "The \"Date\" field in the current page displays \"2030-10-10\"."
  await expect(field(page, "Date")).toHaveValue("2030-10-10");
  // THEN: "The \"High-speed trains only\" checkbox is checked in the current page."
  await expect(named(page, "checkbox", "High-speed trains only")).toBeChecked({ checked: true });
  // THEN: "The \"Trains\" list in the region named \"Train results\" contains exactly these entries in order: [\"G531\", \"D701\"]."
  await order(scope1, "Trains", ["G531", "D701"]);
});

test("EV-3.2: Navigate to later months in the date picker", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The visible calendar date is \"Today: 2030-10-01\". The initial two-month window is October 2030 and November 2030."
  // THEN: "The form named \"Ticket search\" is visible."
  const scope0 = named(page, "form", "Ticket search");
  await visible(scope0);
  // WHEN: "The user enters \"Beijingnan\" in the \"From\" field in the form named \"Ticket search\"."
  await fill(scope0, "From", "Beijingnan");
  // WHEN: "The user enters \"Shanghaihongqiao\" in the \"To\" field in the form named \"Ticket search\"."
  await fill(scope0, "To", "Shanghaihongqiao");
  // WHEN: "The user enters \"2030-10-11\" in the \"Date\" field in the form named \"Ticket search\"."
  await fill(scope0, "Date", "2030-10-11");
  // WHEN: "The user checks \"High-speed trains only\" in the form named \"Ticket search\"."
  await checked(scope0, "High-speed trains only", true);
  // WHEN: "The user activates \"Open calendar\" in the form named \"Ticket search\"."
  await button(scope0, "Open calendar");
  // THEN: "The dialog named \"Date picker\" is visible."
  const scope1 = named(page, "dialog", "Date picker");
  await visible(scope1);
  // THEN: "The \"Calendar months\" list in the dialog named \"Date picker\" contains exactly these entries in order: [\"October 2030\", \"November 2030\"]."
  await order(scope1, "Calendar months", ["October 2030", "November 2030"]);
  // WHEN: "The user activates \"Next month\" in the dialog named \"Date picker\"."
  await button(scope1, "Next month");
  // THEN: "The \"Calendar months\" list in the dialog named \"Date picker\" contains exactly these entries in order: [\"November 2030\", \"December 2030\"]."
  await order(scope1, "Calendar months", ["November 2030", "December 2030"]);
  // WHEN: "The user activates \"Previous month\" in the dialog named \"Date picker\"."
  await button(scope1, "Previous month");
  // THEN: "The \"Calendar months\" list in the dialog named \"Date picker\" contains exactly these entries in order: [\"October 2030\", \"November 2030\"]."
  await order(scope1, "Calendar months", ["October 2030", "November 2030"]);
  // WHEN: "The user activates \"Close\" in the dialog named \"Date picker\"."
  await button(scope1, "Close");
  // THEN: "The \"From\" field in the form named \"Ticket search\" displays \"Beijingnan\"."
  await expect(field(scope0, "From")).toHaveValue("Beijingnan");
  // THEN: "The \"To\" field in the form named \"Ticket search\" displays \"Shanghaihongqiao\"."
  await expect(field(scope0, "To")).toHaveValue("Shanghaihongqiao");
  // THEN: "The \"Date\" field in the form named \"Ticket search\" displays \"2030-10-11\"."
  await expect(field(scope0, "Date")).toHaveValue("2030-10-11");
  // THEN: "The \"High-speed trains only\" checkbox is checked in the form named \"Ticket search\"."
  await expect(named(scope0, "checkbox", "High-speed trains only")).toBeChecked({ checked: true });
});
