const { test, expect } = require('@playwright/test');
const { named, field, visible, activate, button, fill, choose, selected, checked, text, order } = require('./light-helpers.cjs');
test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.1: Open hotel search and choose a destination", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The application uses the visible benchmark calendar date \"Today: 2030-10-01\" independently of the machine clock. Hotels is a navigation link or button; the hotel search form initially has Rooms 1, Adults 2, Children 0, Hotel level Any and an empty Keyword. Check-in and Check-out accept YYYY-MM-DD through labelled date-entry inputs. Occupancy and level selectors expose combobox semantics."
  // WHEN: "The user activates \"Hotels\" in the current page."
  await activate(page, "Hotels");
  // THEN: "The form named \"Hotel search\" is visible."
  const scope0 = named(page, "form", "Hotel search");
  await visible(scope0);
  // WHEN: "The user enters \"Shanghai\" in the \"Destination\" field in the form named \"Hotel search\"."
  await fill(scope0, "Destination", "Shanghai");
  // THEN: "The \"Destination\" field in the form named \"Hotel search\" displays \"Shanghai\"."
  await expect(field(scope0, "Destination")).toHaveValue("Shanghai");
  // THEN: "The button named \"Search\" is visible exactly once in the form named \"Hotel search\"."
  await visible(named(scope0, "button", "Search"));
  // THEN: "Flights remains available as a link or button."
  await visible(named(page, "link", "Flights").or(named(page, "button", "Flights")));
  // THEN: "The field labelled \"Check-in\" is visible in Hotel search."
  await visible(field(scope0, "Check-in"));
  // THEN: "The field labelled \"Check-out\" is visible in Hotel search."
  await visible(field(scope0, "Check-out"));
  // THEN: "The field labelled \"Keyword\" is visible in Hotel search."
  await visible(field(scope0, "Keyword"));
  // THEN: "The combobox named \"Rooms\" is visible exactly once in the form named \"Hotel search\"."
  await visible(named(scope0, "combobox", "Rooms"));
  // THEN: "The combobox named \"Adults\" is visible exactly once in the form named \"Hotel search\"."
  await visible(named(scope0, "combobox", "Adults"));
  // THEN: "The combobox named \"Children\" is visible exactly once in the form named \"Hotel search\"."
  await visible(named(scope0, "combobox", "Children"));
  // THEN: "The combobox named \"Hotel level\" is visible exactly once in the form named \"Hotel search\"."
  await visible(named(scope0, "combobox", "Hotel level"));
});

test("EV-1.2: Select a valid hotel stay", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The application uses the visible benchmark calendar date \"Today: 2030-10-01\" independently of the machine clock. Hotels is a navigation link or button; the hotel search form initially has Rooms 1, Adults 2, Children 0, Hotel level Any and an empty Keyword. Check-in and Check-out accept YYYY-MM-DD through labelled date-entry inputs. Occupancy and level selectors expose combobox semantics."
  // WHEN: "The user activates \"Hotels\" in the current page."
  await activate(page, "Hotels");
  // THEN: "The form named \"Hotel search\" is visible."
  const scope0 = named(page, "form", "Hotel search");
  await visible(scope0);
  // WHEN: "The user enters \"Shanghai\" in the \"Destination\" field in the form named \"Hotel search\"."
  await fill(scope0, "Destination", "Shanghai");
  // WHEN: "The user enters \"2030-10-08\" in the \"Check-in\" field in the form named \"Hotel search\"."
  await fill(scope0, "Check-in", "2030-10-08");
  // WHEN: "The user enters \"2030-10-10\" in the \"Check-out\" field in the form named \"Hotel search\"."
  await fill(scope0, "Check-out", "2030-10-10");
  // THEN: "The \"Check-in\" field in the form named \"Hotel search\" displays \"2030-10-08\"."
  await expect(field(scope0, "Check-in")).toHaveValue("2030-10-08");
  // THEN: "The \"Check-out\" field in the form named \"Hotel search\" displays \"2030-10-10\"."
  await expect(field(scope0, "Check-out")).toHaveValue("2030-10-10");
  // THEN: "The status named \"2 nights\" is visible exactly once in the form named \"Hotel search\"."
  await visible(named(scope0, "status", "2 nights"));
  // WHEN: "The user enters \"2030-10-08\" in the \"Check-out\" field in the form named \"Hotel search\"."
  await fill(scope0, "Check-out", "2030-10-08");
  // WHEN: "The user activates \"Search\" in the form named \"Hotel search\"."
  await button(scope0, "Search");
  // THEN: "The alert named \"Check-out must be after check-in\" is visible exactly once in the current page."
  await visible(named(page, "alert", "Check-out must be after check-in"));
  // THEN: "The region named \"Hotel results\" is absent in the current page."
  await expect(named(page, "region", "Hotel results")).toHaveCount(0);
  // WHEN: "The user enters \"2030-09-30\" in the \"Check-in\" field in the form named \"Hotel search\"."
  await fill(scope0, "Check-in", "2030-09-30");
  // WHEN: "The user enters \"2030-10-10\" in the \"Check-out\" field in the form named \"Hotel search\"."
  await fill(scope0, "Check-out", "2030-10-10");
  // WHEN: "The user activates \"Search\" in the form named \"Hotel search\"."
  await button(scope0, "Search");
  // THEN: "The alert named \"Check-in cannot be before today\" is visible exactly once in the current page."
  await visible(named(page, "alert", "Check-in cannot be before today"));
  // THEN: "The region named \"Hotel results\" is absent in the current page."
  await expect(named(page, "region", "Hotel results")).toHaveCount(0);
});

