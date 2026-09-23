"""Model-translation fallback regressions. Requirements and model replies are SYNTHETIC; no gateway is called."""
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from oneshot import scenario_check, scenario_translate, scenarios

REQUIREMENTS = """id: ROOT
name: Synthetic Board
type: FOLDER
children:
  - id: REQ-1
    name: Open Board
    type: ATOMIC
    description: 'Open the board. It shows a region named `Cards` and a button named `Add card`; search matches are `mark` elements.'
    dependencies: []
    scenarios:
      - name: Open Board
        steps:
          - keyword: GIVEN
            content: The system is accessible.
          - keyword: WHEN
            content: Open the application entry URL.
          - keyword: THEN
            content: The page shows the `Cards` region and the `Add card` button.
  - id: REQ-2
    name: Archive Card
    type: ATOMIC
    description: 'Archive a card with its `Archive` button. The card shows status `Card archived`. Seed data: card "Card 2".'
    dependencies: [REQ-1]
    scenarios:
      - name: Archive Card
        steps:
          - keyword: GIVEN
            content: The user is somewhere unusual.
          - keyword: WHEN
            content: The user archives the card.
          - keyword: THEN
            content: The card disappears and a status appears.
  - id: REQ-3
    name: Rename Card
    type: ATOMIC
    description: 'Rename a card. Seed data: card "Card 3".'
    dependencies: [REQ-1]
    scenarios:
      - name: Rename Card
        steps:
          - keyword: GIVEN
            content: The user sees the board in a mood.
          - keyword: WHEN
            content: The user renames it.
          - keyword: THEN
            content: It has a new name.
"""

GOOD = {"id": "REQ-2", "steps": [
    {"phase": "given", "do": "open"},
    {"phase": "when", "do": "hover", "role": "article", "name": "Card 2"},
    {"phase": "when", "do": "click", "role": "button", "name": "Archive", "in": {"role": "article", "name": "Card 2"}},
    {"phase": "then", "do": "expect", "role": "article", "name": "Card 2", "count": "none"},
    {"phase": "then", "do": "expect", "role": "text", "name": "Card archived."},
    {"phase": "then", "do": "expect", "role": "button", "name": "Add card", "attr": {"aria-pressed": "false"}},
    {"phase": "then", "do": "expect", "tag": "mark", "name": "Cards"},
    {"phase": "then", "do": "expect", "role": "region", "count": "one"}]}


def reply(*items):
    return json.dumps({"scenarios": list(items)})


class FakeCall:
    def __init__(self, content, usage=None):
        self.content, self.usage, self.calls = content, usage or {"prompt_tokens": 1000, "completion_tokens": 500}, []

    def __call__(self, messages, base, key, model):
        self.calls.append(messages)
        return self.content, self.usage, "stop", 0.1


