# 3D Twin-Slope Tunnel Simulation Viewer

Static WebGL viewer for the 20-year OGS twin-slope arch-tunnel simulation.

## Open the interactive visualization

Click here to launch the browser-based 3D viewer:

**[Open interactive 3D viewer](https://fx794726198.github.io/ogs-tunnel-web-viewer/)**

Do not click `index.html` in the GitHub file list. The repository page shows the source files; the link above opens the actual interactive visualization.

In the viewer:

- Drag with the mouse or finger to rotate the model.
- Scroll or pinch to zoom.
- Use `Displacement` and `Lining stress` to switch result fields.
- Use the `Year` slider to move through the 20-year result sequence.
- Use the `Warp` slider to change displacement exaggeration.

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
