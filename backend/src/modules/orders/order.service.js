import { randomBytes } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../shared/app-error.js";
import { centsToDecimal, decimalToCents } from "../shared/money.js";
import { parseCheckout, parseQuoteItems } from "./order.validation.js";

const categorySelect = { id: true, name: true, slug: true };

export async function quoteCart(rawItems) {
  const items = parseQuoteItems(rawItems);
  if (!items.length) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((item) => item.productId) }, isActive: true },
    include: { category: { select: categorySelect } },
  });
  const byId = new Map(products.map((product) => [product.id, product]));

  return items.map((item) => {
    const product = byId.get(item.productId);
    if (!product) {
      return {
        productId: item.productId,
        quantity: item.quantity,
        available: false,
        product: null,
        priceChanged: false,
        quantityAvailable: false,
      };
    }

    const currentPrice = product.price.toFixed(2);
    return {
      productId: item.productId,
      quantity: item.quantity,
      available: true,
      product: toPublicProduct(product),
      currentPrice,
      priceChanged: item.expectedPrice !== undefined && item.expectedPrice !== currentPrice,
      quantityAvailable: item.quantity <= product.stock,
    };
  });
}

export async function createOrder(body) {
  const input = parseCheckout(body);
  const existing = await findByIdempotencyKey(input.idempotencyKey);
  if (existing) return replayOrReject(existing, input);

  try {
    const order = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: input.items.map((item) => item.productId) }, isActive: true },
        include: { category: { select: categorySelect } },
      });
      const byId = new Map(products.map((product) => [product.id, product]));
      const changes = findCheckoutChanges(input.items, byId);
      if (changes.length) throw reviewRequired(changes);

      const lines = input.items.map((item) => ({ ...item, product: byId.get(item.productId) }));
      let subtotalCents = 0n;
      for (const line of lines) {
        const currentPrice = line.product.price.toFixed(2);
        const update = await tx.product.updateMany({
          where: {
            id: line.productId,
            isActive: true,
            stock: { gte: line.quantity },
            price: line.product.price,
          },
          data: { stock: { decrement: line.quantity } },
        });

        if (update.count !== 1) {
          const latest = await tx.product.findMany({
            where: { id: { in: lines.map((entry) => entry.productId) }, isActive: true },
          });
          const latestById = new Map(latest.map((product) => [product.id, product]));
          throw reviewRequired(findCheckoutChanges(input.items, latestById));
        }

        subtotalCents += decimalToCents(currentPrice) * BigInt(line.quantity);
      }

      const subtotal = centsToDecimal(subtotalCents);
      const orderNumber = makeOrderNumber();
      return tx.order.create({
        data: {
          orderNumber,
          idempotencyKey: input.idempotencyKey,
          status: "PENDING",
          paymentMethod: input.paymentMethod,
          notes: input.notes,
          customerName: input.customer.name,
          customerEmail: input.customer.email,
          customerPhone: input.customer.phone,
          shippingAddress: input.shippingAddress.line1,
          shippingAddress2: input.shippingAddress.line2,
          shippingCity: input.shippingAddress.city,
          shippingRegion: input.shippingAddress.region,
          shippingPostal: input.shippingAddress.postalCode,
          shippingCountry: input.shippingAddress.country,
          subtotal,
          shippingFee: "0.00",
          total: subtotal,
          items: {
            create: lines.map((line) => ({
              productId: line.productId,
              productName: line.product.name,
              unitPrice: line.product.price.toFixed(2),
              quantity: line.quantity,
            })),
          },
        },
        include: { items: true },
      });
    }, { isolationLevel: "ReadCommitted", maxWait: 5000, timeout: 15000 });

    return { order: toPublicOrder(order), replayed: false };
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === "CART_REVIEW_REQUIRED") {
        const raced = await findByIdempotencyKey(input.idempotencyKey);
        if (raced) return replayOrReject(raced, input);
      }
      throw error;
    }
    if (error?.code === "P2002" && input.idempotencyKey) {
      const raced = await findByIdempotencyKey(input.idempotencyKey);
      if (raced) return replayOrReject(raced, input);
    }
    throw error;
  }
}

