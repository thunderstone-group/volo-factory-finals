#!/usr/bin/env python3
"""Experimental V3 entry preserving the platform's pre-existing runner metadata."""
import argparse
import contextlib
import io
import json
from pathlib import Path
import tempfile
from oneshot import platform_entry
from oneshot.v3 import entry


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('requirement_path', type=Path)
    parser.add_argument('--output-dir', required=True, type=Path)
    parser.add_argument('--type', choices=('web',), default='web')
    args = parser.parse_args(argv)
    try:
        output = platform_entry.check_output(args.output_dir)
        output.parent.mkdir(parents=True, exist_ok=True)
        # V3 evidence is a sibling of this directory, so cleaning the private
        # application stage does not remove its request/observation evidence.
        with tempfile.TemporaryDirectory(prefix='.volo-v3-app-', dir=output.parent) as temp:
            staged = Path(temp)
            captured = io.StringIO()
            with contextlib.redirect_stdout(captured):
                code = entry.main([str(args.requirement_path), '--output-dir', str(staged), '--type', args.type])
            result = json.loads(captured.getvalue())
            if code:
                print(json.dumps(result, ensure_ascii=False))
                return code
            platform_entry.publish(staged, output)
            result['platform_output'] = str(output)
            result['runner_metadata_preserved'] = True
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except (OSError, ValueError) as exc:
        print(json.dumps({'schema': 'minimal-v3-entry/v1', 'delivered': False,
                          'error': {'stage': 'platform_publication', 'code': type(exc).__name__},
                          'verified_requirements': []}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
