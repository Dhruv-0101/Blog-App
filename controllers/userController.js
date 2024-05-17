require("dotenv").config();
const db = require("../models/index");
const User = db.users;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const passport = require("passport");
const FollowUnfollow = db.followunfollow;
const { Op } = require("sequelize"); // Import Op from sequelize

const sendAccVerificationEmail = require("../utils/sendAccVerificationEmail");

const registerUserCtrl = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  // Check if username or email already exist
  const userFound = await User.findOne({ where: { username } });
  if (userFound) {
    throw new Error("User already exists");
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Register the user
  const userRegistered = await User.create({
    username,
    email,
    password: hashedPassword,
  });

  // Send the response
  res.status(201).json({
    status: "success",
    message: "User registered successfully",
    userRegistered,
  });
});

const login = asyncHandler(async (req, res, next) => {
  passport.authenticate("local", async (err, user, info) => {
    if (err) return next(err);

    // Check if user not found
    if (!user) {
      return res.status(401).json({ message: info.message });
    }

    // Generate token
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);

    // Send the response with token
    res
      .cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
      })
      .json({
        status: "success",
        message: "Login Success",
        username: user.username,
        email: user.email,
        id: user.id,
        token: token,
      });
  })(req, res, next);
});

const googleAuthMiddleware = passport.authenticate("google", {
  // scope: ["profile"],
  scope: ["profile", "email"],
});

const googleAuthCallback = asyncHandler(async (req, res, next) => {
  passport.authenticate(
    "google",
    {
      failureRedirect: "/login",
      session: false,
    },
    async (err, user, info) => {
      try {
        if (err) return next(err);
        if (!user) {
          return res.redirect("http://localhost:8080/google-login-error");
        }

        // Generate the token
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
          expiresIn: "3d",
        });

        // Set the token into the cookie
        res.cookie("token", token, {
          httpOnly: true,
          secure: false,
          sameSite: "strict",
          maxAge: 24 * 60 * 60 * 1000, // 1 day
        });

        // Redirect the user to the dashboard
        res.redirect("http://localhost:8080/dashboard");
      } catch (error) {
        next(error);
      }
    }
  )(req, res, next);
});

const checkAuthenticated = async (req, res) => {
  const token = req.cookies["token"];
  console.log(token);
  if (!token) {
    return res.status(401).json({ isAuthenticated: false });
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log(decoded);
  // Find the user
  const user = await User.findByPk(decoded.id);
  if (!user) {
    return res.status(401).json({ isAuthenticated: false });
  } else {
    return res.status(200).json({
      isAuthenticated: true,
      id: user?.id,
      username: user?.username,
      profilePicture: user?.profilePicture,
    });
  }
};

const profile = async (req, res) => {
  const userId = req.user;
  const user = await User.findByPk(userId, {
    include: [{ model: User }],
    attributes: {
      exclude: [
        "password",
        "passwordResetToken",
        "accountVerificationToken",
        "accountVerificationExpires",
        "passwordResetExpires",
      ],
    },
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json({ user });
};

const followUser = asyncHandler(async (req, res) => {
  const userId = req.user;
  const followerId = req.params.followerId;

  if (userId === followerId) {
    res.status(400).json({ message: "You cannot follow yourself" });
  }

  // Check if already following
  const existingFollow = await FollowUnfollow.findOne({
    where: { userId, followerId },
  });

  if (existingFollow) {
    res.status(200).json({ message: "You are already following this user" });
  }

  await FollowUnfollow.create({ userId, followerId });
  res.status(201).json({ message: "Followed successfully" });
});

const unfollowUser = async (req, res) => {
  const userId = req.user;
  const followerId = req.params.followerId;

  const existingFollow = await FollowUnfollow.findOne({
    where: { userId, followerId },
  });
  if (!existingFollow) {
    return res.status(400).json({ message: "You are not following this user" });
  }

  // If the relationship exists, delete it
  await FollowUnfollow.destroy({ where: { userId, followerId } });

  res.status(200).json({ message: "Unfollowed successfully" });
};

const isFollowing = async (userId, followerId) => {
  // Check if the follow relationship exists
  const existingFollow = await FollowUnfollow.findOne({
    where: { userId, followerId },
  });
  return !!existingFollow; // Return true if a record is found, false otherwise
};

const checkFollowing = async (req, res) => {
  const userId = req.user;
  const followerId = req?.params?.followerId;
  console.log(followerId);

  // Check if the user is following the specified follower
  const isUserFollowing = await isFollowing(userId, followerId);
  res
    .status(200)
    .json({ data: userId, following: isUserFollowing, message: "success" });
};

const logout = asyncHandler(async (req, res) => {
  // Clear the token cookie
  res.cookie("token", "", { maxAge: 1 });

  res.status(200).json({ message: "Logout success" });
});

const verifyEmailAccount = asyncHandler(async (req, res) => {
  // Find the logged-in user
  const userId = req.user;
  const user = await User.findByPk(userId);
  if (!user) {
    res.status(404);
    throw new Error("User not found, please login");
  }

  // Check if user email exists
  if (!user.email) {
    res.status(400);
    throw new Error("Email not found");
  }

  // Use the method from the model
  const token = await user.generateAccVerificationToken();

  // Save changes to the user instance
  await user.save();

  // Send the email
  sendAccVerificationEmail(user.email, token);

  res.json({
    message: `Account verification email sent to ${user.email}. Token expires in 10 minutes`,
  });
});

const verifyEmailAcc = asyncHandler(async (req, res) => {
  // Get the token
  const verifyToken = req.params.verifyToken;

  // Convert the token to actual token that has been saved in our db
  const cryptoToken = crypto
    .createHash("sha256")
    .update(verifyToken)
    .digest("hex");

  // Find the user
  const userFound = await User.findOne({
    where: {
      accountVerificationToken: cryptoToken,
      // accountVerificationExpires: {
      //   [Op.gt]: new Date(),
      // },
    },
  });

  if (!userFound) {
    throw new Error("Account verification expires");
  }

  // Update the user field
  userFound.isEmailVerified = true;
  userFound.accountVerificationToken = null;
  userFound.accountVerificationExpires = null;

  // Resave the user
  await userFound.save();

  res.json({ message: "Account successfully verified" });
});
module.exports = {
  registerUserCtrl,
  login,
  googleAuthMiddleware,
  googleAuthCallback,
  checkAuthenticated,
  profile,
  followUser,
  unfollowUser,
  checkFollowing,
  logout,
  verifyEmailAccount,
  verifyEmailAcc,
};
