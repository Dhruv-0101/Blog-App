const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const asyncHandler = require("express-async-handler");
const db = require("../models/index");
const Plan = db.plans;
const Payment = db.payments;
const User = db.users;

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

const createPayment = async (userId, planId) => {
  const plan = await Plan.findByPk(planId);
  if (!plan) throw new Error("Plan not found");

  // Calculate the expiration date
  const expirationDate = new Date();
  expirationDate.setMonth(expirationDate.getMonth() + 1);

  // Create a payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: plan.price * 100,
    currency: "usd",
    metadata: { userId, planId },
  });

  // Save payment details to the database
  const payment = await Payment.create({
    userId,
    reference: paymentIntent.id,
    currency: "usd",
    status: "pending",
    planId: planId,
    amount: plan.price,
    expirationDate,
  });

  return { clientSecret: paymentIntent.client_secret, payment };
};

const createPaymentController = async (req, res) => {
  const userId = req.user;
  const planId = req.params.planId;

  if (!userId || !planId) {
    return res.status(400).json({ message: "userId and planId are required" });
  }

  const { clientSecret, payment } = await createPayment(userId, planId);

  return res.status(200).json({ clientSecret, payment });
};

const verifyPaymentController = asyncHandler(async (req, res) => {
  const paymentId = req.params.paymentId;
  console.log(paymentId);

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);
  console.log(paymentIntent);

  if (paymentIntent.status === "succeeded") {
    // Get the data from the metadata
    const metadata = paymentIntent?.metadata;
    console.log(metadata);
    const planId = metadata?.planId;
    console.log(planId);
    const userId = metadata?.userId;
    console.log(userId);
    // Find the user
    const userFound = await User.findByPk(userId);
    if (!userFound) {
      return res.status(404).json({ message: "User not found" });
    }
    console.log(userFound);

    // Get the payment details
    const amount = paymentIntent?.amount / 100;
    const currency = paymentIntent?.currency;

    // Update the existing payment record or create if not exists
    let payment = await Payment.findOne({ where: { reference: paymentId } });
    if (!payment) {
      payment = await Payment.create({
        userId,
        planId,
        status: "success",
        amount,
        currency,
        reference: paymentId,
      });
    } else {
      payment.status = "success";
      await payment.save();
    }

    // Update the user profile
    userFound.hasSelectedPlan = true;
    userFound.planId = planId;
    await userFound.save();

    // Send the response
    res.json({
      status: true,
      message: "Payment verified, user updated",
      user: userFound,
    });
  } else {
    res.status(400).json({ message: "Payment not successful" });
  }
});

const updateUserFreePlan = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user);
  if (!user) {
    return res.status(404).json({ status: false, message: "User not found" });
  }

  user.hasSelectedPlan = true;
  await user.save();

  res.json({
    status: true,
    message: "Payment verified, user updated",
  });
});

module.exports = {
  createPlan,
  listPlans,
  createPaymentController,
  verifyPaymentController,
  updateUserFreePlan
};
