# Cartlane E-Commerce

CubeTech Internship Assessment project: a customer storefront and protected store administration dashboard for a fictional electronics shop. The application uses one React frontend, one Express API, and one PostgreSQL database. Customer checkout is guest-based; administrators manage products, categories, orders, and customer summaries.

## Features

### Customer storefront

- Home page with Cartlane branding, promotional content, product categories, featured products, navigation, and fictional contact details.
- Product catalog with case-insensitive search, category filters, price sorting, availability, and product details with related active products.
- Persistent browser cart with duplicate item merging, quantity controls, live price and stock review, and totals displayed in PHP.
- Guest checkout with contact and delivery details, optional notes, and demo selections for Cash on Delivery, E-Wallet, or Bank Transfer.
- Saved order confirmation with order number, purchased item snapshots, customer and delivery details, total, and status.

### Admin dashboard

- Demo administrator sign-in and sign-out. The API verifies the seeded password hash and protects admin data endpoints with a signed HTTP-only session cookie.
- Dashboard cards for all products, all orders, pending orders, completed orders, unique normalized customer emails, and completed-order sales.
- Product management: list, search, category/status filters, add, edit, and delete. Products referenced by orders cannot be deleted; they can be made inactive.
- Category management with case-insensitive duplicate-name prevention. Categories with products cannot be deleted.
- Newest-first order list, order details, and validated fulfillment status updates. Eligible cancellations restore inventory.
- Read-only customer summaries grouped by normalized checkout email, with latest contact details, order count, and completed-order value.

## Technology and architecture

| Area | Technology |
| --- | --- |
| Frontend | React 19, React Router 7, Vite 8, Tailwind CSS 4 integration, responsive CSS |
| Backend | Node.js 22.12+, Express 5, JavaScript ES modules |
| Database | PostgreSQL, Prisma 7, Prisma PostgreSQL adapter (`pg`) |
| Admin password hashing | `bcryptjs` |
| Tests and lint | Node.js built-in test runner, Oxlint, Vite production build |

This is a **modular monolith**, not a collection of microservices. The Express app mounts focused modules for products, categories, orders, admin, health, and shared validation/money handling. Those modules use one Prisma client and one PostgreSQL database. The React single-page app contains separate customer and admin routes and calls the API through Vite's `/api` development proxy. The customer cart is stored in browser `localStorage`; product data, prices, stock, and orders are stored in PostgreSQL.

```mermaid
flowchart LR
  Browser[React storefront and admin UI] -->|/api requests| Vite[Vite development server]
  Vite -->|proxy to port 5001| Express[Express modular monolith]
  Express --> Prisma[Prisma 7 adapter]
  Prisma --> PostgreSQL[(PostgreSQL)]
  Cart[Browser localStorage cart] --> Browser
```

## Repository structure

```text
backend/
  prisma/
    migrations/             Checked-in PostgreSQL migrations
    schema.prisma           Database models, relations, and enums
    seed.js                 Demo categories, products, and admin account
  src/
    db/                     Prisma client and PostgreSQL adapter
    modules/
      admin/                Admin auth, dashboard, catalog, orders, customers
      categories/           Public category reads
      health/               Health endpoint
      orders/               Guest checkout, quotes, order confirmation
      products/             Public catalog reads
      shared/               Errors, cart parsing, exact money helpers
  test/                     Backend validation and PostgreSQL integration tests
  .env.example
  package.json
frontend/
  public/                   Static frontend assets
  src/
    api/                    API client
    cart/                   Persistent cart state and calculations
    components/             Customer and admin UI components
    pages/                  Storefront and admin screens
  test/                     Cart unit tests
  package.json
README.md                   Main project and assessment documentation
```

## System requirements

- Node.js **22.12 or newer** and npm. The backend package declares this minimum.
- PostgreSQL installed, running, and accessible to the local user. The project does not pin a PostgreSQL major version.
- A modern browser with JavaScript enabled.
- Local ports `5432` (PostgreSQL), `5001` (API), and `5173` (Vite) available, or update the corresponding application configuration.

## Local setup

Run commands from the indicated folder. There is no root `package.json`; install and run the backend and frontend separately.

### 1. Clone the project

Clone the repository using the URL supplied with the assessment, then change to its folder:

```sh
cd cubetech-ecommerce
```

### 2. Create a dedicated PostgreSQL database

Start PostgreSQL, then create the project database. Replace `postgres` with your local PostgreSQL role if it has a different name:

