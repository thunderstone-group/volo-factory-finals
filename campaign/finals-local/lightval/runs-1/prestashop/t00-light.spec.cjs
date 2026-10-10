const { test, expect } = require('@playwright/test');
const { named, field, visible, activate, button, fill, choose, selected, checked, text, order } = require('./light-helpers.cjs');
test.use({ storageState: { cookies: [], origins: [] } });

test("EV-1.1: Remove active catalog filters", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "Clothes initially contains exactly these six alphabetically displayed products: \"Checkout shirt EV-3.1\" (USD 20.00, in stock), \"Checkout shirt EV-3.2\" (USD 20.00, in stock), \"Cotton shirt EV-1.1\" (USD 20.00, in stock), \"Linen shirt EV-1.1\" (USD 35.00, in stock), \"Sharing shirt EV-2.1\" (USD 20.00, in stock), and \"Wool shirt EV-1.1\" (USD 60.00, unavailable). No filters are initially applied."
  // WHEN: "The user activates \"Clothes\" in the current page."
  await activate(page, "Clothes");
  // THEN: "The form named \"Catalog filters\" is visible."
  const scope0 = named(page, "form", "Catalog filters");
  await visible(scope0);
  // WHEN: "The user checks \"In stock\" in the form named \"Catalog filters\"."
  await checked(scope0, "In stock", true);
  // WHEN: "The user enters \"30\" in the \"Minimum price\" field in the form named \"Catalog filters\"."
  await fill(scope0, "Minimum price", "30");
  // WHEN: "The user enters \"70\" in the \"Maximum price\" field in the form named \"Catalog filters\"."
  await fill(scope0, "Maximum price", "70");
  // WHEN: "The user activates \"Apply filters\" in the form named \"Catalog filters\"."
  await button(scope0, "Apply filters");
  // THEN: "The region named \"Active filters\" is visible."
  const scope1 = named(page, "region", "Active filters");
  await visible(scope1);
  // THEN: "The button named \"Remove In stock\" is visible exactly once in the region named \"Active filters\"."
  await visible(named(scope1, "button", "Remove In stock"));
  // THEN: "The button named \"Remove price range\" is visible exactly once in the region named \"Active filters\"."
  await visible(named(scope1, "button", "Remove price range"));
  // THEN: "The region named \"Product list\" is visible."
  const scope2 = named(page, "region", "Product list");
  await visible(scope2);
  // THEN: "The \"Product names\" list in the region named \"Product list\" contains exactly these entries in order: [\"Linen shirt EV-1.1\"]."
  await order(scope2, "Product names", ["Linen shirt EV-1.1"]);
  // THEN: "The status named \"1 product\" is visible exactly once in the current page."
  await visible(named(page, "status", "1 product"));
  // WHEN: "The user activates \"Remove In stock\" in the region named \"Active filters\"."
  await button(scope1, "Remove In stock");
  // THEN: "The \"Product names\" list in the region named \"Product list\" contains exactly these entries in order: [\"Linen shirt EV-1.1\", \"Wool shirt EV-1.1\"]."
  await order(scope2, "Product names", ["Linen shirt EV-1.1", "Wool shirt EV-1.1"]);
  // THEN: "The status named \"2 products\" is visible exactly once in the current page."
  await visible(named(page, "status", "2 products"));
  // THEN: "The button named \"Remove In stock\" is absent in the region named \"Active filters\"."
  await expect(named(scope1, "button", "Remove In stock")).toHaveCount(0);
  // THEN: "The button named \"Remove price range\" is visible exactly once in the region named \"Active filters\"."
  await visible(named(scope1, "button", "Remove price range"));
  // WHEN: "The user activates \"Clear all\" in the region named \"Active filters\"."
  await button(scope1, "Clear all");
  // THEN: "The button named \"Remove price range\" is absent in the region named \"Active filters\"."
  await expect(named(scope1, "button", "Remove price range")).toHaveCount(0);
  // THEN: "The \"Product names\" list in the region named \"Product list\" contains exactly these entries in order: [\"Checkout shirt EV-3.1\", \"Checkout shirt EV-3.2\", \"Cotton shirt EV-1.1\", \"Linen shirt EV-1.1\", \"Sharing shirt EV-2.1\", \"Wool shirt EV-1.1\"]."
  await order(scope2, "Product names", ["Checkout shirt EV-3.1", "Checkout shirt EV-3.2", "Cotton shirt EV-1.1", "Linen shirt EV-1.1", "Sharing shirt EV-2.1", "Wool shirt EV-1.1"]);
  // THEN: "The status named \"6 products\" is visible exactly once in the current page."
  await visible(named(page, "status", "6 products"));
  // THEN: "The heading named \"Clothes\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Clothes"));
});

