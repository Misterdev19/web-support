// Builds the "placa con polvo" figure: a motherboard on the bench whose CPU cooler fills with dust.
//   node figures/dust-board/build.mjs            writes the Astro fragment, the live script and a standalone page
//   node figures/dust-board/build.mjs --light    standalone page in the light theme
//   node figures/dust-board/build.mjs --audit    also proves contacts and depth order
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import * as A from "../kit/audit.mjs";
import { AMBIENT, POWER, LIMIT, BLOCKED, steady } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 480;
const HEIGHT = 340;

// World: the board lies flat, x to the right, y toward the viewer, z up. About 1 unit per 1.5 mm.
const BASE = { x: -112, y: -92, w: 224, d: 200, r: 8 };
const BASE_H = 10;
const FOOT_H = 5;
const BOARD = { x: -90, y: -80, w: 180, d: 130, r: 3 };
const LIFT = 4;
const TOP = LIFT + 2.5;

const COOLER = [-20, -15];
const FINS = { x: -44, y: -39, w: 48, d: 48 };
const FIN_Z = [14, 40];
const FIN_COUNT = 11;
const FIN_THICK = 1.6;
const FAN = { x: COOLER[0] - 25, y: COOLER[1] - 25, w: 50, d: 50, r: 3 };
const FAN_Z = [FIN_Z[1], FIN_Z[1] + 10];
const FAN_RING = 22;
const FAN_HUB = 6;
const BLADES = 7;

const RAIL = { x: -104, y: 70, w: 133, d: 5, r: 1 };
const STRIP = { x: -104, y: 80, w: 133, d: 7, r: 1 };
const TRAVEL = [-100, 125];
const GAUGE = [72, 84];
const GAUGE_R = 16;
const GAUGE_H = 9;
const SCALE = [30, 110];
const SWEEP = [1.25 * Math.PI, 1.5 * Math.PI];
const BANDS = 10;
const START = 0.1;

const P = k.fitProjection([...k.boxCorners(BASE, -BASE_H - FOOT_H, 0), ...k.boxCorners(FAN, 0, FAN_Z[1] + 2)], WIDTH, HEIGHT, { pad: 18 });
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);

