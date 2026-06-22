const prisma = require("../prismaClient");
const { startOfDay, endOfDay } = require("../reports/utils/report.utils");
const { audit } = require("../utils/audit");
const { AuditAction } = require("../../prisma/generated");

const getTickets = async (filters) => {
  const {
    user,
    view,
    status,
    assignee,
    projectId,
    priority,
    startDate,
    endDate,
    page,
    limit,
    sortBy,
    search,
    deletedOnly,
    includeDeleted,
    sprintId,
  } = filters;
  const user_id = BigInt(user.id);
  const where = {};
  const resolvedSortBy = sortBy || (deletedOnly ? "deletedAt" : "deadline");

  if (deletedOnly && user.role === "ADMIN") {
    where.deletedAt = { not: null };
  } else if (!includeDeleted && user.role === "ADMIN") {
    where.deletedAt = null;
  }

  if (user.role !== "ADMIN") {
    where.OR = [
      { sprintId: { not: null }, assigneeId: user_id },
      { status: "SCOPED_BACKLOG", assigneeId: user_id },
    ];
    where.deletedAt = null;
  } else {
    if (assignee) where.assigneeId = BigInt(assignee);
  }
  if (projectId) {
    where.projectId = BigInt(projectId);
  }
  if (sprintId) {
    where.sprintId = BigInt(sprintId);
  } else if (view === "sprint") {
    where.sprintId = { not: null };
  }
  const statusList = Array.isArray(status) ? status : null;
  if (view === "scoped" && !status) where.status = "SCOPED_BACKLOG";
  if (statusList?.length) {
    where.status = { in: statusList };
  } else if (status) {
    where.status = status;
  }
  if (priority) where.priority = priority;
  if ((startDate || endDate) && filters.deletedOnly) {
    where.deletedAt = {};
    if (startDate) where.deletedAt.gte = startOfDay(startDate);
    if (endDate) where.deletedAt.lte = endOfDay(endDate);
  } else if (startDate || endDate) {
    where.deadline = {};
    if (startDate) where.deadline.gte = startOfDay(startDate);
    if (endDate) where.deadline.lte = endOfDay(endDate);
  }
  if (search) {
    where.title = {
      contains: search,
    };
  }

  const skip = (page - 1) * limit;
  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [resolvedSortBy]: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        deadline: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        sprint: { select: { id: true, name: true } },
      },
    }),
    prisma.ticket.count({ where }),
  ]);
  return {
    items: tickets,
    paginationMeta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getTicketById = async (id, user) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: BigInt(id) },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      deadline: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
      assigneeId: true,
      project: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      sprint: { select: { id: true, name: true } },
    },
  });

  if (!ticket || ticket.deletedAt) {
    const err = new Error("Ticket not found");
    err.status = 404;
    throw err;
  }

  if (user.role !== "ADMIN") {
    if (ticket.deletedAt) {
      const err = new Error("Forbidden");
      err.status = 403;
      throw err;
    }

    const userId = BigInt(user.id);
    const isAssignedToUser =
      ticket.assigneeId?.toString() === userId.toString();
    const isScopedBacklog = ticket.status === "SCOPED_BACKLOG";
    const isSprintTicket = ticket.sprint?.id != null;

    if (!isAssignedToUser || (!isScopedBacklog && !isSprintTicket)) {
      const err = new Error("Forbidden");
      err.status = 403;
      throw err;
    }
  }

  return {
    items: [ticket],
  };
};

const createTicket = async (payload, actor) => {
  const { sprintId, assigneeId, projectId, ...details } = payload;

  return await prisma.$transaction(async (tx) => {
    // If a sprint is provided, verify it belongs to the same project
    if (sprintId) {
      const sprint = await tx.sprint.findUnique({
        where: { id: sprintId },
        select: { projectId: true },
      });

      if (!sprint) {
        const err = new Error(`Sprint ${sprintId} not found.`);
        err.status = 404;
        throw err;
      }

      if (sprint.projectId !== BigInt(projectId)) {
        const err = new Error(
          `Sprint ${sprintId} does not belong to project ${projectId}.`,
        );
        err.status = 422;
        throw err;
      }
    }

    const ticket = await tx.ticket.create({
      data: {
        ...details,
        project: { connect: { id: projectId } },
        createdBy: { connect: { id: BigInt(actor.id) } },
        assignee: assigneeId ? { connect: { id: assigneeId } } : undefined,
        sprint: sprintId ? { connect: { id: sprintId } } : undefined,
      },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        sprint: { select: { id: true, name: true } },
      },
    });

    await audit({
      ticketId: ticket.id,
      actorId: actor.id,
      actorRole: actor.role,
      action: AuditAction.TICKET_CREATED,
      newValue: {
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        deadline: ticket.deadline,
        projectId: projectId?.toString() ?? null,
        assigneeId: assigneeId?.toString() ?? null,
        sprintId: sprintId?.toString() ?? null,
      },
      tx,
    });

    return ticket;
  });
};

