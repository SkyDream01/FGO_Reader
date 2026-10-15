export type Easing = (t: number) => number;

const bounceOut: Easing = (t) => {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};
const elasticIn: Easing = (t) => t === 0 || t === 1 ? t : -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * 2 * Math.PI / 3);
const incoming: Record<string, Easing> = {
  Quad: (t) => t ** 2, Cubic: (t) => t ** 3, Quart: (t) => t ** 4, Quint: (t) => t ** 5,
  Sine: (t) => 1 - Math.cos(t * Math.PI / 2),
  Expo: (t) => t === 0 ? 0 : 2 ** (10 * t - 10),
  Circ: (t) => 1 - Math.sqrt(1 - t * t),
  Back: (t) => t * t * (2.70158 * t - 1.70158),
  Elastic: elasticIn, Bounce: (t) => 1 - bounceOut(1 - t),
};

/** All 33 iTween names; only easing names are matched without case sensitivity. */
export const easings: Record<string, Easing> = { linear: (t) => t };
for (const [name, easeIn] of Object.entries(incoming)) {
  easings[`easeIn${name}`] = easeIn;
  easings[`easeOut${name}`] = (t) => 1 - easeIn(1 - t);
  easings[`easeInOut${name}`] = (t) => t < 0.5 ? easeIn(2 * t) / 2 : 1 - easeIn(2 - 2 * t) / 2;
}
easings.spring = (t) => (Math.sin(t * Math.PI * (0.2 + 2.5 * t ** 3)) * (1 - t) ** 2.2 + t) * (1 + 1.2 * (1 - t));
easings.punch = (t) => t === 0 || t === 1 ? 0 : 2 ** (-10 * t) * Math.sin(t * 2 * Math.PI / 0.3);
easings.easeInOutBack = (t) => {
  const c = 1.70158 * 1.525;
  return t < 0.5 ? (2 * t) ** 2 * ((c + 1) * 2 * t - c) / 2 : ((2 * t - 2) ** 2 * ((c + 1) * (2 * t - 2) + c) + 2) / 2;
};
easings.easeInOutElastic = (t) => {
  if (t === 0 || t === 1) return t;
  const wave = Math.sin((20 * t - 11.125) * 2 * Math.PI / 4.5);
  return t < 0.5 ? -(2 ** (20 * t - 10) * wave) / 2 : 2 ** (-20 * t + 10) * wave / 2 + 1;
};
const lookup = new Map(Object.entries(easings).map(([name, fn]) => [name.toLowerCase(), fn]));
export function resolveEasing(name?: string | null): Easing {
  return lookup.get(name?.toLowerCase() ?? "linear") ?? easings.linear;
}
