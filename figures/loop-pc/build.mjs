// Builds the "loop líquido" figure: an open-frame PC with a custom hardline loop.
//   node figures/loop-pc/build.mjs            writes the Astro fragment, the live script and a standalone page
//   node figures/loop-pc/build.mjs --light    standalone page in the light theme
//   node figures/loop-pc/build.mjs --audit    also proves clearances, contacts and depth order
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../kit/tube.mjs";
import * as A from "../kit/audit.mjs";
import { AMBIENT, LOAD, FLOW, rpmAt, conductance, steady } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 480;
const HEIGHT = 450;

// World: x along the tray, y out of the tray toward the viewer, z up. About 1 unit per 2 mm.
const BASE = { x: -16, y: -16, w: 304, d: 108, r: 8 };
const BASE_H = 10;
const FOOT_H = 5;
const TRAY = { x: 0, y: 0, w: 272, d: 4, r: 0.6 };
const TRAY_H = 208;
const FACE = TRAY.y + TRAY.d;

const RAD = { x: 10, y: FACE, w: 58, d: 13, r: 1.5 };
const RAD_Z = [12, 200];
const RAD_FACE = RAD.y + RAD.d;
const FAN = { x: 14, y: RAD_FACE, w: 50, d: 12, r: 2.5 };
const FAN_Z = [31, 82, 133];
const FAN_SIZE = 50;
const FAN_FACE = FAN.y + FAN.d;
const FAN_X = FAN.x + FAN.w / 2;
const FAN_RING = 23;
const FAN_HUB = 6;
const BLADES = 7;

const BOARD = { x: 84, y: FACE, w: 120, d: 3, r: 0.5 };
const BOARD_Z = [50, 196];
const DECK = BOARD.y + BOARD.d;
const CPU = [149, 150];
const CPU_R = 14;
const CPU_BASE = DECK + 2.2;
const CPU_FACE = CPU_BASE + 8.8;
const GPU = { x: 92, y: 10, w: 104, d: 10, r: 1.5 };
const GPU_Z = [40, 82];
const GPU_FACE = GPU.y + GPU.d;
const TERMINAL = { x: 140, y: GPU_FACE, w: 18, d: 2.5, r: 1.2 };
const PUMP = { x: 222, y: FACE, w: 28, d: 30, r: 3 };
const PUMP_Z = [34, 60];
const RES = [236, 19];
const RES_R = 11;
const RES_Z = [64, 164];

// Every run of tube lies in one plane in front of the parts.
const RUN = 28;
const TUBE = 2.3;
const BALL = 3.6;
const BOSS = 2.6;
const BOSS_SEAT = Math.sqrt(BALL * BALL - BOSS * BOSS);
const COLLAR = 3.1;
const COLLAR_LENGTH = 3.4;
const COLLAR_SEAT = Math.sqrt(BALL * BALL - COLLAR * COLLAR);
const PORT = { gpuIn: [149, 47], gpuOut: [149, 73], cpuIn: [149, 143], cpuOut: [149, 157], radIn: [54, 192], radOut: [39, 22], back: [236, 22] };
const SENSOR = 198;

const GAUGE = [226, 54];
const GAUGE_R = 16;
const GAUGE_H = 9;
const SCALE = [20, 50];
const SWEEP = [1.25 * Math.PI, 1.5 * Math.PI];
const RAIL = { x: 16, y: 56, w: 156, d: 5, r: 1 };
const STRIP = { x: 16, y: 66, w: 156, d: 7, r: 1 };
const PER_WATT = 0.25;

const P = k.fitProjection(
  [...k.boxCorners(BASE, -BASE_H - FOOT_H, 0), ...k.boxCorners(TRAY, 0, TRAY_H), [RES[0], RES[1], RES_Z[1] + 9]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 56 },
);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const path3 = (points, closed = false) => k.pathOf(points.map(at), closed);

