import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRoles } from "../../middleware/rbac";
import {
  bootstrapSchema,
  bootstrapSuperAdminHandler,
  changePasswordHandler,
  changePasswordSchema,
  forgotPasswordHandler,
  forgotPasswordSchema,
  loginHandler,
  loginSchema,
  patchApplicationSchema,
  patchMyApplication,
  register,
  registerStaffSchema,
  registerTrainee,
  registerTraineeSchema,
  resetPasswordHandler,
  resetPasswordSchema,
} from "../../controllers/authController";
import { getMe } from "../../controllers/meController";
import {
  listStaff,
  reviewStaff,
  staffReviewBodySchema,
  staffIdParamsSchema,
} from "../../controllers/staffController";
import { upload } from "../../middleware/upload";
import {
  certificateSchema,
  certificateBase64Schema,
  getStaffProfile,
  listProfileChangeRequests,
  livePhotoBase64Schema,
  profileUpdateSchema,
  requestStaffProfileUpdate,
  reviewSchema,
  reviewStaffProfileUpdate,
  staffIdParamsSchema as staffProfileStaffIdParamsSchema,
  uploadCertificate,
  uploadCertificateBase64,
  uploadLivePhoto,
  uploadLivePhotoBase64,
} from "../../controllers/staffProfileController";
import { listLogsHandler, statusLogListSchema } from "../../controllers/statusLogController";
import {
  addStock,
  closeMaintenanceHandler,
  createItem,
  createItemSchema,
  currentReport,
  damageStock,
  deleteItem,
  issueStock,
  itemIdParamsSchema,
  listItems,
  maintenanceCloseSchema,
  maintenanceStartSchema,
  movementSchema,
  replaceStock,
  updateItem,
  updateItemSchema,
  startMaintenanceHandler,
} from "../../controllers/stockController";
import {
  assignHandler,
  assignSchema,
  dailyReportHandler,
  dailySchema,
  getHandler,
  listHandler,
  listSchema,
  reviewHandler,
  reviewSchema as workReviewSchema,
  submitHandler,
  submitSchema,
  uploadAttachmentHandler,
  workIdParamsSchema,
} from "../../controllers/workController";
import {
  createUserHandler,
  createUserSchema,
  getCreatableRolesHandler,
  listUsersHandler,
  listUsersSchema,
  promoteUserHandler,
  promoteUserSchema,
} from "../../controllers/userController";
import {
  assignUserSchema,
  assignUserToTeamHandler,
  createTeamHandler,
  createTeamSchema,
  getTeamHandler,
  listTeamsHandler,
  teamIdParamsSchema,
  updateTeamHandler,
  updateTeamSchema,
} from "../../controllers/teamController";
import { CANDIDATE_REVIEWER_ROLES, USER_CREATOR_ROLES } from "../../utils/roleHierarchy";

export const v1Router = Router();

v1Router.get("/health", (_req, res) => {
  res.json({
    status: true,
    statusCode: 200,
    message: "API is healthy.",
    data: { version: "v1" },
  });
});

// ----- Auth (public self-registration for STAFF / TRAINEE only) -----
v1Router.post("/auth/bootstrap-super-admin", bootstrapSchema, bootstrapSuperAdminHandler);
v1Router.post("/auth/register/staff", registerStaffSchema, register);
v1Router.post("/auth/register/trainee", registerTraineeSchema, registerTrainee);
v1Router.post("/auth/login", loginSchema, loginHandler);
v1Router.post("/auth/forgot-password", forgotPasswordSchema, forgotPasswordHandler);
v1Router.post("/auth/reset-password", resetPasswordSchema, resetPasswordHandler);
v1Router.post("/auth/change-password", requireAuth, changePasswordSchema, changePasswordHandler);

// ----- Me -----
v1Router.get("/me", requireAuth, getMe);
v1Router.patch("/me/application", requireAuth, patchApplicationSchema, patchMyApplication);

// ----- Users (admin / HR / manager creates HR / Manager / TL / Cashier / Captain / Accountant) -----
v1Router.post(
  "/users",
  requireAuth,
  requireRoles(USER_CREATOR_ROLES),
  createUserSchema,
  createUserHandler,
);
v1Router.get("/users", requireAuth, listUsersSchema, listUsersHandler);
v1Router.get("/users/creatable-roles", requireAuth, getCreatableRolesHandler);
v1Router.post(
  "/users/:id/promote",
  requireAuth,
  requireRoles(USER_CREATOR_ROLES),
  promoteUserSchema,
  promoteUserHandler,
);

// ----- Teams -----
v1Router.post(
  "/teams",
  requireAuth,
  requireRoles(["SUPER_ADMIN", "ADMIN", "HR"]),
  createTeamSchema,
  createTeamHandler,
);
v1Router.get(
  "/teams",
  requireAuth,
  requireRoles(["SUPER_ADMIN", "ADMIN", "HR", "MANAGER", "TL", "CAPTAIN"]),
  listTeamsHandler,
);
v1Router.get(
  "/teams/:id",
  requireAuth,
  requireRoles(["SUPER_ADMIN", "ADMIN", "HR", "MANAGER", "TL", "CAPTAIN"]),
  teamIdParamsSchema,
  getTeamHandler,
);
v1Router.put(
  "/teams/:id",
  requireAuth,
  requireRoles(["SUPER_ADMIN", "ADMIN", "HR"]),
  teamIdParamsSchema,
  updateTeamSchema,
  updateTeamHandler,
);
v1Router.post(
  "/teams/assign-user",
  requireAuth,
  requireRoles(["SUPER_ADMIN", "ADMIN", "HR", "MANAGER"]),
  assignUserSchema,
  assignUserToTeamHandler,
);

