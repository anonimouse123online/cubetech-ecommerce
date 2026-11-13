export function decimalToCents(value) {
  const text = typeof value === "string" ? value : value.toFixed(2);
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new TypeError("Money must be a non-negative decimal with at most two fractional digits.");
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
}

export function centsToDecimal(cents) {
  const value = BigInt(cents);
  const whole = value / 100n;
  const fraction = String(value % 100n).padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function normalizeDecimal(value) {
  return centsToDecimal(decimalToCents(String(value)));
}