// Lines on the two kinds of face the viewer sees.
const faceRect = (x0, z0, x1, z1, y) => path3([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], true);
const faceRing = (x, z, r, y, steps = 40) => k.sideRing([x, y, z], r, "y", P, steps);
const faceDots = (points, y) => points.map(([x, z]) => at([x, y, z]));
const slot = (x0, z0, x1, z1, y, steps = 8) => {
  const r = Math.min(x1 - x0, z1 - z0) / 2;
  const tall = z1 - z0 > x1 - x0;
  const [a, b] = tall ? [[(x0 + x1) / 2, z0 + r], [(x0 + x1) / 2, z1 - r]] : [[x0 + r, (z0 + z1) / 2], [x1 - r, (z0 + z1) / 2]];
  const turn = tall ? Math.PI : Math.PI / 2;
  const arc = ([cx, cz], from) => Array.from({ length: steps + 1 }, (_, i) => [cx + r * Math.cos(from + (i / steps) * Math.PI), y, cz + r * Math.sin(from + (i / steps) * Math.PI)]);
  return path3([...arc(a, turn), ...arc(b, turn + Math.PI)], true);
};
const AXIS_Y = (x, y, z) => G.frameOf([x, y, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const AXIS_Z = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);

const R = A.recorder(P);
function put(name, ref, svg, shapes = [], { bias = 0, ...rest } = {}) {
  return R.put({ name, at: ref, bias, svg, shapes, piece: "pc", ...rest });
}
function box(name, plan, z0, z1, style = {}, { steps = 3, bevel = 0, extra = "", inner = "", bias = 0, attrs } = {}) {
  const shape = R.solid(A.slab(plan, z0, z1 - z0, { name }, steps));
  put(name, [plan.x + plan.w / 2, plan.y + plan.d / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [shape], { bias, attrs });
  return shape;
}
function post(name, [x, y], r, z0, z1, style = {}, { steps = 28, bevel = 0, extra = "", inner = "", bias = 0 } = {}) {
  const shape = R.solid(A.cylinder(x, y, r, z0, z1 - z0, { name }));
  put(name, [x, y, (z0 + z1) / 2], S(k.cylinder(x, y, r, z0, z1 - z0, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [shape], { bias });
  return shape;
}
function turned(name, F, profile, style = {}, { extra = "", inner = "", bias = 0, owner } = {}) {
  const shape = R.solid(A.solid(F, profile, { name, owner }));
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  put(name, G.add3(F.o, G.mul3(F.a, mid)), S(G.solidOf(profile, F, P), { tone: "mid", ...style, inner }) + extra, [shape], { bias });
  return shape;
}
const disc = (name, F, s0, s1, r, style, options) => turned(name, F, [[s0, r], [s1, r]], style, options);
function ball(name, centre, owner) {
  const shape = R.solid(A.ball(centre, BALL, { name, owner }));
  put(name, centre, S(G.sphereOf(centre, BALL, P, { steps: 32 }), { tone: "hi" }), [shape]);
}
// A 90° fitting on a port that faces the viewer: a boss out of the face and a ball the tube leaves sideways.
function fitting(name, [x, z], face) {
  disc(`${name}.boss`, AXIS_Y(x, face, z), 0, RUN - BOSS_SEAT - face, BOSS, { tone: "hi" }, { owner: name });
  ball(`${name}.ball`, [x, RUN, z], name);
  return [x, RUN, z];
}
const FLOWS = [];
const toward = (from, to, by) => G.add3(from, G.mul3(G.unit3(G.sub3(to, from)), by));
// A run of rigid tube. An end that lands on a fitting's ball gets a compression collar, and the tube is gapped under it.
function tube(name, points, { bend = 12, gaps = [], collars = [true, true], fittings = [] } = {}) {
  const ends = [...points];
  if (collars[0]) ends[0] = toward(points[0], points[1], COLLAR_SEAT);
  if (collars[1]) ends[ends.length - 1] = toward(points[points.length - 1], points[points.length - 2], COLLAR_SEAT);
  const route = ends.length > 2 ? G.fillet(ends, bend, 9, { P, tube: TUBE }) : ends;
  const total = G.pathLength(route);
  const all = [...(collars[0] ? [[0, COLLAR_LENGTH]] : []), ...gaps, ...(collars[1] ? [[total - COLLAR_LENGTH, total]] : [])];
  R.route(name, route, TUBE, { gaps: all, rims: collars.map((on) => (on ? COLLAR : TUBE)), piece: "pc" });
  tubePieces(route, TUBE, P, { maxLength: 400, spacing: 1.6, gaps: all }).forEach((piece, index) => {
    const flow = L(path3(piece.points), { tone: "lit", flow: true, className: "lp-flow", free: true });
    put(`${name}:${index}`, piece.mid, tubeSvg(piece, { tone: "hi" }) + flow, [A.tube(piece.points, piece.radii)], { route: name, chunk: index });
  });
  collars.forEach((on, index) => {
    if (!on) return;
    const end = index ? route[route.length - 1] : route[0];
    const inward = G.mul3(G.tangentAlong(route, index ? total : 0), index ? -1 : 1);
    disc(`${name}.collar${index}`, G.frameAlong(end, inward), 0, COLLAR_LENGTH, COLLAR, { tone: "hi" }, { owner: fittings[index] ?? name });
  });
  FLOWS.push(name);
  return route;
}

// ── Base ────────────────────────────────────────────────────────────────────────────────────────
const back = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`];
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
for (const [x, y] of byDepth(k.corners(BASE, 22))) {
  back.push(S(k.cylinder(x, y, 7, -BASE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 5.4, -BASE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
}
back.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(BASE, -4, P, 8), { tone: "faint" }) }));
back.push(L(k.planOutline(k.insetPlan(BASE, 5), 0, P), { tone: "lo" }));
const baseScrews = k.corners(BASE, 10);
back.push(L(baseScrews.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
back.push(D(baseScrews.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
R.solid(A.slab(BASE, -BASE_H, BASE_H, { name: "stand.plate", ground: true }, 8));

// Load scale: one tick per 20 W, a long one per 100 W.
back.push(S(k.slabOf(STRIP, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
const ticks = k.topTicks(LOAD[0] * PER_WATT, LOAD[1] * PER_WATT, 5, 5, STRIP.y, 0.6, [2, 3.8], P);
back.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
back.push(D([at([STRIP.x + 2.5, STRIP.y + 3.5, 0.6]), at([STRIP.x + STRIP.w - 2.5, STRIP.y + 3.5, 0.6])], { size: 0.45 }));
const LABEL = { x: 180, y: 76, w: 32, d: 11, r: 1.2 };
back.push(S(k.slabOf(LABEL, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
back.push(L(k.planOutline(k.insetPlan(LABEL, 1.4), 0.8, P, 3), { tone: "faint" }));
back.push(L([18, 12, 15].map((w, i) => k.lineOnTop([LABEL.x + 4, LABEL.y + 2.8 + i * 2.7], [LABEL.x + 4 + w, LABEL.y + 2.8 + i * 2.7], 0.8, P)).join(""), { tone: "lo", free: true }));
back.push(D([at([LABEL.x + LABEL.w - 2.6, LABEL.y + 2.4, 0.8]), at([LABEL.x + LABEL.w - 2.6, LABEL.y + LABEL.d - 2.4, 0.8])], { size: 0.45 }));

// ── Chassis ─────────────────────────────────────────────────────────────────────────────────────
const trayMarks =
  L(slot(73, 62, 79, 118, FACE) + slot(208, 96, 215, 150, FACE) + slot(108, 8, 168, 13, FACE) + slot(96, 200, 176, 204.5, FACE), { tone: "lo" }) +
  D(faceDots([[5, 203], [267, 203], [5, 12], [267, 12]], FACE), { size: 0.5 });
box("tray", TRAY, 0, TRAY_H, { tone: "mid" }, { steps: 2, extra: trayMarks });
for (const [index, x] of [6, 258].entries()) {
  const plan = { x, y: FACE, w: 8, d: 24, r: 1 };
  box(`tray.foot${index}`, plan, 0, 6, {}, { bevel: 0.4, extra: D([at([x + 4, FACE + 8, 6]), at([x + 4, FACE + 19, 6])], { size: 0.45 }) });
}

// ── Radiator and fans ───────────────────────────────────────────────────────────────────────────
const fins = [];
for (let z = RAD_Z[0] + 16; z <= RAD_Z[1] - 16 + 1e-6; z += 6.5) fins.push(k.sideSeam(RAD, z, P, 3));
box("rad", RAD, RAD_Z[0], RAD_Z[1], { tone: "mid" }, { bevel: 0.6, inner: L(fins.join(""), { tone: "faint" }), extra: D([at([RAD.x + 6, RAD.y + 6.5, RAD_Z[1]]), at([RAD.x + RAD.w - 6, RAD.y + 6.5, RAD_Z[1]])], { size: 0.45 }) });

// One blade is a swept curve from the hub ring to the frame ring, in the fan's face plane.
function bladesAt(turn, zc, project) {
  let d = "";
  for (let blade = 0; blade < BLADES; blade++) {
    const a = turn + (blade / BLADES) * Math.PI * 2;
    for (let step = 0; step <= 14; step++) {
      const t = step / 14;
      const r = FAN_HUB + (FAN_RING - FAN_HUB) * t;
      const angle = a + 0.85 * t * t;
      const [x, y] = project([FAN_X + r * Math.cos(angle), FAN_FACE, zc + r * Math.sin(angle)]);
      d += (step ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }
  }
  return d;
}
FAN_Z.forEach((z0, index) => {
  const zc = z0 + FAN_SIZE / 2;
  const marks =
    L(faceRing(FAN_X, zc, FAN_RING, FAN_FACE, 56), { tone: "mid" }) +
    `<path class="iso-line" data-tone="mid" data-fan="${index}" d="${bladesAt(index * 0.3, zc, at)}"/>` +
    L(faceRing(FAN_X, zc, FAN_HUB, FAN_FACE, 28), { tone: "hi" }) +
    L(faceRing(FAN_X, zc, 2.8, FAN_FACE, 16), { tone: "lo" }) +
    D(faceDots([[-21.5, -21.5], [21.5, -21.5], [-21.5, 21.5], [21.5, 21.5]].map(([dx, dz]) => [FAN_X + dx, zc + dz]), FAN_FACE), { size: 0.5 });
  box(`fan${index}`, FAN, z0, z0 + FAN_SIZE, { tone: "mid" }, { bevel: 0.5, extra: marks });
});

// ── Motherboard ─────────────────────────────────────────────────────────────────────────────────
const boardMarks =
  L(faceRect(96, 90, 150, 93, DECK) + faceRect(96, 100, 150, 103, DECK), { tone: "lo" }) +
  L(faceRing(112, 126, 3.6, DECK, 20), { tone: "lo" }) +
  D(faceDots([[88, 54], [200, 54], [88, 114], [200, 192], [144, 54], [200, 122], [144, 122]], DECK), { size: 0.5 });
box("board", BOARD, BOARD_Z[0], BOARD_Z[1], { tone: "mid" }, { steps: 2, extra: boardMarks });

const finsOn = (plan, z0, z1, step) => {
  const lines = [];
  for (let x = plan.x + step; x < plan.x + plan.w - step / 2; x += step) lines.push(k.segment([x, plan.y + plan.d, z0], [x, plan.y + plan.d, z1], P));
  return L(lines.join(""), { tone: "faint" });
};
const VRM = { x: 120, y: DECK, w: 50, d: 8, r: 0.4 };
box("board.vrm", VRM, 178, 191, {}, { steps: 2, extra: finsOn(VRM, 178, 191, 4.2) });
const SHROUD = { x: 86, y: DECK, w: 16, d: 13, r: 1.5 };
box("board.shroud", SHROUD, 118, 194, {}, { bevel: 0.5, inner: L(k.sideSeam(SHROUD, 150, P, 3), { tone: "faint" }) });
const CHIPSET = { x: 158, y: DECK, w: 30, d: 3.5, r: 2 };
box("board.chipset", CHIPSET, 88, 106, {}, { bevel: 0.4, extra: D(faceDots([[162, 92], [184, 102]], DECK + 3.5), { size: 0.4 }) });
box("board.power", { x: 197, y: DECK, w: 5, d: 8, r: 0.4 }, 128, 160, {}, { steps: 2 });
box("board.sata", { x: 196, y: DECK, w: 6, d: 5, r: 0.4 }, 90, 112, {}, { steps: 2 });
box("board.m2", { x: 104, y: DECK, w: 40, d: 1.6, r: 0.4 }, 107, 113, {}, { steps: 2, extra: D(faceDots([[107, 110], [141, 110]], DECK + 1.6), { size: 0.4 }) });
for (let stick = 0; stick < 4; stick++) {
  const plan = { x: 174 + stick * 6.2, y: DECK, w: 2.2, d: 13, r: 0.4 };
  box(`ram${stick}`, plan, 110, 182, { tone: "mid" }, { steps: 2, extra: D([at([plan.x + 1.1, DECK + 6.5, 182])], { size: 0.35, tone: "lo" }) });
}

// CPU block: a bracket on four thumb nuts and a round block with two ports.
const BRACKET = { x: CPU[0] - 18, y: DECK, w: 36, d: 2.2, r: 0.4 };
box("cpu.bracket", BRACKET, CPU[1] - 18, CPU[1] + 18, {}, { steps: 2 });
for (const [index, [dx, dz]] of [[-14, -14], [14, -14], [-14, 14], [14, 14]].entries()) {
  const F = AXIS_Y(CPU[0] + dx, CPU_BASE, CPU[1] + dz);
  disc(`cpu.nut${index}`, F, 0, 3.4, 2.3, {}, { extra: D([at([CPU[0] + dx, CPU_BASE + 3.4, CPU[1] + dz])], { size: 0.45 }) });
}
const CPU_F = AXIS_Y(CPU[0], CPU_BASE, CPU[1]);
turned("cpu.block", CPU_F, [[0, CPU_R], [7.6, CPU_R], [8.8, CPU_R - 1.2]], { tone: "hi", crease: "lo" }, {
  inner: L(G.arcOf(CPU_F, 3, CPU_R, P), { tone: "faint" }),
  extra: L(G.circleOf(CPU_F, 8.8, 10.6, P), { tone: "lo" }),
});

// GPU on a vertical mount: riser, two stand-offs, a block with its port terminal.
box("gpu.riser", { x: 104, y: DECK, w: 70, d: GPU.y - DECK, r: 0.4 }, 60, 66, {}, { steps: 2 });
for (const [index, x] of [100, 188].entries()) disc(`gpu.standoff${index}`, AXIS_Y(x, FACE, 45), 0, GPU.y - FACE, 2, {});
const gpuMarks =
  L(faceRect(96, 44, 136, 78, GPU_FACE) + faceRect(162, 44, 192, 78, GPU_FACE), { tone: "lo" }) +
  L([50, 55, 60, 65, 70].map((z) => slot(101, z, 131, z + 2.4, GPU_FACE, 4)).join(""), { tone: "faint" }) +
  D(faceDots([[94.5, 42.5], [193.5, 42.5], [94.5, 79.5], [193.5, 79.5], [138, 61], [160, 61]], GPU_FACE), { size: 0.45 });
box("gpu.card", GPU, GPU_Z[0], GPU_Z[1], { tone: "hi", crease: "lo" }, { bevel: 0.5, extra: gpuMarks });
box("gpu.terminal", TERMINAL, 41, 79, { tone: "hi", crease: "lo" }, { bevel: 0.3 });
box("gpu.power", { x: 172, y: 12, w: 16, d: 6, r: 0.6 }, GPU_Z[1], GPU_Z[1] + 3.5, {}, { steps: 2 });

// ── Pump and reservoir ──────────────────────────────────────────────────────────────────────────
const pumpMarks =
  L(faceRing(236, 47, 9, PUMP.y + PUMP.d, 32), { tone: "lo" }) +
  L(faceRing(236, 47, 3, PUMP.y + PUMP.d, 16), { tone: "faint" }) +
  D(faceDots([[226, 38], [246, 38], [226, 56], [246, 56]], PUMP.y + PUMP.d), { size: 0.45 });
box("pump", PUMP, PUMP_Z[0], PUMP_Z[1], { tone: "mid" }, { steps: 4, bevel: 0.6, extra: pumpMarks });
post("res.collar", RES, RES_R + 1, PUMP_Z[1], RES_Z[0], {}, { steps: 40, extra: L(k.knurl(RES[0], RES[1], RES_R + 1, PUMP_Z[1], RES_Z[0], 44, P, 0.4), { tone: "lo" }) });
for (const [index, z] of [82, 132].entries()) box(`res.clamp${index}`, { x: RES[0] - 12, y: FACE, w: 24, d: RES[1] - RES_R - FACE, r: 0.4 }, z, z + 6, {}, { steps: 2 });
// A spec plate on the tray, above the pump.
const SPEC = { x: 214, y: FACE, w: 44, d: 0.8, r: 0.3 };
const specFace = FACE + 0.8;
box("tray.spec", SPEC, 178, 198, { tone: "lo" }, {
  steps: 2,
  extra:
    L([[30, 193], [22, 189.5], [26, 186]].map(([w, z]) => k.segment([SPEC.x + 4, specFace, z], [SPEC.x + 4 + w, specFace, z], P)).join(""), { tone: "lo", free: true }) +
    D(faceDots([[SPEC.x + 2.4, 180.6], [SPEC.x + SPEC.w - 2.4, 180.6]], specFace), { size: 0.45 }),
});
post("res.tube", RES, RES_R, RES_Z[0], RES_Z[1], { tone: "hi", crease: "lo" }, {
  steps: 48,
  inner: L(k.sideArc(RES[0], RES[1], RES_R, 142, P, 32), { tone: "mid" }) + L(k.sideArc(RES[0], RES[1], RES_R, 121, P, 32), { tone: "faint" }),
});
post("res.cap", RES, RES_R + 1, RES_Z[1], RES_Z[1] + 6, {}, { steps: 40, bevel: 0.6, extra: L(k.knurl(RES[0], RES[1], RES_R + 1, RES_Z[1], RES_Z[1] + 6, 44, P, 0.4), { tone: "lo" }) });
post("res.plug", RES, 3.2, RES_Z[1] + 6, RES_Z[1] + 8.5, {}, { steps: 20, extra: L(k.knurl(RES[0], RES[1], 3.2, RES_Z[1] + 6, RES_Z[1] + 8.5, 16, P, 0.3), { tone: "lo" }) });

// ── The loop, in the order the coolant travels ──────────────────────────────────────────────────
const gpuIn = fitting("fit.gpu-in", PORT.gpuIn, TERMINAL.y + TERMINAL.d);
const gpuOut = fitting("fit.gpu-out", PORT.gpuOut, TERMINAL.y + TERMINAL.d);
const cpuIn = fitting("fit.cpu-in", PORT.cpuIn, CPU_FACE);
const cpuOut = fitting("fit.cpu-out", PORT.cpuOut, CPU_FACE);
const radIn = fitting("fit.rad-in", PORT.radIn, RAD_FACE);
const radOut = fitting("fit.rad-out", PORT.radOut, RAD_FACE);
const backBall = [PORT.back[0], RUN, PORT.back[1]];
ball("fit.back.ball", backBall, "fit.back");
disc("fit.back.stub", AXIS_Z(backBall[0], RUN, backBall[2]), BOSS_SEAT, PUMP_Z[0] - backBall[2], BOSS, { tone: "hi" }, { owner: "fit.back" });

const pumpOut = [PUMP.x, RUN, PORT.gpuIn[1]];
tube("run.pump-gpu", [pumpOut, gpuIn], { collars: [false, true], fittings: [null, "fit.gpu-in"] });
tube("run.gpu-cpu", [gpuOut, cpuIn], { fittings: ["fit.gpu-out", "fit.cpu-in"] });
tube("run.cpu-rad", [cpuOut, [cpuOut[0], RUN, radIn[2]], radIn], { fittings: ["fit.cpu-out", "fit.rad-in"] });
const sensorAt = SENSOR - radOut[0] - COLLAR_SEAT;
tube("run.rad-pump", [radOut, backBall], { gaps: [[sensorAt - 2, sensorAt + 2]], fittings: ["fit.rad-out", "fit.back"] });
disc("sensor", G.frameOf([SENSOR, RUN, PORT.back[1]], [1, 0, 0], [0, 1, 0], [0, 0, 1]), -2, 2, BALL, { tone: "mid" }, { owner: "run.rad-pump" });

// ── Controls on the deck: load slider, coolant thermometer ──────────────────────────────────────
box("rail", RAIL, 0, 3, {}, { bevel: 0.4, extra: D([at([RAIL.x + 5, RAIL.y + 2.5, 3]), at([RAIL.x + RAIL.w - 5, RAIL.y + 2.5, 3])], { size: 0.4 }) });
for (const [index, x] of [RAIL.x - 5, RAIL.x + RAIL.w].entries()) {
  box(`rail.stop${index}`, { x, y: RAIL.y - 3, w: 5, d: 11, r: 1.2 }, 0, 7, {}, { bevel: 0.5, extra: D([at([x + 2.5, RAIL.y + 2.5, 7])], { size: 0.45 }) });
}
const startLoad = LOAD[0];
// Built where it rests at the lowest load; the page slides it along the rail from there.
const SX = startLoad * PER_WATT;
const CARRIAGE = { x: SX - 6, y: RAIL.y - 2.5, w: 12, d: 10, r: 2 };
const sliderSvg = [
  S(k.slabOf({ x: SX - 1.2, y: RAIL.y + 7.5, w: 2.4, d: 4.6, r: 0.6 }, 1, 0.8, P, 2), { tone: "hi", crease: "none" }),
  S(k.slabOf(CARRIAGE, 3, 4.5, P, 4, 0.5), { tone: "hi", crease: "lo" }),
  S(k.cylinder(SX, RAIL.y + 2.5, 3.6, 7.5, 4.5, P, 24), { tone: "hi", crease: "lo" }),
  L(k.knurl(SX, RAIL.y + 2.5, 3.6, 7.5, 12, 22, P, 0.4), { tone: "lo" }),
  D([at([SX, RAIL.y + 2.5, 12])], { size: 0.5, tone: "hi" }),
].join("");
put("slider", [SX, RAIL.y + 2.5, 6], sliderSvg, [R.solid(A.slab(CARRIAGE, 3, 4.5, { name: "slider" }, 4)), R.solid(A.cylinder(SX, RAIL.y + 2.5, 3.6, 7.5, 4.5, { name: "slider.knob" }))], {
  attrs: ` data-part="slider"`,
});

const BLOCK = { x: 201, y: 40, w: 10, d: 8, r: 1 };
box("gauge.block", BLOCK, 0, 3, {}, { bevel: 0.3, extra: D([at([BLOCK.x + 2.5, BLOCK.y + 4, 3])], { size: 0.45 }) });
const needleAt = (liquid) => {
  const share = Math.min(1, Math.max(0, (liquid - SCALE[0]) / (SCALE[1] - SCALE[0])));
  const angle = SWEEP[0] + share * SWEEP[1];
  const [sx, sy] = [Math.sin(angle), -Math.cos(angle)];
  return k.lineOnTop([GAUGE[0] - sx * 3, GAUGE[1] - sy * 3], [GAUGE[0] + sx * (GAUGE_R - 4.2), GAUGE[1] + sy * (GAUGE_R - 4.2)], GAUGE_H + 0.2, P);
};
const first = steady(startLoad, AMBIENT);
const dialTicks = k.radialTicks(GAUGE[0], GAUGE[1], GAUGE_R - 3, 30, 5, GAUGE_H, [1.2, 2.6], P, SWEEP[0], SWEEP[1]);
const gaugeMarks = [
  L(k.knurl(GAUGE[0], GAUGE[1], GAUGE_R, GAUGE_H - 3, GAUGE_H, 72, P, 0.3), { tone: "lo" }),
  L(k.ring(GAUGE[0], GAUGE[1], GAUGE_R - 2.2, GAUGE_H, P, 56), { tone: "lo" }),
  L(dialTicks.minor, { tone: "lo" }),
  L(dialTicks.major, { tone: "mid" }),
  L(k.ring(GAUGE[0], GAUGE[1], 1.5, GAUGE_H, P, 16), { tone: "mid" }),
  k.faceTextSvg(k.topMatrix([GAUGE[0], GAUGE[1] + 8.6], GAUGE_H, P, "x"), "°C", { size: 2.6, tone: "lo", anchor: "middle" }),
  `<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" d="${needleAt(first.liquid)}" style="stroke-width:1.1"/>`,
].join("");
post("gauge", GAUGE, GAUGE_R, 0, GAUGE_H, { tone: "hi", crease: "lo" }, {
  steps: 64,
  bevel: 0.8,
  inner: L(k.sideArc(GAUGE[0], GAUGE[1], GAUGE_R, GAUGE_H - 3, P, 40), { tone: "faint" }),
  extra: gaugeMarks,
});

A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);

// The sensor lead: from the collar on the return run, down to the deck and along it to the gauge's terminal.
const lead = k.wireSvg(at([SENSOR, RUN, PORT.back[1] - BALL]), at([BLOCK.x + 6, BLOCK.y + 4, 3]), {
  via: [at([SENSOR, RUN, 0]), at([SENSOR, BLOCK.y + 4, 0]), at([BLOCK.x, BLOCK.y + 4, 0]), at([BLOCK.x, BLOCK.y + 4, 3])],
  tone: "mid",
  size: 1,
});

const label =
  "Un PC en chasis abierto con refrigeración líquida a medida. La bomba empuja el refrigerante por tubo rígido hacia el bloque de la tarjeta gráfica, luego al bloque del procesador, sube al radiador de 360 mm con tres ventiladores y vuelve al depósito. Un deslizador fija la carga térmica y un termómetro de aguja marca la temperatura del líquido.";
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label,
  body: [...back, ...R.items.map((item) => `<g class="it" data-name="${item.name}"${item.attrs ?? ""}>${item.svg}</g>`), lead],
});

