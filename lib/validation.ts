import { z } from "zod";
const date = z.iso.date();
const id = z.uuid();
export const wellnessSchema = z.object({
  athlete_id: id,
  date,
  sleep_hours: z.number().min(0).max(24),
  sleep_quality: z.number().int().min(0).max(10),
  fatigue: z.number().int().min(0).max(10),
  soreness: z.number().int().min(0).max(10),
  stress: z.number().int().min(0).max(10),
  appetite: z.number().int().min(0).max(10),
  weight: z.number().min(20).max(300),
  comment: z.string().max(2000),
  pain: z
    .array(
      z.object({
        body_part: z.string().min(1).max(100),
        severity: z.number().int().min(0).max(10),
      }),
    )
    .max(20),
});
export const rpeSchema = z
  .object({
    athlete_id: id,
    session_id: id,
    status: z.enum([
      "attended",
      "rehabilitation",
      "absent",
      "rest",
      "not_participating",
    ]),
    minutes: z.number().int().min(0).max(600),
    rpe: z.number().min(0).max(10).nullable(),
  })
  .refine(
    (v) => !["attended", "rehabilitation"].includes(v.status) || v.rpe !== null,
    { message: "RPE required for participation" },
  );
export const sessionSchema = z
  .object({
    code: z.string().min(1).max(30),
    date,
    team_id: id,
    type: z.enum(["Field", "Gym", "Rehabilitation", "Match", "Other"]),
    start_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    end_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    duration: z.number().int().min(0).max(600),
    athlete_ids: z.array(id).min(1),
  })
  .refine((v) => v.end_time > v.start_time, {
    message: "End time must follow start time",
  });

export const sessionWriteSchema = sessionSchema.safeExtend({
  id: id.optional(),
});
