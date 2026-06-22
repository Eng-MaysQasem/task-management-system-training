const { z } = require("zod");
const {
  bigIntIdSchema,
  paginationSchema,
} = require("../../utils/schema.utils");

const sprintShape = {
  name: z
    .string()
    .trim()
    .min(4, "Name is too short")
    .max(100, "Name is too long"),
  projectId: bigIntIdSchema, 
  startDate: z
    .string()
    .datetime({ message: "Invalid ISO date string" })
    .transform((val) => new Date(val)),
  endDate: z
    .string()
    .datetime({ message: "Invalid ISO date string" })
    .transform((val) => new Date(val)),
};

const createSprintSchema = z
  .object(sprintShape)
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after the start date",
    path: ["endDate"],
  })
  .strict();

const updateSprintSchema = z
  .object(sprintShape)
  .omit({"projectId": true})
  .partial()
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate > data.startDate;
      }
      return true;
    },
    {
      message: "End date must be after the start date",
      path: ["endDate"],
    },
  )
  .strict();
const updateSprintParamSchema = z
  .object({
    id: bigIntIdSchema,
  })
  .strict();

const SprintRequestSchema = paginationSchema.extend({
  projectId: bigIntIdSchema.optional(),
}).strict();

module.exports = {
  createSprintSchema,
  updateSprintSchema,
  updateSprintParamSchema,
  SprintRequestSchema,
};