// ── Live page ───────────────────────────────────────────────────────────────────────────────────
const cam = k.cameraOf(P);
const stops = [100, 280, 460, 650];
const say = ({ load, liquid, rpm }) => `carga ${Math.round(load)} W · ${liquid.toFixed(1)} °C · ${Math.round(rpm / 10) * 10} rpm`;
const live = `
(() => {
const stage = document.querySelector("[data-figure='loop-pc']");
if (!stage) return;
const O = ${JSON.stringify(P.origin)}, CAM = ${JSON.stringify(cam)};
const iso = ([x, y, z]) => [O[0] + (x * CAM.sinA - y * CAM.cosA) * CAM.k, O[1] + ((x * CAM.cosA + y * CAM.sinA) * CAM.sinE - z * CAM.cosE) * CAM.k];
const move = (dx) => { const a = iso([0, 0, 0]), b = iso([dx, 0, 0]); return "translate(" + (b[0] - a[0]).toFixed(2) + " " + (b[1] - a[1]).toFixed(2) + ")"; };
const AMBIENT = ${AMBIENT}, LOAD = ${JSON.stringify(LOAD)}, PER_WATT = ${PER_WATT};
const FAN_X = ${FAN_X}, FAN_FACE = ${FAN_FACE}, FAN_RING = ${FAN_RING}, FAN_HUB = ${FAN_HUB}, BLADES = ${BLADES};
const FAN_Z = ${JSON.stringify(FAN_Z.map((z) => z + FAN_SIZE / 2))};
const GAUGE = ${JSON.stringify(GAUGE)}, GAUGE_R = ${GAUGE_R}, GAUGE_TOP = ${GAUGE_H + 0.2}, SCALE = ${JSON.stringify(SCALE)}, SWEEP = ${JSON.stringify(SWEEP)};
${steady.toString()}
${bladesAt.toString()}
const needleAt = (liquid) => {
  const share = Math.min(1, Math.max(0, (liquid - SCALE[0]) / (SCALE[1] - SCALE[0])));
  const angle = SWEEP[0] + share * SWEEP[1];
  const sx = Math.sin(angle), sy = -Math.cos(angle);
  const a = iso([GAUGE[0] - sx * 3, GAUGE[1] - sy * 3, GAUGE_TOP]), b = iso([GAUGE[0] + sx * (GAUGE_R - 4.2), GAUGE[1] + sy * (GAUGE_R - 4.2), GAUGE_TOP]);
  return "M" + a[0].toFixed(1) + " " + a[1].toFixed(1) + "L" + b[0].toFixed(1) + " " + b[1].toFixed(1);
};
const say = ${say.toString()};
const svg = stage.querySelector("svg");
const slider = svg.querySelector('[data-part="slider"]');
const needle = svg.querySelector('[data-part="needle"]');
const fans = [...svg.querySelectorAll("[data-fan]")];
const readout = stage.closest(".iso-plate").querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const stops = ${JSON.stringify(stops)};
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
let load = ${startLoad}, target = load, liquid = steady(load, AMBIENT).liquid, rpm = steady(load, AMBIENT).rpm, turn = 0;
let frame = 0, last = 0, clock = 0, touring = !still.matches, visible = false, idleTimer = 0;
function describe() {
  const now = steady(target, AMBIENT);
  stage.setAttribute("aria-valuenow", String(Math.round(target)));
  stage.setAttribute("aria-valuetext", Math.round(target) + " vatios de carga, líquido a " + now.liquid.toFixed(1) + " grados, ventiladores a " + Math.round(now.rpm / 10) * 10 + " rpm");
}
function draw() {
  slider.setAttribute("transform", move((load - LOAD[0]) * PER_WATT));
  needle.setAttribute("d", needleAt(liquid));
  fans.forEach((fan, index) => fan.setAttribute("d", bladesAt(turn + index * 0.3, FAN_Z[index], iso)));
  const text = say({ load, liquid, rpm });
  if (readout.textContent !== text) readout.textContent = text;
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) { clock += dt; target = stops[Math.floor(clock / 2.6) % stops.length]; describe(); }
  load = calm ? target : load + (target - load) * (1 - Math.exp(-dt / 0.3));
  if (Math.abs(target - load) < 0.2) load = target;
  // The coolant and the fans settle on the steady state for the load the slider shows.
  const want = steady(load, AMBIENT);
  liquid = calm ? want.liquid : liquid + (want.liquid - liquid) * (1 - Math.exp(-dt / 0.45));
  rpm = calm ? want.rpm : rpm + (want.rpm - rpm) * (1 - Math.exp(-dt / 0.45));
  if (Math.abs(want.liquid - liquid) < 0.004) { liquid = want.liquid; rpm = want.rpm; }
  // Blades turn at one twentieth of the true speed, so the eye can follow them.
  if (!calm) turn += (rpm / 60) * Math.PI * 2 * dt / 20;
  draw();
  frame = visible && !calm ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => {
  touring = false;
  target = clamp(next, LOAD[0], LOAD[1]);
  describe();
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 3600);
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; stage.toggleAttribute("data-inview", visible); if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
const fromPointer = (event) => {
  const box = svg.getBoundingClientRect();
  const share = clamp(((event.clientX - box.left) / box.width - 0.2) / 0.6, 0, 1);
  steer(LOAD[0] + share * (LOAD[1] - LOAD[0]));
};
stage.addEventListener("pointermove", fromPointer);
stage.addEventListener("pointerdown", fromPointer);
stage.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 100 : 50;
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = target + step;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = target - step;
  if (event.key === "Home") to = LOAD[0];
  if (event.key === "End") to = LOAD[1];
  if (to === null) return;
  event.preventDefault();
  steer(Math.round(to / 50) * 50);
});
describe();
draw();
})();
`;

