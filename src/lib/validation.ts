import { z } from "zod";

/** Normalises an Indian mobile to +91XXXXXXXXXX. Returns null when invalid. */
export function normalizeIndianPhone(raw: string): string | null {
  const digits = String(raw ?? "").replace(/[\s\-()]/g, "");
  if (!/^\+?[0-9]+$/.test(digits)) return null;
  let d = digits.replace(/^\+/, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (!/^[6-9][0-9]{9}$/.test(d)) return null;
  return `+91${d}`;
}

export const indianPhone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizeIndianPhone(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid Indian mobile number (10 digits, starts with 6–9)" });
      return z.NEVER;
    }
    return n;
  });

export const pastDate = z
  .string()
  .trim()
  .refine((v) => !v || (!Number.isNaN(Date.parse(v)) && new Date(v) <= new Date()), "Date of birth cannot be in the future");

export const SOCIAL_KEYS = [
  ["youtube", "YouTube"], ["google_maps", "Google Maps"], ["google_reviews", "Google Reviews"],
  ["facebook", "Facebook"], ["instagram", "Instagram"], ["whatsapp", "WhatsApp"],
  ["whatsapp_group", "WhatsApp Group"], ["whatsapp_community", "WhatsApp Community"],
  ["telegram", "Telegram"], ["x", "X / Twitter"], ["linkedin", "LinkedIn"],
] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number][0];
export type SocialLinks = Partial<Record<SocialKey, { url: string; enabled: boolean }>>;

export function safeHttpsUrl(v: string): string | null {
  try {
    const u = new URL(v.trim());
    if (u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

const FOOD = /(restaurant|cafe|café|coffee|bakery|food|dhaba|sweet|juice|bar|pizza|hotel)/i;
export function isFoodBusiness(category: string | null | undefined) {
  return FOOD.test(category ?? "");
}
export function catalogLabel(category: string | null | undefined) {
  if (isFoodBusiness(category)) return "Digital Menu";
  if (/(retail|store|shop|furniture|boutique|electronics|mart)/i.test(category ?? "")) return "Product Catalog";
  return "Services Catalog";
}

/** All stored formats a phone may exist in (older rows were saved un-normalised). */
export function phoneVariants(raw: string): string[] {
  const n = normalizeIndianPhone(raw);
  if (!n) return [String(raw).trim()];
  const ten = n.slice(3);
  return [n, ten, `91${ten}`, `0${ten}`, String(raw).trim()];
}