const updateTicket = async (id, payload, actor) => {
  const { assigneeId, sprintId, ...data } = payload;

  const old = await prisma.ticket.findUnique({ where: { id } });

  if (!old) {
    const err = new Error("Ticket not found");
    err.status = 404;
    throw err;
  }
  const effectiveAssigneeId =
    assigneeId === null
      ? null
      : (assigneeId ?? old.assigneeId?.toString() ?? null);
  const effectiveSprintId =
    sprintId === null ? null : (sprintId ?? old.sprintId?.toString() ?? null);
  const changed =
    ("title" in data && data.title !== old.title) ||
    ("description" in data && data.description !== old.description) ||
    ("priority" in data && data.priority !== old.priority) ||
    ("deadline" in data && String(data.deadline) !== String(old.deadline)) ||
    (assigneeId !== undefined &&
      effectiveAssigneeId !== (old.assigneeId?.toString() ?? null)) ||
    (sprintId !== undefined &&
      effectiveSprintId !== (old.sprintId?.toString() ?? null));

  if (!changed) return old;

  if (assigneeId === null) {
    data.assignee = { disconnect: true };
  } else if (assigneeId) {
    data.assignee = { connect: { id: assigneeId } };
  }

  if (sprintId === null) {
    data.sprint = { disconnect: true };
  } else if (sprintId) {
    data.sprint = { connect: { id: sprintId } };
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id },
      data,
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        sprint: { select: { id: true, name: true } },
      },
    });

    await audit({
      ticketId: updated.id,
      actorId: actor.id,
      actorRole: actor.role,
      action: AuditAction.TICKET_UPDATED,
      oldValue: {
        title: old.title,
        description: old.description,
        priority: old.priority,
        deadline: old.deadline,
        projectId: old.projectId?.toString() ?? null,
        assigneeId: old.assigneeId?.toString() ?? null,
        sprintId: old.sprintId?.toString() ?? null,
      },
      newValue: {
        title: updated.title,
        description: updated.description,
        priority: updated.priority,
        deadline: updated.deadline,
        projectId: updated.projectId?.toString() ?? null,
        assigneeId: updated.assigneeId?.toString() ?? null,
        sprintId: updated.sprintId?.toString() ?? null,
      },
      tx,
    });

    return updated;
  });
};

const updateTicketStatus = async (id, status, ticket, actor) => {
  if (ticket.status === status) {
    const err = new Error("Ticket is already in this status");
    err.status = 400;
    throw err;
  }

  if (actor.role !== "ADMIN") {
    const allowed = {
      TODO: ["IN_PROGRESS"],
      IN_PROGRESS: ["DONE"],
    };

    if (!allowed[ticket.status]?.includes(status)) {
      const err = new Error(
        `Cannot transition from ${ticket.status} to ${status}`,
      );
      err.status = 409;
      throw err;
    }
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id: BigInt(id) },
      data: { status },
    });

    await audit({
      ticketId: updated.id,
      actorId: actor.id,
      actorRole: actor.role,
      action: AuditAction.STATUS_CHANGED,
      oldValue: { status: ticket.status },
      newValue: { status },
      tx,
    });

    return updated;
  });
};

const deleteTicket = async (id, actor) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: BigInt(id) } });

  if (!ticket) {
    const err = new Error("Ticket not found");
    err.status = 404;
    throw err;
  }

  if (ticket.deletedAt) {
    const err = new Error("Ticket already deleted");
    err.status = 400;
    throw err;
  }

  return await prisma.$transaction(async (tx) => {
    const deleted = await tx.ticket.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date() },
    });

    await audit({
      ticketId: deleted.id,
      actorId: actor.id,
      actorRole: actor.role,
      action: AuditAction.TICKET_DELETED,
      oldValue: { deletedAt: null },
      newValue: { deletedAt: deleted.deletedAt },
      tx,
    });

    return deleted;
  });
};

const restoreTicket = async (id, actor) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: BigInt(id) } });

  if (!ticket || !ticket.deletedAt) {
    const err = new Error("Ticket not found");
    err.status = 404;
    throw err;
  }

  return await prisma.$transaction(async (tx) => {
    const restored = await tx.ticket.update({
      where: { id: BigInt(id) },
      data: { deletedAt: null },
    });

    await audit({
      ticketId: restored.id,
      actorId: actor.id,
      actorRole: actor.role,
      action: AuditAction.TICKET_RESTORED,
      oldValue: { deletedAt: ticket.deletedAt },
      newValue: { deletedAt: null },
      tx,
    }).catch((err) => console.error("[audit] TICKET_RESTORED failed:", err)); //;

    return restored;
  });
};

const deletePermanent = async (id) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: BigInt(id) } });

  if (!ticket) {
    const err = new Error("Ticket not found");
    err.status = 404;
    throw err;
  }

  if (!ticket.deletedAt) {
    const err = new Error("Ticket is not deleted");
    err.status = 400;
    throw err;
  }

  return await prisma.ticket.delete({
    where: { id: BigInt(id) },
  });
};

const deleteAllPermanent = async () => {
  const result = await prisma.ticket.deleteMany({
    where: {
      deletedAt: { not: null },
    },
  });
  console.log(result);
  return result;
};

const cleanupExpiredTickets = async () => {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);

  const result = await prisma.ticket.deleteMany({
    where: {
      deletedAt: {
        not: null,
        lt: cutoff,
      },
    },
  });

  console.log(`[Cleanup] Permanently deleted ${result.count} expired tickets.`);
  return result;
};

module.exports = {
  getTickets,
  getTicketById,
  createTicket,
  updateTicket,
  updateTicketStatus,
  deleteTicket,
  restoreTicket,
  deletePermanent,
  deleteAllPermanent,
  cleanupExpiredTickets,
};