test("EV-1.3: Configure hotel-specific criteria", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The application uses the visible benchmark calendar date \"Today: 2030-10-01\" independently of the machine clock. Hotels is a navigation link or button; the hotel search form initially has Rooms 1, Adults 2, Children 0, Hotel level Any and an empty Keyword. Check-in and Check-out accept YYYY-MM-DD through labelled date-entry inputs. Occupancy and level selectors expose combobox semantics."
  // WHEN: "The user activates \"Hotels\" in the current page."
  await activate(page, "Hotels");
  // THEN: "The form named \"Hotel search\" is visible."
  const scope0 = named(page, "form", "Hotel search");
  await visible(scope0);
  // WHEN: "The user selects \"2\" in the \"Rooms\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Rooms", "2");
  // WHEN: "The user selects \"3\" in the \"Adults\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Adults", "3");
  // WHEN: "The user selects \"0\" in the \"Children\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Children", "0");
  // WHEN: "The user selects \"Luxury\" in the \"Hotel level\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Hotel level", "Luxury");
  // WHEN: "The user enters \"Bund\" in the \"Keyword\" field in the form named \"Hotel search\"."
  await fill(scope0, "Keyword", "Bund");
  // THEN: "The status named \"2 rooms, 3 adults, 0 children; Luxury\" is visible exactly once in the form named \"Hotel search\"."
  await visible(named(scope0, "status", "2 rooms, 3 adults, 0 children; Luxury"));
  // THEN: "The \"Keyword\" field in the form named \"Hotel search\" displays \"Bund\"."
  await expect(field(scope0, "Keyword")).toHaveValue("Bund");
});

test("EV-2.1: View matching hotel results", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The application uses the visible benchmark calendar date \"Today: 2030-10-01\" independently of the machine clock. Hotels is a navigation link or button; the hotel search form initially has Rooms 1, Adults 2, Children 0, Hotel level Any and an empty Keyword. Check-in and Check-out accept YYYY-MM-DD through labelled date-entry inputs. Occupancy and level selectors expose combobox semantics."
  // WHEN: "The user activates \"Hotels\" in the current page."
  await activate(page, "Hotels");
  // THEN: "The form named \"Hotel search\" is visible."
  const scope0 = named(page, "form", "Hotel search");
  await visible(scope0);
  // GIVEN: "For Shanghai, check-in 2030-10-08, check-out 2030-10-10, one room, two adults and zero children, exactly three hotels are available: \"Bund Garden Hotel\" at \"88 Bund Road, Shanghai\", 5 stars, review score 9.2, CNY 600 per room per night; \"Riverside Hotel\" at \"20 River Road, Shanghai\", 4 stars, review score 8.6, CNY 400 per room per night; \"City Budget Inn\" at \"10 Station Road, Shanghai\", 3 stars, review score 7.8, CNY 200 per room per night. Each card is a region named after the hotel with one image named after the hotel and an Open <hotel name> navigation control. Hotel names in the Hotel names list follow the result-card order. Bund Garden Hotel has Wi-Fi and Breakfast, two gallery images named Bund Garden Hotel exterior and Bund Garden Hotel lobby, and an available Deluxe King plan: King bed, Sleeps 2, Breakfast included, Free cancellation, CNY 600 per room per night. This two-night, one-room offer totals CNY 1200 including all taxes and fees. Booking availability is independently provisioned for this scenario; confirmation does not consume another scenario's inventory."
  // WHEN: "The user enters \"Shanghai\" in the \"Destination\" field in the form named \"Hotel search\"."
  await fill(scope0, "Destination", "Shanghai");
  // WHEN: "The user enters \"2030-10-08\" in the \"Check-in\" field in the form named \"Hotel search\"."
  await fill(scope0, "Check-in", "2030-10-08");
  // WHEN: "The user enters \"2030-10-10\" in the \"Check-out\" field in the form named \"Hotel search\"."
  await fill(scope0, "Check-out", "2030-10-10");
  // WHEN: "The user selects \"1\" in the \"Rooms\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Rooms", "1");
  // WHEN: "The user selects \"2\" in the \"Adults\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Adults", "2");
  // WHEN: "The user selects \"0\" in the \"Children\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Children", "0");
  // WHEN: "The user selects \"Any\" in the \"Hotel level\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Hotel level", "Any");
  // WHEN: "The user enters \"\" in the \"Keyword\" field in the form named \"Hotel search\"."
  await fill(scope0, "Keyword", "");
  // WHEN: "The user activates \"Search\" in the form named \"Hotel search\"."
  await button(scope0, "Search");
  // THEN: "The region named \"Hotel results\" is visible."
  const scope1 = named(page, "region", "Hotel results");
  await visible(scope1);
  // THEN: "The region named \"Search summary\" is visible."
  const scope2 = named(page, "region", "Search summary");
  await visible(scope2);
  // THEN: "The exact text \"Shanghai\" is visible exactly once in the region named \"Search summary\"."
  await text(scope2, "Shanghai");
  // THEN: "The exact text \"2030-10-08 to 2030-10-10\" is visible exactly once in the region named \"Search summary\"."
  await text(scope2, "2030-10-08 to 2030-10-10");
  // THEN: "The \"Hotel names\" list in the region named \"Hotel results\" contains exactly these entries in order: [\"Bund Garden Hotel\", \"Riverside Hotel\", \"City Budget Inn\"]."
  await order(scope1, "Hotel names", ["Bund Garden Hotel", "Riverside Hotel", "City Budget Inn"]);
  // THEN: "The region named \"Bund Garden Hotel\" is visible."
  const scope3 = named(page, "region", "Bund Garden Hotel");
  await visible(scope3);
  // THEN: "The img named \"Bund Garden Hotel\" is visible exactly once in the region named \"Bund Garden Hotel\"."
  await visible(named(scope3, "img", "Bund Garden Hotel"));
  // THEN: "The exact text \"88 Bund Road, Shanghai\" is visible exactly once in the region named \"Bund Garden Hotel\"."
  await text(scope3, "88 Bund Road, Shanghai");
  // THEN: "The exact text \"5 stars\" is visible exactly once in the region named \"Bund Garden Hotel\"."
  await text(scope3, "5 stars");
  // THEN: "The exact text \"Review score: 9.2\" is visible exactly once in the region named \"Bund Garden Hotel\"."
  await text(scope3, "Review score: 9.2");
  // THEN: "The exact text \"From CNY 600 per night\" is visible exactly once in the region named \"Bund Garden Hotel\"."
  await text(scope3, "From CNY 600 per night");
  // THEN: "The region named \"Riverside Hotel\" is visible."
  const scope4 = named(page, "region", "Riverside Hotel");
  await visible(scope4);
  // THEN: "The img named \"Riverside Hotel\" is visible exactly once in the region named \"Riverside Hotel\"."
  await visible(named(scope4, "img", "Riverside Hotel"));
  // THEN: "The exact text \"20 River Road, Shanghai\" is visible exactly once in the region named \"Riverside Hotel\"."
  await text(scope4, "20 River Road, Shanghai");
  // THEN: "The exact text \"4 stars\" is visible exactly once in the region named \"Riverside Hotel\"."
  await text(scope4, "4 stars");
  // THEN: "The exact text \"Review score: 8.6\" is visible exactly once in the region named \"Riverside Hotel\"."
  await text(scope4, "Review score: 8.6");
  // THEN: "The exact text \"From CNY 400 per night\" is visible exactly once in the region named \"Riverside Hotel\"."
  await text(scope4, "From CNY 400 per night");
  // THEN: "The region named \"City Budget Inn\" is visible."
  const scope5 = named(page, "region", "City Budget Inn");
  await visible(scope5);
  // THEN: "The img named \"City Budget Inn\" is visible exactly once in the region named \"City Budget Inn\"."
  await visible(named(scope5, "img", "City Budget Inn"));
  // THEN: "The exact text \"10 Station Road, Shanghai\" is visible exactly once in the region named \"City Budget Inn\"."
  await text(scope5, "10 Station Road, Shanghai");
  // THEN: "The exact text \"3 stars\" is visible exactly once in the region named \"City Budget Inn\"."
  await text(scope5, "3 stars");
  // THEN: "The exact text \"Review score: 7.8\" is visible exactly once in the region named \"City Budget Inn\"."
  await text(scope5, "Review score: 7.8");
  // THEN: "The exact text \"From CNY 200 per night\" is visible exactly once in the region named \"City Budget Inn\"."
  await text(scope5, "From CNY 200 per night");
});

