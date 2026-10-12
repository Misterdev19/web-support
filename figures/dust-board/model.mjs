// Steady-state model of an air-cooled CPU whose heatsink and fan fill with dust.
// Pure functions, shared by the build and the live page (inlined with toString).
export const AMBIENT = 25; // °C
export const POWER = 95; // W the processor draws at full load
export const LIMIT = 95; // °C where the processor starts cutting its own power
export const BLOCKED = 0.85; // share of the air path that a fully clogged heatsink closes

// dirt runs 0 (just cleaned) to 1 (fully clogged). Returns CPU temperature, fan speed and the share of
// full power the processor can still use.
export function steady(dirt) {
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
