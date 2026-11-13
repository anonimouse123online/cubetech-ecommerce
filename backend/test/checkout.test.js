import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { app } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";

const databaseReady = Boolean(process.env.DATABASE_URL?.trim());

test("checkout transaction, persistence, retries, and stock race", { skip: !databaseReady && "DATABASE_URL is not configured" }, async (t) => {
  const suffix = randomUUID().replaceAll("-", "").toLowerCase();
  const prefix = `phase2-${suffix}`;
  const category = await prisma.category.create({ data: { name: `Phase 2 ${suffix.slice(0, 8)}`, slug: prefix } });
  const keys = [];
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const post = async (body) => {
      const response = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    };
    const createProduct = (name, price, stock, isActive = true) => prisma.product.create({
      data: {
        name,
        slug: `${prefix}-${name.toLowerCase().replaceAll(" ", "-")}`,
        description: `Temporary integration fixture for ${name}.`,
        price,
        imageUrl: "https://example.invalid/phase2-test.png",
        stock,
        isActive,
        categoryId: category.id,
      },
    });
    const makeBody = ({ items, key = `${prefix}-key-01`, name = "Demo Customer", email = "demo@example.invalid", paymentMethod = "CASH_ON_DELIVERY", notes = "Leave at the door" }) => {
      keys.push(key);
      return {
        idempotencyKey: key,
        items,
        customer: { name, email, phone: "+63 912 555 0100" },
        shippingAddress: {
          line1: "123 Fictional Street",
          line2: "Unit 4",
          city: "Sample City",
          region: "Sample Region",
          postalCode: "1000",
          country: "Philippines",
        },
        paymentMethod,
        notes,
      };
    };

    const emptyStock = await createProduct("Empty Stock", "49.00", 0);
    const changedPrice = await createProduct("Changed Price", "19.99", 5);
    const inactive = await createProduct("Inactive Product", "9.00", 5, false);
    const successA = await createProduct("Checkout A", "100.25", 5);
    const successB = await createProduct("Checkout B", "125.00", 3);
    const finalItem = await createProduct("Final Unit", "12.50", 1);

    await t.test("rejects an empty checkout before saving", async () => {
      const result = await post(makeBody({ items: [], key: `${prefix}-empty` }));
      assert.equal(result.status, 400);
      assert.equal(result.body.code, "EMPTY_CART");
    });

    await t.test("keeps active zero-stock products readable but blocks their purchase", async () => {
      const productResponse = await fetch(`${baseUrl}/api/products/${emptyStock.id}`);
      const productJson = await productResponse.json();
      assert.equal(productResponse.status, 200);
      assert.equal(productJson.data.stock, 0);
      const quoteResponse = await fetch(`${baseUrl}/api/orders/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ productId: emptyStock.id, quantity: 1, expectedPrice: "49.00" }] }),
      });
      const quoteJson = await quoteResponse.json();
      assert.equal(quoteJson.data[0].available, true);
      assert.equal(quoteJson.data[0].quantityAvailable, false);
      const result = await post(makeBody({ items: [{ productId: emptyStock.id, quantity: 1, expectedPrice: "49.00" }], key: `${prefix}-out` }));
      assert.equal(result.status, 409);
      assert.equal(result.body.code, "CART_REVIEW_REQUIRED");
      assert.equal(result.body.details.items[0].stock, 0);
    });

    await t.test("hides and rejects an inactive product", async () => {
      const productResponse = await fetch(`${baseUrl}/api/products/${inactive.id}`);
      assert.equal(productResponse.status, 404);
      const quoteResponse = await fetch(`${baseUrl}/api/orders/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ productId: inactive.id, quantity: 1, expectedPrice: "9.00" }] }),
      });
      assert.equal((await quoteResponse.json()).data[0].available, false);
      const result = await post(makeBody({ items: [{ productId: inactive.id, quantity: 1, expectedPrice: "9.00" }], key: `${prefix}-inactive` }));
      assert.equal(result.status, 409);
      assert.equal(result.body.details.items[0].available, false);
    });

    await t.test("requires a review when the current price differs", async () => {
      const staleBody = makeBody({ items: [{ productId: changedPrice.id, quantity: 1, expectedPrice: "18.99" }], key: `${prefix}-price` });
      const quoteResponse = await fetch(`${baseUrl}/api/orders/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: staleBody.items }),
      });
      const quote = await quoteResponse.json();
      assert.equal(quote.data[0].priceChanged, true);
      assert.equal(quote.data[0].currentPrice, "19.99");
      const result = await post(staleBody);
      assert.equal(result.status, 409);
      assert.equal(result.body.code, "CART_REVIEW_REQUIRED");
      assert.equal(result.body.details.items[0].priceChanged, true);
      assert.equal(result.body.details.items[0].currentPrice, "19.99");
      assert.equal((await prisma.product.findUnique({ where: { id: changedPrice.id } })).stock, 5);
      const reviewed = await post({ ...staleBody, items: [{ productId: changedPrice.id, quantity: 1, expectedPrice: "19.99" }] });
      assert.equal(reviewed.status, 201);
      assert.equal(reviewed.body.data.items[0].unitPrice, "19.99");
      assert.equal((await prisma.product.findUnique({ where: { id: changedPrice.id } })).stock, 4);
    });

    await t.test("commits order, snapshots, exact PHP 325.50 total, and supports an idempotent retry", async () => {
      const body = makeBody({
        items: [
          { productId: successA.id, quantity: 2, expectedPrice: "100.25" },
          { productId: successB.id, quantity: 1, expectedPrice: "125.00" },
        ],
        key: `${prefix}-success`,
        paymentMethod: "E_WALLET",
      });
      const result = await post(body);
      assert.equal(result.status, 201);
      assert.equal(result.body.data.total, "325.50");
      assert.equal(result.body.data.subtotal, "325.50");
      assert.equal(result.body.data.status, "PENDING");
      assert.equal(result.body.data.paymentMethod, "E_WALLET");
      assert.equal(result.body.data.items.find((item) => item.productId === successA.id).unitPrice, "100.25");

      const persisted = await prisma.order.findUnique({ where: { orderNumber: result.body.data.orderNumber }, include: { items: true } });
      assert.ok(persisted);
      assert.equal(persisted.items.length, 2);
      assert.equal(persisted.items.find((item) => item.productId === successA.id).productName, "Checkout A");
      assert.equal((await prisma.product.findUnique({ where: { id: successA.id } })).stock, 3);
      assert.equal((await prisma.product.findUnique({ where: { id: successB.id } })).stock, 2);

      const confirmation = await fetch(`${baseUrl}/api/orders/${encodeURIComponent(result.body.data.orderNumber)}`);
      const confirmationJson = await confirmation.json();
      assert.equal(confirmation.status, 200);
      assert.equal(confirmationJson.data.customer.email, "demo@example.invalid");
      assert.equal(confirmationJson.data.paymentMethod, "E_WALLET");

      const retry = await post(body);
      assert.equal(retry.status, 200);
      assert.equal(retry.body.meta.replayed, true);
      assert.equal(retry.body.data.orderNumber, result.body.data.orderNumber);
      assert.equal((await prisma.product.findUnique({ where: { id: successA.id } })).stock, 3);
      const conflictingRetry = await post({ ...body, notes: "A different order" });
      assert.equal(conflictingRetry.status, 409);
      assert.equal(conflictingRetry.body.code, "IDEMPOTENCY_KEY_REUSED");
    });

    await t.test("only one concurrent customer can buy the final unit", async () => {
      const requestA = makeBody({ items: [{ productId: finalItem.id, quantity: 1, expectedPrice: "12.50" }], key: `${prefix}-race-a`, email: "a@example.invalid" });
      const requestB = makeBody({ items: [{ productId: finalItem.id, quantity: 1, expectedPrice: "12.50" }], key: `${prefix}-race-b`, email: "b@example.invalid" });
      const results = await Promise.all([post(requestA), post(requestB)]);
      assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
      assert.equal((await prisma.product.findUnique({ where: { id: finalItem.id } })).stock, 0);
      const created = await prisma.order.count({ where: { idempotencyKey: { in: [`${prefix}-race-a`, `${prefix}-race-b`] } } });
      assert.equal(created, 1);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (keys.length) {
      const orders = await prisma.order.findMany({ where: { idempotencyKey: { in: keys } }, select: { id: true } });
      if (orders.length) await prisma.order.deleteMany({ where: { id: { in: orders.map((order) => order.id) } } });
    }
    await prisma.product.deleteMany({ where: { slug: { startsWith: prefix } } });
    await prisma.category.delete({ where: { id: category.id } });
  }
});
