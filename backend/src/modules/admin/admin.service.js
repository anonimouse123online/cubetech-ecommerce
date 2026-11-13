import { randomUUID } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../shared/app-error.js";
import { centsToDecimal, decimalToCents } from "../shared/money.js";
import { parseAdminProductQuery, parseCategoryInput, parseOrderStatus, parseProductInput } from "./admin.validation.js";

const productInclude = { category: { select: { id: true, name: true, slug: true } } };
const orderInclude = { items: true };
const ORDER_STATUS_LABELS = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  SHIPPED: "Shipped",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
const NEXT_STATUSES = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["SHIPPED"],
  SHIPPED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export async function getDashboardStats() {
  const [totalProducts, totalOrders, pendingOrders, completedOrders, distinctCustomers, totalSales] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: "COMPLETED" } }),
    prisma.$queryRaw`SELECT COUNT(DISTINCT lower(btrim("customer_email")))::int AS count FROM "orders"`,
    prisma.order.aggregate({ where: { status: "COMPLETED" }, _sum: { total: true } }),
  ]);
  return {
    totalProducts,
    totalOrders,
    pendingOrders,
    completedOrders,
    totalCustomers: distinctCustomers[0]?.count ?? 0,
    totalSales: totalSales._sum.total?.toFixed(2) ?? "0.00",
  };
}

export async function listAdminProducts(query) {
  const { where } = parseAdminProductQuery(query);
  const products = await prisma.product.findMany({ where, include: productInclude, orderBy: { updatedAt: "desc" } });
  return products.map(toAdminProduct);
}

export async function createAdminProduct(body) {
  const input = parseProductInput(body);
  await assertCategory(input.categoryId);
  const slug = await uniqueProductSlug(input.name);
  const product = await prisma.product.create({ data: { ...input, slug }, include: productInclude });
  return toAdminProduct(product);
}

export async function updateAdminProduct(id, body) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Product was not found.", "PRODUCT_NOT_FOUND");
  const input = parseProductInput(body, { partial: true });
  if (input.categoryId) await assertCategory(input.categoryId);
  const slug = input.name ? await uniqueProductSlug(input.name, id) : existing.slug;
  const product = await prisma.product.update({ where: { id }, data: { ...input, ...(input.name ? { slug } : {}) }, include: productInclude });
  return toAdminProduct(product);
}

export async function deleteAdminProduct(id) {
  const product = await prisma.product.findUnique({ where: { id }, include: { _count: { select: { orderItems: true } } } });
  if (!product) throw new AppError(404, "Product was not found.", "PRODUCT_NOT_FOUND");
  if (product._count.orderItems > 0) {
    throw new AppError(409, "This product appears in saved orders. Make it inactive to hide it from customers.", "PRODUCT_HAS_ORDERS", {
      canDeactivate: true,
      orderItemCount: product._count.orderItems,
    });
  }
  try {
    await prisma.product.delete({ where: { id } });
  } catch (error) {
    if (error?.code === "P2003" || error?.code === "P2014") {
      throw new AppError(409, "This product is referenced by an order. Make it inactive instead.", "PRODUCT_HAS_ORDERS", { canDeactivate: true });
    }
    throw error;
  }
  return { id, deleted: true };
}

export async function listAdminCategories() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return categories.map(({ _count, ...category }) => ({ ...category, productCount: _count.products }));
}

export async function createAdminCategory(body) {
  const input = parseCategoryInput(body);
  return withCategoryNameLock(async (tx) => {
    await assertUniqueCategoryName(tx, input.name);
    const slug = await uniqueCategorySlug(tx, input.name);
    return tx.category.create({ data: { ...input, slug } });
  });
}

export async function updateAdminCategory(id, body) {
  const input = parseCategoryInput(body);
  return withCategoryNameLock(async (tx) => {
    const existing = await tx.category.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, "Category was not found.", "CATEGORY_NOT_FOUND");
    await assertUniqueCategoryName(tx, input.name, id);
    const slug = await uniqueCategorySlug(tx, input.name, id);
    return tx.category.update({ where: { id }, data: { ...input, slug } });
  });
}

export async function deleteAdminCategory(id) {
  const category = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
  if (!category) throw new AppError(404, "Category was not found.", "CATEGORY_NOT_FOUND");
  if (category._count.products > 0) {
    throw new AppError(409, "Move or remove the products in this category before deleting it.", "CATEGORY_HAS_PRODUCTS", {
      productCount: category._count.products,
    });
  }
  await prisma.category.delete({ where: { id } });
  return { id, deleted: true };
}

export async function listAdminOrders(statusQuery = "") {
  const status = statusQuery ? parseOrderStatus(statusQuery) : undefined;
  const orders = await prisma.order.findMany({
    where: status ? { status } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: orderInclude,
  });
  return orders.map(toAdminOrder);
}

export async function getAdminOrder(orderNumber) {
  const order = await prisma.order.findUnique({ where: { orderNumber }, include: orderInclude });
  if (!order) throw new AppError(404, "Order was not found.", "ORDER_NOT_FOUND");
  return toAdminOrder(order);
}

