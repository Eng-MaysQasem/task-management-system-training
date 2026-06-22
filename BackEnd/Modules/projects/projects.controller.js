const projectService = require("./projects.service");

const createProject = async (req, res, next) => {
  try {
    const project = await projectService.createProject(req.body, req.user);

    res.status(201).json({
      success: true,
      data: project,
    });
  } catch (error) {
    next(error);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const project = await projectService.updateProject(id, req.body, req.user);

    res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    next(error);
  }
};

const listProjects = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await projectService.listProjects(req.user, {
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    await projectService.deleteProject(id, req.user);

    res.status(200).json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProject,
  updateProject,
  listProjects,
  deleteProject,
};