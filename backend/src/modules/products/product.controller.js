import { getProductById, listProducts } from "./product.service.js";

export async function getProducts(req, res) {
  const data = await listProducts(req.query);
  res.json({ data, meta: { count: data.length } });
}

export async function getProduct(req, res) {
  const data = await getProductById(req.params.id);
  res.json({ data });
}