const R = A.recorder(P);
function put(name, ref, svg, shapes = [], { bias = 0, ...rest } = {}) {
  return R.put({ name, at: ref, bias, svg, shapes, piece: "board", ...rest });
}
function box(name, plan, z0, z1, style = {}, { steps = 3, bevel = 0, extra = "", inner = "", bias = 0 } = {}) {
  const shape = R.solid(A.slab(plan, z0, z1 - z0, { name }, steps));
  put(name, [plan.x + plan.w / 2, plan.y + plan.d / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [shape], { bias });
  return shape;
}
function post(name, [x, y], r, z0, z1, style = {}, { steps = 24, bevel = 0, extra = "", inner = "", bias = 0 } = {}) {
  const shape = R.solid(A.cylinder(x, y, r, z0, z1 - z0, { name }));
  put(name, [x, y, (z0 + z1) / 2], S(k.cylinder(x, y, r, z0, z1 - z0, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [shape], { bias });
  return shape;
}

// Dust is drawn as specks in ten bands; band b shows once the dirt passes b tenths.
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shownAt = (dirt, band) => Math.min(1, Math.max(0, dirt * BANDS - band));
function dust(seed, count, place, { size = 0.6, from = 0 } = {}) {
  const next = random(seed);
  const bands = Array.from({ length: BANDS }, () => []);
  for (let i = 0; i < count; i++) {
    const point = place(next);
    const band = Math.min(BANDS - 1, from + Math.floor(next() * (BANDS - from)));
    if (point) bands[band].push(at(point));
  }
  return bands.map((points, band) => (points.length ? `<g data-dust="${band}" opacity="${shownAt(START, band).toFixed(2)}">${D(points, { size, tone: "hi" })}</g>` : "")).join("");
}

// ── Bench ───────────────────────────────────────────────────────────────────────────────────────
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

// Dirt scale: one tick per 5 %, a long one per 10 %.
back.push(S(k.slabOf(STRIP, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
const ticks = k.topTicks(TRAVEL[0], TRAVEL[0] + TRAVEL[1], TRAVEL[1] / 20, 2, STRIP.y, 0.6, [2, 3.8], P);
back.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
back.push(D([at([STRIP.x + 1.6, STRIP.y + 5.2, 0.6]), at([STRIP.x + STRIP.w - 1.6, STRIP.y + 5.2, 0.6])], { size: 0.45 }));
const LABEL = { x: -104, y: 92, w: 32, d: 10, r: 1.2 };
back.push(S(k.slabOf(LABEL, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
back.push(L(k.planOutline(k.insetPlan(LABEL, 1.4), 0.8, P, 3), { tone: "faint" }));
back.push(L([18, 12].map((w, i) => k.lineOnTop([LABEL.x + 4, LABEL.y + 3.4 + i * 3], [LABEL.x + 4 + w, LABEL.y + 3.4 + i * 3], 0.8, P)).join(""), { tone: "lo", free: true }));
back.push(D([at([LABEL.x + LABEL.w - 2.6, LABEL.y + 5, 0.8])], { size: 0.45 }));

// ── Board ───────────────────────────────────────────────────────────────────────────────────────
k.corners(BOARD, 6).forEach(([x, y], index) => post(`standoff${index}`, [x, y], 2.6, 0, LIFT));
const boardMarks =
  L(k.planOutline({ x: -86, y: 34, w: 100, d: 6, r: 1 }, TOP, P, 3) + k.ring(56, -52, 5, TOP, P, 24) + k.ring(56, -52, 3.4, TOP, P, 20), { tone: "lo" }) +
  D(k.corners(BOARD, 6).map(([x, y]) => at([x, y, TOP])), { size: 0.55 }) +
  dust(11, 340, (next) => [BOARD.x + 4 + next() * (BOARD.w - 8), BOARD.y + 4 + next() * (BOARD.d - 8), TOP], { size: 0.65, from: 1 });
box("board", BOARD, LIFT, TOP, { tone: "mid" }, { steps: 4, extra: boardMarks });

const IO = { x: -88, y: -78, w: 20, d: 58, r: 1.2 };
box("io", IO, TOP, TOP + 16, {}, { bevel: 0.5, inner: L(k.sideSeam(IO, TOP + 8, P, 3), { tone: "faint" }), extra: dust(21, 26, (next) => [IO.x + 2 + next() * (IO.w - 4), IO.y + 2 + next() * (IO.d - 4), TOP + 16], { from: 3 }) });
const VRM = { x: -60, y: -78, w: 58, d: 10, r: 0.4 };
const vrmFins = [];
for (let x = VRM.x + 4.2; x < VRM.x + VRM.w - 2; x += 4.2) vrmFins.push(k.segment([x, VRM.y + VRM.d, TOP], [x, VRM.y + VRM.d, TOP + 10], P));
box("vrm", VRM, TOP, TOP + 10, {}, { steps: 2, extra: L(vrmFins.join(""), { tone: "faint" }) });
for (const [index, x] of [22, 31].entries()) {
  box(`ram.slot${index}`, { x: x - 0.9, y: -62, w: 4, d: 92, r: 0.4 }, TOP, TOP + 2, {}, { steps: 2 });
  const stick = { x, y: -60, w: 2.2, d: 88, r: 0.4 };
  box(`ram${index}`, stick, TOP + 2, TOP + 18, {}, { steps: 2, extra: dust(31 + index, 16, (next) => [x + 1.1, stick.y + 2 + next() * (stick.d - 4), TOP + 18], { size: 0.5, from: 4 }) });
}
box("power", { x: 78, y: -42, w: 8, d: 34, r: 0.5 }, TOP, TOP + 7, {}, { steps: 2 });
const CHIPSET = { x: 40, y: 2, w: 30, d: 24, r: 2 };
box("chipset", CHIPSET, TOP, TOP + 4, {}, { bevel: 0.4, extra: L(k.planOutline(k.insetPlan(CHIPSET, 4), TOP + 4, P, 4), { tone: "faint" }) + dust(41, 22, (next) => [CHIPSET.x + 2 + next() * (CHIPSET.w - 4), CHIPSET.y + 2 + next() * (CHIPSET.d - 4), TOP + 4], { from: 3 }) });
box("slot", { x: -84, y: 35, w: 96, d: 4, r: 0.5 }, TOP, TOP + 5, {}, { steps: 2 });
box("header", { x: 60, y: 41, w: 10, d: 5, r: 0.5 }, TOP, TOP + 3, {}, { steps: 2 });
for (const [index, [x, y]] of [[-63, -6], [-63, 2], [-63, 10], [-34, 22], [-26, 22]].entries()) {
  post(`cap${index}`, [x, y], 2.4, TOP, TOP + 7, {}, { steps: 18, bevel: 0.3, extra: L(k.lineOnTop([x - 2.4, y], [x + 2.4, y], TOP + 7, P), { tone: "faint" }) });
}

// ── Cooler: bracket, cold plate, spreader, a stack of fins and the fan on top ────────────────────
box("cooler.bracket", { x: COOLER[0] - 27, y: COOLER[1] - 27, w: 54, d: 54, r: 2 }, TOP, TOP + 2, {}, { extra: D(k.corners({ x: COOLER[0] - 27, y: COOLER[1] - 27, w: 54, d: 54 }, 3.5).map(([x, y]) => at([x, y, TOP + 2])), { size: 0.5 }) });
box("cooler.plate", { x: COOLER[0] - 17, y: COOLER[1] - 17, w: 34, d: 34, r: 1 }, TOP + 2, 12, { tone: "hi", crease: "lo" }, { steps: 2 });
box("cooler.spreader", { ...FINS, r: 0.6 }, 12, FIN_Z[0], { tone: "hi", crease: "lo" }, { steps: 2 });
const pitch = (FINS.w - FIN_THICK) / (FIN_COUNT - 1);
for (let fin = 0; fin < FIN_COUNT; fin++) {
  box(`fin${fin}`, { x: FINS.x + fin * pitch, y: FINS.y, w: FIN_THICK, d: FINS.d, r: 0.2 }, FIN_Z[0], FIN_Z[1], { tone: "hi", crease: "lo" }, { steps: 1 });
}
// The mat of lint that builds up across the open face of the fins.
const FRONT = FINS.y + FINS.d;
const MAT = { x: FINS.x, y: FRONT, w: FINS.w, d: 0.3, r: 0 };
const matSvg =
  dust(51, 150, (next) => [FINS.x + next() * FINS.w, FRONT + 0.3, FIN_Z[0] + 1 + next() * (FIN_Z[1] - FIN_Z[0] - 2)], { size: 0.6, from: 1 }) +
  dust(52, 46, (next) => [FINS.x + pitch / 2 + Math.floor(next() * (FIN_COUNT - 1)) * pitch + FIN_THICK / 2, FRONT + 0.3, FIN_Z[0] + 2 + next() * (FIN_Z[1] - FIN_Z[0] - 4)], { size: 1.15, from: 5 });
put("cooler.mat", [FINS.x + FINS.w / 2, FRONT + 0.15, (FIN_Z[0] + FIN_Z[1]) / 2], matSvg, [R.solid(A.slab(MAT, FIN_Z[0], FIN_Z[1] - FIN_Z[0], { name: "cooler.mat" }, 1))]);

function bladesAt(turn, project) {
  let d = "";
  for (let blade = 0; blade < BLADES; blade++) {
    const a = turn + (blade / BLADES) * Math.PI * 2;
    for (let step = 0; step <= 14; step++) {
      const t = step / 14;
      const r = FAN_HUB + (FAN_RING - FAN_HUB) * t;
      const angle = a + 0.85 * t * t;
      const [x, y] = project([FAN_X + r * Math.cos(angle), FAN_Y + r * Math.sin(angle), FAN_TOP]);
      d += (step ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }
  }
  return d;
}
const [FAN_X, FAN_Y] = COOLER;
const FAN_TOP = FAN_Z[1];
const fanMarks =
  L(k.ring(FAN_X, FAN_Y, FAN_RING, FAN_TOP, P, 56), { tone: "mid" }) +
  `<path class="iso-line" data-tone="mid" data-fan d="${bladesAt(0, at)}"/>` +
  L(k.ring(FAN_X, FAN_Y, FAN_HUB, FAN_TOP, P, 28), { tone: "hi" }) +
  L(k.ring(FAN_X, FAN_Y, 2.8, FAN_TOP, P, 16), { tone: "lo" }) +
  D(k.corners(FAN, 3.5).map(([x, y]) => at([x, y, FAN_TOP])), { size: 0.5 }) +
  dust(61, 120, (next) => {
    const r = FAN_HUB + 1 + next() * (FAN_RING - FAN_HUB - 2);
    const angle = next() * Math.PI * 2;
    return [FAN_X + r * Math.cos(angle), FAN_Y + r * Math.sin(angle), FAN_TOP];
  }, { size: 0.6, from: 1 }) +
  dust(62, 30, (next) => [FAN.x + 1.5 + next() * (FAN.w - 3), FAN.y + 1.5 + next() * (FAN.d - 3), FAN_TOP], { size: 0.5, from: 3 });
box("cooler.fan", FAN, FAN_Z[0], FAN_Z[1], { tone: "mid" }, { steps: 4, bevel: 0.5, inner: L(k.sideSeam(FAN, FAN_Z[0] + 5, P, 4), { tone: "faint" }), extra: fanMarks });

// ── Controls on the bench: dirt slider and CPU thermometer ──────────────────────────────────────
box("rail", RAIL, 0, 3, {}, { bevel: 0.4, extra: D([at([RAIL.x + 5, RAIL.y + 2.5, 3]), at([RAIL.x + RAIL.w - 5, RAIL.y + 2.5, 3])], { size: 0.4 }) });
for (const [index, x] of [RAIL.x - 5, RAIL.x + RAIL.w].entries()) {
  box(`rail.stop${index}`, { x, y: RAIL.y - 3, w: 5, d: 11, r: 1.2 }, 0, 7, {}, { bevel: 0.5, extra: D([at([x + 2.5, RAIL.y + 2.5, 7])], { size: 0.45 }) });
}
// Built where it rests at the starting dirt; the page slides it along the rail from there.
const SX = TRAVEL[0] + START * TRAVEL[1];
const CARRIAGE = { x: SX - 6, y: RAIL.y - 2.5, w: 12, d: 10, r: 2 };
const sliderSvg = [
  S(k.slabOf({ x: SX - 1.2, y: RAIL.y + 7.5, w: 2.4, d: 4.6, r: 0.6 }, 1, 0.8, P, 2), { tone: "hi", crease: "none" }),
  S(k.slabOf(CARRIAGE, 3, 4.5, P, 4, 0.5), { tone: "hi", crease: "lo" }),
  S(k.cylinder(SX, RAIL.y + 2.5, 3.6, 7.5, 4.5, P, 24), { tone: "hi", crease: "lo" }),
  L(k.knurl(SX, RAIL.y + 2.5, 3.6, 7.5, 12, 22, P, 0.4), { tone: "lo" }),
  D([at([SX, RAIL.y + 2.5, 12])], { size: 0.5, tone: "hi" }),
].join("");
put("slider", [SX, RAIL.y + 2.5, 6], sliderSvg, [R.solid(A.slab(CARRIAGE, 3, 4.5, { name: "slider" }, 4)), R.solid(A.cylinder(SX, RAIL.y + 2.5, 3.6, 7.5, 4.5, { name: "slider.knob" }))], { attrs: ` data-part="slider"` });

const BLOCK = { x: 44, y: 78, w: 10, d: 8, r: 1 };
box("gauge.block", BLOCK, 0, 3, {}, { bevel: 0.3, extra: D([at([BLOCK.x + 7.5, BLOCK.y + 4, 3])], { size: 0.45 }) });
const angleOf = (cpu) => SWEEP[0] + Math.min(1, Math.max(0, (cpu - SCALE[0]) / (SCALE[1] - SCALE[0]))) * SWEEP[1];
const needleAt = (cpu) => {
  const [sx, sy] = [Math.sin(angleOf(cpu)), -Math.cos(angleOf(cpu))];
  return k.lineOnTop([GAUGE[0] - sx * 3, GAUGE[1] - sy * 3], [GAUGE[0] + sx * (GAUGE_R - 4.2), GAUGE[1] + sy * (GAUGE_R - 4.2)], GAUGE_H + 0.2, P);
};
const first = steady(START);
const dialTicks = k.radialTicks(GAUGE[0], GAUGE[1], GAUGE_R - 3, 40, 5, GAUGE_H, [1.2, 2.6], P, SWEEP[0], SWEEP[1]);
// The thermal limit is a short bar across the scale, from the bezel ring to the tick circle.
const [lx, ly] = [Math.sin(angleOf(LIMIT)), -Math.cos(angleOf(LIMIT))];
const limitMark = k.lineOnTop([GAUGE[0] + lx * (GAUGE_R - 7), GAUGE[1] + ly * (GAUGE_R - 7)], [GAUGE[0] + lx * (GAUGE_R - 2.2), GAUGE[1] + ly * (GAUGE_R - 2.2)], GAUGE_H, P);
const gaugeMarks = [
  L(k.knurl(GAUGE[0], GAUGE[1], GAUGE_R, GAUGE_H - 3, GAUGE_H, 72, P, 0.3), { tone: "lo" }),
  L(k.ring(GAUGE[0], GAUGE[1], GAUGE_R - 2.2, GAUGE_H, P, 56), { tone: "lo" }),
  L(k.ring(GAUGE[0], GAUGE[1], GAUGE_R - 7, GAUGE_H, P, 48), { tone: "faint" }),
  L(dialTicks.minor, { tone: "lo" }),
  L(dialTicks.major, { tone: "mid" }),
  `<path class="iso-line" data-tone="lit" d="${limitMark}" style="stroke-width:1.4"/>`,
  L(k.ring(GAUGE[0], GAUGE[1], 1.5, GAUGE_H, P, 16), { tone: "mid" }),
  k.faceTextSvg(k.topMatrix([GAUGE[0], GAUGE[1] + 8.6], GAUGE_H, P, "x"), "°C", { size: 2.6, tone: "lo", anchor: "middle" }),
  `<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" d="${needleAt(first.cpu)}" style="stroke-width:1.1"/>`,
].join("");
post("gauge", GAUGE, GAUGE_R, 0, GAUGE_H, { tone: "hi", crease: "lo" }, { steps: 64, bevel: 0.8, inner: L(k.sideArc(GAUGE[0], GAUGE[1], GAUGE_R, GAUGE_H - 3, P, 40), { tone: "faint" }), extra: gaugeMarks });

A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);

// The sensor lead: from the header on the board's front edge, down to the bench and along it to the gauge's terminal.
const lead = k.wireSvg(at([65, 46, TOP + 1.5]), at([BLOCK.x + 5, BLOCK.y + 4, 3]), {
  via: [at([65, 53, TOP + 1.5]), at([65, 53, 0]), at([BLOCK.x + 5, 53, 0]), at([BLOCK.x + 5, BLOCK.y, 0]), at([BLOCK.x + 5, BLOCK.y, 3])],
  tone: "mid",
  size: 1,
});

const label =
  "Una placa base sobre el banco con su disipador de aletas y un ventilador encima. Al subir la suciedad aparecen motas de polvo sobre el ventilador, entre las aletas y sobre la placa; el ventilador gira más rápido y la aguja del termómetro sube hasta la marca del límite térmico.";
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label,
  body: [...back, ...R.items.map((item) => `<g class="it" data-name="${item.name}"${item.attrs ?? ""}>${item.svg}</g>`), lead],
});

// ── Live page ───────────────────────────────────────────────────────────────────────────────────
const cam = k.cameraOf(P);
const stops = [0.05, 0.4, 0.75, 1];
const say = ({ dirt, cpu, rpm, power }) =>
  `polvo ${Math.round(dirt * 100)} % · ${Math.round(cpu)} °C · ` + (power < 0.995 ? `rinde ${Math.round(power * 100)} %` : `${Math.round(rpm / 10) * 10} rpm`);
const live = `
(() => {
const stage = document.querySelector("[data-figure='dust-board']");
if (!stage) return;
const O = ${JSON.stringify(P.origin)}, CAM = ${JSON.stringify(cam)};
const iso = ([x, y, z]) => [O[0] + (x * CAM.sinA - y * CAM.cosA) * CAM.k, O[1] + ((x * CAM.cosA + y * CAM.sinA) * CAM.sinE - z * CAM.cosE) * CAM.k];
const move = (dx) => { const a = iso([0, 0, 0]), b = iso([dx, 0, 0]); return "translate(" + (b[0] - a[0]).toFixed(2) + " " + (b[1] - a[1]).toFixed(2) + ")"; };
const TRAVEL = ${TRAVEL[1]}, START = ${START}, BANDS = ${BANDS}, LIMIT = ${LIMIT};
const FAN_X = ${FAN_X}, FAN_Y = ${FAN_Y}, FAN_TOP = ${FAN_TOP}, FAN_RING = ${FAN_RING}, FAN_HUB = ${FAN_HUB}, BLADES = ${BLADES};
const GAUGE = ${JSON.stringify(GAUGE)}, GAUGE_R = ${GAUGE_R}, GAUGE_TOP = ${GAUGE_H + 0.2}, SCALE = ${JSON.stringify(SCALE)}, SWEEP = ${JSON.stringify(SWEEP)};
${steady.toString()}
${bladesAt.toString()}
const needleAt = (cpu) => {
  const angle = SWEEP[0] + Math.min(1, Math.max(0, (cpu - SCALE[0]) / (SCALE[1] - SCALE[0]))) * SWEEP[1];
  const sx = Math.sin(angle), sy = -Math.cos(angle);
  const a = iso([GAUGE[0] - sx * 3, GAUGE[1] - sy * 3, GAUGE_TOP]), b = iso([GAUGE[0] + sx * (GAUGE_R - 4.2), GAUGE[1] + sy * (GAUGE_R - 4.2), GAUGE_TOP]);
  return "M" + a[0].toFixed(1) + " " + a[1].toFixed(1) + "L" + b[0].toFixed(1) + " " + b[1].toFixed(1);
};
const say = ${say.toString()};
const svg = stage.querySelector("svg");
const slider = svg.querySelector('[data-part="slider"]');
const needle = svg.querySelector('[data-part="needle"]');
const fan = svg.querySelector("[data-fan]");
const specks = [...svg.querySelectorAll("[data-dust]")].map((node) => ({ node, band: Number(node.dataset.dust), shown: -1 }));
const readout = stage.closest(".iso-plate").querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const stops = ${JSON.stringify(stops)};
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
let dirt = START, target = dirt, cpu = steady(dirt).cpu, rpm = steady(dirt).rpm, turn = 0;
let frame = 0, last = 0, clock = 0, touring = !still.matches, visible = false, idleTimer = 0;
function describe() {
  const now = steady(target);
  stage.setAttribute("aria-valuenow", String(Math.round(target * 100)));
  stage.setAttribute("aria-valuetext", Math.round(target * 100) + " por ciento de suciedad, procesador a " + Math.round(now.cpu) + " grados" + (now.power < 0.995 ? ", rindiendo al " + Math.round(now.power * 100) + " por ciento" : ""));
}
function draw() {
  slider.setAttribute("transform", move((dirt - START) * TRAVEL));
  needle.setAttribute("d", needleAt(cpu));
  fan.setAttribute("d", bladesAt(turn, iso));
  for (const speck of specks) {
    const shown = Math.round(clamp(dirt * BANDS - speck.band, 0, 1) * 20) / 20;
    if (shown !== speck.shown) { speck.shown = shown; speck.node.setAttribute("opacity", String(shown)); }
  }
  // The word and the number come from the same reading: it only says "rinde" once the needle is on the limit.
  const text = say({ dirt, cpu, rpm, power: cpu >= LIMIT - 0.5 ? steady(dirt).power : 1 });
  if (readout.textContent !== text) readout.textContent = text;
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) { clock += dt; target = stops[Math.floor(clock / 2.8) % stops.length]; describe(); }
  dirt = calm ? target : dirt + (target - dirt) * (1 - Math.exp(-dt / 0.35));
  if (Math.abs(target - dirt) < 0.002) dirt = target;
  // Temperature and fan settle on the steady state for the dirt the slider shows.
  const want = steady(dirt);
  cpu = calm ? want.cpu : cpu + (want.cpu - cpu) * (1 - Math.exp(-dt / 0.45));
  rpm = calm ? want.rpm : rpm + (want.rpm - rpm) * (1 - Math.exp(-dt / 0.45));
  if (Math.abs(want.cpu - cpu) < 0.02) { cpu = want.cpu; rpm = want.rpm; }
  // Blades turn at one twentieth of the true speed, so the eye can follow them.
  if (!calm) turn += (rpm / 60) * Math.PI * 2 * dt / 20;
  draw();
  frame = visible && !calm ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => {
  touring = false;
  target = clamp(next, 0, 1);
  describe();
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 3600);
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
const fromPointer = (event) => {
  const box = svg.getBoundingClientRect();
  steer(clamp(((event.clientX - box.left) / box.width - 0.2) / 0.6, 0, 1));
};
stage.addEventListener("pointermove", fromPointer);
stage.addEventListener("pointerdown", fromPointer);
stage.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 0.25 : 0.1;
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = target + step;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = target - step;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = 1;
  if (to === null) return;
  event.preventDefault();
  steer(Math.round(to * 20) / 20);
});
describe();
draw();
})();
`;

// Where the thermal limit is first reached, to the nearest percent.
let onset = 1;
for (let percent = 0; percent <= 100; percent++) if (steady(percent / 100).power < 0.995) { onset = percent / 100; break; }
const clean = steady(0);
const full = steady(1);
const plate = k.plateHtml({
  fig: "Fig 2",
  title: "Placa con polvo",
  hint: "Desliza para ensuciar la placa",
  readout: say({ dirt: START, ...first }),
  body: `<div class="iso-stage fig-stage" data-figure="dust-board" tabindex="0" role="slider" aria-label="Placa con polvo: las flechas suben o bajan la suciedad de diez en diez por ciento" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(START * 100)}">${svg}</div>`,
});

const PAGE_CSS = `.fig-stage{outline:none;touch-action:pan-y}.fig-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}`;
const page = k.pageHtml({ title: "Placa con polvo", theme, body: `<style>${PAGE_CSS}</style>${plate}`, script: live, width: 560 });
const pageName = theme === "light" ? "dust-board-light.html" : "dust-board.html";
mkdirSync(join(HERE, "out"), { recursive: true });
writeFileSync(join(HERE, "out", pageName), page);
if (theme === "dark") {
  const target = join(ROOT, "src", "components", "figures");
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, "dust-board.figure.html"), plate + "\n");
  writeFileSync(join(target, "dust-board.live.js"), live.trim() + "\n");
}
console.log("wrote", pageName, `${(page.length / 1024).toFixed(0)} KB`, `${R.items.length} items`, `${R.solids.length} solids`, `scale ${G.scaleOf(P).toFixed(3)}`);
console.log("check", say({ dirt: 0, ...clean }), "|", say({ dirt: 0.5, ...steady(0.5) }), "|", say({ dirt: 1, ...full }), "| onset", onset);

A.auditOrExit(R, P, {});
