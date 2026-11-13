import { AppError } from "../shared/app-error.js";
import { parseCartItems } from "../shared/cart-input.js";

const PAYMENT_METHODS = new Set(["CASH_ON_DELIVERY", "E_WALLET", "BANK_TRANSFER"]);

function requiredText(value, label, minimum, maximum) {
  if (typeof value !== "string") throw new AppError(400, `${label} is required.`, "INVALID_CUSTOMER_DETAILS");
  const text = value.trim();
  if (text.length < minimum || text.length > maximum) {
    throw new AppError(400, `${label} must be between ${minimum} and ${maximum} characters.`, "INVALID_CUSTOMER_DETAILS");
  }
  return text;
}

export function parseCheckout(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError(400, "Checkout details are required.", "INVALID_CHECKOUT");
  }

  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  if (!/^[a-z0-9._:-]{8,100}$/i.test(idempotencyKey)) {
    throw new AppError(400, "A valid checkout retry key is required.", "INVALID_IDEMPOTENCY_KEY");
  }

  const customerBody = body.customer ?? {};
  const name = requiredText(customerBody.name, "Customer name", 2, 100);
  const email = requiredText(customerBody.email, "Email", 5, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, "Enter a valid email address.", "INVALID_CUSTOMER_DETAILS");
  }
  const phone = requiredText(customerBody.phone, "Contact number", 7, 30);
  if (!/^\+?[0-9][0-9\s().-]{5,28}$/.test(phone) || phone.replace(/\D/g, "").length < 7) {
    throw new AppError(400, "Enter a valid contact number.", "INVALID_CUSTOMER_DETAILS");
  }

  const addressBody = body.shippingAddress ?? {};
  const shippingAddress = {
    line1: requiredText(addressBody.line1, "Delivery address", 5, 180),
    line2: typeof addressBody.line2 === "string" ? addressBody.line2.trim().slice(0, 180) || null : null,
    city: requiredText(addressBody.city, "City", 2, 80),
    region: requiredText(addressBody.region, "Region", 2, 80),
    postalCode: requiredText(addressBody.postalCode, "Postal code", 2, 20),
    country: typeof addressBody.country === "string" && addressBody.country.trim()
      ? addressBody.country.trim().slice(0, 80)
      : "Philippines",
  };

  if (!PAYMENT_METHODS.has(body.paymentMethod)) {
    throw new AppError(400, "Choose Cash on Delivery, E-Wallet, or Bank Transfer.", "INVALID_PAYMENT_METHOD");
  }

  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (notes.length > 500) throw new AppError(400, "Order notes must be 500 characters or fewer.", "INVALID_NOTES");

  return {
    idempotencyKey,
    items: parseCartItems(body.items, { requirePrice: true }),
    customer: { name, email, phone },
    shippingAddress,
    paymentMethod: body.paymentMethod,
    notes: notes || null,
  };
}

export function parseQuoteItems(rawItems) {
  return parseCartItems(rawItems, { allowEmpty: true });
}