test("EV-1.2: Submit a customer service contact message", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // WHEN: "The user activates \"Contact us\" in the current page."
  await activate(page, "Contact us");
  // THEN: "The heading named \"Contact us\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Contact us"));
  // THEN: "The form named \"Contact form\" is visible."
  const scope0 = named(page, "form", "Contact form");
  await visible(scope0);
  // WHEN: "The user selects \"Customer service\" in the \"Subject\" combobox in the form named \"Contact form\"."
  await choose(scope0, "Subject", "Customer service");
  // WHEN: "The user enters \"invalid-email\" in the \"Email\" field in the form named \"Contact form\"."
  await fill(scope0, "Email", "invalid-email");
  // WHEN: "The user enters \"\" in the \"Message\" field in the form named \"Contact form\"."
  await fill(scope0, "Message", "");
  // WHEN: "The user activates \"Send\" in the form named \"Contact form\"."
  await button(scope0, "Send");
  // THEN: "The alert named \"Enter a valid email address\" is visible exactly once in the current page."
  await visible(named(page, "alert", "Enter a valid email address"));
  // THEN: "The alert named \"Message is required\" is visible exactly once in the current page."
  await visible(named(page, "alert", "Message is required"));
  // THEN: "The status named \"Message sent\" is absent in the current page."
  await expect(named(page, "status", "Message sent")).toHaveCount(0);
  // THEN: "The form named \"Contact form\" is visible exactly once in the current page."
  await visible(named(page, "form", "Contact form"));
  // WHEN: "The user enters \"customer.ev-1.2@example.com\" in the \"Email\" field in the form named \"Contact form\"."
  await fill(scope0, "Email", "customer.ev-1.2@example.com");
  // WHEN: "The user enters \"I need help choosing a shirt size.\" in the \"Message\" field in the form named \"Contact form\"."
  await fill(scope0, "Message", "I need help choosing a shirt size.");
  // WHEN: "The user activates \"Send\" in the form named \"Contact form\"."
  await button(scope0, "Send");
  // THEN: "The status named \"Message sent\" is visible exactly once in the current page."
  await visible(named(page, "status", "Message sent"));
  // THEN: "The heading named \"Contact us\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Contact us"));
});

