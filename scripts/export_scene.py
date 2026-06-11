from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np
import pyvista as pv


ROOT = Path("/Users/fengxiao/Documents/Codex/2026-06-10/gis-mcp")
RESULTS = ROOT / "work" / "mac-ogs" / "results" / "twin_slope_tunnel_3d_longterm"
CASE = ROOT / "work" / "ogs_twin_slope_tunnel_case_3d_longterm" / "twin_slope_tunnel_3d.vtu"
OUT = ROOT / "outputs" / "ogs-tunnel-web-viewer" / "data" / "scene.json"


def time_of(path: Path) -> float:
    match = re.search(r"_t_([0-9]+(?:\.[0-9]+)?)\.vtu$", path.name)
    if not match:
        raise ValueError(f"Cannot parse result time from {path.name}")
    return float(match.group(1))


def round_list(array: np.ndarray, digits: int = 5) -> list:
    return np.round(np.asarray(array, dtype=float), digits).tolist()


def faces_to_triangles(poly: pv.PolyData | pv.UnstructuredGrid) -> list[list[int]]:
    surface = poly.extract_surface().triangulate() if not isinstance(poly, pv.PolyData) else poly.triangulate()
    faces = np.asarray(surface.faces).reshape(-1, 4)
    if not np.all(faces[:, 0] == 3):
        raise ValueError("Expected triangulated surface")
    return faces[:, 1:].astype(int).tolist()


def sigma_vm(sigma: np.ndarray) -> np.ndarray:
    sxx, syy, szz = sigma[:, 0], sigma[:, 1], sigma[:, 2]
    sxy = sigma[:, 3]
    syz = sigma[:, 4] if sigma.shape[1] > 4 else 0.0
    sxz = sigma[:, 5] if sigma.shape[1] > 5 else 0.0
    return np.sqrt(
        0.5 * ((sxx - syy) ** 2 + (syy - szz) ** 2 + (szz - sxx) ** 2)
        + 3.0 * (sxy**2 + syz**2 + sxz**2)
    )


def mesh_with_material_ids(path: Path) -> pv.UnstructuredGrid:
    mesh = pv.read(path)
    original = pv.read(CASE)
    if "MaterialIDs" not in mesh.cell_data and original.n_cells == mesh.n_cells:
        mesh.cell_data["MaterialIDs"] = np.asarray(original.cell_data["MaterialIDs"])
    return mesh


def main() -> None:
    files = sorted(RESULTS.glob("twin_slope_tunnel_3dts*_t_*.vtu"), key=time_of)
    if not files:
        raise FileNotFoundError(f"No VTU files found in {RESULTS}")

    final = mesh_with_material_ids(files[-1])
    final_surface = final.extract_surface(pass_pointid=True, pass_cellid=True).triangulate()
    full_point_ids = np.asarray(final_surface.point_data["vtkOriginalPointIds"], dtype=int)

    lining_surface = final_surface.extract_cells(np.asarray(final_surface.cell_data["MaterialIDs"]) == 2).clean()
    lining_surface = lining_surface.extract_surface().triangulate()
    lining_point_ids = np.asarray(lining_surface.point_data["vtkOriginalPointIds"], dtype=int)

    frames = []
    global_disp_max = 0.0
    global_sigma_max = 0.0
    lining_sigma_min = np.inf
    lining_sigma_max = 0.0

    for path in files:
        mesh = mesh_with_material_ids(path)
        displacement = np.asarray(mesh.point_data["displacement"], dtype=float)
        disp_mag = np.linalg.norm(displacement, axis=1)
        vm = sigma_vm(np.asarray(mesh.point_data["sigma"], dtype=float))

        full_disp = displacement[full_point_ids]
        full_disp_mag = disp_mag[full_point_ids]
        lining_disp = displacement[lining_point_ids]
        lining_vm = vm[lining_point_ids]

        global_disp_max = max(global_disp_max, float(np.nanmax(disp_mag)))
        global_sigma_max = max(global_sigma_max, float(np.nanmax(vm)))
        lining_sigma_min = min(lining_sigma_min, float(np.nanmin(lining_vm)))
        lining_sigma_max = max(lining_sigma_max, float(np.nanmax(lining_vm)))

        frames.append(
            {
                "year": time_of(path),
                "fullDisplacement": round_list(full_disp, 5),
                "fullDispMag": round_list(full_disp_mag, 5),
                "liningDisplacement": round_list(lining_disp, 5),
                "liningSigmaVm": round_list(lining_vm, 1),
            }
        )

    scene = {
        "title": "20-year 3D twin-slope tunnel simulation",
        "units": {"length": "m", "stress": "Pa"},
        "defaultWarp": 5,
        "geometry": {
            "full": {
                "points": round_list(final_surface.points, 5),
                "triangles": faces_to_triangles(final_surface),
            },
            "lining": {
                "points": round_list(lining_surface.points, 5),
                "triangles": faces_to_triangles(lining_surface),
            },
        },
        "ranges": {
            "dispMag": [0.0, round(global_disp_max, 5)],
            "liningSigmaVm": [round(lining_sigma_min, 1), round(lining_sigma_max, 1)],
            "globalSigmaVm": [0.0, round(global_sigma_max, 1)],
        },
        "frames": frames,
        "notes": [
            "Geometry is extracted from OGS VTU results and simplified to browser-renderable surfaces.",
            "Displacements are shown with an adjustable warp factor; default matches the ParaView figures.",
            "The current displacement history is synthetic and should later be replaced by GNSS-derived boundary histories.",
        ],
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(scene, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"Frames: {len(frames)}")
    print(f"Full surface: {final_surface.n_points} points, {final_surface.n_cells} triangles")
    print(f"Lining surface: {lining_surface.n_points} points, {lining_surface.n_cells} triangles")
    print(f"Size: {OUT.stat().st_size / 1024 / 1024:.2f} MB")


if __name__ == "__main__":
    main()