test("EV-2.2: Filter and sort hotel results", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The application uses the visible benchmark calendar date \"Today: 2030-10-01\" independently of the machine clock. Hotels is a navigation link or button; the hotel search form initially has Rooms 1, Adults 2, Children 0, Hotel level Any and an empty Keyword. Check-in and Check-out accept YYYY-MM-DD through labelled date-entry inputs. Occupancy and level selectors expose combobox semantics."
  // WHEN: "The user activates \"Hotels\" in the current page."
  await activate(page, "Hotels");
  // THEN: "The form named \"Hotel search\" is visible."
  const scope0 = named(page, "form", "Hotel search");
  await visible(scope0);
  // GIVEN: "For Shanghai, check-in 2030-10-08, check-out 2030-10-10, one room, two adults and zero children, exactly three hotels are available: \"Bund Garden Hotel\" at \"88 Bund Road, Shanghai\", 5 stars, review score 9.2, CNY 600 per room per night; \"Riverside Hotel\" at \"20 River Road, Shanghai\", 4 stars, review score 8.6, CNY 400 per room per night; \"City Budget Inn\" at \"10 Station Road, Shanghai\", 3 stars, review score 7.8, CNY 200 per room per night. Each card is a region named after the hotel with one image named after the hotel and an Open <hotel name> navigation control. Hotel names in the Hotel names list follow the result-card order. Bund Garden Hotel has Wi-Fi and Breakfast, two gallery images named Bund Garden Hotel exterior and Bund Garden Hotel lobby, and an available Deluxe King plan: King bed, Sleeps 2, Breakfast included, Free cancellation, CNY 600 per room per night. This two-night, one-room offer totals CNY 1200 including all taxes and fees. Booking availability is independently provisioned for this scenario; confirmation does not consume another scenario's inventory."
  // WHEN: "The user enters \"Shanghai\" in the \"Destination\" field in the form named \"Hotel search\"."
  await fill(scope0, "Destination", "Shanghai");
  // WHEN: "The user enters \"2030-10-08\" in the \"Check-in\" field in the form named \"Hotel search\"."
  await fill(scope0, "Check-in", "2030-10-08");
  // WHEN: "The user enters \"2030-10-10\" in the \"Check-out\" field in the form named \"Hotel search\"."
  await fill(scope0, "Check-out", "2030-10-10");
  // WHEN: "The user selects \"1\" in the \"Rooms\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Rooms", "1");
  // WHEN: "The user selects \"2\" in the \"Adults\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Adults", "2");
  // WHEN: "The user selects \"0\" in the \"Children\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Children", "0");
  // WHEN: "The user selects \"Any\" in the \"Hotel level\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Hotel level", "Any");
  // WHEN: "The user enters \"\" in the \"Keyword\" field in the form named \"Hotel search\"."
  await fill(scope0, "Keyword", "");
  // WHEN: "The user activates \"Search\" in the form named \"Hotel search\"."
  await button(scope0, "Search");
  // THEN: "The region named \"Hotel results\" is visible."
  const scope1 = named(page, "region", "Hotel results");
  await visible(scope1);
  // THEN: "The form named \"Hotel filters\" is visible."
  const scope2 = named(page, "form", "Hotel filters");
  await visible(scope2);
  // WHEN: "The user checks \"4 stars\" in the form named \"Hotel filters\"."
  await checked(scope2, "4 stars", true);
  // WHEN: "The user checks \"5 stars\" in the form named \"Hotel filters\"."
  await checked(scope2, "5 stars", true);
  // WHEN: "The user enters \"300\" in the \"Minimum price\" field in the form named \"Hotel filters\"."
  await fill(scope2, "Minimum price", "300");
  // WHEN: "The user enters \"700\" in the \"Maximum price\" field in the form named \"Hotel filters\"."
  await fill(scope2, "Maximum price", "700");
  // WHEN: "The user enters \"Hotel\" in the \"Keyword\" field in the form named \"Hotel filters\"."
  await fill(scope2, "Keyword", "Hotel");
  // WHEN: "The user activates \"Apply filters\" in the form named \"Hotel filters\"."
  await button(scope2, "Apply filters");
  // WHEN: "The user selects \"Price low to high\" in the \"Sort\" combobox in the current page."
  await choose(page, "Sort", "Price low to high");
  // THEN: "The \"Hotel names\" list in the region named \"Hotel results\" contains exactly these entries in order: [\"Riverside Hotel\", \"Bund Garden Hotel\"]."
  await order(scope1, "Hotel names", ["Riverside Hotel", "Bund Garden Hotel"]);
  // THEN: "The region named \"Active filters\" is visible."
  const scope3 = named(page, "region", "Active filters");
  await visible(scope3);
  // THEN: "The exact text \"4 stars\" is visible exactly once in the region named \"Active filters\"."
  await text(scope3, "4 stars");
  // THEN: "The exact text \"5 stars\" is visible exactly once in the region named \"Active filters\"."
  await text(scope3, "5 stars");
  // THEN: "The exact text \"CNY 300-700\" is visible exactly once in the region named \"Active filters\"."
  await text(scope3, "CNY 300-700");
  // THEN: "The exact text \"Hotel\" is visible exactly once in the region named \"Active filters\"."
  await text(scope3, "Hotel");
  // WHEN: "The user activates \"Remove 4 stars\" in the region named \"Active filters\"."
  await button(scope3, "Remove 4 stars");
  // THEN: "The \"Hotel names\" list in the region named \"Hotel results\" contains exactly these entries in order: [\"Bund Garden Hotel\"]."
  await order(scope1, "Hotel names", ["Bund Garden Hotel"]);
  // WHEN: "The user activates \"Clear all\" in the region named \"Active filters\"."
  await button(scope3, "Clear all");
  // THEN: "The \"Hotel names\" list in the region named \"Hotel results\" contains exactly these entries in order: [\"City Budget Inn\", \"Riverside Hotel\", \"Bund Garden Hotel\"]."
  await order(scope1, "Hotel names", ["City Budget Inn", "Riverside Hotel", "Bund Garden Hotel"]);
  // THEN: "The region named \"Search summary\" is visible."
  const scope4 = named(page, "region", "Search summary");
  await visible(scope4);
  // THEN: "The exact text \"Shanghai\" is visible exactly once in the region named \"Search summary\"."
  await text(scope4, "Shanghai");
  // THEN: "The exact text \"2030-10-08 to 2030-10-10\" is visible exactly once in the region named \"Search summary\"."
  await text(scope4, "2030-10-08 to 2030-10-10");
});

