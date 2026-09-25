"""Merge exported shape files into the shared library everyone gets.

Usage (from the repo folder):
    python3 tools/merge_shapes.py my-shapes.json [more-shapes.json ...]

Shapes with the same LaTeX are combined; duplicate drawings are dropped.
Then commit and push shapes/shared.json.
"""

import json
import sys
from pathlib import Path

FORMAT = "math-to-latex-shapes"
SHARED = Path(__file__).resolve().parent.parent / "shapes" / "shared.json"


def load(path):
    data = json.loads(Path(path).read_text())
    if data.get("format") != FORMAT or not isinstance(data.get("shapes"), list):
        sys.exit(f"{path} is not a shapes file exported from the site.")
    return data["shapes"]


def main(paths):
    if not paths:
        sys.exit(__doc__)
    shared = load(SHARED)
    added_shapes = added_drawings = 0
    for path in paths:
        for shape in load(path):
            existing = next((s for s in shared if s["latex"] == shape["latex"]), None)
            if existing is None:
                shared.append({"id": shape["id"], "latex": shape["latex"], "samples": list(shape["samples"])})
                added_shapes += 1
                added_drawings += len(shape["samples"])
                continue
            seen = {json.dumps(s, sort_keys=True) for s in existing["samples"]}
            for sample in shape["samples"]:
                key = json.dumps(sample, sort_keys=True)
                if key not in seen:
                    existing["samples"].append(sample)
                    seen.add(key)
                    added_drawings += 1
    SHARED.write_text(json.dumps({"format": FORMAT, "version": 1, "shapes": shared}, separators=(",", ":")) + "\n")
    print(f"Added {added_shapes} new shapes and {added_drawings} drawings. {SHARED} now has {len(shared)} shapes.")


if __name__ == "__main__":
    main(sys.argv[1:])