```sh
psql -U postgres -d postgres -c "CREATE DATABASE cubetech_ecommerce;"
```

You can also create a database named `cubetech_ecommerce` in pgAdmin. Use a dedicated database for this app rather than a database containing unrelated projects.

### 3. Install and configure the backend

```sh
cd backend
npm install
```

Copy the environment template to `.env` (PowerShell shown first):

```powershell
Copy-Item .env.example .env
```

```sh
# macOS/Linux alternative
cp .env.example .env
```

Edit `backend/.env` and replace the placeholder PostgreSQL username and password in `DATABASE_URL`:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/cubetech_ecommerce?schema=public"
```

If the password contains URL-reserved characters, URL-encode them in the connection string. In production, also set `ADMIN_SESSION_SECRET` to a random value of at least 32 characters. The local development build has a development-only fallback when that variable is omitted; do not use that fallback in production. `NODE_ENV=production` also marks the admin cookie `Secure`, so production must use HTTPS.

Generate Prisma Client, apply the checked-in migrations, then seed the demo catalog and admin account:

```sh
npm run db:generate
npm run db:migrate
npm run db:seed
```

`db:migrate` deploys existing migrations; it does not reset the database. The migrations create the original schema, add checkout fields, and update the order status enum while retaining existing order rows. `db:seed` upserts three categories, twelve fictional products, and the demo administrator. On a fresh database, run it once. It updates the matching seeded records if run again, so rerunning it can overwrite admin edits to those specific demo products/categories and resets the demo admin password.

Start the API in this terminal:

```sh
npm run dev
```

The API listens at `http://localhost:5001`. For a non-watch start, use `npm start` instead.

### 4. Install and start the frontend

Open a second terminal from the repository root:

```sh
cd frontend
npm install
npm run dev
```

Vite serves the frontend at `http://localhost:5173` and proxies `/api` requests to `http://localhost:5001`.

## Application URLs and demo login

| Page/service | URL |
| --- | --- |
| Cartlane storefront | `http://localhost:5173/` |
| Product catalog | `http://localhost:5173/products` |
| Admin sign-in | `http://localhost:5173/admin/login` |
| Admin dashboard | `http://localhost:5173/admin` |
| Backend health check | `http://localhost:5001/api/health` |

Seeded demo administrator:

- **Email:** `demo@cartlane.test`
- **Password:** `CartlaneDemo2026!`

The password is hashed with bcrypt before it is stored. These are demonstration credentials; change or remove the demo account before any public deployment.

## REST API

All routes are mounted below `/api`. Admin data routes require the `cartlane_admin_session` HTTP-only cookie. The login route is public; logout clears the cookie; session inspection and all admin data routes require an authenticated administrator.

### Public endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | API health check |
| `GET` | `/api/categories` | Customer-visible categories with active products |
| `GET` | `/api/products?search=&category=&sort=` | Active product catalog; supports case-insensitive search, category slug, `price-asc`, and `price-desc` |
| `GET` | `/api/products/:id` | Active product details and up to three active related products |
| `POST` | `/api/orders/quote` | Recheck cart prices, stock, and product availability |
| `POST` | `/api/orders` | Validate and create a guest checkout order |
| `GET` | `/api/orders/:orderNumber` | Read saved customer order confirmation details |

### Admin authentication endpoints

| Method | Endpoint | Access |
| --- | --- | --- |
| `POST` | `/api/admin/auth/login` | Public; verifies admin email/password and sets the HTTP-only cookie |
| `POST` | `/api/admin/auth/logout` | Clears the admin cookie |
| `GET` | `/api/admin/auth/me` | Authenticated; returns the current admin profile |

### Protected admin data endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/dashboard` | Product/order/customer counts and completed-order sales |
| `GET` | `/api/admin/products?search=&categoryId=&status=` | List/search/filter all products, including inactive products |
| `POST` | `/api/admin/products` | Create product |
| `PUT` | `/api/admin/products/:id` | Update product |
| `DELETE` | `/api/admin/products/:id` | Delete product unless referenced by an order |
| `GET` | `/api/admin/categories` | List all categories and product counts |
| `POST` | `/api/admin/categories` | Create category |
| `PUT` | `/api/admin/categories/:id` | Update category |
| `DELETE` | `/api/admin/categories/:id` | Delete category only when no products reference it |
| `GET` | `/api/admin/orders?status=` | List orders newest first; optional status filter |
| `GET` | `/api/admin/orders/:orderNumber` | Read admin order details |
| `PATCH` | `/api/admin/orders/:orderNumber/status` | Apply an allowed order status transition |
| `GET` | `/api/admin/customers` | Read-only customer summaries grouped by normalized email |

