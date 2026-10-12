(() => {
const stage = document.querySelector("[data-figure='dust-board']");
if (!stage) return;
const O = [248.37735849056605,158.3845622019116], CAM = {"sinA":0.7071067811865475,"cosA":0.7071067811865476,"sinE":0.49999999999999994,"cosE":0.8660254037844387,"k":1.4809217492774862};
const iso = ([x, y, z]) => [O[0] + (x * CAM.sinA - y * CAM.cosA) * CAM.k, O[1] + ((x * CAM.cosA + y * CAM.sinA) * CAM.sinE - z * CAM.cosE) * CAM.k];
const move = (dx) => { const a = iso([0, 0, 0]), b = iso([dx, 0, 0]); return "translate(" + (b[0] - a[0]).toFixed(2) + " " + (b[1] - a[1]).toFixed(2) + ")"; };
const TRAVEL = 125, START = 0.1, BANDS = 10, LIMIT = 95;
const FAN_X = -20, FAN_Y = -15, FAN_TOP = 50, FAN_RING = 22, FAN_HUB = 6, BLADES = 7;
const GAUGE = [72,84], GAUGE_R = 16, GAUGE_TOP = 9.2, SCALE = [30,110], SWEEP = [3.9269908169872414,4.71238898038469];
function steady(dirt) {
  const open = 1 - 0.85 * dirt;
  // 0.15 K/W through the cold plate and paste, plus 0.30 K/W to the air at 1500 rpm with a clean heatsink.
  const resistance = (rpm) => 0.15 + 0.3 / Math.pow((open * rpm) / 1500, 0.8);
  // Fan curve: 900 rpm up to 50 °C, +40 rpm per °C, capped at 2200.
  const curve = (cpu) => Math.min(2200, Math.max(900, 900 + (cpu - 50) * 40));
  let cpu = 70;
  for (let i = 0; i < 80; i++) cpu += (25 + 95 * resistance(curve(cpu)) - cpu) * 0.4;
  if (cpu <= 95) return { cpu, rpm: curve(cpu), power: 1 };
  return { cpu: 95, rpm: 2200, power: (95 - 25) / resistance(2200) / 95 };
}
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
const needleAt = (cpu) => {
  const angle = SWEEP[0] + Math.min(1, Math.max(0, (cpu - SCALE[0]) / (SCALE[1] - SCALE[0]))) * SWEEP[1];
  const sx = Math.sin(angle), sy = -Math.cos(angle);
  const a = iso([GAUGE[0] - sx * 3, GAUGE[1] - sy * 3, GAUGE_TOP]), b = iso([GAUGE[0] + sx * (GAUGE_R - 4.2), GAUGE[1] + sy * (GAUGE_R - 4.2), GAUGE_TOP]);
  return "M" + a[0].toFixed(1) + " " + a[1].toFixed(1) + "L" + b[0].toFixed(1) + " " + b[1].toFixed(1);
};
const say = ({ dirt, cpu, rpm, power }) =>
  `polvo ${Math.round(dirt * 100)} % · ${Math.round(cpu)} °C · ` + (power < 0.995 ? `rinde ${Math.round(power * 100)} %` : `${Math.round(rpm / 10) * 10} rpm`);
const svg = stage.querySelector("svg");
const slider = svg.querySelector('[data-part="slider"]');
const needle = svg.querySelector('[data-part="needle"]');
const fan = svg.querySelector("[data-fan]");
const specks = [...svg.querySelectorAll("[data-dust]")].map((node) => ({ node, band: Number(node.dataset.dust), shown: -1 }));
const readout = stage.closest(".iso-plate").querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const stops = [0.05,0.4,0.75,1];
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
