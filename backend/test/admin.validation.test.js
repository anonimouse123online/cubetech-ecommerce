import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../src/modules/shared/app-error.js";
import { parseAdminProductQuery, parseOrderStatus, parseProductInput } from "../src/modules/admin/admin.validation.js";

const validProduct = {
  name: "Desk Lamp",
  description: "A small adjustable lamp for a home desk.",
  price: "325.50",
  stock: 4,
  categoryId: "cm00000000000000000000001",
  imageUrl: "https://example.invalid/lamp.png",
};

test("admin product validation requires a positive price and whole nonnegative stock", () => {
  assert.equal(parseProductInput(validProduct).price, "325.50");
  assert.equal(parseProductInput({ ...validProduct, stock: 0 }).stock, 0);
  assert.throws(() => parseProductInput({ ...validProduct, price: "0.00" }), (error) => error instanceof AppError && error.code === "INVALID_PRODUCT_PRICE");
  assert.throws(() => parseProductInput({ ...validProduct, price: "-1.00" }), (error) => error instanceof AppError && error.code === "INVALID_PRODUCT_PRICE");
  assert.throws(() => parseProductInput({ ...validProduct, stock: -1 }), (error) => error instanceof AppError && error.code === "INVALID_PRODUCT_STOCK");
  assert.throws(() => parseProductInput({ ...validProduct, stock: 2.5 }), (error) => error instanceof AppError && error.code === "INVALID_PRODUCT_STOCK");
});

test("admin product filters include inactive listings and validate filter values", () => {
  assert.deepEqual(parseAdminProductQuery({ search: " Lamp ", categoryId: "category-a", status: "inactive" }).where, {
    name: { contains: "Lamp", mode: "insensitive" },
    categoryId: "category-a",
    isActive: false,
  });
  assert.deepEqual(parseAdminProductQuery({ status: "all" }).where, {});
  assert.throws(() => parseAdminProductQuery({ status: "hidden" }), (error) => error instanceof AppError && error.code === "INVALID_ADMIN_FILTER");
});

test("admin order statuses accept only the new fulfillment workflow", () => {
  for (const status of ["PENDING", "CONFIRMED", "PREPARING", "SHIPPED", "COMPLETED", "CANCELLED"]) assert.equal(parseOrderStatus(status), status);
  assert.throws(() => parseOrderStatus("DELIVERED"), (error) => error instanceof AppError && error.code === "INVALID_ORDER_STATUS");
});
