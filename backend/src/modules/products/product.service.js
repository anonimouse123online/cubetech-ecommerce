import { prisma } from "../../db/prisma.js";
import { AppError } from "../shared/app-error.js";
import { parseProductQuery } from "./product.validation.js";

const productInclude = { category: { select: { id: true, name: true, slug: true } } };

export async function listProducts(query) {
  const { where, orderBy } = parseProductQuery(query);
  const products = await prisma.product.findMany({
    where,
    orderBy,
    include: productInclude,
  });
  return products.map(toPublicProduct);
}

export async function getProductById(id) {
  if (!/^[a-z0-9_-]{1,64}$/i.test(id)) throw new AppError(400, "Product ID is invalid.");

  const product = await prisma.product.findFirst({
    where: { id, isActive: true },
    include: productInclude,
  });
  if (!product) throw new AppError(404, "Product was not found.");
  const relatedProducts = await prisma.product.findMany({
    where: { categoryId: product.categoryId, id: { not: product.id }, isActive: true },
    orderBy: { createdAt: "desc" },
    take: 3,
    include: productInclude,
  });
  return {
    ...toPublicProduct(product),
    relatedProducts: relatedProducts.map(toPublicProduct),
  };
}

function toPublicProduct(product) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price.toFixed(2),
    imageUrl: product.imageUrl,
    stock: product.stock,
    isActive: product.isActive,
    category: product.category,
    createdAt: product.createdAt,
  };
}
