require("dotenv").config();
const db = require("../models/index");
const User = db.users;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const passport = require("passport");

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
    res.cookie("token", token, {
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
  console.log(token)
  if (!token) {
    return res.status(401).json({ isAuthenticated: false });
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log(decoded)
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

module.exports = {
  registerUserCtrl,
  login,
  googleAuthMiddleware,
  googleAuthCallback,
  checkAuthenticated,
};
