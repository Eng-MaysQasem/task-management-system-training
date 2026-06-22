const prisma = require("../prismaClient");

const create = async (payload) => {
  return await prisma.sprint.create({
    data: {
      name: payload.name,
      projectId: payload.projectId,
      startDate: payload.startDate,
      endDate: payload.endDate,
      createdAt: new Date(),
      isActive: calculateIsActive(payload.startDate, payload.endDate),
    },
  });
};

const update = async (id, data) => {
  const currentSprint = await prisma.sprint.findUnique({
    where: { id },
    select: { startDate: true, endDate: true },
  });

  if (!currentSprint) {
    const err = new Error("Sprint not found");
    err.status = 404;
    throw err;
  }
  const newStart = data.startDate || currentSprint.startDate;
  const newEnd = data.endDate || currentSprint.endDate;

  if (newStart >= newEnd) {
    const err = new Error("start Date should be before end date");
    err.status = 422;
    throw err;
  }

  const isActive = calculateIsActive(newStart, newEnd);

  return await prisma.sprint.update({
    where: { id },
    data: {
      ...data,
      isActive,
    },
  });
};

const findAll = async (page, limit, user, projectId) => {
  let where = {};
  const ticketsWhere = { deletedAt: null };
  
  if (projectId) {
    where.projectId = projectId;
  }
  
  if (user.role !== "ADMIN") {
    where.tickets = {
      some: {
        assigneeId: BigInt(user.id),
        deletedAt: null,
      },
    };
    ticketsWhere.assigneeId = BigInt(user.id);
  }

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.sprint.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        name: true,
        projectId: true,
        startDate: true,
        endDate: true,
        isActive: true,
        _count: {
          select: { tickets: { where: ticketsWhere } },
        },
      },
    }),
    prisma.sprint.count({ where }),
  ]);

  return {
    items,
    paginationMeta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    },
  };
};

const findOne = async (id, user) => {
  const ticketsWhere = { deletedAt: null };

  if (user.role !== "ADMIN") {
    ticketsWhere.assigneeId = BigInt(user.id);
  }
  const sprint = await prisma.sprint.findUnique({
    where: { id },
    include: {
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      tickets: {
        where: ticketsWhere,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          assigneeId: true,
          assignee: { select: { id: true, name: true } },
        },
      },
      _count: {
        select: { tickets: { where: ticketsWhere } },
      },
    },
  });
  if (!sprint) {
    const err = new Error("Sprint not found");
    err.status = 404;
    throw err;
  }
  if (user.role !== "ADMIN" && sprint.tickets.length === 0) {
    const err = new Error(
      "Access Denied: You are not assigned to any tickets in this sprint.",
    );
    err.status = 403;
    throw err;
  }

  return sprint;
};

const remove = async (id) => {
  const sprint = await prisma.sprint.findUnique({
    where: { id },
  });

  if (!sprint) {
    const err = new Error("Sprint not found");
    err.status = 404;
    throw err;
  }
  return await prisma.sprint.delete({
    where: { id },
  });
};

const calculateIsActive = (start, end) => {
  const now = new Date();
  const startDate = new Date(start);
  const endDate = new Date(end);
  return now >= startDate && now <= endDate;
};

module.exports = {
  create,
  update,
  findAll,
  findOne,
  remove,
};