test("EV-3.1: Expand checkout order summary details", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The account has an empty cart and saved address \"12 Benchmark Road, Shanghai, 200000, China\". Clothes contains \"Checkout shirt EV-3.1\" at USD 20.00 per item, Size M, Color White, available quantity 10. Standard shipping costs USD 5.00. Two units total USD 40.00 subtotal and USD 45.00 including shipping and all taxes. The address and shipping steps each expose a uniquely named form with a Continue button."
  // GIVEN: "The application provides the account \"prestashop.ev-3.1@example.com\" with password \"Benchmark123!\"; its isolated records and permissions are those stated in this scenario."
  // WHEN: "The user activates \"Login\" in the current page."
  await activate(page, "Login");
  // THEN: "The form named \"Login\" is visible."
  const scope0 = named(page, "form", "Login");
  await visible(scope0);
  // WHEN: "The user enters \"prestashop.ev-3.1@example.com\" in the \"Email\" field in the form named \"Login\"."
  await fill(scope0, "Email", "prestashop.ev-3.1@example.com");
  // WHEN: "The user enters \"Benchmark123!\" in the \"Password\" field in the form named \"Login\"."
  await fill(scope0, "Password", "Benchmark123!");
  // THEN: "The Password input masks the password."
  await expect(field(scope0, "Password")).toHaveAttribute("type", "password");
  // WHEN: "The user activates \"Login\" in the form named \"Login\"."
  await button(scope0, "Login");
  // THEN: "The status named \"Signed in\" is visible exactly once in the current page."
  await visible(named(page, "status", "Signed in"));
  // WHEN: "The user activates \"Clothes\" in the current page."
  await activate(page, "Clothes");
  // THEN: "The region named \"Product list\" is visible."
  const scope1 = named(page, "region", "Product list");
  await visible(scope1);
  // WHEN: "The user activates \"Checkout shirt EV-3.1\" in the region named \"Product list\"."
  await activate(scope1, "Checkout shirt EV-3.1");
  // THEN: "The heading named \"Checkout shirt EV-3.1\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Checkout shirt EV-3.1"));
  // WHEN: "The user selects \"M\" in the \"Size\" combobox in the current page."
  await choose(page, "Size", "M");
  // WHEN: "The user selects \"White\" in the \"Color\" combobox in the current page."
  await choose(page, "Color", "White");
  // WHEN: "The user enters \"2\" in the \"Quantity\" field in the current page."
  await fill(page, "Quantity", "2");
  // WHEN: "The user activates \"Add to cart\" in the current page."
  await button(page, "Add to cart");
  // THEN: "The status named \"Added to cart\" is visible exactly once in the current page."
  await visible(named(page, "status", "Added to cart"));
  // WHEN: "The user activates \"Cart\" in the current page."
  await activate(page, "Cart");
  // WHEN: "The user activates \"Proceed to checkout\" in the current page."
  await button(page, "Proceed to checkout");
  // THEN: "The form named \"Address\" is visible."
  const scope2 = named(page, "form", "Address");
  await visible(scope2);
  // WHEN: "The user selects \"12 Benchmark Road, Shanghai, 200000, China\" in the \"Delivery address\" combobox in the form named \"Address\"."
  await choose(scope2, "Delivery address", "12 Benchmark Road, Shanghai, 200000, China");
  // WHEN: "The user activates \"Continue\" in the form named \"Address\"."
  await button(scope2, "Continue");
  // THEN: "The form named \"Shipping method\" is visible."
  const scope3 = named(page, "form", "Shipping method");
  await visible(scope3);
  // WHEN: "The user selects the Standard shipping radio in the Shipping method form."
  await visible(named(scope3, "radio", "Standard shipping"));
  await named(scope3, "radio", "Standard shipping").check();
  // THEN: "The region named \"Order summary\" is visible."
  const scope4 = named(page, "region", "Order summary");
  await visible(scope4);
  // THEN: "The exact text \"2 items\" is visible exactly once in the region named \"Order summary\"."
  await text(scope4, "2 items");
  // THEN: "The exact text \"Subtotal: USD 40.00\" is visible exactly once in the region named \"Order summary\"."
  await text(scope4, "Subtotal: USD 40.00");
  // THEN: "The exact text \"Shipping: USD 5.00\" is visible exactly once in the region named \"Order summary\"."
  await text(scope4, "Shipping: USD 5.00");
  // THEN: "The exact text \"Total: USD 45.00\" is visible exactly once in the region named \"Order summary\"."
  await text(scope4, "Total: USD 45.00");
  // WHEN: "The user activates \"Show details\" in the region named \"Order summary\"."
  await button(scope4, "Show details");
  // THEN: "The \"Order items\" list in the region named \"Order summary\" contains exactly these entries in order: [\"Checkout shirt EV-3.1 - Quantity: 2 - Unit: USD 20.00 - Line total: USD 40.00\"]."
  await order(scope4, "Order items", ["Checkout shirt EV-3.1 - Quantity: 2 - Unit: USD 20.00 - Line total: USD 40.00"]);
  // THEN: "Standard shipping remains selected and the Shipping method form stays visible."
  await expect(named(scope3, "radio", "Standard shipping")).toBeChecked();
  await visible(scope3);
  // WHEN: "The user activates \"Hide details\" in the region named \"Order summary\"."
  await button(scope4, "Hide details");
  // THEN: "The list named \"Order items\" is absent in the region named \"Order summary\"."
  await expect(named(scope4, "list", "Order items")).toHaveCount(0);
  // THEN: "The exact text \"2 items\" is visible exactly once in the region named \"Order summary\"."
  await text(scope4, "2 items");
  // THEN: "The exact text \"Subtotal: USD 40.00\" is visible exactly once in the region named \"Order summary\"."
  await text(scope4, "Subtotal: USD 40.00");
  // THEN: "The exact text \"Shipping: USD 5.00\" is visible exactly once in the region named \"Order summary\"."
  await text(scope4, "Shipping: USD 5.00");
  // THEN: "The exact text \"Total: USD 45.00\" is visible exactly once in the region named \"Order summary\"."
  await text(scope4, "Total: USD 45.00");
});

