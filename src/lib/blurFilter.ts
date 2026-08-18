/** Converts a validated script blur intensity into a CSS filter value. */
export function blurFilterCss(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "none";
  return `blur(${value}px)`;
}
