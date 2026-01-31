import { z } from "zod/v4";

export const createBreakfastSchema = z.object({
  team_id: z.uuid(),
  owed_by: z.uuid(),
  reason: z.string().max(200).optional(),
});

export const scheduleBreakfastSchema = z.object({
  scheduled_date: z.iso.date(),
});

export const proposeBreakfastDateSchema = z.object({
  proposed_date: z.iso.date(),
});

export type CreateBreakfastInput = z.infer<typeof createBreakfastSchema>;
export type ScheduleBreakfastInput = z.infer<typeof scheduleBreakfastSchema>;
export type ProposeBreakfastDateInput = z.infer<typeof proposeBreakfastDateSchema>;
