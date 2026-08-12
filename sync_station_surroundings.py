#!/usr/bin/env python3
"""Merge curated surroundings into the generated browser data without losing wiki fields."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


START_MARKER = "window.subwayDataMap = "
END_MARKER = ";\n\n// Keep window.subwayData"


def load_compiled_data(path: Path) -> tuple[dict[str, Any], str, str]:
    content = path.read_text(encoding="utf-8")
    start = content.index(START_MARKER) + len(START_MARKER)
    end = content.index(END_MARKER, start)
    return json.loads(content[start:end]), content[:start], content[end:]


def merge_surroundings(compiled_data: dict[str, Any], surroundings_data: dict[str, Any]) -> int:
    merged_count = 0
    for city_key, stations in surroundings_data.items():
        if city_key in {"schemaVersion", "generatedAt"}:
            continue
        if city_key not in compiled_data:
            raise ValueError(f"unknown city in surroundings data: {city_key}")
        if not isinstance(stations, dict):
            raise ValueError(f"stations for {city_key} must be an object")
        nodes_by_name = {node["name"]: node for node in compiled_data[city_key].get("nodes", [])}
        for station_name, surroundings in stations.items():
            if station_name not in nodes_by_name:
                raise ValueError(f"unknown station in surroundings data: {city_key}/{station_name}")
            node = nodes_by_name[station_name]
            node.setdefault("wiki", {})["surroundings"] = surroundings
            merged_count += 1
    return merged_count


def merge_station_status(compiled_data: dict[str, Any], status_data: dict[str, Any]) -> int:
    merged_count = 0
    for city_key, stations in status_data.items():
        if city_key in {"schemaVersion", "generatedAt"}:
            continue
        if city_key not in compiled_data:
            raise ValueError(f"unknown city in station status data: {city_key}")
        if not isinstance(stations, dict):
            raise ValueError(f"stations for {city_key} must be an object")
        nodes_by_name = {node["name"]: node for node in compiled_data[city_key].get("nodes", [])}
        for station_name, status in stations.items():
            if station_name not in nodes_by_name:
                raise ValueError(f"unknown station in status data: {city_key}/{station_name}")
            if not isinstance(status, dict) or status.get("state") != "temporarily_closed":
                raise ValueError(f"unsupported status for {city_key}/{station_name}")
            nodes_by_name[station_name].setdefault("wiki", {})["operationalStatus"] = status
            merged_count += 1
    return merged_count


def write_compiled_data(path: Path, compiled_data: dict[str, Any], prefix: str, suffix: str) -> None:
    output = prefix + json.dumps(compiled_data, ensure_ascii=False, indent=2) + suffix
    path.write_text(output, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--status", type=Path, default=None)
    args = parser.parse_args()
    surroundings_data = json.loads(args.input.read_text(encoding="utf-8"))
    compiled_data, prefix, suffix = load_compiled_data(args.data)
    count = merge_surroundings(compiled_data, surroundings_data)
    status_path = args.status or args.input.with_name("station_status.json")
    status_count = 0
    if status_path.exists():
        status_count = merge_station_status(
            compiled_data,
            json.loads(status_path.read_text(encoding="utf-8")),
        )
    write_compiled_data(args.data, compiled_data, prefix, suffix)
    print(f"Merged surroundings for {count} stations and statuses for {status_count} stations into {args.data}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
