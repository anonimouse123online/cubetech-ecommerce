import { AppError } from "./app-error.js";
import { normalizeDecimal } from "./money.js";

export function parseCartItems(rawItems, { requirePrice = false, allowEmpty = false } = {}) {
  if (!Array.isArray(rawItems) || (!allowEmpty && rawItems.length === 0)) {
    throw new AppError(400, "Add at least one product before checkout.", "EMPTY_CART");
  }
  if (rawItems.length > 50) {
    throw new AppError(400, "A cart can contain at most 50 different products.", "TOO_MANY_ITEMS");
  }

  const items = new Map();
  for (const [index, item] of rawItems.entries()) {
    const productId = typeof item?.productId === "string" ? item.productId.trim() : "";
    if (!/^[a-z0-9_-]{1,64}$/i.test(productId)) {
      throw new AppError(400, `Product ${index + 1} has an invalid ID.`, "INVALID_PRODUCT_ID");
    }

    const quantity = item?.quantity;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 2147483647) {
      throw new AppError(400, `Quantity for product ${productId} must be a positive whole number.`, "INVALID_QUANTITY");
    }

    let expectedPrice;
    if (item?.expectedPrice !== undefined && item?.expectedPrice !== null && item.expectedPrice !== "") {
      if (typeof item.expectedPrice !== "string") {
        throw new AppError(400, `Expected price for product ${productId} must be a decimal string.`, "INVALID_PRICE");
      }
      try {
        expectedPrice = normalizeDecimal(item.expectedPrice);
      } catch {
        throw new AppError(400, `Expected price for product ${productId} is invalid.`, "INVALID_PRICE");
      }
    } else if (requirePrice) {
      throw new AppError(400, `Expected price for product ${productId} is required.`, "INVALID_PRICE");
    }

    const existing = items.get(productId);
    if (existing && existing.expectedPrice !== expectedPrice) {
      throw new AppError(400, `Duplicate cart lines for ${productId} have different prices.`, "DUPLICATE_PRICE_MISMATCH");
    }
    const totalQuantity = (existing?.quantity ?? 0) + quantity;
    if (totalQuantity > 2147483647) {
      throw new AppError(400, `Quantity for product ${productId} is too large.`, "INVALID_QUANTITY");
    }
    items.set(productId, { productId, quantity: totalQuantity, expectedPrice });
  }

  return [...items.values()];
}
