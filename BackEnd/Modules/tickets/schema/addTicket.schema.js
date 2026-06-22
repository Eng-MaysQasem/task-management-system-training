const { z } = require("zod");
const { TicketStatus, Priority } = require("../../../prisma/generated");
const { bigIntIdSchema } = require("../../utils/schema.utils");

const addTicketSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  description: z.string().max(10000, "description too long").optional(),
  projectId: bigIntIdSchema,
  status: z.enum(Object.values(TicketStatus)).optional(),
  priority: z.enum(Object.values(Priority)).optional(),
  deadline: z
    .string()
    .datetime({ message: "Invalid ISO date string" })
    .optional()
    .nullable(),
  assigneeId: bigIntIdSchema.optional().nullable(),
  sprintId: bigIntIdSchema.optional().nullable(),
}) .strict();

module.exports = {
    addTicketSchema,
}
