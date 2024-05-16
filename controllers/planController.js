const asyncHandler = require("express-async-handler");
const db = require("../models/index");
const Plan = db.plans;

const createPlan = asyncHandler(async (req, res) => {
  const { planName, features, price } = req.body;

  // Check if plan exists
  const planFound = await Plan.findOne({ where: { planName } });
  if (planFound) {
    throw new Error("Plan already exists");
  }

  // Check if total plans are two
  const planCount = await Plan.count();
  if (planCount >= 2) {
    throw new Error("You cannot add more than two plans");
  }

  // Create the plan
  const planCreated = await Plan.create({
    planName,
    features: features.split(","), 
    price,
    userId: req.user,
  });

  // Send the response
  res.json({
    status: "success",
    message: "Plan created successfully",
    planCreated,
  });
});

module.exports = { createPlan };
