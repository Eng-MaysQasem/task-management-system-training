const express = require("express");
const router = express.Router();

const authMiddleware = require("../Middlewares/auth.middleware");
const isAdmin = require("../Middlewares/isAdmin.middleware");
const validate = require("../Middlewares/validation");
const projectController = require("./projects.controller");
const createProjectSchema = require("./schema/createProject.schema");
const {
  updateProjectSchema,
  updateProjectParamSchema,
} = require("./schema/updateProject.schema");
const { paginationSchema } = require("../utils/schema.utils");

router.use(authMiddleware);

router.get("", validate({ query: paginationSchema }), projectController.listProjects);

router.post(
  "/",
  isAdmin,
  validate({ body: createProjectSchema }),
  projectController.createProject,
);

router.patch(
  "/:id",
  isAdmin,
  validate({ params: updateProjectParamSchema, body: updateProjectSchema }),
  projectController.updateProject,
);

router.delete(
  "/:id",
  isAdmin,
  validate({ params: updateProjectParamSchema }),
  projectController.deleteProject,
);

module.exports = router;