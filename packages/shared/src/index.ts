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