test("EV-3.1: Open hotel details", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The application uses the visible benchmark calendar date \"Today: 2030-10-01\" independently of the machine clock. Hotels is a navigation link or button; the hotel search form initially has Rooms 1, Adults 2, Children 0, Hotel level Any and an empty Keyword. Check-in and Check-out accept YYYY-MM-DD through labelled date-entry inputs. Occupancy and level selectors expose combobox semantics."
  // WHEN: "The user activates \"Hotels\" in the current page."
  await activate(page, "Hotels");
  // THEN: "The form named \"Hotel search\" is visible."
  const scope0 = named(page, "form", "Hotel search");
  await visible(scope0);
  // GIVEN: "For Shanghai, check-in 2030-10-08, check-out 2030-10-10, one room, two adults and zero children, exactly three hotels are available: \"Bund Garden Hotel\" at \"88 Bund Road, Shanghai\", 5 stars, review score 9.2, CNY 600 per room per night; \"Riverside Hotel\" at \"20 River Road, Shanghai\", 4 stars, review score 8.6, CNY 400 per room per night; \"City Budget Inn\" at \"10 Station Road, Shanghai\", 3 stars, review score 7.8, CNY 200 per room per night. Each card is a region named after the hotel with one image named after the hotel and an Open <hotel name> navigation control. Hotel names in the Hotel names list follow the result-card order. Bund Garden Hotel has Wi-Fi and Breakfast, two gallery images named Bund Garden Hotel exterior and Bund Garden Hotel lobby, and an available Deluxe King plan: King bed, Sleeps 2, Breakfast included, Free cancellation, CNY 600 per room per night. This two-night, one-room offer totals CNY 1200 including all taxes and fees. Booking availability is independently provisioned for this scenario; confirmation does not consume another scenario's inventory."
  // WHEN: "The user enters \"Shanghai\" in the \"Destination\" field in the form named \"Hotel search\"."
  await fill(scope0, "Destination", "Shanghai");
  // WHEN: "The user enters \"2030-10-08\" in the \"Check-in\" field in the form named \"Hotel search\"."
  await fill(scope0, "Check-in", "2030-10-08");
  // WHEN: "The user enters \"2030-10-10\" in the \"Check-out\" field in the form named \"Hotel search\"."
  await fill(scope0, "Check-out", "2030-10-10");
  // WHEN: "The user selects \"1\" in the \"Rooms\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Rooms", "1");
  // WHEN: "The user selects \"2\" in the \"Adults\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Adults", "2");
  // WHEN: "The user selects \"0\" in the \"Children\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Children", "0");
  // WHEN: "The user selects \"Any\" in the \"Hotel level\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Hotel level", "Any");
  // WHEN: "The user enters \"\" in the \"Keyword\" field in the form named \"Hotel search\"."
  await fill(scope0, "Keyword", "");
  // WHEN: "The user activates \"Search\" in the form named \"Hotel search\"."
  await button(scope0, "Search");
  // THEN: "The region named \"Hotel results\" is visible."
  const scope1 = named(page, "region", "Hotel results");
  await visible(scope1);
  // WHEN: "The user activates \"Open Bund Garden Hotel\" in the region named \"Hotel results\"."
  await activate(scope1, "Open Bund Garden Hotel");
  // THEN: "The heading named \"Bund Garden Hotel\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Bund Garden Hotel"));
  // THEN: "The region named \"Hotel information\" is visible."
  const scope2 = named(page, "region", "Hotel information");
  await visible(scope2);
  // THEN: "The exact text \"88 Bund Road, Shanghai\" is visible exactly once in the region named \"Hotel information\"."
  await text(scope2, "88 Bund Road, Shanghai");
  // THEN: "The exact text \"5 stars\" is visible exactly once in the region named \"Hotel information\"."
  await text(scope2, "5 stars");
  // THEN: "The exact text \"Review score: 9.2\" is visible exactly once in the region named \"Hotel information\"."
  await text(scope2, "Review score: 9.2");
  // THEN: "The exact text \"Wi-Fi\" is visible exactly once in the region named \"Hotel information\"."
  await text(scope2, "Wi-Fi");
  // THEN: "The exact text \"Breakfast\" is visible exactly once in the region named \"Hotel information\"."
  await text(scope2, "Breakfast");
  // THEN: "The region named \"Hotel gallery\" is visible."
  const scope3 = named(page, "region", "Hotel gallery");
  await visible(scope3);
  // THEN: "The img named \"Bund Garden Hotel exterior\" is visible exactly once in the region named \"Hotel gallery\"."
  await visible(named(scope3, "img", "Bund Garden Hotel exterior"));
  // THEN: "The img named \"Bund Garden Hotel lobby\" is visible exactly once in the region named \"Hotel gallery\"."
  await visible(named(scope3, "img", "Bund Garden Hotel lobby"));
  // THEN: "The region named \"Stay criteria\" is visible."
  const scope4 = named(page, "region", "Stay criteria");
  await visible(scope4);
  // THEN: "The exact text \"2030-10-08 to 2030-10-10\" is visible exactly once in the region named \"Stay criteria\"."
  await text(scope4, "2030-10-08 to 2030-10-10");
  // THEN: "The exact text \"1 room, 2 adults, 0 children\" is visible exactly once in the region named \"Stay criteria\"."
  await text(scope4, "1 room, 2 adults, 0 children");
});

