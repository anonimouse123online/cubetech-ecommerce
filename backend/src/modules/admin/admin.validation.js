import { AppError } from "../shared/app-error.js";

const MAX_PRICE_CENTS = 9_999_999_999n;

function text(value, label, min, max) {
  if (typeof value !== "string") throw new AppError(400, `${label} is required.`, "INVALID_ADMIN_INPUT");
  const result = value.trim();
  if (result.length < min || result.length > max) {
    throw new AppError(400, `${label} must be between ${min} and ${max} characters.`, "INVALID_ADMIN_INPUT");
  }
  return result;
}

export function parseProductInput(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError(400, "Product details are required.", "INVALID_ADMIN_INPUT");
  const result = {};
  for (const [key, label, min, max] of [["name", "Product name", 2, 120], ["description", "Description", 3, 3000]]) {
    if (partial && body[key] === undefined) continue;
    result[key] = text(body[key], label, min, max);
  }

  if (!partial || body.price !== undefined) {
    const raw = typeof body.price === "number" ? String(body.price) : body.price;
    if (typeof raw !== "string" || !/^\d{1,8}(?:\.\d{1,2})?$/.test(raw.trim())) {
      throw new AppError(400, "Price must be a positive amount with up to two decimal places.", "INVALID_PRODUCT_PRICE");
    }
    const [whole, fractional = ""] = raw.trim().split(".");
    const cents = BigInt(whole) * 100n + BigInt(fractional.padEnd(2, "0"));
    if (cents < 1n || cents > MAX_PRICE_CENTS) throw new AppError(400, "Price must be greater than zero.", "INVALID_PRODUCT_PRICE");
    result.price = `${whole}.${fractional.padEnd(2, "0")}`;
  }

  if (!partial || body.stock !== undefined) {
    if (!Number.isSafeInteger(body.stock) || body.stock < 0 || body.stock > 2_147_483_647) {
      throw new AppError(400, "Stock must be a nonnegative whole number.", "INVALID_PRODUCT_STOCK");
    }
    result.stock = body.stock;
  }

  if (!partial || body.categoryId !== undefined) {
    result.categoryId = text(body.categoryId, "Category", 1, 64);
  }
  if (!partial || body.imageUrl !== undefined) {
    const imageUrl = text(body.imageUrl, "Image URL", 1, 1000);
    if (!/^(https?:\/\/|\/)/i.test(imageUrl)) throw new AppError(400, "Image URL must be an HTTP(S) URL or a local path.", "INVALID_PRODUCT_IMAGE");
    result.imageUrl = imageUrl;
  }
  if (!partial || body.isActive !== undefined) {
    if (body.isActive !== undefined && typeof body.isActive !== "boolean") {
      throw new AppError(400, "Product status must be active or inactive.", "INVALID_PRODUCT_STATUS");
    }
    result.isActive = body.isActive === undefined ? true : body.isActive;
  }
  return result;
}

export function parseCategoryInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError(400, "Category details are required.", "INVALID_ADMIN_INPUT");
  const name = text(body.name, "Category name", 2, 80);
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) || null : null;
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim().slice(0, 1000) || null : null;
  if (imageUrl && !/^(https?:\/\/|\/)/i.test(imageUrl)) throw new AppError(400, "Image URL must be an HTTP(S) URL or a local path.", "INVALID_CATEGORY_IMAGE");
  return { name, description, imageUrl };
}

export function parseOrderStatus(value) {
  const allowed = new Set(["PENDING", "CONFIRMED", "PREPARING", "SHIPPED", "COMPLETED", "CANCELLED"]);
  if (!allowed.has(value)) throw new AppError(400, "Choose a valid order status.", "INVALID_ORDER_STATUS");
  return value;
}

export function parseAdminProductQuery(query) {
  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search.length > 120) throw new AppError(400, "Search must be 120 characters or fewer.", "INVALID_ADMIN_FILTER");
  const status = typeof query.status === "string" ? query.status : "all";
  if (!["all", "active", "inactive"].includes(status)) throw new AppError(400, "Status must be all, active, or inactive.", "INVALID_ADMIN_FILTER");
  const categoryId = typeof query.categoryId === "string" ? query.categoryId.trim() : "";
  return {
    where: {
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      ...(status === "all" ? {} : { isActive: status === "active" }),
      ...(categoryId ? { categoryId } : {}),
    },
  };
}
