"""Scenario parser and planner regressions. Requirement texts here are SYNTHETIC, written for these
tests; the optional BookStack checks read the public exercise file when it exists locally."""
import os
import unittest
from pathlib import Path

from oneshot import scenarios

try:
    import yaml
except ImportError:  # the official image has no PyYAML; the comparison tests then skip
    yaml = None

BOOKSTACK = Path(os.environ.get("SCENARIO_TEST_BOOKSTACK_REQUIREMENTS", str(
    Path.home() / "projects/arcbench-campaign/upstream/hackathon-local-simulation/public-exercise/bookstack/"
                  "requirements/requirements.yaml")))

YAML_CASES = [
    """# comment
a: 1
b: -2
c: 3.5
d: true
e: no
f: ~
g:
h: 'it''s'
i: "tab\\tnew\\nline \\u00e9 \\x41"
j: [1, two, 'three', "four", [5, 6], {k: v}]
k: {}
l: []
m: 2026-09-23
n: 0x1F
o: 012
p: .5
q: 4.2.1
r: REQ-4.2.1
""",
    """lit: |
  line one
    indented
  line three

keep: |+
  kept

strip: >-
  folded
  text

  para two
    more
  back
clip: >
  a
  b
next: x
""",
    """items:
- id: A
  deps:
  - B
  - C
- id: B
  nested:
    - - x
      - y
    - z
  mq: 'multi
    line quoted

    with blank'
  dq: "double \\
    joined"
  plain: first line
    second line
top: end   # trailing comment
url: http://example.com/a#b
colon: 'Email: '
""",
    """- a
- b: 1
  c: 2
-
  d: 3
- ''
""",
]

