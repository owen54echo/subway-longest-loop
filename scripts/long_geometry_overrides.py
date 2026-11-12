"""Reapply inspected OSM long sections without silently accepting changed stations."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def apply_reviewed_long_segments(out, city):
    overlays = json.loads((ROOT / 'data/geometry/reviewed-long-segments.json').read_text())
    overlay = overlays.get(city)
    if not overlay:
        return out
    for name, expected in overlay['stationPositions'].items():
        if out['positions'].get(name) != expected:
            raise ValueError(f'{city} 长区间端点 {name} 已变更，需重新核验轨迹')
    for source, metadata in overlay.get('sources', {}).items():
        if source in out['meta']['sources'] and out['meta']['sources'][source] != metadata:
            raise ValueError(f'{city} 长区间来源 {source} 已变化，需重新核验轨迹')
        out['meta']['sources'][source] = metadata
    for key, segment in overlay['segments'].items():
        if key not in out['missing'] or key in out['segments']:
            raise ValueError(f'{city} 长区间 {key} 已变化，需重新核验轨迹')
        if segment['source'] not in out['meta']['sources']:
            raise ValueError(f'{city} 长区间 {key} 的 OSM 来源已变化')
        out['segments'][key] = segment
        out['missing'].remove(key)
    out['meta']['matchedSegments'] = len(out['segments'])
    out['meta']['longSegmentsReviewed'] = '2026-11-12'
    out['meta']['approach'] += ' Reviewed long sections use OSM route stop-to-stop tracks matched to existing station positions.'
    return out
