const { z } = require("zod");
const { addTicketSchema } = require("./addTicket.schema");
const { bigIntIdSchema } = require("../../utils/schema.utils");
const { TicketStatus } = require("../../../prisma/generated");
const updateTicketSchema = addTicketSchema
  .omit({ projectId: true })
  .partial();
const updateTicketParamSchema = z
  .object({
    id: bigIntIdSchema,
  })
  .strict();

const updateTicketStatusSchema = z
  .object({
    status: z.enum(Object.values(TicketStatus)),
  })
  .strict();

module.exports = {
  updateTicketSchema,
  updateTicketParamSchema,
  updateTicketStatusSchema,
};