test("EV-3.2: Select an available room plan", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The application uses the visible benchmark calendar date \"Today: 2030-10-01\" independently of the machine clock. Hotels is a navigation link or button; the hotel search form initially has Rooms 1, Adults 2, Children 0, Hotel level Any and an empty Keyword. Check-in and Check-out accept YYYY-MM-DD through labelled date-entry inputs. Occupancy and level selectors expose combobox semantics."
  // WHEN: "The user activates \"Hotels\" in the current page."
  await activate(page, "Hotels");
  // THEN: "The form named \"Hotel search\" is visible."
  const scope0 = named(page, "form", "Hotel search");
  await visible(scope0);
  // GIVEN: "For Shanghai, check-in 2030-10-08, check-out 2030-10-10, one room, two adults and zero children, exactly three hotels are available: \"Bund Garden Hotel\" at \"88 Bund Road, Shanghai\", 5 stars, review score 9.2, CNY 600 per room per night; \"Riverside Hotel\" at \"20 River Road, Shanghai\", 4 stars, review score 8.6, CNY 400 per room per night; \"City Budget Inn\" at \"10 Station Road, Shanghai\", 3 stars, review score 7.8, CNY 200 per room per night. Each card is a region named after the hotel with one image named after the hotel and an Open <hotel name> navigation control. Hotel names in the Hotel names list follow the result-card order. Bund Garden Hotel has Wi-Fi and Breakfast, two gallery images named Bund Garden Hotel exterior and Bund Garden Hotel lobby, and an available Deluxe King plan: King bed, Sleeps 2, Breakfast included, Free cancellation, CNY 600 per room per night. This two-night, one-room offer totals CNY 1200 including all taxes and fees. Booking availability is independently provisioned for this scenario; confirmation does not consume another scenario's inventory."
  // WHEN: "The user enters \"Shanghai\" in the \"Destination\" field in the form named \"Hotel search\"."
  await fill(scope0, "Destination", "Shanghai");
  // WHEN: "The user enters \"2030-10-08\" in the \"Check-in\" field in the form named \"Hotel search\"."
  await fill(scope0, "Check-in", "2030-10-08");
  // WHEN: "The user enters \"2030-10-10\" in the \"Check-out\" field in the form named \"Hotel search\"."
  await fill(scope0, "Check-out", "2030-10-10");
  // WHEN: "The user selects \"1\" in the \"Rooms\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Rooms", "1");
  // WHEN: "The user selects \"2\" in the \"Adults\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Adults", "2");
  // WHEN: "The user selects \"0\" in the \"Children\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Children", "0");
  // WHEN: "The user selects \"Any\" in the \"Hotel level\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Hotel level", "Any");
  // WHEN: "The user enters \"\" in the \"Keyword\" field in the form named \"Hotel search\"."
  await fill(scope0, "Keyword", "");
  // WHEN: "The user activates \"Search\" in the form named \"Hotel search\"."
  await button(scope0, "Search");
  // THEN: "The region named \"Hotel results\" is visible."
  const scope1 = named(page, "region", "Hotel results");
  await visible(scope1);
  // WHEN: "The user activates \"Open Bund Garden Hotel\" in the region named \"Hotel results\"."
  await activate(scope1, "Open Bund Garden Hotel");
  // THEN: "The heading named \"Bund Garden Hotel\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Bund Garden Hotel"));
  // THEN: "The region named \"Deluxe King\" is visible."
  const scope2 = named(page, "region", "Deluxe King");
  await visible(scope2);
  // THEN: "The exact text \"King bed\" is visible exactly once in the region named \"Deluxe King\"."
  await text(scope2, "King bed");
  // THEN: "The exact text \"Sleeps 2\" is visible exactly once in the region named \"Deluxe King\"."
  await text(scope2, "Sleeps 2");
  // THEN: "The exact text \"Breakfast included\" is visible exactly once in the region named \"Deluxe King\"."
  await text(scope2, "Breakfast included");
  // THEN: "The exact text \"Free cancellation\" is visible exactly once in the region named \"Deluxe King\"."
  await text(scope2, "Free cancellation");
  // THEN: "The exact text \"CNY 600 per room per night\" is visible exactly once in the region named \"Deluxe King\"."
  await text(scope2, "CNY 600 per room per night");
  // WHEN: "The user activates \"Book\" in the region named \"Deluxe King\"."
  await button(scope2, "Book");
  // THEN: "The heading named \"Hotel booking\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Hotel booking"));
  // THEN: "The region named \"Booking summary\" is visible."
  const scope3 = named(page, "region", "Booking summary");
  await visible(scope3);
  // THEN: "The exact text \"Bund Garden Hotel\" is visible exactly once in the region named \"Booking summary\"."
  await text(scope3, "Bund Garden Hotel");
  // THEN: "The exact text \"2030-10-08 to 2030-10-10\" is visible exactly once in the region named \"Booking summary\"."
  await text(scope3, "2030-10-08 to 2030-10-10");
  // THEN: "The exact text \"1 room, 2 adults, 0 children\" is visible exactly once in the region named \"Booking summary\"."
  await text(scope3, "1 room, 2 adults, 0 children");
  // THEN: "The exact text \"Deluxe King\" is visible exactly once in the region named \"Booking summary\"."
  await text(scope3, "Deluxe King");
  // THEN: "The exact text \"Total: CNY 1200\" is visible exactly once in the region named \"Booking summary\"."
  await text(scope3, "Total: CNY 1200");
});