SYNTHETIC = """id: ROOT
name: Synthetic Library
type: FOLDER
description: >
  Synthetic requirements for parser tests.
dependencies: []
children:
  - id: REQ-1
    name: Home
    type: FOLDER
    dependencies: []
    children:
      - id: REQ-1.1
        name: Open Home
        type: ATOMIC
        description: Open the application.
        dependencies: []
        scenarios:
          - name: Open Home
            steps:
              - keyword: GIVEN
                content: The system is accessible.
              - keyword: WHEN
                content: The user opens the application URL.
              - keyword: THEN
                content: The homepage is displayed as the default page with exactly one visible heading named `Library`.
      - id: REQ-1.2
        name: Back Home
        type: ATOMIC
        dependencies:
          - REQ-1.1
        scenarios:
          - name: Back Home
            steps:
              - keyword: GIVEN
                content: The user is on a non-homepage page and the global navigation bar is visible.
              - keyword: WHEN
                content: The user activates the unique button named `Library` in the global navigation.
              - keyword: THEN
                content: The system navigates to the homepage, where exactly one visible heading named `Library` is present.
  - id: REQ-2
    name: Accounts
    type: FOLDER
    children:
      - id: REQ-2.1
        name: Enter Login Page
        type: ATOMIC
        dependencies: [REQ-1.1]
        scenarios:
          - name: Enter Login Page
            steps:
              - keyword: GIVEN
                content: The user is on the homepage and is not logged in.
              - keyword: WHEN
                content: The user activates the unique link or button named `Sign in` in the homepage navigation bar.
              - keyword: THEN
                content: The system displays the login form page with exactly one visible heading named `Sign in` and a form named `Sign in form`.
      - id: REQ-2.2
        name: Log In
        type: ATOMIC
        description: 'Seed data: account "Reader" with email "reader@example.com".'
        dependencies: [REQ-2.1]
        scenarios:
          - name: Log In
            steps:
              - keyword: GIVEN
                content: The user is on the login form page.
              - keyword: WHEN
                content: The user enters `reader@example.com` in the uniquely labelled email textbox `Email`, enters `secret` in the uniquely labelled password textbox `Password`, checks the checkbox named `Stay signed in`, and activates the `Sign in` button inside the `Sign in form`.
              - keyword: THEN
                content: The system logs the user in, returns to the homepage, and displays the nickname `Reader` in the authenticated navigation area.
  - id: REQ-3
    name: Rooms
    type: FOLDER
    children:
      - id: REQ-3.1
        name: View Room List
        type: ATOMIC
        dependencies: [REQ-1.1]
        scenarios:
          - name: View Room List
            steps:
              - keyword: GIVEN
                content: The user is on a page where the global navigation bar is visible.
              - keyword: WHEN
                content: The user activates the unique link or button named `Rooms` in the top navigation bar.
              - keyword: THEN
                content: The system displays the room list page with heading `Rooms` and a unique room entry named `Room 3.1` in the `Room list` region.
      - id: REQ-3.2
        name: Room Details
        type: ATOMIC
        dependencies: [REQ-3.1]
        scenarios:
          - name: Room Details
            steps:
              - keyword: GIVEN
                content: The user is on the room list page and at least one room is visible.
              - keyword: WHEN
                content: The user activates the unique link or button named `Room 3.2` in the room list.
              - keyword: THEN
                content: The system displays the room details page with a visible heading named `Room 3.2`.
      - id: REQ-3.3
        name: Delete Room
        type: FOLDER
        dependencies: [REQ-3.2]
        children:
          - id: REQ-3.3.1
            name: Confirm Delete Room
            type: ATOMIC
            description: 'Seed data: deletable room "Room 3.3.1".'
            dependencies: [REQ-3.2]
            scenarios:
              - name: Confirm Delete Room
                steps:
                  - keyword: GIVEN
                    content: The user is on the room details page and can access the action panel.
                  - keyword: WHEN
                    content: The user activates `Delete`, then activates the unique `Confirm Delete` control on the confirmation view.
                  - keyword: THEN
                    content: The system deletes the room, returns to the room list page, and the entry named `Room 3.3.1` is absent.
          - id: REQ-3.3.2
            name: Cancel Delete Room
            type: ATOMIC
            description: 'Seed data: deletable room "Room 3.3.2".'
            dependencies: [REQ-3.2]
            scenarios:
              - name: Cancel Delete Room
                steps:
                  - keyword: GIVEN
                    content: The user is on the delete room confirmation page.
                  - keyword: WHEN
                    content: The user activates the unique `Cancel` button.
                  - keyword: THEN
                    content: The system returns to the room details page and keeps `Room 3.3.2` unchanged.
      - id: REQ-3.4
        name: Bookmark Room
        type: ATOMIC
        description: 'Seed data: room "Room 3.4".'
        dependencies: [REQ-3.2, REQ-2.2]
        scenarios:
          - name: Bookmark Room
            steps:
              - keyword: GIVEN
                content: The authenticated user is on a supported room, desk, or floor view.
              - keyword: WHEN
                content: The user activates the unique button named `Bookmark` for the current item.
              - keyword: THEN
                content: The system bookmarks the room and changes the control to `Unbookmark` with aria-pressed=true.
      - id: REQ-3.5
        name: Open Recent
        type: ATOMIC
        dependencies: [REQ-3.2]
        scenarios:
          - name: Open Recent
            steps:
              - keyword: GIVEN
                content: The homepage shows `Recent Rooms` with at least one item.
              - keyword: WHEN
                content: The user activates the unique link or button named after the target room in `Recent Rooms`.
              - keyword: THEN
                content: The system opens the corresponding room page.
"""


