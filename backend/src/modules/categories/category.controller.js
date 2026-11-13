import { prisma } from "../../db/prisma.js";

export async function getCategories(_req, res) {
  const categories = await prisma.category.findMany({
    where: { products: { some: { isActive: true } } },
    orderBy: { name: "asc" },
    include: { _count: { select: { products: { where: { isActive: true } } } } },
  });

  res.json({
    data: categories.map(({ _count, ...category }) => ({
      ...category,
      productCount: _count.products,
    })),
  });
}
