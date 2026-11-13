import { AppError } from "../shared/app-error.js";

const SORTS = new Set(["", "price-asc", "price-desc"]);

export function parseProductQuery(query) {
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const category = typeof query.category === "string" ? query.category.trim() : "";
  const sort = typeof query.sort === "string" ? query.sort.trim() : "";

  if (search.length > 120) throw new AppError(400, "Search must be 120 characters or fewer.");
  if (category && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(category)) {
    throw new AppError(400, "Category must be a valid category slug.");
  }
  if (!SORTS.has(sort)) throw new AppError(400, "Sort must be price-asc or price-desc.");

  return {
    where: {
      isActive: true,
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      ...(category ? { category: { is: { slug: category } } } : {}),
    },
    orderBy: sort
      ? { price: sort === "price-asc" ? "asc" : "desc" }
      : { createdAt: "desc" },
  };
}
