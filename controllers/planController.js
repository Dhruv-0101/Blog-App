const asyncHandler = require("express-async-handler");
const db = require("../models/index");
const Plan = db.plans;

const createPlan = asyncHandler(async (req, res) => {
  const userId = req.user;
  const { planName, features, price } = req.body;

  const planFound = await Plan.findOne({ where: { planName } });
  if (planFound) {
    throw new Error("Plan already exists");
  }

  const planCount = await Plan.count();
  if (planCount >= 2) {
    throw new Error("You cannot add more than two plans");
  }

  const planCreated = await Plan.create({
    planName,
    features: features.split(","),
    price,
    userId: userId,
  });

  // Send the response
  res.json({
    status: "success",
    message: "Plan created successfully",
    planCreated,
  });
});

const listPlans = asyncHandler(async (req, res) => {
  const plans = await Plan.findAll();
  res.json({
    status: "success",
    message: "Plans fetched successfully",
    plans: plans,
  });
});

module.exports = { createPlan, listPlans };
