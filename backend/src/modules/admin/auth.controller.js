import bcrypt from "bcryptjs";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../shared/app-error.js";
import { clearAdminCookie, issueAdminCookie } from "./auth.js";

export async function loginAdmin(req, res) {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password || email.length > 254 || password.length > 200) {
    throw new AppError(400, "Enter your email and password.", "INVALID_LOGIN");
  }

  const admin = await prisma.adminUser.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  const passwordMatches = admin?.passwordHash ? await bcrypt.compare(password, admin.passwordHash) : false;
  if (!admin?.isActive || !passwordMatches) {
    throw new AppError(401, "Email or password is incorrect.", "INVALID_CREDENTIALS");
  }

  res.setHeader("Set-Cookie", issueAdminCookie(admin.id));
  res.setHeader("Cache-Control", "no-store");
  res.json({ data: { id: admin.id, email: admin.email, displayName: admin.displayName } });
}

export function logoutAdmin(_req, res) {
  res.setHeader("Set-Cookie", clearAdminCookie());
  res.setHeader("Cache-Control", "no-store");
  res.json({ data: { loggedOut: true } });
}

export function readAdminSession(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.json({ data: req.admin });
}
