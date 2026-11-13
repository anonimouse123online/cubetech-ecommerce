import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../shared/app-error.js";

export const ADMIN_SESSION_COOKIE = "cartlane_admin_session";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const COOKIE_PATH = "/api/admin";
const LOCAL_DEVELOPMENT_SECRET = "cartlane-local-admin-session-secret-change-before-deploy";

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV !== "production") return LOCAL_DEVELOPMENT_SECRET;
  throw new AppError(503, "Admin sessions are not configured.", "ADMIN_SESSION_NOT_CONFIGURED");
}

function signature(value) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function cookieOptions(maxAge) {
  return [
    `Path=${COOKIE_PATH}`,
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
  ].join("; ");
}

export function issueAdminCookie(adminId) {
  const payload = Buffer.from(JSON.stringify({ sub: adminId, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS }))
    .toString("base64url");
  const token = `${payload}.${signature(payload)}`;
  return `${ADMIN_SESSION_COOKIE}=${token}; ${cookieOptions(SESSION_MAX_AGE_SECONDS)}`;
}

export function clearAdminCookie() {
  return `${ADMIN_SESSION_COOKIE}=; ${cookieOptions(0)}`;
}

function readCookie(request) {
  const prefix = `${ADMIN_SESSION_COOKIE}=`;
  const entry = (request.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return entry?.slice(prefix.length) || "";
}

function readSession(token) {
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra !== undefined) return null;

  let expected;
  try {
    expected = Buffer.from(signature(payload));
  } catch {
    return null;
  }
  const actual = Buffer.from(suppliedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof session.sub !== "string" || !Number.isInteger(session.exp) || session.exp <= Date.now() / 1000) return null;
    return session;
  } catch {
    return null;
  }
}

export async function requireAdmin(request, _response, next) {
  try {
    const session = readSession(readCookie(request));
    if (!session) throw new AppError(401, "Please sign in to continue.", "ADMIN_AUTH_REQUIRED");
    const admin = await prisma.adminUser.findUnique({
      where: { id: session.sub },
      select: { id: true, email: true, displayName: true, isActive: true },
    });
    if (!admin?.isActive) throw new AppError(401, "Please sign in to continue.", "ADMIN_AUTH_REQUIRED");
    request.admin = { id: admin.id, email: admin.email, displayName: admin.displayName };
    next();
  } catch (error) {
    next(error);
  }
}