class YamlSubsetCase(unittest.TestCase):
    def test_constructs_parse_to_the_expected_values(self):
        value = scenarios.load_yaml(YAML_CASES[1])
        self.assertEqual(value["lit"], "line one\n  indented\nline three\n")
        self.assertEqual(value["keep"], "kept\n\n")
        self.assertEqual(value["strip"], "folded text\npara two\n  more\nback")
        self.assertEqual(value["clip"], "a b\n")
        value = scenarios.load_yaml(YAML_CASES[0])
        self.assertEqual((value["a"], value["d"], value["e"], value["f"], value["g"]), (1, True, False, None, None))
        self.assertEqual((value["q"], value["r"], value["n"], value["o"]), ("4.2.1", "REQ-4.2.1", 31, 10))
        self.assertEqual(value["j"], [1, "two", "three", "four", [5, 6], {"k": "v"}])
        value = scenarios.load_yaml(YAML_CASES[2])
        self.assertEqual(value["items"][0], {"id": "A", "deps": ["B", "C"]})
        self.assertEqual(value["items"][1]["mq"], "multi line quoted\nwith blank")
        self.assertEqual(value["items"][1]["dq"], "double joined")
        self.assertEqual(value["top"], "end")
        self.assertEqual(value["url"], "http://example.com/a#b")

    @unittest.skipIf(yaml is None, "PyYAML is not installed (the comparison is a development check)")
    def test_same_result_as_pyyaml(self):
        for text in YAML_CASES + [SYNTHETIC]:
            self.assertEqual(scenarios.load_yaml(text), yaml.safe_load(text))
        if BOOKSTACK.is_file():
            text = BOOKSTACK.read_text(encoding="utf-8")
            self.assertEqual(scenarios.load_yaml(text), yaml.safe_load(text))

    def test_unsupported_input_raises(self):
        with self.assertRaises(scenarios.YAMLError):
            scenarios.load_yaml("a: 'unterminated\nb: 2\n")
        with self.assertRaises(scenarios.YAMLError):
            scenarios.load_yaml("a:\n  b: 1\n c: 2\n")


def ops_of(plan, sid):
    return next(s for s in plan["scenarios"] if s["id"] == sid)


