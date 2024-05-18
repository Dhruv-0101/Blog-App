const planController = require("../../controllers/planController");
const isAuthenticated = require("../../middleware/isAuthenticated");

const PlanRouter = require("express").Router();

PlanRouter.post("/create-plan", isAuthenticated, planController.createPlan);
PlanRouter.get("/get-plan", planController.listPlans);

module.exports = PlanRouter;
