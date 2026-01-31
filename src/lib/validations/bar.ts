import { z } from "zod/v4";

export const addBarSchema = z.object({
  team_id: z.uuid(),
  assigned_to: z.uuid(),
  reason: z.string().max(200).optional(),
});

export type AddBarInput = z.infer<typeof addBarSchema>;
