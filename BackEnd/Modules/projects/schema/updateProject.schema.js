const { z } = require("zod");
const { bigIntIdSchema } = require("../../utils/schema.utils");

const isoDateSchema = z
  .string()
  .datetime({ message: "Date must be a valid ISO-8601 string" })
  .transform((value) => new Date(value));

const updateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: "Name is required" })
      .max(100, { message: "Name must be at most 100 characters long" })
      .optional(),
    description: z.string().trim().nullable().optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.startDate > data.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "endDate must be greater than or equal to startDate",
      });
    }
  });

const updateProjectParamSchema = z
  .object({
    id: bigIntIdSchema,
  })
  .strict();

module.exports = {
  updateProjectSchema,
  updateProjectParamSchema,
};