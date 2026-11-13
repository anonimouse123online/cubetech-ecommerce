import { Router } from "express";
import { postOrder, quoteOrder, readOrder } from "./order.controller.js";

export const orderRoutes = Router();

orderRoutes.post("/quote", quoteOrder);
orderRoutes.post("/", postOrder);
orderRoutes.get("/:orderNumber", readOrder);
