# Bengaluru Zone Manager

A geo-fencing & serving-area planner for a Bengaluru hyperlocal startup connecting local stores to customers within a 10 km serving radius.

## What it does

- Renders the **real irregular outline of Bengaluru** as the default base layer (not a circle/rectangle)
- Divides the city into **5 main zones**: Central, North, South, East, West
- Maps **96 active Bengaluru pincodes** (560001 – 560117 range) with names, each pre-assigned to a main zone
- Generates **proper polygon shapes for each pincode** using Voronoi tessellation, clipped to the Bengaluru boundary
- Click any zone or pincode to see:
  - Area covered (km²)
  - Max reach distance from the polygon centre to its farthest edge
  - **10 km service-limit indicator** (green = OK, red = exceeds limit)
  - List of pincodes inside the zone
- Search pincodes/areas by name or code
- **Create custom sub-zones** by selecting any pincodes via checkboxes and giving the zone a name + colour
- **Combine zones** (any mix of main + custom) to view total combined coverage and km
- Reset view returns to default Bengaluru-outline-only state

## Tech stack

- **Leaflet 1.9** – map rendering
- **Turf.js 6.5** – polygon area, distance, union, intersection
- **d3-delaunay 6** – Voronoi polygon generation for pincodes
- **Vanilla HTML/CSS/JS** – no build step, no framework

## Run it

Just open `index.html` in any browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Or push to GitHub Pages — works as-is.

## File layout

```
.
├── index.html              # shell: topbar, sidebar tabs, map, info panel
├── styles.css              # dark theme UI
├── app.js                  # main logic (~600 lines)
└── data/
    └── bengaluru.js        # boundary polygon + pincode dataset
```

## How the polygon outlines work

For pincodes:
1. All 96 pincode centres are passed to a **d3-delaunay Voronoi diagram**
2. Each pincode gets a unique cell (the area closest to that pincode's centre)
3. Each cell is **clipped to the Bengaluru boundary** using `turf.intersect`
4. Result: proper, varied polygon shapes that tessellate the city — every square metre of Bengaluru belongs to exactly one pincode polygon

For zones:
- All pincode polygons of a zone are **unioned** with `turf.union` to produce a single zone polygon
- Custom sub-zones use the same union approach over user-selected pincodes

For the 10 km limit check:
- Compute polygon centroid (`turf.centerOfMass`)
- Find the maximum distance from centroid to any boundary vertex
- If `> 10 km` → red "Exceeds limit" badge + red reach-circle on map
- A reference 10 km dashed ring is always drawn around the centroid for visual context

## Notes & next steps

- The Bengaluru boundary is a hand-traced ~32-vertex polygon approximating BBMP/Greater-Bengaluru shape. For pixel-accurate boundaries, replace `BENGALURU_BOUNDARY` in `data/bengaluru.js` with an official BBMP GeoJSON.
- Pincode centroids are approximate (good enough for zone planning; tweak in `data/bengaluru.js` for exact post-office coordinates).
- Custom sub-zones live in memory only — wire them to a backend / `localStorage` if persistence is needed.
