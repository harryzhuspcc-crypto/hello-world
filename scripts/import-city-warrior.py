#!/usr/bin/env python3
"""Import a tested Godot Web release without publishing or reading credentials."""

import argparse
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent
LIMIT = 25 * 1024 * 1024


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="City Warrior build/web directory")
    parser.add_argument("--commit", required=True, help="Source game Git commit")
    args = parser.parse_args()
    source = args.source.resolve()
    destination = ROOT / "public/embedded/city-warrior"
    destination.mkdir(parents=True, exist_ok=True)
    filenames = (
        "index.js", "index.pck", "index.png", "index.icon.png",
        "index.apple-touch-icon.png", "index.audio.worklet.js",
        "index.audio.position.worklet.js",
    )
    for filename in filenames:
        shutil.copyfile(source / filename, destination / filename)

    wasm = (source / "index.wasm").read_bytes()
    split = 20 * 1024 * 1024
    if not split < len(wasm) <= split * 2:
        raise SystemExit("Expected a WASM binary between 20 and 40 MiB")
    (destination / "index.wasm.parta").write_bytes(wasm[:split])
    (destination / "index.wasm.partb").write_bytes(wasm[split:])
    shutil.copyfile(ROOT / "scripts/city-warrior-wasm.js", destination / "cloudflare-wasm.js")
    html = (source / "index.html").read_text()
    marker = '<script src="index.js"></script>'
    if html.count(marker) != 1:
        raise SystemExit("Unexpected Godot HTML: engine script marker missing or duplicated")
    html = html.replace(marker, '<script src="cloudflare-wasm.js"></script>\n\t\t' + marker)
    (destination / "index.html").write_text(html.rstrip() + "\n")
    manifest = {
        "game": "city-warrior", "source_commit": args.commit,
        "wasm_sha256": hashlib.sha256(wasm).hexdigest(),
        "files": {},
    }
    for path in sorted(destination.iterdir()):
        if path.name == "release.json":
            continue
        if path.stat().st_size >= LIMIT:
            raise SystemExit(f"Asset exceeds Cloudflare limit: {path}")
        manifest["files"][path.name] = {
            "bytes": path.stat().st_size,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }
    (destination / "release.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Imported {args.commit} into {destination}")


if __name__ == "__main__":
    main()
