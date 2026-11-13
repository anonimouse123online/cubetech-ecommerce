import {
  createAdminCategory,
  createAdminProduct,
  deleteAdminCategory,
  deleteAdminProduct,
  getAdminOrder,
  getDashboardStats,
  listAdminCategories,
  listAdminCustomers,
  listAdminOrders,
  listAdminProducts,
  updateAdminCategory,
  updateAdminOrderStatus,
  updateAdminProduct,
} from "./admin.service.js";

export async function readDashboard(_req, res) {
  res.json({ data: await getDashboardStats() });
}

export async function readProducts(req, res) {
  const data = await listAdminProducts(req.query);
  res.json({ data, meta: { count: data.length } });
}

export async function createProduct(req, res) {
  res.status(201).json({ data: await createAdminProduct(req.body) });
}

export async function updateProduct(req, res) {
  res.json({ data: await updateAdminProduct(req.params.id, req.body) });
}

export async function deleteProduct(req, res) {
  res.json({ data: await deleteAdminProduct(req.params.id) });
}

export async function readCategories(_req, res) {
  const data = await listAdminCategories();
  res.json({ data, meta: { count: data.length } });
}

export async function createCategory(req, res) {
  res.status(201).json({ data: await createAdminCategory(req.body) });
}

export async function updateCategory(req, res) {
  res.json({ data: await updateAdminCategory(req.params.id, req.body) });
}

export async function deleteCategory(req, res) {
  res.json({ data: await deleteAdminCategory(req.params.id) });
}

export async function readOrders(req, res) {
  const data = await listAdminOrders(typeof req.query.status === "string" ? req.query.status : "");
  res.json({ data, meta: { count: data.length } });
}

export async function readOrder(req, res) {
  res.json({ data: await getAdminOrder(req.params.orderNumber) });
}

export async function updateOrderStatus(req, res) {
  res.json({ data: await updateAdminOrderStatus(req.params.orderNumber, req.body?.status) });
}

export async function readCustomers(_req, res) {
  const data = await listAdminCustomers();
  res.json({ data, meta: { count: data.length } });
}
