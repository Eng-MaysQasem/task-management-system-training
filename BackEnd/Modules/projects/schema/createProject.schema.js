const { z } = require("zod");

const isoDateSchema = z
  .string()
  .datetime({ message: "Date must be a valid ISO-8601 string" })
  .transform((value) => new Date(value));

const createProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: "Name is required" })
      .max(100, { message: "Name must be at most 100 characters long" }),
    description: z.string().trim().optional().nullable(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.startDate > data.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "endDate must be greater than or equal to startDate",
      });
    }
  });

module.exports = createProjectSchema;