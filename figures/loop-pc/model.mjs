// Steady-state model of a custom loop: 360 mm radiator, three 120 mm fans, 3.8 L/min pump.
// Pure functions, shared by the build and the live page (inlined with toString).
export const AMBIENT = 24; // °C
export const LOAD = [100, 650]; // W of heat going into the coolant
export const FLOW = 265; // W/K carried by 3.8 L/min of water (0.0633 kg/s × 4186 J/kg·K)

// Fan curve on coolant temperature: 600 rpm up to 28 °C, +90 rpm per °C, capped at 1800.
export function rpmAt(liquid) {
  return Math.min(1800, Math.max(600, 600 + (liquid - 28) * 90));
}

// Radiator conductance in W/K: 22 W/K at 600 rpm, 39 W/K at 1800 rpm.
export function conductance(rpm) {
  return 14 + 0.014 * rpm;
}

// Coolant temperature where the radiator sheds exactly the load, with the fans on their curve.
export function steady(load, ambient) {
  let liquid = ambient + load / 30;
  for (let i = 0; i < 40; i++) liquid += (ambient + load / (14 + 0.014 * Math.min(1800, Math.max(600, 600 + (liquid - 28) * 90))) - liquid) * 0.5;
  const rpm = Math.min(1800, Math.max(600, 600 + (liquid - 28) * 90));
  return { liquid, rpm };
}
