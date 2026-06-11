# 3D Twin-Slope Tunnel Simulation Viewer

Static WebGL viewer for the 20-year OGS twin-slope arch-tunnel simulation.

## Local preview

```bash
python3 -m http.server 8088
```

Open `http://localhost:8088`.

## GitHub Pages

Publish this directory as a GitHub repository and enable GitHub Pages from the repository root.

The viewer is fully static. It uses Three.js from a CDN and loads the preprocessed result file at `data/scene.json`.

## Data

The JSON scene data is generated from local OGS VTU results:

```bash
/Users/fengxiao/Documents/Codex/2026-06-10/gis-mcp/work/mac-ogs/venv/bin/python scripts/export_scene.py
```

Current prototype caveat: the displacement history is synthetic and should later be replaced by GNSS-derived boundary histories for the final case study.
