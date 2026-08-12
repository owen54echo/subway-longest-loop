#!/usr/bin/env python3
"""Validate the curated station-surroundings source before it is compiled."""

from __future__ import annotations

import argparse
import json
import re
from datetime import date
from pathlib import Path
from typing import Any


ALLOWED_DISTANCE_TYPES = {"official", "map_estimate", "not_available"}
ALLOWED_VERIFICATIONS = {"verified", "needs_review"}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def load_compiled_data(path: Path) -> dict[str, Any]:
    content = path.read_text(encoding="utf-8")
    start_marker = "window.subwayDataMap = "
    end_marker = ";\n\n// Keep window.subwayData"
    start = content.index(start_marker) + len(start_marker)
    end = content.index(end_marker, start)
    return json.loads(content[start:end])


def _valid_date(value: Any) -> bool:
    if not isinstance(value, str) or not DATE_RE.fullmatch(value):
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


def _require_text(value: Any, field: str, context: str, errors: list[str]) -> None:
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{context}: {field} must be a non-empty string")


def _validate_source(source: Any, context: str, errors: list[str]) -> str | None:
    if not isinstance(source, dict):
        errors.append(f"{context}: source must be an object")
        return None
    for field in ("id", "publisher", "title", "url", "accessedAt", "type"):
        _require_text(source.get(field), field, context, errors)
    source_id = source.get("id") if isinstance(source.get("id"), str) else None
    if isinstance(source.get("url"), str) and not source["url"].startswith(("http://", "https://")):
        errors.append(f"{context}: url must use HTTP(S)")
    if not _valid_date(source.get("accessedAt")):
        errors.append(f"{context}: accessedAt must be YYYY-MM-DD")
    return source_id


def _validate_item(
    item: Any,
    context: str,
    source_ids: set[str],
    errors: list[str],
    require_distance: bool,
) -> None:
    if not isinstance(item, dict):
        errors.append(f"{context}: item must be an object")
        return
    for field in ("name", "type", "description", "reviewedAt", "verification"):
        _require_text(item.get(field), field, context, errors)
    if not _valid_date(item.get("reviewedAt")):
        errors.append(f"{context}: reviewedAt must be YYYY-MM-DD")
    if item.get("verification") not in ALLOWED_VERIFICATIONS:
        errors.append(f"{context}: invalid verification")

    references = item.get("sourceIds")
    if not isinstance(references, list) or not references or not all(isinstance(ref, str) for ref in references):
        errors.append(f"{context}: sourceIds must contain at least one source")
    else:
        for ref in references:
            if ref not in source_ids:
                errors.append(f"{context}: unknown source id {ref}")

    if isinstance(item.get("recommendedExits"), list) and not all(
        isinstance(exit_name, str) and exit_name.strip() for exit_name in item["recommendedExits"]
    ):
        errors.append(f"{context}: recommendedExits must contain non-empty strings")
    elif "recommendedExits" in item and not isinstance(item["recommendedExits"], list):
        errors.append(f"{context}: recommendedExits must be a list")

    if require_distance:
        distance_type = item.get("distanceType")
        if distance_type not in ALLOWED_DISTANCE_TYPES:
            errors.append(f"{context}: distanceType must be one of {sorted(ALLOWED_DISTANCE_TYPES)}")
        if distance_type == "map_estimate":
            if not isinstance(item.get("walkingDistanceM"), (int, float)) or item["walkingDistanceM"] <= 0:
                errors.append(f"{context}: map_estimate needs positive walkingDistanceM")
            if not isinstance(item.get("walkingMinutes"), (int, float)) or item["walkingMinutes"] <= 0:
                errors.append(f"{context}: map_estimate needs positive walkingMinutes")
        if distance_type == "official" and not any(
            key in item for key in ("walkingDistanceM", "walkingMinutes")
        ):
            errors.append(f"{context}: official distance needs distance fields")


def validate_file(path: Path | str, subway_data_path: Path | str) -> list[str]:
    errors: list[str] = []
    path = Path(path)
    subway_data_path = Path(subway_data_path)
    try:
        payload = _load_json(path)
    except (OSError, ValueError) as exc:
        return [f"cannot load {path}: {exc}"]
    try:
        compiled = load_compiled_data(subway_data_path)
    except (OSError, ValueError, KeyError) as exc:
        return [f"cannot load compiled data {subway_data_path}: {exc}"]

    if not isinstance(payload, dict):
        return ["top-level surroundings payload must be an object"]
    if payload.get("schemaVersion") != "1.0":
        errors.append("schemaVersion must be 1.0")
    if not _valid_date(payload.get("generatedAt")):
        errors.append("generatedAt must be YYYY-MM-DD")

    known_cities = set(compiled)
    for city_key, stations in payload.items():
        if city_key in {"schemaVersion", "generatedAt"}:
            continue
        context = f"{city_key}"
        if city_key not in known_cities:
            errors.append(f"{context}: unknown city")
            continue
        if not isinstance(stations, dict):
            errors.append(f"{context}: stations must be an object")
            continue
        known_stations = {node["name"] for node in compiled[city_key].get("nodes", [])}
        for station_name, surroundings in stations.items():
            station_context = f"{city_key}/{station_name}"
            if station_name not in known_stations:
                errors.append(f"{station_context}: unknown station")
            if not isinstance(surroundings, dict):
                errors.append(f"{station_context}: surroundings must be an object")
                continue
            for field in ("version", "reviewedAt", "summary", "verification"):
                _require_text(surroundings.get(field), field, station_context, errors)
            if not _valid_date(surroundings.get("reviewedAt")):
                errors.append(f"{station_context}: reviewedAt must be YYYY-MM-DD")
            if surroundings.get("verification") not in ALLOWED_VERIFICATIONS:
                errors.append(f"{station_context}: invalid verification")

            sources = surroundings.get("sources", [])
            if not isinstance(sources, list):
                errors.append(f"{station_context}: sources must be a list")
                sources = []
            source_ids: set[str] = set()
            for index, source in enumerate(sources):
                source_id = _validate_source(source, f"{station_context}/sources[{index}]", errors)
                if source_id in source_ids:
                    errors.append(f"{station_context}: duplicate source id {source_id}")
                if source_id:
                    source_ids.add(source_id)

            places = surroundings.get("places", [])
            connections = surroundings.get("connections", [])
            if not isinstance(places, list):
                errors.append(f"{station_context}: places must be a list")
                places = []
            if not isinstance(connections, list):
                errors.append(f"{station_context}: connections must be a list")
                connections = []
            if len(places) < 2:
                errors.append(f"{station_context}: at least two places are required")
            names: set[str] = set()
            descriptions: set[str] = set()
            for index, place in enumerate(places):
                item_context = f"{station_context}/places[{index}]"
                _validate_item(place, item_context, source_ids, errors, require_distance=True)
                if isinstance(place, dict):
                    name = place.get("name")
                    description = place.get("description")
                    if name in names:
                        errors.append(f"{station_context}: duplicate place name {name}")
                    if description in descriptions:
                        errors.append(f"{station_context}: duplicate place description")
                    names.add(name)
                    descriptions.add(description)
            for index, connection in enumerate(connections):
                _validate_item(connection, f"{station_context}/connections[{index}]", source_ids, errors, False)

    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("subway_data", type=Path)
    args = parser.parse_args()
    errors = validate_file(args.input, args.subway_data)
    if errors:
        print("\n".join(f"ERROR: {error}" for error in errors))
        return 1
    print(f"Validated station surroundings: {args.input}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