// ----- Staff approval + listing -----
v1Router.get(
  "/staff",
  requireAuth,
  requireRoles(["SUPER_ADMIN", "ADMIN", "HR", "MANAGER", "TL"]),
  listStaff,
);
v1Router.post(
  "/staff/:id/review",
  requireAuth,
  requireRoles(CANDIDATE_REVIEWER_ROLES),
  staffIdParamsSchema,
  staffReviewBodySchema,
  reviewStaff,
);

// ----- Staff profile -----
v1Router.get("/staff/:id/profile", requireAuth, staffProfileStaffIdParamsSchema, getStaffProfile);
v1Router.put(
  "/staff/:id/profile",
  requireAuth,
  staffProfileStaffIdParamsSchema,
  profileUpdateSchema,
  requestStaffProfileUpdate,
);
v1Router.post(
  "/staff/:id/photo",
  requireAuth,
  staffProfileStaffIdParamsSchema,
  upload.single("photo"),
  uploadLivePhoto,
);
v1Router.post(
  "/staff/:id/photo/base64",
  requireAuth,
  staffProfileStaffIdParamsSchema,
  livePhotoBase64Schema,
  uploadLivePhotoBase64,
);
v1Router.post(
  "/staff/:id/documents",
  requireAuth,
  staffProfileStaffIdParamsSchema,
  certificateSchema,
  upload.single("document"),
  uploadCertificate,
);
v1Router.post(
  "/staff/:id/documents/base64",
  requireAuth,
  staffProfileStaffIdParamsSchema,
  certificateBase64Schema,
  uploadCertificateBase64,
);

// ----- Profile change requests (HR included) -----
v1Router.get(
  "/profile-change-requests",
  requireAuth,
  requireRoles(["SUPER_ADMIN", "ADMIN", "HR"]),
  listProfileChangeRequests,
);
v1Router.post(
  "/profile-change-requests/:id/review",
  requireAuth,
  requireRoles(["SUPER_ADMIN", "ADMIN", "HR"]),
  reviewSchema,
  reviewStaffProfileUpdate,
);

// ----- Stock items (catalogue management: SUPER / ADMIN only) -----
v1Router.post(
  "/stock/items",
  requireAuth,
  requireRoles(["SUPER_ADMIN", "ADMIN"]),
  createItemSchema,
  createItem,
);
v1Router.get(
  "/stock/items",
  requireAuth,
  requireRoles(["SUPER_ADMIN", "ADMIN", "MANAGER", "TL", "CAPTAIN", "ACCOUNTANT"]),
  listItems,
);
v1Router.put(
  "/stock/items/:id",
  requireAuth,
  requireRoles(["SUPER_ADMIN", "ADMIN"]),
  itemIdParamsSchema,
  updateItemSchema,
  updateItem,
);
v1Router.delete(
  "/stock/items/:id",
  requireAuth,
  requireRoles(["SUPER_ADMIN", "ADMIN"]),
  itemIdParamsSchema,
  deleteItem,
);

// ----- Stock movements (operations: SUPER / ADMIN / MANAGER / TL / CAPTAIN) -----
const STOCK_OP_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "TL", "CAPTAIN"] as const;

v1Router.post(
  "/stock/movements/add",
  requireAuth,
  requireRoles([...STOCK_OP_ROLES]),
  movementSchema,
  addStock,
);
v1Router.post(
  "/stock/movements/issue",
  requireAuth,
  requireRoles([...STOCK_OP_ROLES]),
  movementSchema,
  issueStock,
);
v1Router.post(
  "/stock/movements/damage",
  requireAuth,
  requireRoles([...STOCK_OP_ROLES]),
  movementSchema,
  damageStock,
);
v1Router.post(
  "/stock/movements/replace",
  requireAuth,
  requireRoles([...STOCK_OP_ROLES]),
  movementSchema,
  replaceStock,
);
v1Router.post(
  "/stock/maintenance/start",
  requireAuth,
  requireRoles([...STOCK_OP_ROLES]),
  maintenanceStartSchema,
  startMaintenanceHandler,
);
v1Router.post(
  "/stock/maintenance/close",
  requireAuth,
  requireRoles([...STOCK_OP_ROLES]),
  maintenanceCloseSchema,
  closeMaintenanceHandler,
);

v1Router.get(
  "/stock/reports/current",
  requireAuth,
  requireRoles([...STOCK_OP_ROLES, "ACCOUNTANT"]),
  currentReport,
);

// ----- Work dashboard -----
const WORK_REVIEWER_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "TL", "CAPTAIN"] as const;

v1Router.post(
  "/work",
  requireAuth,
  requireRoles([...WORK_REVIEWER_ROLES]),
  assignSchema,
  assignHandler,
);
v1Router.get("/work", requireAuth, listSchema, listHandler);
v1Router.get("/work/:id", requireAuth, workIdParamsSchema, getHandler);
v1Router.post(
  "/work/:id/attachments",
  requireAuth,
  workIdParamsSchema,
  upload.single("file"),
  uploadAttachmentHandler,
);
v1Router.post("/work/:id/submit", requireAuth, workIdParamsSchema, submitSchema, submitHandler);
v1Router.post(
  "/work/:id/review",
  requireAuth,
  requireRoles([...WORK_REVIEWER_ROLES]),
  workIdParamsSchema,
  workReviewSchema,
  reviewHandler,
);
v1Router.get(
  "/work/reports/daily",
  requireAuth,
  requireRoles([...WORK_REVIEWER_ROLES, "HR"]),
  dailySchema,
  dailyReportHandler,
);

// ----- Status logs (audit trail) -----
v1Router.get(
  "/status-logs",
  requireAuth,
  requireRoles(["SUPER_ADMIN", "ADMIN", "HR", "MANAGER", "TL"]),
  statusLogListSchema,
  listLogsHandler,
);
