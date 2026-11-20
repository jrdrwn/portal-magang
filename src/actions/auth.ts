"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/session";
import { homePathFor } from "@/lib/auth";
import {
  clientIp,
  loginBlocked,
  recordLogin,
  recordRegister,
  registerBlocked,
} from "@/lib/rate-limit";
import {
  failure,
  str,
  validationFailure,
  type ActionResult,
} from "@/lib/action-result";

// Hash tiruan agar waktu respons sama saat email tidak ditemukan.
const DUMMY_HASH = bcrypt.hashSync("tidak-dipakai", 10);

const registerSchema = z
  .object({
    name: z.string().min(2, "Nama minimal 2 karakter").max(80),
    email: z.email("Email tidak valid").max(120),
    password: z.string().min(8, "Password minimal 8 karakter").max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Konfirmasi password tidak sama",
  });

export async function registerAccount(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    name: str(formData, "name"),
    email: str(formData, "email").toLowerCase(),
    password: str(formData, "password"),
    confirm: str(formData, "confirm"),
  });
  if (!parsed.success) return validationFailure(parsed.error);
  const { name, email, password } = parsed.data;

  const ip = await clientIp();
  const blocked = await registerBlocked(ip);
  if (blocked) return failure(blocked);

  const exists = await db.user.findUnique({ where: { email } });
  if (exists) {
    return {
      ok: false,
      error: "Periksa kembali isian Anda.",
      fieldErrors: { email: ["Email sudah terdaftar"] },
    };
  }

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "INTERN",
      profile: { create: {} },
    },
  });
  await recordRegister(ip);
  await createSession({ userId: user.id, role: user.role });
  redirect("/pendaftaran");
}

const loginSchema = z.object({
  email: z.email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export async function login(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: str(formData, "email").toLowerCase(),
    password: str(formData, "password"),
  });
  if (!parsed.success) return validationFailure(parsed.error);
  const { email } = parsed.data;

  const ip = await clientIp();
  const blocked = await loginBlocked(email, ip);
  if (blocked) return failure(blocked);

  const user = await db.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(
    parsed.data.password,
    user?.passwordHash ?? DUMMY_HASH,
  );
  await recordLogin(email, ip, Boolean(user && valid));
  if (!user || !valid) return failure("Email atau password salah.");
  if (!user.isActive) {
    return failure("Akun dinonaktifkan. Hubungi admin.");
  }

  await createSession({ userId: user.id, role: user.role });
  redirect(homePathFor(user.role));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
