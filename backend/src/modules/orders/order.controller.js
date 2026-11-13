import { createOrder, getOrderByNumber, quoteCart } from "./order.service.js";

export async function quoteOrder(req, res) {
  const data = await quoteCart(req.body?.items);
  res.json({ data });
}

export async function postOrder(req, res) {
  const result = await createOrder(req.body);
  res.status(result.replayed ? 200 : 201).json({ data: result.order, meta: { replayed: result.replayed } });
}

export async function readOrder(req, res) {
  const data = await getOrderByNumber(req.params.orderNumber);
  res.json({ data });
}