test("EV-4.1: Block an incomplete hotel order", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The application uses the visible benchmark calendar date \"Today: 2030-10-01\" independently of the machine clock. Hotels is a navigation link or button; the hotel search form initially has Rooms 1, Adults 2, Children 0, Hotel level Any and an empty Keyword. Check-in and Check-out accept YYYY-MM-DD through labelled date-entry inputs. Occupancy and level selectors expose combobox semantics."
  // WHEN: "The user activates \"Hotels\" in the current page."
  await activate(page, "Hotels");
  // THEN: "The form named \"Hotel search\" is visible."
  const scope0 = named(page, "form", "Hotel search");
  await visible(scope0);
  // GIVEN: "For Shanghai, check-in 2030-10-08, check-out 2030-10-10, one room, two adults and zero children, exactly three hotels are available: \"Bund Garden Hotel\" at \"88 Bund Road, Shanghai\", 5 stars, review score 9.2, CNY 600 per room per night; \"Riverside Hotel\" at \"20 River Road, Shanghai\", 4 stars, review score 8.6, CNY 400 per room per night; \"City Budget Inn\" at \"10 Station Road, Shanghai\", 3 stars, review score 7.8, CNY 200 per room per night. Each card is a region named after the hotel with one image named after the hotel and an Open <hotel name> navigation control. Hotel names in the Hotel names list follow the result-card order. Bund Garden Hotel has Wi-Fi and Breakfast, two gallery images named Bund Garden Hotel exterior and Bund Garden Hotel lobby, and an available Deluxe King plan: King bed, Sleeps 2, Breakfast included, Free cancellation, CNY 600 per room per night. This two-night, one-room offer totals CNY 1200 including all taxes and fees. Booking availability is independently provisioned for this scenario; confirmation does not consume another scenario's inventory."
  // WHEN: "The user enters \"Shanghai\" in the \"Destination\" field in the form named \"Hotel search\"."
  await fill(scope0, "Destination", "Shanghai");
  // WHEN: "The user enters \"2030-10-08\" in the \"Check-in\" field in the form named \"Hotel search\"."
  await fill(scope0, "Check-in", "2030-10-08");
  // WHEN: "The user enters \"2030-10-10\" in the \"Check-out\" field in the form named \"Hotel search\"."
  await fill(scope0, "Check-out", "2030-10-10");
  // WHEN: "The user selects \"1\" in the \"Rooms\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Rooms", "1");
  // WHEN: "The user selects \"2\" in the \"Adults\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Adults", "2");
  // WHEN: "The user selects \"0\" in the \"Children\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Children", "0");
  // WHEN: "The user selects \"Any\" in the \"Hotel level\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Hotel level", "Any");
  // WHEN: "The user enters \"\" in the \"Keyword\" field in the form named \"Hotel search\"."
  await fill(scope0, "Keyword", "");
  // WHEN: "The user activates \"Search\" in the form named \"Hotel search\"."
  await button(scope0, "Search");
  // THEN: "The region named \"Hotel results\" is visible."
  const scope1 = named(page, "region", "Hotel results");
  await visible(scope1);
  // WHEN: "The user activates \"Open Bund Garden Hotel\" in the region named \"Hotel results\"."
  await activate(scope1, "Open Bund Garden Hotel");
  // THEN: "The heading named \"Bund Garden Hotel\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Bund Garden Hotel"));
  // THEN: "The region named \"Deluxe King\" is visible."
  const scope2 = named(page, "region", "Deluxe King");
  await visible(scope2);
  // WHEN: "The user activates \"Book\" in the region named \"Deluxe King\"."
  await button(scope2, "Book");
  // THEN: "The heading named \"Hotel booking\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Hotel booking"));
  // THEN: "The region named \"Booking summary\" is visible."
  const scope3 = named(page, "region", "Booking summary");
  await visible(scope3);
  // WHEN: "The user enters \"\" in the \"Guest name\" field in the current page."
  await fill(page, "Guest name", "");
  // WHEN: "The user enters \"\" in the \"Contact mobile\" field in the current page."
  await fill(page, "Contact mobile", "");
  // WHEN: "The user activates \"Submit order\" in the current page."
  await button(page, "Submit order");
  // THEN: "The alert named \"Guest name is required\" is visible exactly once in the current page."
  await visible(named(page, "alert", "Guest name is required"));
  // THEN: "The alert named \"Contact mobile is required\" is visible exactly once in the current page."
  await visible(named(page, "alert", "Contact mobile is required"));
  // THEN: "The region named \"Order confirmation\" is absent in the current page."
  await expect(named(page, "region", "Order confirmation")).toHaveCount(0);
  // WHEN: "The user enters \"Morgan Lee\" in the \"Guest name\" field in the current page."
  await fill(page, "Guest name", "Morgan Lee");
  // WHEN: "The user enters \"123\" in the \"Contact mobile\" field in the current page."
  await fill(page, "Contact mobile", "123");
  // WHEN: "The user activates \"Submit order\" in the current page."
  await button(page, "Submit order");
  // THEN: "The alert named \"Enter a valid 11-digit mobile number\" is visible exactly once in the current page."
  await visible(named(page, "alert", "Enter a valid 11-digit mobile number"));
  // THEN: "The region named \"Order confirmation\" is absent in the current page."
  await expect(named(page, "region", "Order confirmation")).toHaveCount(0);
  // THEN: "The heading named \"Hotel booking\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Hotel booking"));
  // THEN: "The exact text \"Bund Garden Hotel\" is visible exactly once in the region named \"Booking summary\"."
  await text(scope3, "Bund Garden Hotel");
  // THEN: "The exact text \"2030-10-08 to 2030-10-10\" is visible exactly once in the region named \"Booking summary\"."
  await text(scope3, "2030-10-08 to 2030-10-10");
  // THEN: "The exact text \"1 room, 2 adults, 0 children\" is visible exactly once in the region named \"Booking summary\"."
  await text(scope3, "1 room, 2 adults, 0 children");
  // THEN: "The exact text \"Deluxe King\" is visible exactly once in the region named \"Booking summary\"."
  await text(scope3, "Deluxe King");
  // THEN: "The exact text \"Total: CNY 1200\" is visible exactly once in the region named \"Booking summary\"."
  await text(scope3, "Total: CNY 1200");
});

