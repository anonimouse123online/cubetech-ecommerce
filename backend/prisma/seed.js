import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const categories = [
  { name: "Desk & Devices", slug: "desk-and-devices", description: "Thoughtful tools for a better workday." },
  { name: "Sound & Vision", slug: "sound-and-vision", description: "Small upgrades for your everyday media." },
  { name: "Everyday Carry", slug: "everyday-carry", description: "Useful essentials for life on the move." },
];

const products = [
  { name: "Morrow Wireless Earbuds", slug: "morrow-wireless-earbuds", category: "sound-and-vision", price: "59.00", stock: 24, description: "Clear, balanced sound with a pocket-sized charging case.", imageUrl: "https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=900&q=85" },
  { name: "Aster Bluetooth Speaker", slug: "aster-bluetooth-speaker", category: "sound-and-vision", price: "34.50", stock: 15, description: "Warm room-filling audio in a compact, travel-ready shape.", imageUrl: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=85" },
  { name: "Nook USB-C Hub", slug: "nook-usb-c-hub", category: "desk-and-devices", price: "27.99", stock: 19, description: "A tidy six-port hub for desks, studios, and shared spaces.", imageUrl: "https://images.unsplash.com/photo-1625842268584-8f3296236761?auto=format&fit=crop&w=900&q=85" },
  { name: "Fieldnote Mechanical Keyboard", slug: "fieldnote-mechanical-keyboard", category: "desk-and-devices", price: "52.00", stock: 8, description: "Comfortable tactile keys and a clean, compact footprint.", imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=85" },
  { name: "Solace Desk Lamp", slug: "solace-desk-lamp", category: "desk-and-devices", price: "19.99", stock: 12, description: "Soft adjustable lighting for late reads and early starts.", imageUrl: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85" },
  { name: "Luma Smart Bulb Pair", slug: "luma-smart-bulb-pair", category: "desk-and-devices", price: "8.99", stock: 0, description: "A pair of warm-to-cool smart bulbs for an easy room refresh.", imageUrl: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85" },
  { name: "Drift Laptop Sleeve", slug: "drift-laptop-sleeve", category: "everyday-carry", price: "17.99", stock: 31, description: "A cushioned sleeve with a soft lining and quick-access pocket.", imageUrl: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=85" },
  { name: "Orbit Wireless Mouse", slug: "orbit-wireless-mouse", category: "desk-and-devices", price: "14.99", stock: 20, description: "A quiet, comfortable mouse that pairs with two devices.", imageUrl: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=900&q=85" },
  { name: "Arc Portable SSD", slug: "arc-portable-ssd", category: "desk-and-devices", price: "46.99", stock: 7, description: "Fast pocket storage with a durable, travel-friendly shell.", imageUrl: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=900&q=85" },
  { name: "Vela Full HD Webcam", slug: "vela-full-hd-webcam", category: "desk-and-devices", price: "28.99", stock: 10, description: "Natural color and an easy clip-on mount for video calls.", imageUrl: "https://images.unsplash.com/photo-1587826080692-f439cd0b70da?auto=format&fit=crop&w=900&q=85" },
  { name: "Pip Cable Keeper Set", slug: "pip-cable-keeper-set", category: "everyday-carry", price: "2.99", stock: 40, isActive: false, description: "Reusable little wraps to keep everyday cables in order.", imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=85" },
  { name: "Mosaic Charging Stand", slug: "mosaic-charging-stand", category: "everyday-carry", price: "12.99", stock: 18, description: "A compact stand to keep your phone upright while it charges.", imageUrl: "https://images.unsplash.com/photo-1609592806596-b43bada2f1c0?auto=format&fit=crop&w=900&q=85" },
];

try {
  const categoryIds = new Map();
  for (const category of categories) {
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.description },
      create: category,
    });
    categoryIds.set(category.slug, saved.id);
  }

  for (const product of products) {
    const { category, ...fields } = product;
    const data = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
    data.categoryId = categoryIds.get(category);
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: data,
      create: data,
    });
  }

  const passwordHash = await bcrypt.hash("CartlaneDemo2026!", 12);
  await prisma.adminUser.upsert({
    where: { email: "demo@cartlane.test" },
    update: { passwordHash, displayName: "Cartlane Demo Admin", isActive: true },
    create: { email: "demo@cartlane.test", passwordHash, displayName: "Cartlane Demo Admin" },
  });

  console.log(`Seed complete: ${categories.length} categories, ${products.length} products, 1 demo administrator.`);
  console.log("Demo administrator: demo@cartlane.test / CartlaneDemo2026!");
} finally {
  await prisma.$disconnect();
}