class ValidateCase(unittest.TestCase):
    def setUp(self):
        self.corpus = scenario_translate._corpus(scenarios.load_requirements(REQUIREMENTS))

    def test_a_valid_translation_becomes_executor_ops(self):
        ops = scenario_translate.validate(GOOD, self.corpus, "REQ-2")
        self.assertEqual([op["op"] for op in ops], ["goto", "hover", "click", "expect", "expect", "expect", "expect", "expect"])
        self.assertEqual(ops[2]["target"]["scope"], {"type": "named", "name": "Card 2", "roles": ["article"], "strict": False})
        self.assertEqual((ops[3]["count"], ops[3]["target"]["kind"]), ("none", "structure"))
        self.assertEqual(ops[4]["target"]["kind"], "text")  # trailing punctuation aside, `Card archived` is quoted
        self.assertEqual(ops[5]["attrs"], {"aria-pressed": "false"})
        self.assertEqual((ops[6]["target"]["kind"], ops[6]["target"]["tag"]), ("tag", "mark"))
        self.assertEqual(ops[7]["target"], {"name": "", "roles": ["region"], "kind": "structure"})
        self.assertTrue(all(op["src"] == "REQ-2" for op in ops))

    def test_invented_names_unknown_steps_and_missing_checks_are_rejected(self):
        bad = [
            ({"phase": "when", "do": "click", "role": "button", "name": "Archive all"}, "not a quoted name"),
            ({"phase": "when", "do": "drag", "role": "button", "name": "Archive"}, "not a supported step type"),
            ({"phase": "when", "do": "click", "role": "widget", "name": "Archive"}, "not an ARIA role"),
            ({"phase": "then", "do": "expect", "role": "button", "name": "Archive", "count": "two"}, "count"),
            ({"phase": "when", "do": "press", "key": "F13"}, "not a supported key"),
            ({"phase": "when", "do": "click", "role": "button", "name": "Archive", "in": {"role": "region", "name": "Board"}},
             "not a quoted name"),
            ({"phase": "then", "do": "expect", "tag": "blink", "name": "Cards"}, "not supported"),
        ]
        for step, reason in bad:
            item = {"id": "REQ-2", "steps": [{"phase": "given", "do": "open"}, step,
                                             {"phase": "then", "do": "expect", "role": "button", "name": "Add card"}]}
            with self.assertRaisesRegex(scenario_translate.Invalid, reason):
                scenario_translate.validate(item, self.corpus, "REQ-2")
        with self.assertRaisesRegex(scenario_translate.Invalid, "no expect step"):
            scenario_translate.validate({"id": "REQ-2", "steps": [{"phase": "given", "do": "open"}]}, self.corpus, "REQ-2")
        with self.assertRaisesRegex(scenario_translate.Invalid, "given step after"):
            scenario_translate.validate({"id": "REQ-2", "steps": [
                {"phase": "when", "do": "click", "role": "button", "name": "Add card"},
                {"phase": "given", "do": "open"},
                {"phase": "then", "do": "expect", "role": "button", "name": "Add card"}]}, self.corpus, "REQ-2")

    def test_a_value_typed_earlier_may_be_named_later_and_open_is_added_first(self):
        ops = scenario_translate.validate({"id": "REQ-3", "steps": [
            {"phase": "when", "do": "fill", "role": "textbox", "name": "Cards", "value": "Renamed card"},
            {"phase": "then", "do": "expect", "role": "article", "name": "Renamed card"}]}, self.corpus, "REQ-3")
        self.assertEqual([op["op"] for op in ops], ["goto", "fill", "expect"])


class CoverageCase(unittest.TestCase):
    """A reply that drops part of the scenario or puts a state on the wrong element is rejected."""

    TEXT = """id: ROOT
type: FOLDER
children:
  - id: REQ-1
    name: Menu
    type: ATOMIC
    description: 'A unique button named `Toggle panel` in the top navigation bar exposes aria-expanded. The panel region
      is named `Panel`.'
    dependencies: []
    scenarios:
      - name: Menu
        steps:
          - keyword: GIVEN
            content: The user is on the home page.
          - keyword: WHEN
            content: The user activates the unique button named `Toggle panel` in the top navigation bar.
          - keyword: THEN
            content: The page shows the `Panel` region.
  - id: REQ-2
    name: Collapse
    type: ATOMIC
    dependencies: [REQ-1]
    scenarios:
      - name: Collapse
        steps:
          - keyword: GIVEN
            content: The `Panel` region is open in some way.
          - keyword: WHEN
            content: Toggle it back.
          - keyword: THEN
            content: The panel collapses.
"""

    def setUp(self):
        requirements = scenarios.load_requirements(self.TEXT)
        self.corpus = scenario_translate._corpus(requirements)
        self.scenario = requirements[2]["scenarios"][0]
        self.known = scenarios.plan(self.TEXT)["known_steps"]

    def steps(self, *middle):
        return {"id": "REQ-2", "steps": [{"phase": "given", "do": "open"}, *middle]}

    def test_the_scenario_names_must_all_be_used(self):
        item = self.steps({"phase": "then", "do": "expect", "role": "button", "name": "Toggle panel"})
        with self.assertRaisesRegex(scenario_translate.Invalid, "GIVEN name `Panel` is not used"):
            scenario_translate.validate(item, self.corpus, "REQ-2", scenario=self.scenario)

    def test_aria_states_belong_to_roles_that_support_them(self):
        item = self.steps({"phase": "when", "do": "click", "role": "button", "name": "Toggle panel"},
                          {"phase": "then", "do": "expect", "role": "region", "name": "Panel",
                           "attr": {"aria-expanded": "false"}})
        with self.assertRaisesRegex(scenario_translate.Invalid, "aria-expanded is not a state of role region"):
            scenario_translate.validate(item, self.corpus, "REQ-2", scenario=self.scenario)

    def test_a_dropped_location_comes_back_from_the_rules(self):
        item = self.steps({"phase": "when", "do": "click", "role": "button", "name": "Toggle panel", "unique": True},
                          {"phase": "then", "do": "expect", "role": "button", "name": "Toggle panel",
                           "attr": {"aria-expanded": "false"}},
                          {"phase": "then", "do": "expect", "role": "region", "name": "Panel", "count": "none"})
        ops = scenario_translate.validate(item, self.corpus, "REQ-2", scenario=self.scenario, known=self.known)
        self.assertEqual(ops[1]["target"]["scope"], {"type": "landmark"})


class TranslateCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.cache = Path(self.temp.name)
        self.planned = scenarios.plan(REQUIREMENTS)
        self.assertEqual(self.planned["coverage"], {"total": 3, "parsed": 1})

    def tearDown(self):
        self.temp.cleanup()

    def test_one_call_for_all_unparsed_scenarios_then_the_cache(self):
        fake = FakeCall(reply(GOOD, {"id": "REQ-3", "untranslatable": "no new name is given"}),
                        {"prompt_tokens": 1000, "completion_tokens": 500, "prompt_cache_hit_tokens": 200})
        first = scenario_translate.translate(REQUIREMENTS, self.planned, key="synthetic", cache_dir=self.cache, call=fake)
        self.assertEqual(len(fake.calls), 1)
        self.assertEqual((first["status"], sorted(first["accepted"]), first["calls"]), ("called", ["REQ-2"], 1))
        self.assertEqual(first["rejected"], {"REQ-3": "model: no new name is given"})
        self.assertAlmostEqual(first["cost_cny"], (800 * 3.0 + 200 * 0.1 + 500 * 9.0) / 1e6)
        user = fake.calls[0][1]["content"]
        self.assertIn('"id": "REQ-1"', user)  # the dependency travels with the scenarios that need it
        self.assertEqual(user.count('"id": "REQ-2"'), 2)  # once as context, once as a request
        again = scenario_translate.translate(REQUIREMENTS, self.planned, key="synthetic", cache_dir=self.cache, call=fake)
        self.assertEqual(len(fake.calls), 1)
        self.assertEqual((again["status"], again["cost_cny"], sorted(again["accepted"])), ("cached", 0.0, ["REQ-2"]))
        record = json.loads(Path(first["cache"]).read_text())
        self.assertEqual(record["messages"], fake.calls[0])  # the true prompt stays in the cache record

    def test_no_key_failed_call_and_broken_reply(self):
        fake = FakeCall(reply(GOOD))
        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}):
            summary = scenario_translate.translate(REQUIREMENTS, self.planned, cache_dir=self.cache, call=fake)
        self.assertEqual((summary["status"], fake.calls), ("no_key", []))

        def fail(*args):
            raise scenario_translate.TranslateError("model HTTP 502")
        summary = scenario_translate.translate(REQUIREMENTS, self.planned, key="synthetic", cache_dir=self.cache, call=fail)
        self.assertEqual((summary["status"], summary["error"], summary["accepted"]), ("failed", "model HTTP 502", {}))
        summary = scenario_translate.translate(REQUIREMENTS, self.planned, key="synthetic", cache_dir=self.cache,
                                               call=FakeCall("I cannot do that."))
        self.assertEqual(summary["accepted"], {})
        self.assertEqual(set(summary["rejected"]), {"REQ-2", "REQ-3"})

    def test_run_merges_accepted_translations_and_can_be_switched_off(self):
        fake = FakeCall("```json\n" + reply(GOOD) + "\n```")
        with patch.object(scenario_translate, "CACHE_DIR", self.cache), \
                patch.object(scenario_translate, "call_model", fake), \
                patch.dict(os.environ, {"OPENAI_API_KEY": "synthetic", "SCENARIO_TRANSLATE": "1"}):
            planned = scenarios.plan(REQUIREMENTS)
            summary = scenario_check.translate_unparsed(REQUIREMENTS, planned)
        by_id = {item["id"]: item for item in planned["scenarios"]}
        self.assertEqual((by_id["REQ-2"]["status"], by_id["REQ-2"]["source"]), ("parsed", "model"))
        self.assertEqual((by_id["REQ-3"]["status"], summary["accepted"]), ("unparsed", ["REQ-2"]))
        with patch.dict(os.environ, {"SCENARIO_TRANSLATE": "0"}):
            self.assertEqual(scenario_check.translate_unparsed(REQUIREMENTS, scenarios.plan(REQUIREMENTS)),
                             {"status": "disabled"})


if __name__ == "__main__":
    unittest.main()
