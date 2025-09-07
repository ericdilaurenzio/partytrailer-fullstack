/**
 * Delivery fee calculator (MVP).
 * Defaults can be overridden via env:
 *   DELIVERY_BASE_FEE=50
 *   DELIVERY_PER_MILE=3
 */
export function calcDeliveryFee({ miles = 0 } = {}) {
  const base = Number(process.env.DELIVERY_BASE_FEE ?? 50);   // $ base fee
  const perMile = Number(process.env.DELIVERY_PER_MILE ?? 3); // $ / mile
  const m = Number.isFinite(+miles) ? Math.max(0, +miles) : 0;
  return Math.max(0, base + perMile * m);
}

/**
 * Optional miles helper stub.
 * In the future we can compute miles from an address (Maps API).
 * For now, pass miles from the client or leave 0.
 */
export async function ensureMiles(logistics = {}) {
  // If miles not provided, keep 0 (no external calls for MVP)
  if (typeof logistics.miles !== "number") logistics.miles = 0;
  return logistics;
}

/**
 * Normalize and compute deliveryFee if deliveryType === "delivery".
 * Returns a { logistics } object safe to persist.
 */
export async function normalizeLogistics(input = {}) {
  const logistics = { ...input };
  // Window sanity: swap if inverted
  if (logistics.windowStart && logistics.windowEnd) {
    const s = new Date(logistics.windowStart).getTime();
    const e = new Date(logistics.windowEnd).getTime();
    if (Number.isFinite(s) && Number.isFinite(e) && s > e) {
      const tmp = logistics.windowStart;
      logistics.windowStart = logistics.windowEnd;
      logistics.windowEnd = tmp;
    }
  }
  await ensureMiles(logistics);
  if (logistics.deliveryType === "delivery") {
    logistics.deliveryFee = calcDeliveryFee({ miles: logistics.miles ?? 0 });
  } else {
    logistics.deliveryFee = 0;
  }
  return { logistics };
}
