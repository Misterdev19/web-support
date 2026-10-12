(() => {
const stage = document.querySelector("[data-figure='loop-pc']");
if (!stage) return;
const O = [118.50239463608946,257.1892391638288], CAM = {"sinA":0.8290375725550417,"cosA":0.5591929034707468,"sinE":0.49999999999999994,"cosE":0.8660254037844387,"k":1.3278458809470992};
const iso = ([x, y, z]) => [O[0] + (x * CAM.sinA - y * CAM.cosA) * CAM.k, O[1] + ((x * CAM.cosA + y * CAM.sinA) * CAM.sinE - z * CAM.cosE) * CAM.k];
const move = (dx) => { const a = iso([0, 0, 0]), b = iso([dx, 0, 0]); return "translate(" + (b[0] - a[0]).toFixed(2) + " " + (b[1] - a[1]).toFixed(2) + ")"; };
const AMBIENT = 24, LOAD = [100,650], PER_WATT = 0.25;
const FAN_X = 39, FAN_FACE = 29, FAN_RING = 23, FAN_HUB = 6, BLADES = 7;
const FAN_Z = [56,107,158];
const GAUGE = [226,54], GAUGE_R = 16, GAUGE_TOP = 9.2, SCALE = [20,50], SWEEP = [3.9269908169872414,4.71238898038469];
function steady(load, ambient) {
  let liquid = ambient + load / 30;
  for (let i = 0; i < 40; i++) liquid += (ambient + load / (14 + 0.014 * Math.min(1800, Math.max(600, 600 + (liquid - 28) * 90))) - liquid) * 0.5;
  const rpm = Math.min(1800, Math.max(600, 600 + (liquid - 28) * 90));
  return { liquid, rpm };
}
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
const needleAt = (liquid) => {
  const share = Math.min(1, Math.max(0, (liquid - SCALE[0]) / (SCALE[1] - SCALE[0])));
  const angle = SWEEP[0] + share * SWEEP[1];
  const sx = Math.sin(angle), sy = -Math.cos(angle);
  const a = iso([GAUGE[0] - sx * 3, GAUGE[1] - sy * 3, GAUGE_TOP]), b = iso([GAUGE[0] + sx * (GAUGE_R - 4.2), GAUGE[1] + sy * (GAUGE_R - 4.2), GAUGE_TOP]);
  return "M" + a[0].toFixed(1) + " " + a[1].toFixed(1) + "L" + b[0].toFixed(1) + " " + b[1].toFixed(1);
};
const say = ({ load, liquid, rpm }) => `carga ${Math.round(load)} W · ${liquid.toFixed(1)} °C · ${Math.round(rpm / 10) * 10} rpm`;
const svg = stage.querySelector("svg");
const slider = svg.querySelector('[data-part="slider"]');
const needle = svg.querySelector('[data-part="needle"]');
const fans = [...svg.querySelectorAll("[data-fan]")];
const readout = stage.closest(".iso-plate").querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const stops = [100,280,460,650];
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
let load = 100, target = load, liquid = steady(load, AMBIENT).liquid, rpm = steady(load, AMBIENT).rpm, turn = 0;
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
