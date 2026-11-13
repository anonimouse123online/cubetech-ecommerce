CREATE TYPE "PaymentMethod" AS ENUM (
  'CASH_ON_DELIVERY',
  'E_WALLET',
  'BANK_TRANSFER'
);

ALTER TABLE "orders"
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH_ON_DELIVERY',
  ADD COLUMN "notes" TEXT;

CREATE UNIQUE INDEX "orders_idempotency_key_key"
  ON "orders"("idempotency_key");
