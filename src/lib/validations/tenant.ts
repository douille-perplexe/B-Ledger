import { z } from "zod/v4";

export const createTenantSchema = z.object({
  name: z.string().min(3).max(50),
  timezone: z.string().default("UTC"),
});

export const updateTenantSchema = z.object({
  name: z.string().min(3).max(50).optional(),
  timezone: z.string().optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
