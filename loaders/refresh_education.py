#!/usr/bin/env python3
"""Refresh AAMC, ABA and BLS. Run from any directory with Python 3.9+."""
import argparse
import json
import os
import sys
import tempfile
from pathlib import Path

import aamc_facts
import aba_509
import bls_table11

DEST = Path(__file__).resolve().parents[1] / "data" / "imports"


def validate(bundle):
    sources = {s["id"]: s for s in bundle["sources"]}
    if len(sources) != len(bundle["sources"]) or any(not s["url"].startswith("https://") or not s["definition"].strip() or not s["retrieved_on"] for s in sources.values()):
        raise ValueError("Duplicate, unlinked or undefined source")
    keys = set()
    segments = {}
    for entry in bundle["series"]:
        source = sources.get(entry["source_id"])
        key = (entry["profession_id"], entry["family"], entry["group"], entry["year"])
        segment = entry["series_id"]
        if key in keys or not source or not entry["definition"].strip() or entry["definition"] != source["definition"]:
            raise ValueError(f"Duplicate, orphaned or undefined point: {key}")
        if segments.setdefault(segment, entry["definition"]) != entry["definition"]:
            raise ValueError(f"Different definitions in one segment: {segment}")
        if abs(entry["value"] - 100 * entry["numerator"] / entry["denominator"]) >= 0.000001:
            raise ValueError(f"Share disagrees with publisher numerator/denominator: {key}")
        keys.add(key)


def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("--source", choices=("all","aamc","aba","bls"), default="all")
    requests = args.add_mutually_exclusive_group()
    requests.add_argument("--offline",action="store_true",help="Recompute from previously reviewed aggregate cells")
    requests.add_argument("--strict-network",action="store_true",help="Fail if an original cannot be fetched and validated")
    args.add_argument("--aba-through", type=int, default=2025, help="Last verified ABA reporting year to request")
    args.add_argument("--output-dir", type=Path, default=DEST)
    opt = args.parse_args()
    if not 2017 <= opt.aba_through <= 2100:
        args.error("--aba-through must be 2017 or later and no later than 2100")
    warnings = []
    kw = dict(download=not opt.offline,strict=opt.strict_network,warnings=warnings)
    loaders = {"aamc": lambda:aamc_facts.load(**kw), "aba": lambda:aba_509.load(**kw,last_year=opt.aba_through), "bls":lambda:bls_table11.load(**kw)}
    names = list(loaders) if opt.source == "all" else [opt.source]
    bundles = {}
    for key in names:
        bundles[key]=loaders[key]()
        validate(bundles[key])
    opt.output_dir.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(dir=opt.output_dir) as tmp:
        for key, bundle in bundles.items():
            name = f"{key}.json"
            path = Path(tmp,name)
            path.write_text(json.dumps(bundle,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
            os.replace(path,opt.output_dir/name)
            print(f"{key}: {len(bundle['sources'])} tables, {len(bundle['series'])} measured observations")
    for warning in sorted(warnings):
        print(f"Source check: {warning}",file=sys.stderr)


if __name__ == "__main__":
    main()