export async function getOrderByNumber(orderNumber) {
  if (!/^CL-\d{8}-[A-F0-9]{20}$/i.test(orderNumber)) {
    throw new AppError(400, "Order number is invalid.", "INVALID_ORDER_NUMBER");
  }
  const order = await prisma.order.findUnique({
    where: { orderNumber: orderNumber.toUpperCase() },
    include: { items: true },
  });
  if (!order) throw new AppError(404, "Order was not found.", "ORDER_NOT_FOUND");
  return toPublicOrder(order);
}

async function findByIdempotencyKey(idempotencyKey) {
  return prisma.order.findUnique({
    where: { idempotencyKey },
    include: { items: true },
  });
}

function replayOrReject(order, input) {
  const sameCustomer = order.customerName === input.customer.name
    && order.customerEmail === input.customer.email
    && order.customerPhone === input.customer.phone;
  const sameAddress = order.shippingAddress === input.shippingAddress.line1
    && order.shippingAddress2 === input.shippingAddress.line2
    && order.shippingCity === input.shippingAddress.city
    && order.shippingRegion === input.shippingAddress.region
    && order.shippingPostal === input.shippingAddress.postalCode
    && order.shippingCountry === input.shippingAddress.country;
  const sameItems = order.items.length === input.items.length && order.items.every((saved) => {
    const retry = input.items.find((item) => item.productId === saved.productId);
    return retry && retry.quantity === saved.quantity && retry.expectedPrice === saved.unitPrice.toFixed(2);
  });

  if (!sameCustomer || !sameAddress || !sameItems || order.paymentMethod !== input.paymentMethod || order.notes !== input.notes) {
    throw new AppError(409, "This retry key was already used for different checkout details.", "IDEMPOTENCY_KEY_REUSED");
  }
  return { order: toPublicOrder(order), replayed: true };
}

function findCheckoutChanges(items, productsById) {
  return items.flatMap((item) => {
    const product = productsById.get(item.productId);
    if (!product) {
      return [{ productId: item.productId, available: false, requestedQuantity: item.quantity }];
    }
    const currentPrice = product.price.toFixed(2);
    const priceChanged = item.expectedPrice !== currentPrice;
    const stockChanged = item.quantity > product.stock;
    if (!priceChanged && !stockChanged) return [];
    return [{
      productId: item.productId,
      name: product.name,
      available: true,
      currentPrice,
      stock: product.stock,
      requestedQuantity: item.quantity,
      priceChanged,
      stockChanged,
    }];
  });
}

function reviewRequired(items) {
  return new AppError(409, "Cart prices or availability changed. Review the cart before placing the order.", "CART_REVIEW_REQUIRED", { items });
}

function makeOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `CL-${date}-${randomBytes(10).toString("hex").toUpperCase()}`;
}

function toPublicProduct(product) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price.toFixed(2),
    imageUrl: product.imageUrl,
    stock: product.stock,
    isActive: product.isActive,
    category: product.category ? {
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug,
    } : undefined,
    createdAt: product.createdAt,
  };
}

function toPublicOrder(order) {
  const items = order.items.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    unitPrice: item.unitPrice.toFixed(2),
    quantity: item.quantity,
    lineTotal: centsToDecimal(decimalToCents(item.unitPrice) * BigInt(item.quantity)),
  }));
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    customer: {
      name: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone,
    },
    shippingAddress: {
      line1: order.shippingAddress,
      line2: order.shippingAddress2,
      city: order.shippingCity,
      region: order.shippingRegion,
      postalCode: order.shippingPostal,
      country: order.shippingCountry,
    },
    notes: order.notes,
    items,
    subtotal: order.subtotal.toFixed(2),
    shippingFee: order.shippingFee.toFixed(2),
    total: order.total.toFixed(2),
    createdAt: order.createdAt,
  };
}
