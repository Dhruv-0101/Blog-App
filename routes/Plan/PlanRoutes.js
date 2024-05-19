const planController = require("../../controllers/planController");
const isAuthenticated = require("../../middleware/isAuthenticated");

const PlanRouter = require("express").Router();

PlanRouter.post("/create-plan", isAuthenticated, planController.createPlan);
PlanRouter.get("/get-plan", planController.listPlans);
PlanRouter.post(
  "/plan-payment/:planId",
  isAuthenticated,
  planController.createPaymentController
);
PlanRouter.post(
  "/plan-payment-verify/:paymentId",
  isAuthenticated,
  planController.verifyPaymentController
);

module.exports = PlanRouter;
