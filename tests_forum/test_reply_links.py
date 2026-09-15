"""Synthetic reply-link normalization; no network or credentials."""
import unittest
from tools.qiwoo_cli.client import normalize_post, ForumError

class ReplyLinkTests(unittest.TestCase):
    def post(self, **extra):
        return dict(id=101, post_number=5, topic_id=16, username="synthetic", created_at="2026-09-16T00:00:00Z", cooked="<p>Synthetic answer</p>", **extra)

    def test_reply_number_is_preserved_and_optional(self):
        self.assertEqual(normalize_post(self.post(reply_to_post_number=3),16)["reply_to_post_number"],3)
        self.assertIsNone(normalize_post(self.post(),16)["reply_to_post_number"])

    def test_invalid_reply_number_is_not_silently_accepted(self):
        for value in (0,-1,True,"3",[],{}):
            with self.subTest(value=value), self.assertRaises(ForumError):
                normalize_post(self.post(reply_to_post_number=value),16)