export async function updateAdminOrderStatus(orderNumber, requestedStatus) {
  const targetStatus = parseOrderStatus(requestedStatus);
  return prisma.$transaction(async (tx) => {
    const beforeLock = await tx.order.findUnique({ where: { orderNumber }, select: { id: true } });
    if (!beforeLock) throw new AppError(404, "Order was not found.", "ORDER_NOT_FOUND");
    await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${beforeLock.id} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: beforeLock.id }, include: orderInclude });
    if (!order) throw new AppError(404, "Order was not found.", "ORDER_NOT_FOUND");
    if (order.status === targetStatus) return toAdminOrder(order);

    const allowed = NEXT_STATUSES[order.status] || [];
    if (!allowed.includes(targetStatus)) {
      throw new AppError(409, `Order cannot move from ${ORDER_STATUS_LABELS[order.status] || order.status} to ${ORDER_STATUS_LABELS[targetStatus]}.`, "INVALID_ORDER_TRANSITION", {
        currentStatus: order.status,
        requestedStatus: targetStatus,
        allowedNextStatuses: allowed,
      });
    }

    if (targetStatus === "CANCELLED") {
      for (const item of order.items) {
        const result = await tx.product.updateMany({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
        if (result.count !== 1) throw new AppError(409, "The original product record is missing; cancellation was not applied.", "CANCELLATION_RESTOCK_FAILED");
      }
    }

    const updated = await tx.order.update({ where: { id: order.id }, data: { status: targetStatus }, include: orderInclude });
    return toAdminOrder(updated);
  }, { isolationLevel: "ReadCommitted", maxWait: 5000, timeout: 15000 });
}

export async function listAdminCustomers() {
  const rows = await prisma.$queryRaw`
    WITH customer_stats AS (
      SELECT
        lower(btrim("customer_email")) AS normalized_email,
        COUNT(*)::int AS order_count,
        COALESCE(SUM(CASE WHEN "status" = 'COMPLETED' THEN "total" ELSE 0 END), 0)::numeric(12, 2) AS completed_value,
        MAX("created_at") AS latest_order_at
      FROM "orders"
      GROUP BY lower(btrim("customer_email"))
    )
    SELECT
      latest."customer_name" AS name,
      latest."customer_email" AS email,
      latest."customer_phone" AS phone,
      customer_stats.order_count,
      customer_stats.completed_value,
      customer_stats.latest_order_at
    FROM customer_stats
    JOIN LATERAL (
      SELECT "customer_name", "customer_email", "customer_phone"
      FROM "orders" AS order_detail
      WHERE lower(btrim(order_detail."customer_email")) = customer_stats.normalized_email
      ORDER BY "created_at" DESC, "id" DESC
      LIMIT 1
    ) AS latest ON true
    ORDER BY customer_stats.latest_order_at DESC
  `;
  return rows.map((row) => ({
    name: row.name,
    email: row.email,
    phone: row.phone,
    orderCount: row.order_count,
    completedOrderValue: typeof row.completed_value?.toFixed === "function" ? row.completed_value.toFixed(2) : String(row.completed_value),
    latestOrderAt: row.latest_order_at,
  }));
}

async function assertCategory(categoryId) {
  if (!await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } })) {
    throw new AppError(400, "Choose an existing category.", "INVALID_PRODUCT_CATEGORY");
  }
}

function slugBase(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "item";
}

async function uniqueProductSlug(name, currentId) {
  const base = slugBase(name);
  const existing = await prisma.product.findUnique({ where: { slug: base }, select: { id: true } });
  if (!existing || existing.id === currentId) return base;
  return `${base}-${randomUUID().slice(0, 8)}`;
}

async function uniqueCategorySlug(tx, name, currentId) {
  const base = slugBase(name);
  const existing = await tx.category.findUnique({ where: { slug: base }, select: { id: true } });
  if (!existing || existing.id === currentId) return base;
  return `${base}-${randomUUID().slice(0, 8)}`;
}

async function withCategoryNameLock(callback) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(4862251105341::bigint)`;
    return callback(tx);
  }, { isolationLevel: "ReadCommitted", maxWait: 5000, timeout: 10000 });
}

async function assertUniqueCategoryName(tx, name, exceptId) {
  const duplicate = await tx.category.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (duplicate) throw new AppError(409, "A category with this name already exists.", "DUPLICATE_CATEGORY_NAME");
}

function toAdminProduct(product) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price.toFixed(2),
    imageUrl: product.imageUrl,
    stock: product.stock,
    isActive: product.isActive,
    category: product.category,
    categoryId: product.categoryId,
    updatedAt: product.updatedAt,
  };
}

function toAdminOrder(order) {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    customer: { name: order.customerName, email: order.customerEmail, phone: order.customerPhone },
    shippingAddress: {
      line1: order.shippingAddress,
      line2: order.shippingAddress2,
      city: order.shippingCity,
      region: order.shippingRegion,
      postalCode: order.shippingPostal,
      country: order.shippingCountry,
    },
    notes: order.notes,
    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      unitPrice: item.unitPrice.toFixed(2),
      quantity: item.quantity,
      lineTotal: centsToDecimal(decimalToCents(item.unitPrice) * BigInt(item.quantity)),
    })),
    subtotal: order.subtotal.toFixed(2),
    shippingFee: order.shippingFee.toFixed(2),
    total: order.total.toFixed(2),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
