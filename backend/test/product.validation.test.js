import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../src/modules/shared/app-error.js";
import { parseProductQuery } from "../src/modules/products/product.validation.js";

test("product query combines case-insensitive search, category and ascending price", () => {
  assert.deepEqual(parseProductQuery({
    search: "  lamp ",
    category: "desk-and-devices",
    sort: "price-asc",
  }), {
    where: {
      isActive: true,
      name: { contains: "lamp", mode: "insensitive" },
      category: { is: { slug: "desk-and-devices" } },
    },
    orderBy: { price: "asc" },
  });
});

test("product query hides inactive items and defaults to newest first", () => {
  assert.deepEqual(parseProductQuery({}), {
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
});

test("product query accepts descending price order", () => {
  assert.deepEqual(parseProductQuery({ sort: "price-desc" }).orderBy, { price: "desc" });
});

test("product query rejects unsupported sorts and malformed category slugs", () => {
  assert.throws(() => parseProductQuery({ sort: "newest" }), (error) =>
    error instanceof AppError && error.statusCode === 400);
  assert.throws(() => parseProductQuery({ category: "bad slug" }), (error) =>
    error instanceof AppError && error.statusCode === 400);
});
