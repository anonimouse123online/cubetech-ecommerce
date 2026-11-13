import { Router } from "express";
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  readCategories,
  readCustomers,
  readDashboard,
  readOrder,
  readOrders,
  readProducts,
  updateCategory,
  updateOrderStatus,
  updateProduct,
} from "./admin.controller.js";
import { loginAdmin, logoutAdmin, readAdminSession } from "./auth.controller.js";
import { requireAdmin } from "./auth.js";

export const adminRoutes = Router();
const authRoutes = Router();

authRoutes.post("/login", loginAdmin);
authRoutes.post("/logout", logoutAdmin);
authRoutes.get("/me", requireAdmin, readAdminSession);
adminRoutes.use("/auth", authRoutes);

adminRoutes.use(requireAdmin);
adminRoutes.get("/dashboard", readDashboard);
adminRoutes.get("/products", readProducts);
adminRoutes.post("/products", createProduct);
adminRoutes.put("/products/:id", updateProduct);
adminRoutes.delete("/products/:id", deleteProduct);
adminRoutes.get("/categories", readCategories);
adminRoutes.post("/categories", createCategory);
adminRoutes.put("/categories/:id", updateCategory);
adminRoutes.delete("/categories/:id", deleteCategory);
adminRoutes.get("/orders", readOrders);
adminRoutes.get("/orders/:orderNumber", readOrder);
adminRoutes.patch("/orders/:orderNumber/status", updateOrderStatus);
adminRoutes.get("/customers", readCustomers);
