"""Load a requirement tree without asking a model to rediscover its structure."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

import yaml


@dataclass
class RequirementSet:
    root: Path
    document: dict
    nodes: list[dict]
    fingerprint: str
    assets: list[str]

    @classmethod
    def load(cls, root: Path) -> "RequirementSet":
        root = root.resolve()
        path = root / "requirements.yaml"
        raw = path.read_bytes()
        document = yaml.safe_load(raw)
        if not isinstance(document, dict):
            raise ValueError("requirements.yaml must contain a mapping")
        nodes, all_nodes = [], {}

        def walk(node, parents):
            if not isinstance(node, dict) or not node.get("id"):
                raise ValueError("Every requirement node needs an id")
            key = str(node["id"])
            if key in all_nodes:
                raise ValueError(f"Duplicate requirement id: {key}")
            all_nodes[key] = node
            children = node.get("children") or []
            if node.get("type") == "ATOMIC" or not children:
                nodes.append({**node, "id": key, "parents": parents})
            for child in children:
                walk(child, parents + [key])

        walk(document, [])
        for node in all_nodes.values():
            deps = node.get("dependencies") or []
            if not isinstance(deps, list):
                raise ValueError(f"Dependencies must be a list: {node['id']}")
            for dependency in deps:
                if str(dependency) not in all_nodes:
                    raise ValueError(f"Unknown dependency {dependency} for {node['id']}")

        # Expand dependencies on folders into their descendant atomic nodes.
        atomic = {node["id"]: node for node in nodes}
        def descendants(key):
            return [n["id"] for n in nodes if n["id"] == key or key in n["parents"]]
        dependencies = {}
        for node in nodes:
            keys = [node["id"], *node["parents"]]
            deps = {d for key in keys for dep in all_nodes[key].get("dependencies", []) or []
                    for d in descendants(str(dep))}
            if node["id"] in deps:
                raise ValueError(f"Self dependency: {node['id']}")
            dependencies[node["id"]] = deps
        ordered, remaining = [], set(atomic)
        while remaining:
            ready = [n["id"] for n in nodes
                     if n["id"] in remaining and not (dependencies[n["id"]] & remaining)]
            if not ready:
                raise ValueError("Cyclic requirement dependencies")
            for key in ready:
                ordered.append(atomic[key])
                remaining.remove(key)
        assets = sorted(str(p.relative_to(root)) for p in root.rglob("*")
                        if p.is_file() and not p.is_symlink() and p != path)
        digest = hashlib.sha256(raw)
        for name in assets:
            digest.update(name.encode())
            digest.update(hashlib.sha256((root / name).read_bytes()).digest())
        return cls(root, document, ordered, digest.hexdigest(), assets)

    def prompt(self) -> str:
        return json.dumps({"requirements": self.document,
                           "implementation_order": [n["id"] for n in self.nodes],
                           "reference_assets": self.assets}, ensure_ascii=False, indent=2)

    def batches(self, max_chars=24000, max_nodes=6):
        batches, current, size = [], [], 0
        for node in self.nodes:
            length = len(json.dumps(node, ensure_ascii=False))
            if current and (size + length > max_chars or len(current) >= max_nodes):
                batches.append(current)
                current, size = [], 0
            current.append(node)
            size += length
        if current:
            batches.append(current)
        return batches

    def batch_prompt(self, nodes):
        return json.dumps({
            "application": {k: v for k, v in self.document.items() if k != "children"},
            "all_requirements": [{"id": n["id"], "name": n.get("name", ""),
                                  "dependencies": n.get("dependencies", [])} for n in self.nodes],
            "current_batch": nodes,
            "reference_assets": [a for a in self.assets if (self.root / a).stat().st_size > 0],
        }, ensure_ascii=False, indent=2)
