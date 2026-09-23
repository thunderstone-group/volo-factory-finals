"""Grep gate: the packaged files name no practice task.

Compliance (docs/reference/preliminary-rules.md, 合规): the package may not carry the names or business
wording of a practice or formal task; the organizer audits the code. The gate reads exactly the files
`scripts/package_oneshot.py` ships and matches case-insensitively. The English verb "keep" is allowed;
only Keep used as a product name is flagged.
"""
import re
import unittest

from scripts import package_oneshot as pack

PATTERNS = {
    # Task and product names.
    "12306": r"12306",
    "Ctrip": r"ctrip|携程",
    "BookStack": r"book\s*stack",
    "PrestaShop": r"presta\s*shop",
    "Stack Overflow": r"stack\s*overflow",
    "Keep as a product": (r"google\s+keep|\b(?:lite|web|local|platform)\s+keep\b|\bkeep['’]s\b"
                          r"|\bkeep\s+(?:runs?|failures?|probes?|samples?|replays?|suites?|holdout|r\d+\w*|v\d+)\b"
                          r"|\bkeep\s+\d+\s*(?:/|of)\s*\d+|\b(?:round\s+\d+\w*|r\d+\w*)\s+keep\b"),
    # Seed and control names of the notes practice task.
    "notes-task names": (r"sprint goals|groceries|take a note|note editor|note content|note trashed|note archived"
                         r"|notes workspace|label work|travel plans|delete me \d|garden tasks|team retro"
                         r"|project ideas|weekend plan|meeting agenda|movie list|study schedule|design review"
                         r"|call dentist|farmers market|initial editable content|edit labels|change labels"
                         r"|pin this note|unpin note|delete note|move (?:new notes|checked items) to the bottom"),
    # Seed and control names of the wiki practice task.
    "wiki-task names": (r"\b(?:shelf|book|page|chapter|draft)\s+(?:created\s+|updated\s+|draft\s+)?\d+(?:\.\d+)+"
                        r"|created by req-|write your page content here|shelf creation form|shelf list"
                        r"|(?:create|edit) (?:shelf|book) form|recently updated pages|my recently viewed"
                        r"|my recent drafts|my most viewed favorites|(?:shelf|book) tags"
                        r"|knowledge-base, docs|manual, handbook"),
    # Names and screenshot wording of the large practice tasks.
    "large-task names": (r"from station|departure time|direct trains?|transfer plans?|出发城市|到达城市|出发地|到达地"
                         r"|出发日期|邮箱/用户名/手机号|提交订单|搜航班号|添加返程|main question feed"
                         r"|right sidebar widgets|watch tag|order history and details"),
}
GATE = re.compile("|".join(f"(?:{p})" for p in PATTERNS.values()), re.IGNORECASE)


def packaged():
    return tuple(pack.FILES) + tuple(pack.scaffold_files())


def hits(text):
    return [m.group(0) for m in GATE.finditer(text)]


class PracticeNameGate(unittest.TestCase):
    def test_packaged_files_name_no_practice_task(self):
        found = []
        for name in packaged():
            text = (pack.SOURCE / name).read_text(encoding="utf-8", errors="replace")
            for number, line in enumerate(text.splitlines(), 1):
                found += [f"{name}:{number}: {match!r}" for match in hits(line)]
        self.assertEqual(found, [], "practice names in the package:\n" + "\n".join(found))

    def test_product_names_match_and_the_verb_keep_does_not(self):
        for phrase in ("Google Keep", "Lite Keep", "on one Keep run", "13 of 15 Keep failures", "local Keep probe",
                       "Keep 5/32", "Keep's sidebar", "KEEP r11", "round 24 Keep b", "r26b Keep", "Lite Bookstack",
                       "Book Stack", "StackOverflow", "Stack Overflow", "PrestaShop", "a 12306 run", "Ctrip",
                       "Sprint goals", "GROCERIES", "Shelf 4.3.1", "Shelf 7.1", "Book Updated 5.4.1", "出发城市",
                       "到达城市"):
            self.assertTrue(hits(phrase), phrase)
        for phrase in ("Keep every function; extend", "Keep actions unique within the required scope",
                       "keep the record's layout stable", "Keep the scaffold's delegated events reachable",
                       "keep running", "keep tests green", "keep app.js small", "Keep a stable layout",
                       "keep both", "it keeps serving", "Keep one completion action", "Keep typed values",
                       "Keep distinct named fixtures distinct", "a book, a page, a shelf", "Archive item",
                       "Add item", "Item deleted", "Sign Out", "Search"):
            self.assertEqual(hits(phrase), [], phrase)


if __name__ == "__main__":
    unittest.main()
