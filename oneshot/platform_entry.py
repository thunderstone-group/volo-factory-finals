#!/usr/bin/env python3
"""Platform adapter: preserve runner metadata; publish only new application roots."""
import argparse
import os
from pathlib import Path
import sys
import tempfile
try:
    import v2 as implementation
except ModuleNotFoundError:
    from oneshot.v2 import main as implementation

ROOTS = ('frontend', 'backend')

def safe_path(value):
    path = Path(os.path.abspath(value))
    if any(p.is_symlink() for p in (path, *path.parents)):
        raise ValueError('symlink output path refused')
    return path

def check_output(output):
    output = safe_path(output)
    if output.exists() and not output.is_dir():
        raise ValueError('output must be a directory')
    for name in ROOTS:
        child = output/name
        if child.is_symlink() or (child.exists() and (not child.is_dir() or any(child.iterdir()))):
            raise ValueError('existing application root would be overwritten: '+name)
    return output

def publish(candidate, output):
    check_output(output)
    # The source reader refuses links and requires both application manifests.
    implementation.core.read_template(candidate)
    if set(p.name for p in candidate.iterdir()) != set(ROOTS):
        raise ValueError('unexpected generated top-level path')
    output.mkdir(parents=True, exist_ok=True)
    moved, emptied = [], []
    try:
        for name in ROOTS:
            destination = output/name
            check_output_root = safe_path(destination)
            if check_output_root.exists():
                if not check_output_root.is_dir() or any(check_output_root.iterdir()):
                    raise ValueError('output changed before publication')
                check_output_root.rmdir(); emptied.append(name)
            (candidate/name).rename(destination); moved.append(name)
    except BaseException:
        # Never move or replace the runner's root, requirements, or .arc store.
        for name in reversed(moved):
            (output/name).rename(candidate/name)
        for name in emptied:
            (output/name).mkdir(exist_ok=True)
        raise

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('requirement_path',type=Path)
    parser.add_argument('--output-dir',required=True,type=Path)
    parser.add_argument('--type',default='web',choices=('web',))
    args=parser.parse_args(argv)
    try:
        output=check_output(args.output_dir)
        output.parent.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='.volo-platform-',dir=output.parent) as tmp:
            candidate=Path(tmp)/'application'
            code=implementation.main([str(args.requirement_path),'--output-dir',str(candidate),'--type',args.type])
            if code:return code
            publish(candidate,output)
        print('[minimal] platform publication complete; runner metadata preserved',flush=True)
        return 0
    except Exception as exc:
        key=os.environ.get('OPENAI_API_KEY','')
        text=str(exc).replace(key,'[REDACTED]') if key else str(exc)
        print('[minimal] platform publication failed: '+text,file=sys.stderr)
        return 1

if __name__=='__main__':raise SystemExit(main())