test("EV-4.2: Create a hotel order", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The application uses the visible benchmark calendar date \"Today: 2030-10-01\" independently of the machine clock. Hotels is a navigation link or button; the hotel search form initially has Rooms 1, Adults 2, Children 0, Hotel level Any and an empty Keyword. Check-in and Check-out accept YYYY-MM-DD through labelled date-entry inputs. Occupancy and level selectors expose combobox semantics."
  // WHEN: "The user activates \"Hotels\" in the current page."
  await activate(page, "Hotels");
  // THEN: "The form named \"Hotel search\" is visible."
  const scope0 = named(page, "form", "Hotel search");
  await visible(scope0);
  // GIVEN: "For Shanghai, check-in 2030-10-08, check-out 2030-10-10, one room, two adults and zero children, exactly three hotels are available: \"Bund Garden Hotel\" at \"88 Bund Road, Shanghai\", 5 stars, review score 9.2, CNY 600 per room per night; \"Riverside Hotel\" at \"20 River Road, Shanghai\", 4 stars, review score 8.6, CNY 400 per room per night; \"City Budget Inn\" at \"10 Station Road, Shanghai\", 3 stars, review score 7.8, CNY 200 per room per night. Each card is a region named after the hotel with one image named after the hotel and an Open <hotel name> navigation control. Hotel names in the Hotel names list follow the result-card order. Bund Garden Hotel has Wi-Fi and Breakfast, two gallery images named Bund Garden Hotel exterior and Bund Garden Hotel lobby, and an available Deluxe King plan: King bed, Sleeps 2, Breakfast included, Free cancellation, CNY 600 per room per night. This two-night, one-room offer totals CNY 1200 including all taxes and fees. Booking availability is independently provisioned for this scenario; confirmation does not consume another scenario's inventory."
  // WHEN: "The user enters \"Shanghai\" in the \"Destination\" field in the form named \"Hotel search\"."
  await fill(scope0, "Destination", "Shanghai");
  // WHEN: "The user enters \"2030-10-08\" in the \"Check-in\" field in the form named \"Hotel search\"."
  await fill(scope0, "Check-in", "2030-10-08");
  // WHEN: "The user enters \"2030-10-10\" in the \"Check-out\" field in the form named \"Hotel search\"."
  await fill(scope0, "Check-out", "2030-10-10");
  // WHEN: "The user selects \"1\" in the \"Rooms\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Rooms", "1");
  // WHEN: "The user selects \"2\" in the \"Adults\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Adults", "2");
  // WHEN: "The user selects \"0\" in the \"Children\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Children", "0");
  // WHEN: "The user selects \"Any\" in the \"Hotel level\" combobox in the form named \"Hotel search\"."
  await choose(scope0, "Hotel level", "Any");
  // WHEN: "The user enters \"\" in the \"Keyword\" field in the form named \"Hotel search\"."
  await fill(scope0, "Keyword", "");
  // WHEN: "The user activates \"Search\" in the form named \"Hotel search\"."
  await button(scope0, "Search");
  // THEN: "The region named \"Hotel results\" is visible."
  const scope1 = named(page, "region", "Hotel results");
  await visible(scope1);
  // WHEN: "The user activates \"Open Bund Garden Hotel\" in the region named \"Hotel results\"."
  await activate(scope1, "Open Bund Garden Hotel");
  // THEN: "The heading named \"Bund Garden Hotel\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Bund Garden Hotel"));
  // THEN: "The region named \"Deluxe King\" is visible."
  const scope2 = named(page, "region", "Deluxe King");
  await visible(scope2);
  // WHEN: "The user activates \"Book\" in the region named \"Deluxe King\"."
  await button(scope2, "Book");
  // THEN: "The heading named \"Hotel booking\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Hotel booking"));
  // THEN: "The region named \"Booking summary\" is visible."
  const scope3 = named(page, "region", "Booking summary");
  await visible(scope3);
  // THEN: "The exact text \"Bund Garden Hotel\" is visible exactly once in the region named \"Booking summary\"."
  await text(scope3, "Bund Garden Hotel");
  // THEN: "The exact text \"2030-10-08 to 2030-10-10\" is visible exactly once in the region named \"Booking summary\"."
  await text(scope3, "2030-10-08 to 2030-10-10");
  // THEN: "The exact text \"1 room, 2 adults, 0 children\" is visible exactly once in the region named \"Booking summary\"."
  await text(scope3, "1 room, 2 adults, 0 children");
  // THEN: "The exact text \"Deluxe King\" is visible exactly once in the region named \"Booking summary\"."
  await text(scope3, "Deluxe King");
  // THEN: "The exact text \"Total: CNY 1200\" is visible exactly once in the region named \"Booking summary\"."
  await text(scope3, "Total: CNY 1200");
  // WHEN: "The user enters \"Jordan Chen\" in the \"Guest name\" field in the current page."
  await fill(page, "Guest name", "Jordan Chen");
  // WHEN: "The user enters \"13800004202\" in the \"Contact mobile\" field in the current page."
  await fill(page, "Contact mobile", "13800004202");
  // WHEN: "The user activates \"Submit order\" in the current page."
  await button(page, "Submit order");
  // THEN: "The region named \"Order confirmation\" is visible."
  const scope4 = named(page, "region", "Order confirmation");
  await visible(scope4);
  // THEN: "The status named \"Confirmed\" is visible exactly once in the region named \"Order confirmation\"."
  await visible(named(scope4, "status", "Confirmed"));
  // THEN: "The exact text \"Bund Garden Hotel\" is visible exactly once in the region named \"Order confirmation\"."
  await text(scope4, "Bund Garden Hotel");
  // THEN: "The exact text \"2030-10-08 to 2030-10-10\" is visible exactly once in the region named \"Order confirmation\"."
  await text(scope4, "2030-10-08 to 2030-10-10");
  // THEN: "The exact text \"1 room, 2 adults, 0 children\" is visible exactly once in the region named \"Order confirmation\"."
  await text(scope4, "1 room, 2 adults, 0 children");
  // THEN: "The exact text \"Deluxe King\" is visible exactly once in the region named \"Order confirmation\"."
  await text(scope4, "Deluxe King");
  // THEN: "The exact text \"Total: CNY 1200\" is visible exactly once in the region named \"Order confirmation\"."
  await text(scope4, "Total: CNY 1200");
  // THEN: "The exact text \"Jordan Chen\" is visible exactly once in the region named \"Order confirmation\"."
  await text(scope4, "Jordan Chen");
  // THEN: "The exact text \"13800004202\" is visible exactly once in the region named \"Order confirmation\"."
  await text(scope4, "13800004202");
  // THEN: "Order confirmation displays exactly one nonempty order number as \"Order number: <value>\"."
  await visible(scope4.getByText(new RegExp("^Order number: \\S.*$")));
});
