# Cartlane API

Express REST API and PostgreSQL data layer for the Phase 1 catalog and Phase 2 guest checkout.

## Local setup

1. Use Node.js 22.12 or newer and run `npm install` in this folder.
2. Set `DATABASE_URL` in `.env` to the dedicated `cubetech_ecommerce` database. `.env.example` shows the format.
3. Run `npm run db:generate`.
4. Apply pending migrations with `npm run db:migrate`.
5. Run `npm run db:seed` if the demo catalog has not been seeded yet.
6. Start the API with `npm run dev` on port 5001.

The Phase 2 migration adds a payment method enum, optional order notes, and a nullable unique idempotency key. It does not reset existing tables or orders. Existing orders default to Cash on Delivery.

## Public API

- `GET /api/health`
- `GET /api/products?search=lamp&category=desk-and-devices&sort=price-asc`
- `GET /api/products/:id` — includes up to 3 active products in the same category.
- `GET /api/categories`
- `POST /api/orders/quote` — current availability, price, and stock for cart lines.
- `POST /api/orders` — validates the guest checkout, rechecks prices and stock, decrements stock conditionally, and saves the order and snapshot lines in one PostgreSQL transaction.
- `GET /api/orders/:orderNumber` — returns the saved confirmation details.

Order requests include an `idempotencyKey`, cart `items` with `productId`, positive whole-number `quantity`, and the displayed `expectedPrice`, customer details, shipping address, payment method, and optional notes. Supported payment values are `CASH_ON_DELIVERY`, `E_WALLET`, and `BANK_TRANSFER`. Delivery is free in this demo. Amounts are summed in integer centavos and stored as PostgreSQL Decimal values.

Product search is case-insensitive. Only active products are public; active products with no stock remain visible and cannot be purchased. Prices are returned as decimal strings.

The seed is safe to rerun. It creates 3 categories, 12 fictional products, and one demo administrator (`demo@cartlane.test`, password `CartlaneDemo2026!`). The password is stored as a bcrypt hash.

## Checks

- `npm test` runs validation and PostgreSQL integration tests for cart review, successful persistence, exact totals, retries, and the final-stock concurrency case. Integration tests use unique temporary fixtures and delete only those fixtures; they do not truncate or reset the database.
- `npm run db:generate` regenerates the Prisma client.
- `npm run db:migrate` deploys checked-in migrations without prompting.
- `npm run db:migrate:dev -- --name new_migration` creates a migration in an interactive development terminal.
- `npx prisma migrate status` shows applied migrations.
