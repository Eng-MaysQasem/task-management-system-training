const {z} = require("zod");
const {viewEnum, Priority, TicketStatus,sortEnum} = require("../../Enums/enums");
const {bigIntIdSchema} = require("../../utils/schema.utils")

const statusSchema = z.preprocess((value) => {
    if (typeof value === "string" && value.includes(",")) {
        return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
    return value;
}, z.union([
    z.enum(Object.values(TicketStatus)),
    z.array(z.enum(Object.values(TicketStatus))).nonempty(),
]));

const getTicketsSchema = z.object({
    view: z.enum(Object.values(viewEnum)).optional(),
    status: statusSchema.optional(),
    priority: z.enum(Object.values(Priority)).optional(),
    sortBy: z.enum(Object.values(sortEnum)).optional(),
    search:z.string().trim().max(100).optional(),
    assignee: z.coerce.number().int().positive().optional(),
    projectId: bigIntIdSchema.optional(),
    sprintId: bigIntIdSchema.optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    deletedOnly: z.coerce.boolean().optional(),
    includeDeleted: z.coerce.boolean().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(20).default(20),
}).refine((data) => {
    if (data.startDate && data.endDate) return data.startDate <= data.endDate;
    return true;
}, {
    message: "Start date must be before end date",
    path: ["startDate"]
});

module.exports = {
    getTicketsSchema
}