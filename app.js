import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.querySelector("#scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(0xffffff, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 2000);
camera.up.set(0, 0, 1);
camera.position.set(172, -128, 94);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(70, 40, 18);

scene.add(new THREE.AmbientLight(0xffffff, 1.8));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
keyLight.position.set(80, -120, 150);
scene.add(keyLight);

const root = new THREE.Group();
scene.add(root);

const state = {
  mode: "displacement",
  frameIndex: 0,
  warp: 5,
};

const ui = {
  subtitle: document.querySelector("#subtitle"),
  showDisplacement: document.querySelector("#show-displacement"),
  showStress: document.querySelector("#show-stress"),
  year: document.querySelector("#year"),
  yearValue: document.querySelector("#year-value"),
  warp: document.querySelector("#warp"),
  warpValue: document.querySelector("#warp-value"),
  legendTitle: document.querySelector("#legend-title"),
  legendBar: document.querySelector("#legend-bar"),
  legendMin: document.querySelector("#legend-min"),
  legendMax: document.querySelector("#legend-max"),
  metricALabel: document.querySelector("#metric-a-label"),
  metricA: document.querySelector("#metric-a"),
  metricBLabel: document.querySelector("#metric-b-label"),
  metricB: document.querySelector("#metric-b"),
};

const sceneData = await fetch("./data/scene.json").then((response) => response.json());
state.frameIndex = sceneData.frames.length - 1;
ui.year.min = 0;
ui.year.max = sceneData.frames.length - 1;
ui.year.step = 1;
ui.year.value = state.frameIndex;
ui.warp.value = sceneData.defaultWarp;
state.warp = Number(sceneData.defaultWarp);

const full = buildSurface(sceneData.geometry.full, sceneData.ranges.dispMag, turboColor);
const lining = buildSurface(sceneData.geometry.lining, sceneData.ranges.liningSigmaVm, infernoColor);

const displacementGroup = new THREE.Group();
displacementGroup.add(full.mesh);
displacementGroup.add(makeWireframe(full.geometry, 0x1d2522, 0.34));
root.add(displacementGroup);

const stressGroup = new THREE.Group();
stressGroup.visible = false;
const contextWire = makeWireframe(full.geometry, 0x78827d, 0.18);
stressGroup.add(contextWire);
stressGroup.add(lining.mesh);
stressGroup.add(makeWireframe(lining.geometry, 0x161616, 0.42));
root.add(stressGroup);

updateFrame();
fitRenderer();
animate();

ui.showDisplacement.addEventListener("click", () => setMode("displacement"));
ui.showStress.addEventListener("click", () => setMode("stress"));
ui.year.addEventListener("input", () => {
  state.frameIndex = Number(ui.year.value);
  updateFrame();
});
ui.warp.addEventListener("input", () => {
  state.warp = Number(ui.warp.value);
  updateFrame();
});
window.addEventListener("resize", fitRenderer);

function buildSurface(source, range, colorMap) {
  const points = source.points.map((point) => new THREE.Vector3(point[0], point[1], point[2]));
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(points.length * 3);
  const colors = new Float32Array(points.length * 3);
  const indices = new Uint32Array(source.triangles.flat());

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.02,
    roughness: 0.72,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return { geometry, mesh, points, range, colorMap };
}

function makeWireframe(geometry, color, opacity) {
  const material = new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: true,
    wireframe: true,
    depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}

function setMode(mode) {
  state.mode = mode;
  displacementGroup.visible = mode === "displacement";
  stressGroup.visible = mode === "stress";
  ui.showDisplacement.classList.toggle("active", mode === "displacement");
  ui.showStress.classList.toggle("active", mode === "stress");
  updateLegend();
  updateMetrics();
}

function updateFrame() {
  const frame = sceneData.frames[state.frameIndex];
  updateSurface(full, frame.fullDisplacement, frame.fullDispMag, state.warp);
  updateSurface(lining, frame.liningDisplacement, frame.liningSigmaVm, state.warp);
  ui.yearValue.textContent = formatYear(frame.year);
  ui.warpValue.textContent = `${state.warp.toFixed(2)}x`;
  updateLegend();
  updateMetrics();
}

function updateSurface(surface, displacement, scalars, warp) {
  const positions = surface.geometry.attributes.position.array;
  const colors = surface.geometry.attributes.color.array;
  const [min, max] = surface.range;
  for (let i = 0; i < surface.points.length; i += 1) {
    const base = surface.points[i];
    const disp = displacement[i];
    positions[i * 3] = base.x + disp[0] * warp;
    positions[i * 3 + 1] = base.y + disp[1] * warp;
    positions[i * 3 + 2] = base.z + disp[2] * warp;

    const color = surface.colorMap(normalize(scalars[i], min, max));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  surface.geometry.attributes.position.needsUpdate = true;
  surface.geometry.attributes.color.needsUpdate = true;
  surface.geometry.computeVertexNormals();
}

function updateLegend() {
  if (state.mode === "displacement") {
    ui.subtitle.textContent = "Overall 3D displacement field";
    ui.legendTitle.textContent = "|u| (m)";
    ui.legendBar.classList.remove("stress");
    ui.legendMin.textContent = sceneData.ranges.dispMag[0].toFixed(2);
    ui.legendMax.textContent = sceneData.ranges.dispMag[1].toFixed(2);
  } else {
    ui.subtitle.textContent = "Tunnel lining von Mises stress field";
    ui.legendTitle.textContent = "lining sigma_vm (Pa)";
    ui.legendBar.classList.add("stress");
    ui.legendMin.textContent = formatPa(sceneData.ranges.liningSigmaVm[0]);
    ui.legendMax.textContent = formatPa(sceneData.ranges.liningSigmaVm[1]);
  }
}

function updateMetrics() {
  const frame = sceneData.frames[state.frameIndex];
  if (state.mode === "displacement") {
    ui.metricALabel.textContent = "Max |u|";
    ui.metricA.textContent = `${Math.max(...frame.fullDispMag).toFixed(2)} m`;
    ui.metricBLabel.textContent = "Frame";
    ui.metricB.textContent = `${formatYear(frame.year)} years`;
  } else {
    ui.metricALabel.textContent = "Max lining stress";
    ui.metricA.textContent = formatPa(Math.max(...frame.liningSigmaVm));
    ui.metricBLabel.textContent = "Min lining stress";
    ui.metricB.textContent = formatPa(Math.min(...frame.liningSigmaVm));
  }
}

function fitRenderer() {
  const rect = canvas.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function normalize(value, min, max) {
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

function ramp(t, stops) {
  const scaled = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const local = scaled - i;
  return new THREE.Color(stops[i]).lerp(new THREE.Color(stops[i + 1]), local);
}

function turboColor(t) {
  return ramp(t, [0x30123b, 0x4145ab, 0x4675ed, 0x1bcfd4, 0x35b779, 0xf4d03f, 0xf66b1d, 0x7a0403]);
}

function infernoColor(t) {
  return ramp(t, [0x000004, 0x240c4f, 0x5f187f, 0x982d80, 0xd3436e, 0xf8765c, 0xfec287, 0xfcffa4]);
}

function formatPa(value) {
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)} MPa`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)} kPa`;
  return `${value.toFixed(0)} Pa`;
}

function formatYear(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
