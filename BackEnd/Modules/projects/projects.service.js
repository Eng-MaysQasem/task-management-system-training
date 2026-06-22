const prisma = require("../prismaClient");
const { COMPLETED_STATUSES } = require("../Enums/enums");

const resolveIsActive = ({ isActive, startDate, endDate }) => {
  if (typeof isActive === "boolean") {
    return isActive;
  }

  if (startDate && endDate) {
    const now = new Date();
    return startDate.getTime() <= now.getTime() && now.getTime() <= endDate.getTime();
  }

  return true;
};

const serializeProject = (project) => ({
  ...project,
  id: project.id.toString(),
});

const getProjectTaskCounts = async () => {
  const [totalCounts, completedCounts] = await Promise.all([
    prisma.ticket.groupBy({
      by: ["projectId"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.ticket.groupBy({
      by: ["projectId"],
      where: {
        deletedAt: null,
        status: { in: COMPLETED_STATUSES },
      },
      _count: { _all: true },
    }),
  ]);

  const totalMap = new Map(
    totalCounts.map((row) => [row.projectId.toString(), row._count._all]),
  );
  const completedMap = new Map(
    completedCounts.map((row) => [row.projectId.toString(), row._count._all]),
  );

  return { totalMap, completedMap };
};

const buildProjectData = (project, taskCounts = {}) => ({
  ...serializeProject(project),
  tasksDone: taskCounts.done ?? 0,
  totalTasks: taskCounts.total ?? 0,
});

const resolveProjectDatesAndStatus = (payload, existingProject = {}) => {
  const startDate = payload.startDate ?? existingProject.startDate ?? null;
  const endDate = payload.endDate ?? existingProject.endDate ?? null;

  return {
    startDate,
    endDate,
    isActive:
      typeof payload.isActive === "boolean"
        ? payload.isActive
        : startDate && endDate
          ? startDate.getTime() <= Date.now() && Date.now() <= endDate.getTime()
          : true,
  };
};

const createProject = async (payload, actor) => {
  // Non-premium users should be limited to 2 projects when ownership tracking is added.
  // const projectCount = await prisma.project.count({
  //   where: { ownerId: BigInt(actor.id) },
  // });
  // if (actor.plan !== "PREMIUM" && projectCount >= 2) {
  //   const err = new Error("Free plan project limit reached");
  //   err.status = 403;
  //   throw err;
  // }
  
  const { startDate, endDate, isActive } = resolveProjectDatesAndStatus(payload);

  const data = {
    name: payload.name,
    description: payload.description ?? null,
    startDate,
    endDate,
    isActive,
  };

  const project = await prisma.project.create({
    data,
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return serializeProject(project);
};

const updateProject = async (id, payload, actor) => {
  if (actor?.role !== "ADMIN") {
    const err = new Error("Admin Access Only");
    err.status = 403;
    throw err;
  }

  const currentProject = await prisma.project.findUnique({
    where: { id: BigInt(id) },
  });

  if (!currentProject) {
    const err = new Error("Project not found");
    err.status = 404;
    throw err;
  }

  const { startDate, endDate, isActive } = resolveProjectDatesAndStatus(
    payload,
    currentProject,
  );

  const data = {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.description !== undefined
      ? { description: payload.description }
      : {}),
    ...(payload.startDate !== undefined ? { startDate } : {}),
    ...(payload.endDate !== undefined ? { endDate } : {}),
    ...(payload.isActive !== undefined ? { isActive } : { isActive }),
  };

  const updatedProject = await prisma.project.update({
    where: { id: BigInt(id) },
    data,
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return serializeProject(updatedProject);
};

const listProjects = async (actor, pagination = {}) => {
  if (!actor) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }

  const page = Number(pagination.page ?? 1);
  const limit = Number(pagination.limit ?? 20);
  const skip = (page - 1) * limit;

  const [projects, total, taskCounts] = await Promise.all([
    prisma.project.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.project.count(),
    getProjectTaskCounts(),
  ]);

  const items = projects.map((project) => {
    const projectId = project.id.toString();
    return buildProjectData(project, {
      total: taskCounts.totalMap.get(projectId) ?? 0,
      done: taskCounts.completedMap.get(projectId) ?? 0,
    });
  });

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

const deleteProject = async (id, actor) => {
  const project = await prisma.project.findUnique({
    where: { id: BigInt(id) },
  });

  if (!project) {
    const err = new Error("Project not found");
    err.status = 404;
    throw err;
  }

  return await prisma.$transaction(async (tx) => {
    await tx.ticket.deleteMany({
      where: { projectId: BigInt(id) },
    });

    await tx.sprint.deleteMany({
      where: { projectId: BigInt(id) },
    });

    const deleted = await tx.project.delete({
      where: { id: BigInt(id) },
    });

    return deleted;
  });
};

module.exports = {
  createProject,
  updateProject,
  listProjects,
  deleteProject,
  resolveIsActive,
  serializeProject,
};