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