## PostgreSQL data model

The Prisma schema maps five application tables:

| Table | Contents and relationships |
| --- | --- |
| `categories` | Category name, slug, optional description/image. One category has many products. A category with products cannot be deleted. |
| `products` | Name, slug, description, decimal price, image URL, integer stock, active flag, and required category relation. Product-to-category deletion is restricted. |
| `orders` | Unique order number, status, payment selection, checkout customer/shipping details, optional notes/idempotency key, and decimal totals. Customer records are derived from these guest checkouts; there is no customer account table. |
| `order_items` | Order lines with quantity and saved product name/unit price snapshots. Each item belongs to an order and references its product; product deletion is restricted to preserve history. |
| `admin_users` | Admin email, bcrypt password hash, display name, and active flag. |

`orders` have many `order_items`; deleting an order cascades to its items. Product and category relations use restrictive deletion rules where historical or catalog references exist. PostgreSQL enums store order statuses (`PENDING`, `CONFIRMED`, `PREPARING`, `SHIPPED`, `COMPLETED`, `CANCELLED`) and demo payment methods (`CASH_ON_DELIVERY`, `E_WALLET`, `BANK_TRANSFER`). Prices and totals use PostgreSQL `Decimal`, not binary floating point.

## Checkout and inventory flow

1. The browser stores cart lines in `localStorage`; product information shown in the cart is re-quoted with the API before checkout.
2. Checkout sends guest details, delivery address, payment selection, item quantities, expected prices, and an idempotency key to `POST /api/orders`.
3. The backend validates customer input and reads the current product price, active status, and stock from PostgreSQL. If a price or availability changed, it returns a review-required response and the customer must review the cart again.
4. Within one PostgreSQL transaction, the backend conditionally decrements each product's stock only if it is active, the price still matches, and enough units remain. It then writes the order and order-item snapshots. Exact totals are calculated in integer centavos and stored as decimal values.
5. The unique order number is returned after the transaction commits. The frontend clears the cart only after confirmed success.
6. Admin status transitions are `Pending → Confirmed → Preparing → Shipped → Completed`. Cancellation is allowed only from `Pending` or `Confirmed`. `Completed` and `Cancelled` are final. The API locks the order row while cancelling and restores the saved item quantities in the same transaction, so repeated or concurrent cancellation requests do not restore stock twice.

## Tests and useful commands

Run backend commands from `backend/`:

```sh
npm test                  # Validation and PostgreSQL integration tests
npm run db:generate       # Regenerate Prisma Client
npm run db:migrate        # Deploy checked-in migrations; no database reset
npm run db:migrate:dev -- --name migration_name  # Create a migration in a dev environment
npm run db:seed            # Upsert demo catalog and admin data
npm run db:studio          # Open Prisma Studio
```

Backend integration tests require `DATABASE_URL` and an already migrated database. They create uniquely named fixtures and remove those fixtures when finished; they do not truncate or reset tables.

Run frontend commands from `frontend/`:

```sh
npm test       # Cart persistence, duplicate merge, quantity, and totals tests
npm run lint   # Oxlint
npm run build  # Production bundle in frontend/dist
npm run preview # Serve the production bundle locally
```

The backend test suite covers checkout and admin API behavior, including persistence, exact totals, invalid input, price/stock changes, concurrent purchases of the final unit, admin authorization, status transitions, statistics, and one-time cancellation restock. The frontend test suite exercises cart storage and monetary calculations.

## Known limitations

- Payment selections are demo values only; no payment gateway is connected.
- Checkout is guest-based. There are no customer accounts, registration, or customer order-history login.
- The demo admin session is a signed, stateless cookie with an eight-hour expiry. Logout clears the browser cookie, but there is no server-side per-session revocation store. Production deployments should use a production `ADMIN_SESSION_SECRET`, HTTPS, and a server-side session/revocation strategy if immediate token revocation is required.
- The seed product images are hosted on Unsplash and require an internet connection to load.
- Automated frontend tests cover cart logic, not full browser end-to-end flows or automated viewport screenshots. Responsive styles are implemented, but visual acceptance at specific device sizes should be checked in a browser before submission.
- The project contains local development scripts, not cloud deployment or production infrastructure configuration.

## AI assistance disclosure

AI assistance was used to help implement and revise application code, automated tests, and project documentation. The project owner should review the code and test results and be prepared to explain the design and workflow during assessment.