const full = steady(LOAD[1], AMBIENT);
const plate = k.plateHtml({
  fig: "Fig 1",
  title: "Loop líquido a medida",
  hint: "Desliza para subir la carga",
  readout: say({ load: startLoad, ...first }),
  body: `<div class="iso-stage fig-stage" data-figure="loop-pc" tabindex="0" role="slider" aria-label="Loop líquido: las flechas suben o bajan la carga térmica de 50 en 50 vatios" aria-valuemin="${LOAD[0]}" aria-valuemax="${LOAD[1]}" aria-valuenow="${startLoad}">${svg}</div>`,
});

const PAGE_CSS = `.lp-flow{stroke-width:1.1px}.fig-stage{outline:none;touch-action:pan-y}.fig-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}`;
const page = k.pageHtml({ title: "Loop líquido a medida", theme, body: `<style>${PAGE_CSS}</style>${plate}`, script: live, width: 560 });
const pageName = theme === "light" ? "loop-pc-light.html" : "loop-pc.html";
mkdirSync(join(HERE, "out"), { recursive: true });
writeFileSync(join(HERE, "out", pageName), page);
if (theme === "dark") {
  const target = join(ROOT, "src", "components", "figures");
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, "loop-pc.figure.html"), plate + "\n");
  writeFileSync(join(target, "loop-pc.live.js"), live.trim() + "\n");
}
console.log("wrote", pageName, `${(page.length / 1024).toFixed(0)} KB`, `${R.items.length} items`, `${R.solids.length} solids`, `${FLOWS.length} runs`, `scale ${G.scaleOf(P).toFixed(3)}`);
console.log("check", conductance(rpmAt(first.liquid)).toFixed(1), "W/K at idle,", say({ load: LOAD[1], ...full }));

A.auditOrExit(R, P, {});
