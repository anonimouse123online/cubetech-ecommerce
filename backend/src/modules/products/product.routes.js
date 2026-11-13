import { Router } from "express";
import { getProduct, getProducts } from "./product.controller.js";

export const productRoutes = Router();

productRoutes.get("/", getProducts);
productRoutes.get("/:id", getProduct);