class SentenceCase(unittest.TestCase):
    def test_mask_uses_backticks_else_double_quotes(self):
        self.assertEqual(scenarios.mask("Click `A` then \"B\"."), ('click «0» then "b"', ["A"]))
        self.assertEqual(scenarios.mask('Click the "Register" link.'), ("click the «0» link", ["Register"]))
        self.assertEqual(scenarios.mask("Click “登录”"), ("click «0»", ["登录"]))

    def test_when_shapes(self):
        masked, names = scenarios.mask("The user activates the unique link or button named `Rooms` in the top navigation bar.")
        (op,) = scenarios._when_clause(masked, names)
        self.assertEqual((op["op"], op["target"]["roles"], op["unique"], op["target"]["scope"]),
                         ("click", ["link", "button"], True, {"type": "landmark"}))
        masked, names = scenarios.mask("fills the revealed `tag1, tag2` textbox with `a, b`")
        (op,) = scenarios._when_clause(masked, names)
        self.assertEqual((op["op"], op["target"]["name"], op["value"], op["target"]["kind"]), ("fill", "tag1, tag2", "a, b", "field"))
        masked, names = scenarios.mask("activates the `Sign in` button inside the `Sign in form`")
        (op,) = scenarios._when_clause(masked, names)
        self.assertEqual(op["target"]["scope"], {"type": "named", "name": "Sign in form", "roles": [], "strict": True})
        masked, names = scenarios.mask("Select `Economy` from the `Seat class` dropdown")
        (op,) = scenarios._when_clause(masked, names)
        self.assertEqual((op["op"], op["option"], op["target"]["name"]), ("select", "Economy", "Seat class"))
        masked, names = scenarios.mask("Open the application entry URL.")
        self.assertEqual(scenarios._when_clause(masked, names), [{"op": "goto", "path": "/"}])
        masked, names = scenarios.mask("The system finishes the post-login navigation.")
        self.assertEqual(scenarios._when_clause(masked, names)[0]["op"], "wait")
        for text in ("The user opens the draft actions", "The user activates the item named after the target"):
            masked, names = scenarios.mask(text)
            with self.assertRaises(scenarios.Unparsed):
                scenarios._when_clause(masked, names)

    def test_then_shapes(self):
        clauses, _ = scenarios._then("The system deletes the room, returns to the room list page, and the entry named `Room 1` is absent.")
        self.assertEqual([c["location"] for c in clauses], [None, "the room list page", None])
        (op,) = clauses[2]["ops"]
        self.assertEqual((op["target"]["kind"], op["count"]), ("entry", "none"))
        clauses, _ = scenarios._then("The dashboard is displayed with visible headings or named regions exactly matching \"A\", \"B\", and \"C\".")
        self.assertEqual([(o["target"]["name"], o["target"]["roles"]) for o in clauses[0]["ops"]],
                         [("A", ["heading", "region"]), ("B", ["heading", "region"]), ("C", ["heading", "region"])])
        clauses, _ = scenarios._then("The system changes the control to `Unbookmark` with aria-pressed=true.")
        self.assertEqual(clauses[0]["ops"][0]["attrs"], {"aria-pressed": "true"})
        clauses, _ = scenarios._then("The system stores the draft and shows exactly one entry named `D` in the `Drafts` list on the homepage.")
        op = clauses[1]["ops"][0]
        self.assertTrue(clauses[1]["home"])
        self.assertEqual((op["count"], op["target"]["scope"]["name"], op["target"]["scope"]["roles"]), ("one", "Drafts", ["list"]))
        clauses, _ = scenarios._then("The system displays the room list page with heading `Rooms`, a `Room list` region, and the seeded room `Room 1` as a unique link or button.")
        self.assertEqual([(o["target"]["roles"], o["count"]) for c in clauses for o in c["ops"]],
                         [(["heading"], "any"), (["region"], "any"), (["link", "button"], "one")])

    def test_given_shapes(self):
        def given(text):
            state = scenarios._given(text)
            return {k: v for k, v in state.items() if v not in (None, [])}
        self.assertEqual(given("The system is accessible."), {})
        self.assertEqual(given("The user is on the homepage and is not logged in."), {"auth": False, "location": "the homepage"})
        self.assertEqual(given("The authenticated user is on the page edit page."), {"auth": True, "location": "the page edit page"})
        self.assertEqual(given("User has opened the application and the system is accessible."), {})
        self.assertEqual(given('User is on the home page and the "Take a note" editor is open.'),
                         {"location": "the home page", "open": "Take a note"})
        self.assertEqual(given("The user has just deleted a note from the home page."),
                         {"effects": ["the user has just deleted a note from the home page"]})
        with self.assertRaises(scenarios.Unparsed):
            scenarios._given("The homepage shows `Recent` with at least one item.")

    def test_page_keys(self):
        key = scenarios._page_key
        self.assertEqual(key("the shelf details page"), [frozenset({"shelf", "detail"})])
        self.assertEqual(key("the edit page for the current page"), key("the page edit page"))
        self.assertEqual(key("a non-homepage page"), ["non-home"])
        self.assertEqual(key("a page where the global navigation bar is visible"), [])
        self.assertEqual(len(key("a supported shelf, book, chapter, or page view")), 4)
        self.assertIsNone(key("supported content pages in the system"))


class PlanCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.plan = scenarios.plan(SYNTHETIC)

    def steps(self, sid):
        return [(op["phase"], op["src"], op["op"], (op.get("target") or {}).get("name")) for op in ops_of(self.plan, sid)["ops"]]

    def test_coverage_and_unparsed_reason(self):
        self.assertEqual(self.plan["coverage"], {"total": 10, "parsed": 9})
        recent = ops_of(self.plan, "REQ-3.5")
        self.assertEqual(recent["status"], "unparsed")
        self.assertEqual(recent["fragment"]["phase"], "given")

    def test_dependency_chain_runs_prerequisite_when_steps_then_own_steps(self):
        self.assertEqual(self.steps("REQ-3.2"), [
            ("given", "REQ-3.2", "goto", None), ("given", "REQ-3.1", "click", "Rooms"),
            ("when", "REQ-3.2", "click", "Room 3.2"), ("then", "REQ-3.2", "expect", "Room 3.2")])
        self.assertEqual(ops_of(self.plan, "REQ-3.2")["chain"], ["REQ-3.1"])

    def test_seed_substitution_and_sibling_prefix(self):
        steps = self.steps("REQ-3.3.2")
        self.assertIn(("given", "REQ-3.2", "click", "Room 3.3.2"), steps)  # the seed replaces `Room 3.2`
        self.assertIn(("given", "REQ-3.3.1", "click", "Delete"), steps)  # opens the confirmation view
        self.assertNotIn(("given", "REQ-3.3.1", "click", "Confirm Delete"), steps)
        self.assertEqual(steps[-1], ("then", "REQ-3.3.2", "expect", "Room 3.3.2"))
        self.assertEqual(ops_of(self.plan, "REQ-3.3.2")["substitutions"], {"Room 3.2": "Room 3.3.2"})

    def test_location_claim_uses_the_page_heading_the_requirements_define(self):
        steps = self.steps("REQ-3.3.1")
        self.assertIn(("then", "REQ-3.3.1", "expect", "Rooms"), steps)
        self.assertEqual(steps[-1], ("then", "REQ-3.3.1", "expect", "Room 3.3.1"))
        self.assertEqual(ops_of(self.plan, "REQ-3.3.1")["ops"][-1]["count"], "none")

    def test_non_homepage_given_and_login_prefix(self):
        self.assertIn(("given", "REQ-3.1", "click", "Rooms"), self.steps("REQ-1.2"))
        steps = self.steps("REQ-3.4")
        login = steps.index(("given", "REQ-2.2", "click", "Sign in"))
        self.assertLess(login, steps.index(("given", "REQ-3.2", "click", "Room 3.4")))
        self.assertEqual(steps[-1], ("then", "REQ-3.4", "expect", "Unbookmark"))

    def test_entities_mark_seeded_and_heading_links(self):
        entities = set(self.plan["entities"])
        self.assertTrue({"Room 3.2", "Room 3.3.1", "Rooms"} <= entities)
        self.assertNotIn("Delete", entities)


TOGGLES = """id: ROOT
type: FOLDER
children:
  - id: REQ-1
    name: Home
    type: ATOMIC
    dependencies: []
    scenarios:
      - name: Home
        steps:
          - keyword: GIVEN
            content: User has opened the application and the system is accessible.
          - keyword: WHEN
            content: Open the application entry URL.
          - keyword: THEN
            content: The page shows the `Board` region.
  - id: REQ-2
    name: Toggle views
    type: ATOMIC
    dependencies: [REQ-1]
    scenarios:
      - name: Toggle views
        steps:
          - keyword: GIVEN
            content: User is on the home page.
          - keyword: WHEN
            content: Activate `List view` and then activate `Grid view`.
          - keyword: THEN
            content: '`List view` has aria-pressed=true after the first activation; `Grid view` has aria-pressed=true after the second activation.'
  - id: REQ-3
    name: Pin card
    type: ATOMIC
    description: 'Seed data: card "Card 3.1".'
    dependencies: [REQ-1]
    scenarios:
      - name: Pin card
        steps:
          - keyword: GIVEN
            content: User can see the sidebar.
          - keyword: WHEN
            content: Hover over the article for `Card 3.1`, activate its `More` button, and activate its `Pin` button.
          - keyword: THEN
            content: The `Pin` label is assigned.
  - id: REQ-4
    name: Unpin card
    type: ATOMIC
    description: 'Seed data: card "Card 4.1".'
    dependencies: [REQ-3]
    scenarios:
      - name: Unpin card
        steps:
          - keyword: GIVEN
            content: User is on the home page and the card is pinned.
          - keyword: WHEN
            content: In the `Card 4.1` article, activate `More` and activate `Unpin`.
          - keyword: THEN
            content: The `Card 4.1` article is absent from the pinned list; the `Board` region is visible.
  - id: REQ-5
    name: Collapse
    type: ATOMIC
    dependencies: [REQ-1]
    scenarios:
      - name: Collapse
        steps:
          - keyword: GIVEN
            content: The sidebar is expanded.
          - keyword: WHEN
            content: Activate `Toggle sidebar` twice and activate its `Close` button.
          - keyword: THEN
            content: The `Board` region is visible.
"""


class StrictShapesCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.plan = scenarios.plan(TOGGLES)

    def test_a_state_after_one_of_several_actions_is_checked_right_after_it(self):
        ops = [(o["op"], (o.get("target") or {}).get("name"), o.get("attrs")) for o in ops_of(self.plan, "REQ-2")["ops"]]
        self.assertEqual(ops[-4:], [("click", "List view", None), ("expect", "List view", {"aria-pressed": "true"}),
                                    ("click", "Grid view", None), ("expect", "Grid view", {"aria-pressed": "true"})])

    def test_unread_qualifiers_make_the_scenario_unparsed_instead_of_weaker(self):
        pin = ops_of(self.plan, "REQ-3")  # "is assigned" is not an observable shape
        self.assertEqual((pin["status"], pin["fragment"]["phase"]), ("unparsed", "then"))
        unpin = ops_of(self.plan, "REQ-4")  # an absence inside a container the text never names
        self.assertEqual((unpin["status"], unpin["fragment"]["phase"]), ("unparsed", "then"))
        collapse = ops_of(self.plan, "REQ-5")  # `its` with no container before it
        self.assertEqual((collapse["status"], collapse["fragment"]["phase"]), ("unparsed", "when"))

    def test_pronoun_prefix_and_repeat_scopes(self):
        masked, names = scenarios.mask("Hover over the article for `Card 3.1`, activate its `More` button, and activate `Pin` twice")
        context, ops = {}, []
        for clause in scenarios._clauses(masked):
            ops.extend(scenarios._when_clause(clause, names, context))
        self.assertEqual([(o["op"], o["target"]["name"]) for o in ops],
                         [("hover", "Card 3.1"), ("click", "More"), ("click", "Pin"), ("click", "Pin")])
        self.assertEqual(ops[1]["target"]["scope"]["name"], "Card 3.1")
        masked, names = scenarios.mask("In the `Card 4.1` article, activate `More` and activate `Unpin`")
        context, ops = {}, []
        for clause in scenarios._clauses(masked):
            ops.extend(scenarios._when_clause(clause, names, context))
        self.assertEqual([o["target"]["scope"] for o in ops],
                         [{"type": "named", "name": "Card 4.1", "roles": ["article"], "strict": False}] * 2)


@unittest.skipUnless(BOOKSTACK.is_file(), "public BookStack exercise requirements are not present")
class BookStackPlanCase(unittest.TestCase):
    def test_coverage_and_known_shapes(self):
        plan = scenarios.plan(BOOKSTACK.read_text(encoding="utf-8"))
        self.assertGreaterEqual(plan["coverage"]["parsed"] / plan["coverage"]["total"], 0.8)
        unparsed = {s["id"] for s in plan["scenarios"] if s["status"] != "parsed"}
        self.assertEqual(unparsed, {"REQ-6.1.3", "REQ-7.1", "REQ-7.2", "REQ-8.2", "REQ-9.1"})
        delete = ops_of(plan, "REQ-4.4.1")
        self.assertEqual(delete["substitutions"], {"Shelf 4.2.1": "Shelf 4.4.1"})
        draft = [(o["src"], o["op"], (o.get("target") or {}).get("name")) for o in ops_of(plan, "REQ-6.1.2")["ops"]]
        self.assertLess(draft.index(("REQ-2.2", "click", "Login")), draft.index(("REQ-6.1.1", "click", "New Page")))
        self.assertIn(("REQ-1.2", "click", "BookStack"), draft)


if __name__ == "__main__":
    unittest.main()
