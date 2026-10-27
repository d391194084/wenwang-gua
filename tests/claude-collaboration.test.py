"""Behavioral checks for the collaboration gate; no Claude/API calls."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / '.agents/skills/claude-collaboration/scripts/collaborate.py'


class CollaborationGateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('collaborate', SCRIPT)
        cls.mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.mod)

    def test_nonzero_and_json_failure_are_both_rejected(self):
        self.assertFalse(self.mod.result_ok(1, {'tested': 1, 'failures': 0}))
        self.assertFalse(self.mod.result_ok(0, {'tested': 1, 'failures': 1}))
        self.assertFalse(self.mod.result_ok(0, {}))
        self.assertTrue(self.mod.result_ok(0, {'tested': 2, 'failures': 0}))

    def test_corpus_known_failures_cannot_pass_gate(self):
        data = {'failures': 0, 'clear': {'tested': 439, 'correct': 438}, 'newFailures': []}
        self.assertFalse(self.mod.result_ok(0, data))
        data['clear']['correct'] = 439
        self.assertTrue(self.mod.result_ok(0, data))
        data['newFailures'] = [{'question': 'new failure'}]
        self.assertFalse(self.mod.result_ok(0, data))

    def test_missing_suite_is_failed_not_skipped(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t)
            out = root / 'evidence'
            result = self.mod.check(root, out, ['absent'])
            self.assertFalse(result['passed'])
            self.assertEqual(result['tests'][0]['error'], 'Missing required test')

    def test_existing_evidence_cannot_be_overwritten(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t)
            with self.assertRaises(FileExistsError):
                self.mod.check(root, root, ['absent'])

    def test_changed_files_and_new_files_invalidate_snapshot(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t)
            (root / '3-2.html').write_text('before', encoding='utf-8')
            before = self.mod.snapshot(root)
            (root / '3-2.html').write_text('after', encoding='utf-8')
            self.assertNotEqual(before, self.mod.snapshot(root))
            (root / 'tests').mkdir()
            (root / 'tests/new.cjs').write_text('new', encoding='utf-8')
            self.assertNotEqual(before, self.mod.snapshot(root))

    def test_claude_error_or_missing_receipt_is_not_success(self):
        good = {'type': 'result', 'subtype': 'success', 'is_error': False, 'session_id': 'abc'}
        self.assertTrue(self.mod.receipt_ok(0, good))
        self.assertFalse(self.mod.receipt_ok(0, None))
        self.assertFalse(self.mod.receipt_ok(1, good))
        self.assertFalse(self.mod.receipt_ok(0, dict(good, is_error=True)))

    def test_source_mutation_during_test_invalidates_passing_output(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t)
            (root / 'tests').mkdir()
            (root / 'tests/fake.test.cjs').write_text('// fixture', encoding='utf-8')
            app = root / '3-2.html'
            app.write_text('before', encoding='utf-8')
            def mutate(*args, **kwargs):
                app.write_text('changed while running', encoding='utf-8')
                return SimpleNamespace(returncode=0, stdout=json.dumps({'tested': 2, 'failures': 0}), stderr='')
            with patch.object(self.mod.subprocess, 'run', side_effect=mutate):
                result = self.mod.check(root, root / 'evidence', ['fake'])
            self.assertTrue(result['tests'][0]['passed'])
            self.assertFalse(result['stable'])
            self.assertFalse(result['passed'])

    def test_invalid_json_or_incorrect_source_hash_cannot_pass(self):
        for output in ['not JSON', json.dumps({'tested': 1, 'failures': 0, 'sourceHash': 'wrong'})]:
            with self.subTest(output=output), tempfile.TemporaryDirectory() as t:
                root = Path(t)
                (root / 'tests').mkdir()
                (root / 'tests/fake.test.cjs').write_text('// fixture', encoding='utf-8')
                fake = SimpleNamespace(returncode=0, stdout=output, stderr='')
                with patch.object(self.mod.subprocess, 'run', return_value=fake):
                    result = self.mod.check(root, root / 'evidence', ['fake'])
                self.assertFalse(result['passed'])


if __name__ == '__main__':
    unittest.main()
