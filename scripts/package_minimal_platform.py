"""Eight-file V2 platform compatibility baseline; excludes V3 and skill repair."""
import argparse
import json
from pathlib import Path
from scripts.package_minimal_v1 import build as package
from scripts.package_minimal_v2 import FILES as V2_FILES
FILES={**V2_FILES,'main.py':'oneshot/platform_entry.py','v2.py':'oneshot/v2/main.py'}
def build(output):return package(output,files=FILES,candidate='minimal-v2-platform-compat')
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',required=True,type=Path)
    print(json.dumps(build(p.parse_args().output),indent=2))
