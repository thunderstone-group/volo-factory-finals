"""Separate nine-file low-effort candidate; frozen platform baseline is not replaced."""
import argparse
import json
from pathlib import Path
from scripts.package_minimal_v1 import build as package
from scripts.package_minimal_platform import FILES as PLATFORM_FILES
FILES={**PLATFORM_FILES, 'main.py':'oneshot/effort_entry.py', 'platform_entry.py':'oneshot/platform_entry.py'}
def build(output):return package(output,files=FILES,candidate='minimal-v2-low-effort')
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',required=True,type=Path)
    print(json.dumps(build(p.parse_args().output),indent=2))
