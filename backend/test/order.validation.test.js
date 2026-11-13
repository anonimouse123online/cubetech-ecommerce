import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../src/modules/shared/app-error.js";
import { centsToDecimal, decimalToCents } from "../src/modules/shared/money.js";
import { parseCheckout } from "../src/modules/orders/order.validation.js";

function validBody(overrides = {}) {
  return {
    idempotencyKey: "unit-test-key-0001",
    items: [{ productId: "cm00000000000000000000001", quantity: 1, expectedPrice: "325.50" }],
    customer: { name: "Demo Customer", email: "demo@example.invalid", phone: "+63 912 555 0100" },
    shippingAddress: { line1: "123 Fictional Street", city: "Sample City", region: "Sample Region", postalCode: "1000" },
    paymentMethod: "CASH_ON_DELIVERY",
    ...overrides,
  };
}

test("checkout validates required customer details and payment choices", () => {
  assert.equal(parseCheckout(validBody()).customer.email, "demo@example.invalid");
  assert.throws(() => parseCheckout(validBody({ customer: { name: "D", email: "bad", phone: "123" } })), (error) =>
    error instanceof AppError && error.statusCode === 400);
  assert.throws(() => parseCheckout(validBody({ customer: { name: "Demo Customer", email: "demo@example.invalid", phone: "1      " } })), (error) =>
    error instanceof AppError && error.statusCode === 400);
  assert.throws(() => parseCheckout(validBody({ paymentMethod: "CARD" })), (error) =>
    error instanceof AppError && error.code === "INVALID_PAYMENT_METHOD");
});

test("checkout rejects empty carts and non-positive or fractional quantities", () => {
  assert.throws(() => parseCheckout(validBody({ items: [] })), (error) =>
    error instanceof AppError && error.code === "EMPTY_CART");
  assert.throws(() => parseCheckout(validBody({ items: [{ productId: "cm00000000000000000000001", quantity: 0, expectedPrice: "1.00" }] })), (error) =>
    error instanceof AppError && error.code === "INVALID_QUANTITY");
  assert.throws(() => parseCheckout(validBody({ items: [{ productId: "cm00000000000000000000001", quantity: 1.5, expectedPrice: "1.00" }] })), (error) =>
    error instanceof AppError && error.code === "INVALID_QUANTITY");
});

test("money arithmetic preserves centavos", () => {
  const total = decimalToCents("100.25") * 2n + decimalToCents("125.00");
  assert.equal(centsToDecimal(total), "325.50");
});
