#!/usr/bin/env python3
"""Assemble sheet-B spec files: header + shared helper block + per-requirement body."""
import pathlib
W = pathlib.Path(__file__).resolve().parent
T = W.parent / 'tests'
helpers = (W / 'helpers.block.cjs').read_text()
header = "const { test, expect } = require('@playwright/test');\n\n"
for body in sorted((W / 'bodies').glob('*.cjs')):
    out = T / (body.stem + '.spec.cjs')
    out.write_text(header + helpers + '\n' + body.read_text())
    print('wrote', out.name)
