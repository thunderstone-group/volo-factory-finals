"""Discover provided tools deterministically without touching evaluator files."""
from __future__ import annotations

import json
import os
import subprocess
from collections import deque
from pathlib import Path


def discover_playwright(project: Path):
    candidates = ["playwright", "playwright-core"]
    browser_cache = os.getenv("PLAYWRIGHT_BROWSERS_PATH")
    if browser_cache and browser_cache != "0":
        for link in sorted((Path(browser_cache) / ".links").glob("*")):
            try:
                module = Path(link.read_text().strip())
                if module.is_dir():
                    candidates.extend([str(module.parent / "playwright"), str(module)])
            except OSError:
                pass
    # Search installation metadata, never test contents. Keep traversal shallow and bounded.
    queue = deque((p, 0) for p in [project / "node_modules", Path("/opt"),
                                  Path("/usr/local/lib/node_modules"), Path("/usr/share/nodejs")])
    visited = 0
    while queue and visited < 2500:
        directory, depth = queue.popleft()
        visited += 1
        if directory.name in ("playwright", "playwright-core") and (directory / "package.json").is_file():
            candidates.append(str(directory))
            continue
        if depth >= 5 or not directory.is_dir():
            continue
        try:
            for child in sorted(directory.iterdir()):
                if child.is_dir() and not child.is_symlink() and child.name not in (
                        ".git", "tests", "test", "examples", "docs", "browsers"):
                    queue.append((child, depth + 1))
        except OSError:
            continue
    probe = """const fs=require('node:fs');
for(const candidate of JSON.parse(process.argv[1])){
 try {const resolved=require.resolve(candidate);const pw=require(resolved);
 const executable=pw.chromium.executablePath();
 if(fs.existsSync(executable)){console.log(JSON.stringify({available:true,module:resolved,
 chromium_executable:executable}));process.exit(0);}}catch(e){}
}
console.log(JSON.stringify({available:false}));"""
    try:
        result = subprocess.run(["node", "-e", probe, json.dumps(list(dict.fromkeys(candidates)))],
                                cwd=project, capture_output=True, text=True, timeout=10)
        return json.loads(result.stdout) if result.returncode == 0 else {"available": False}
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return {"available": False}
