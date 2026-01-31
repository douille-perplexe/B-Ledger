import { z } from "zod/v4";

export const createTeamSchema = z.object({
  name: z.string().min(3).max(50),
});

export const updateTeamSchema = z.object({
  name: z.string().min(3).max(50).optional(),
  is_archived: z.boolean().optional(),
});

export const addTeamMemberSchema = z.object({
  user_id: z.uuid(),
  role: z.enum(["admin", "lead", "member"]),
});

export const updateTeamMemberSchema = z.object({
  role: z.enum(["admin", "lead", "member"]).optional(),
  is_active: z.boolean().optional(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;
