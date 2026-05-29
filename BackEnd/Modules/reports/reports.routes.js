const express = require("express");
const router = express.Router();
const validate = require("../Middlewares/validation");
const {
  adminReportSchema,
  adminExportSchema,
  userReportSchema,
} = require("./schema/reports.schema");
const isAdmin = require("../Middlewares/isAdmin.middleware");
const isPremium = require("../Middlewares/isPremium.middleware")
const authMiddleware = require("../Middlewares/auth.middleware");
const reportsController = require("./reports.controller")

router.use(authMiddleware)
router.get(
  "/admin",
  isAdmin,
  //isPremium,
  validate({ query: adminReportSchema }),
  reportsController.getAdminReport,
);

router.get(
  "/admin/export",
  isAdmin,
 // isPremium,
  validate({ query: adminExportSchema }),
  reportsController.getAdminReportExport,
);

router.get(
  "/me",
  validate({ query: userReportSchema }),
  reportsController.getMyReport,
);


module.exports = router;