"""Explicit seven-file V2 package; V0/V1 defaults remain unchanged."""
import argparse
import json
from pathlib import Path
from scripts.package_minimal_v1 import build as package

FILES = {'main.py':'oneshot/v2/main.py', 'v1.py':'oneshot/v1/main.py',
         'core.py':'oneshot/main.py', 'dialect.md':'oneshot/v1/dialect.md',
         'requirements.txt':'oneshot/requirements.txt',
         'interaction.js':'oneshot/v2/interaction.js', 'navigation.js':'oneshot/v2/navigation.js'}

def build(output):
    return package(output, files=FILES, candidate='minimal-v2')

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',required=True,type=Path)
    print(json.dumps(build(parser.parse_args().output),indent=2))
