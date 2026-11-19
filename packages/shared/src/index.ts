import { z } from "zod";
export const overviewSchema = z.object({
  shop: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      category: z.string(),
      zone: z.string(),
      subzone: z.string(),
      owned: z.number().int().nonnegative(),
      unusable: z.number().int().nonnegative(),
    }),
  ),
});
export type Overview = z.infer<typeof overviewSchema>;
const label = z.string().trim().min(1).max(160);
const amount = z.number().int().min(0).max(1000000000);
export const catalogFields = z.object({
  name: label,
  category: label,
  zone: label,
  subzone: label,
  description: z.string().trim().max(2000),
  model: z.enum(["Daily", "Fixed period"]),
  period: z.number().int().min(1).max(3650),
  rate: amount,
  cost: amount,
  replacement: amount,
  active: z.number().int().min(0).max(1),
});
export const itemWrite = catalogFields.extend({
  id: label.optional(),
  revision: amount.default(0),
  opening: amount.default(0),
});
export const categoryWrite = z.object({
  original: label.optional(),
  name: label,
  active: z.number().int().min(0).max(1),
});
export const adjustmentKinds = [
  "Purchase",
  "Correction increase",
  "Correction decrease",
  "Damage",
  "Repair",
  "Retire usable",
  "Retire unusable",
] as const;
export const adjustment = z.object({
  id: label,
  kind: z.enum(adjustmentKinds),
  quantity: amount.positive(),
  reason: z.string().trim().min(1).max(500),
  revision: amount,
});
export type CatalogItem = z.infer<typeof catalogFields> & {
  id: string;
  owned: number;
  unusable: number;
  revision: number;
};
export type Category = { name: string; active: number };
export type Movement = {
  id: number;
  item: string;
  kind: string;
  quantity: number;
  owned: number;
  unusable: number;
  reason: string;
  actor: string;
  created: string;
};
export type Inventory = {
  items: CatalogItem[];
  categories: Category[];
  demoAccess: boolean;
};
export function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91")
    ? digits.slice(2)
    : digits;
}
export const customerWrite = z.object({
  name: z.string().trim().min(1).max(160),
  address: z.string().trim().min(1).max(1000),
  phones: z
    .array(
      z
        .string()
        .trim()
        .max(32)
        .regex(/^\+?[\d ()-]+$/)
        .refine((p) => /^\d{7,15}$/.test(p.replace(/\D/g, ""))),
    )
    .min(1)
    .max(10),
  revision: z.number().int().positive().optional(),
  allowSharedPhone: z.boolean().optional(),
});
export type Customer = {
  id: number;
  name: string;
  address: string;
  revision: number;
  phones: string[];
};
export const inquiryLine = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().positive().max(1000000000),
  startOverride: z.iso.date().nullable(),
  dueOverride: z.iso.date().nullable(),
});
export const inquiryWrite = z
  .object({
    requestId: z.uuid(),
    revision: z.number().int().positive().optional(),
    customerId: z.number().int().positive(),
    start: z.iso.date(),
    due: z.iso.date(),
    lines: z.array(inquiryLine).min(1).max(200),
  })
  .refine(
    (v) =>
      v.start <= v.due &&
      v.lines.every(
        (l) => (l.startOverride ?? v.start) <= (l.dueOverride ?? v.due),
      ),
  );
export type InquiryLine = z.infer<typeof inquiryLine>;
export type InquirySummary = {
  atRisk: number;
  status: string;
  issuedAt: string | null;
  id: number;
  customer: string;
  start: string;
  due: string;
};
export type InquiryDetails = InquirySummary & {
  revision: number;
  customerId: number;
  events: {
    id: number;
    action: string;
    created: string;
    position: number | null;
    quantity: number | null;
    condition: string | null;
    remaining: number | null;
  }[];
  lines: (InquiryLine & {
    name: string;
    returned: number;
    rate: number | null;
    model: string | null;
    period: number | null;
  })[];
};

export const rentalAction = z.object({
  acceptRisk: z.boolean().optional(),
  action: z.enum(["Book", "Issue", "Cancel", "Return"]),
  revision: z.number().int().positive(),
  position: z.number().int().nonnegative().optional(),
  quantity: z.number().int().positive().optional(),
  condition: z.enum(["Good", "Damaged", "Missing"]).optional(),
});
