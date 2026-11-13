import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { app } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";

const databaseReady = Boolean(process.env.DATABASE_URL?.trim());
const cents = (value) => {
  const [whole, fraction = "00"] = String(value).split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
};

test("admin session, catalog management, reporting, order transitions, and one-time cancellation restock", { skip: !databaseReady && "DATABASE_URL is not configured" }, async (t) => {
  process.env.ADMIN_SESSION_SECRET = "phase3-integration-session-secret-value";
  const suffix = randomUUID().replaceAll("-", "").toLowerCase();
  const prefix = `phase3-${suffix}`;
  const adminEmail = `${prefix}@example.invalid`;
  const shopperEmail = `${prefix}-shopper@example.invalid`;
  const password = "Phase3 demo password!";
  const category = await prisma.category.create({ data: { name: `Phase 3 ${suffix.slice(0, 8)}`, slug: `${prefix}-category` } });
  const unusedCategory = await prisma.category.create({ data: { name: `Unused ${suffix.slice(0, 8)}`, slug: `${prefix}-unused` } });
  const admin = await prisma.adminUser.create({
    data: { email: adminEmail, passwordHash: await bcrypt.hash(password, 4), displayName: "Phase 3 Test Admin" },
  });
  const server = app.listen(0, "127.0.0.1");
  let cookie = "";
  let productId = "";
  let managedCategoryId = "";
  const orderKeys = [`${prefix}-order-a`, `${prefix}-order-b`];

  try {
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const request = async (path, { method = "GET", body, auth = true } = {}) => {
      const response = await fetch(`${baseUrl}/api${path}`, {
        method,
        headers: {
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(auth && cookie ? { Cookie: cookie } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json(), headers: response.headers };
    };

    await t.test("protects admin endpoints and sets an HTTP-only cookie after password verification", async () => {
      assert.equal((await request("/admin/dashboard", { auth: false })).status, 401);
      const rejected = await request("/admin/auth/login", { method: "POST", auth: false, body: { email: adminEmail, password: "wrong password" } });
      assert.equal(rejected.status, 401);
      const login = await request("/admin/auth/login", { method: "POST", auth: false, body: { email: adminEmail.toUpperCase(), password } });
      assert.equal(login.status, 200);
      assert.match(login.headers.get("set-cookie"), /HttpOnly/i);
      assert.match(login.headers.get("set-cookie"), /SameSite=Strict/i);
      cookie = login.headers.get("set-cookie").split(";")[0];
      assert.equal((await request("/admin/auth/me")).body.data.email, adminEmail);
    });

    const initialStats = (await request("/admin/dashboard")).body.data;
    const createdCategory = await request("/admin/categories", {
      method: "POST",
      body: { name: `Managed Group ${suffix.slice(0, 8)}`, description: "Created by the admin acceptance test." },
    });
    assert.equal(createdCategory.status, 201);
    const managedCategory = createdCategory.body.data;
    managedCategoryId = managedCategory.id;
    const duplicateCategory = await request("/admin/categories", {
      method: "POST",
      body: { name: managedCategory.name.toUpperCase(), description: "A case-only duplicate." },
    });
    assert.equal(duplicateCategory.status, 409);
    assert.equal(duplicateCategory.body.code, "DUPLICATE_CATEGORY_NAME");
    const renamedCategory = await request(`/admin/categories/${managedCategory.id}`, {
      method: "PUT",
      body: { name: `${managedCategory.name} Updated`, description: "Updated in the admin test." },
    });
    assert.equal(renamedCategory.status, 200);

    const productInput = {
      name: `Phase Three Widget ${suffix.slice(0, 8)}`,
      description: "An integration product used to verify the admin workflow.",
      price: "10.50",
      stock: 8,
      imageUrl: "https://example.invalid/phase3-widget.png",
      categoryId: managedCategory.id,
      isActive: true,
    };
    const invalidPrice = await request("/admin/products", { method: "POST", body: { ...productInput, price: "0" } });
    assert.equal(invalidPrice.status, 400);
    const invalidStock = await request("/admin/products", { method: "POST", body: { ...productInput, stock: -1 } });
    assert.equal(invalidStock.status, 400);
    const createdProduct = await request("/admin/products", { method: "POST", body: productInput });
    assert.equal(createdProduct.status, 201);
    productId = createdProduct.body.data.id;

    const productList = await request(`/admin/products?search=${encodeURIComponent("PHASE THREE WIDGET")}&status=active&categoryId=${managedCategory.id}`);
    assert.ok(productList.body.data.some((product) => product.id === productId));
    const productForCustomers = await request(`/products?search=${encodeURIComponent(productInput.name)}`, { auth: false });
    assert.equal(productForCustomers.body.data.find((product) => product.id === productId).price, "10.50");

    const checkout = (key, email, expectedPrice, quantity = 1) => ({
      idempotencyKey: key,
      items: [{ productId, quantity, expectedPrice }],
      customer: { name: "Phase 3 Shopper", email, phone: "+63 912 555 0188" },
      shippingAddress: { line1: "123 Test Avenue", city: "Sample City", region: "Sample Region", postalCode: "1000" },
      paymentMethod: "CASH_ON_DELIVERY",
    });

    const orderAResponse = await request("/orders", { method: "POST", auth: false, body: checkout(orderKeys[0], shopperEmail.toUpperCase(), "10.50", 2) });
    assert.equal(orderAResponse.status, 201);
    const orderA = orderAResponse.body.data;
    assert.equal(orderA.total, "21.00");

    const editedProduct = await request(`/admin/products/${productId}`, {
      method: "PUT",
      body: { ...productInput, name: `${productInput.name} Revised`, price: "12.00", stock: 6, isActive: true },
    });
    assert.equal(editedProduct.status, 200);
    const refreshedProduct = await request(`/products?search=${encodeURIComponent("REVISED")}`, { auth: false });
    assert.equal(refreshedProduct.body.data.find((product) => product.id === productId).price, "12.00");

    const invalidSkip = await request(`/admin/orders/${orderA.orderNumber}/status`, { method: "PATCH", body: { status: "SHIPPED" } });
    assert.equal(invalidSkip.status, 409);
    assert.equal(invalidSkip.body.code, "INVALID_ORDER_TRANSITION");
    for (const status of ["CONFIRMED", "PREPARING", "SHIPPED", "COMPLETED"]) {
      const changed = await request(`/admin/orders/${orderA.orderNumber}/status`, { method: "PATCH", body: { status } });
      assert.equal(changed.status, 200, `expected transition to ${status}`);
      assert.equal(changed.body.data.status, status);
    }
    const historicalOrder = await request(`/admin/orders/${orderA.orderNumber}`);
    assert.equal(historicalOrder.body.data.items[0].productName, productInput.name);
    assert.equal(historicalOrder.body.data.items[0].unitPrice, "10.50");
    const reverseCompleted = await request(`/admin/orders/${orderA.orderNumber}/status`, { method: "PATCH", body: { status: "PENDING" } });
    assert.equal(reverseCompleted.status, 409);
    const visibleOrders = await request("/admin/orders");
    assert.ok(visibleOrders.body.data.some((order) => order.orderNumber === orderA.orderNumber));

    const orderBResponse = await request("/orders", { method: "POST", auth: false, body: checkout(orderKeys[1], shopperEmail, "12.00") });
    assert.equal(orderBResponse.status, 201);
    const orderB = orderBResponse.body.data;
    assert.equal((await prisma.product.findUnique({ where: { id: productId } })).stock, 5);
    assert.equal((await request(`/admin/orders/${orderB.orderNumber}/status`, { method: "PATCH", body: { status: "CONFIRMED" } })).status, 200);
    const concurrentCancellations = await Promise.all([
      request(`/admin/orders/${orderB.orderNumber}/status`, { method: "PATCH", body: { status: "CANCELLED" } }),
      request(`/admin/orders/${orderB.orderNumber}/status`, { method: "PATCH", body: { status: "CANCELLED" } }),
    ]);
    assert.deepEqual(concurrentCancellations.map((result) => result.status), [200, 200]);
    assert.ok(concurrentCancellations.every((result) => result.body.data.status === "CANCELLED"));
    assert.equal((await prisma.product.findUnique({ where: { id: productId } })).stock, 6);
    const cancelledReverse = await request(`/admin/orders/${orderB.orderNumber}/status`, { method: "PATCH", body: { status: "PENDING" } });
    assert.equal(cancelledReverse.status, 409);

    const afterStats = (await request("/admin/dashboard")).body.data;
    assert.equal(afterStats.totalProducts, initialStats.totalProducts + 1);
    assert.equal(afterStats.totalOrders, initialStats.totalOrders + 2);
    assert.equal(afterStats.completedOrders, initialStats.completedOrders + 1);
    assert.equal(afterStats.pendingOrders, initialStats.pendingOrders);
    assert.equal(afterStats.totalCustomers, initialStats.totalCustomers + 1);
    assert.equal(cents(afterStats.totalSales) - cents(initialStats.totalSales), 2100n);

    const customers = await request("/admin/customers");
    const summary = customers.body.data.find((customer) => customer.email.toLowerCase() === shopperEmail);
    assert.ok(summary);
    assert.equal(summary.orderCount, 2);
    assert.equal(summary.completedOrderValue, "21.00");
    assert.equal(summary.name, "Phase 3 Shopper");

    const blockedDelete = await request(`/admin/products/${productId}`, { method: "DELETE" });
    assert.equal(blockedDelete.status, 409);
    assert.equal(blockedDelete.body.details.canDeactivate, true);
    const deactivated = await request(`/admin/products/${productId}`, {
      method: "PUT",
      body: { ...editedProduct.body.data, isActive: false },
    });
    assert.equal(deactivated.status, 200);
    const hiddenProduct = await request(`/products/${productId}`, { auth: false });
    assert.equal(hiddenProduct.status, 404);

    const blockedCategoryDelete = await request(`/admin/categories/${managedCategory.id}`, { method: "DELETE" });
    assert.equal(blockedCategoryDelete.status, 409);
    assert.equal(blockedCategoryDelete.body.code, "CATEGORY_HAS_PRODUCTS");
    const unusedCategoryDelete = await request(`/admin/categories/${unusedCategory.id}`, { method: "DELETE" });
    assert.equal(unusedCategoryDelete.status, 200);

    const logout = await request("/admin/auth/logout", { method: "POST" });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get("set-cookie"), /Max-Age=0/i);
    cookie = logout.headers.get("set-cookie").split(";")[0];
    assert.equal((await request("/admin/dashboard")).status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    const orderIds = await prisma.order.findMany({ where: { idempotencyKey: { in: orderKeys } }, select: { id: true } });
    if (orderIds.length) await prisma.order.deleteMany({ where: { id: { in: orderIds.map((order) => order.id) } } });
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.category.deleteMany({ where: { id: { in: [category.id, unusedCategory.id, ...(managedCategoryId ? [managedCategoryId] : [])] } } });
    await prisma.adminUser.delete({ where: { id: admin.id } });
  }
});
