# home-3d — โมเดลบ้าน 3D ร่างแรก (v0.2)

Procedural three.js model + viewer (orbit/zoom, floor cut-away, 2D plan, clickable rooms, solar array, placeholder device hotspots, elevation views).

- `data/house.json` — levels, rooms (rect in lot meters: x left→right seen from road, z back→front), roof, solar layout, hotspots (future cameras / inverter / router; `placeholder: true` = ตำแหน่งตัวอย่าง).
  - `palette` — colors.
  - `facade.openings` — every window/door: floor, wall line `{z}` or `{x}`, from/to, sill/head relative to floor level, panes, deepFrame. Exterior walls are solid except listed openings.
  - `facade.features` — panel / frame / louver / slats / pergola / slab items in lot meters.
- `model.js` — `buildHouse(data)` → `{ root, pickables, floorGroups, roofGroup, roomMeshes, solar, cars, boundary, planWalls }` (first six keys unchanged since v0.1; `cars` hidden by default).
- `app.js` — viewer UI. `models/house.glb` — exported model (no cars, no plan outlines).

URL params: `?f=1|2|3|all`, `&iso=1`, `&mode=plan`, `?solar=1`, `?view=front|back|left|right|persp-fl`, `&hs=0`, `&cars=1`.
Drawings-based draft; the real house differs in places.
