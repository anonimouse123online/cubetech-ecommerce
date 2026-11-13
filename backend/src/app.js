import cors from "cors";
import express from "express";
import { categoryRoutes } from "./modules/categories/category.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { AppError } from "./modules/shared/app-error.js";
import { orderRoutes } from "./modules/orders/order.routes.js";
import { productRoutes } from "./modules/products/product.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";

export const app = express();

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use("/api/health", healthRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} was not found.` });
});

app.use((error, _req, res, _next) => {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  if (statusCode >= 500) console.error(error);
  res.status(statusCode).json({
    error: statusCode === 500 ? "The request could not be completed." : error.message,
    code: error.code || (statusCode === 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED"),
    ...(error.details === undefined ? {} : { details: error.details }),
  });
});
