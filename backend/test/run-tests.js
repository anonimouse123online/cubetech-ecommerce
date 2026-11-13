import "dotenv/config";
import "./product.validation.test.js";
import "./admin.validation.test.js";
import "./admin.integration.test.js";
import "./order.validation.test.js";
import "./checkout.test.js";
import { after } from "node:test";
import { prisma } from "../src/db/prisma.js";

after(async () => prisma.$disconnect());
