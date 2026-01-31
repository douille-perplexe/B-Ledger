import { z } from "zod/v4";

export const createInviteSchema = z.object({
  team_id: z.uuid(),
  role: z.enum(["admin", "lead", "member"]),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