test("EV-3.2: Add order comment before payment", async ({ page }) => {
  // GIVEN: "The user opens the application home entry in a fresh browser context, signed out."
  await page.goto('/');
  // GIVEN: "The account has an empty cart and saved address \"12 Benchmark Road, Shanghai, 200000, China\". Clothes contains \"Checkout shirt EV-3.2\" at USD 20.00 per item, Size M, Color White, available quantity 10. Standard shipping costs USD 5.00. Two units total USD 40.00 subtotal and USD 45.00 including shipping and all taxes. The address and shipping steps each expose a uniquely named form with a Continue button."
  // GIVEN: "The application provides the account \"prestashop.ev-3.2@example.com\" with password \"Benchmark123!\"; its isolated records and permissions are those stated in this scenario."
  // WHEN: "The user activates \"Login\" in the current page."
  await activate(page, "Login");
  // THEN: "The form named \"Login\" is visible."
  const scope0 = named(page, "form", "Login");
  await visible(scope0);
  // WHEN: "The user enters \"prestashop.ev-3.2@example.com\" in the \"Email\" field in the form named \"Login\"."
  await fill(scope0, "Email", "prestashop.ev-3.2@example.com");
  // WHEN: "The user enters \"Benchmark123!\" in the \"Password\" field in the form named \"Login\"."
  await fill(scope0, "Password", "Benchmark123!");
  // THEN: "The Password input masks the password."
  await expect(field(scope0, "Password")).toHaveAttribute("type", "password");
  // WHEN: "The user activates \"Login\" in the form named \"Login\"."
  await button(scope0, "Login");
  // THEN: "The status named \"Signed in\" is visible exactly once in the current page."
  await visible(named(page, "status", "Signed in"));
  // WHEN: "The user activates \"Clothes\" in the current page."
  await activate(page, "Clothes");
  // THEN: "The region named \"Product list\" is visible."
  const scope1 = named(page, "region", "Product list");
  await visible(scope1);
  // WHEN: "The user activates \"Checkout shirt EV-3.2\" in the region named \"Product list\"."
  await activate(scope1, "Checkout shirt EV-3.2");
  // THEN: "The heading named \"Checkout shirt EV-3.2\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Checkout shirt EV-3.2"));
  // WHEN: "The user selects \"M\" in the \"Size\" combobox in the current page."
  await choose(page, "Size", "M");
  // WHEN: "The user selects \"White\" in the \"Color\" combobox in the current page."
  await choose(page, "Color", "White");
  // WHEN: "The user enters \"2\" in the \"Quantity\" field in the current page."
  await fill(page, "Quantity", "2");
  // WHEN: "The user activates \"Add to cart\" in the current page."
  await button(page, "Add to cart");
  // THEN: "The status named \"Added to cart\" is visible exactly once in the current page."
  await visible(named(page, "status", "Added to cart"));
  // WHEN: "The user activates \"Cart\" in the current page."
  await activate(page, "Cart");
  // WHEN: "The user activates \"Proceed to checkout\" in the current page."
  await button(page, "Proceed to checkout");
  // THEN: "The form named \"Address\" is visible."
  const scope2 = named(page, "form", "Address");
  await visible(scope2);
  // WHEN: "The user selects \"12 Benchmark Road, Shanghai, 200000, China\" in the \"Delivery address\" combobox in the form named \"Address\"."
  await choose(scope2, "Delivery address", "12 Benchmark Road, Shanghai, 200000, China");
  // WHEN: "The user activates \"Continue\" in the form named \"Address\"."
  await button(scope2, "Continue");
  // THEN: "The form named \"Shipping method\" is visible."
  const scope3 = named(page, "form", "Shipping method");
  await visible(scope3);
  // WHEN: "The user selects the Standard shipping radio in the Shipping method form."
  await visible(named(scope3, "radio", "Standard shipping"));
  await named(scope3, "radio", "Standard shipping").check();
  // THEN: "The region named \"Order summary\" is visible."
  const scope4 = named(page, "region", "Order summary");
  await visible(scope4);
  // WHEN: "The user enters \"Please call before delivery.\" in the \"Write a comment about this order\" field in the form named \"Shipping method\"."
  await fill(scope3, "Write a comment about this order", "Please call before delivery.");
  // WHEN: "The user activates \"Continue to payment\" in the form named \"Shipping method\"."
  await button(scope3, "Continue to payment");
  // THEN: "The heading named \"Payment\" is visible exactly once in the current page."
  await visible(named(page, "heading", "Payment"));
  // THEN: "The exact text \"2 items\" is visible exactly once in the region named \"Order summary\"."
  await text(scope4, "2 items");
  // THEN: "The exact text \"Subtotal: USD 40.00\" is visible exactly once in the region named \"Order summary\"."
  await text(scope4, "Subtotal: USD 40.00");
  // THEN: "The exact text \"Shipping: USD 5.00\" is visible exactly once in the region named \"Order summary\"."
  await text(scope4, "Shipping: USD 5.00");
  // THEN: "The exact text \"Total: USD 45.00\" is visible exactly once in the region named \"Order summary\"."
  await text(scope4, "Total: USD 45.00");
  // WHEN: "The user activates \"Show details\" in the region named \"Order summary\"."
  await button(scope4, "Show details");
  // THEN: "The \"Order items\" list in the region named \"Order summary\" contains exactly these entries in order: [\"Checkout shirt EV-3.2 - Quantity: 2 - Unit: USD 20.00 - Line total: USD 40.00\"]."
  await order(scope4, "Order items", ["Checkout shirt EV-3.2 - Quantity: 2 - Unit: USD 20.00 - Line total: USD 40.00"]);
  // WHEN: "The user activates \"Back to shipping\" in the current page."
  await activate(page, "Back to shipping");
  // THEN: "The \"Write a comment about this order\" field in the form named \"Shipping method\" displays \"Please call before delivery.\"."
  await expect(field(scope3, "Write a comment about this order")).toHaveValue("Please call before delivery.");
  // THEN: "Standard shipping remains selected."
  await expect(named(scope3, "radio", "Standard shipping")).toBeChecked();
});
