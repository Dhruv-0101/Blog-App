require("dotenv").config();
const db = require("../models/index");
const User = db.users;
const Post = db.posts;
const PostViewer = db.postviewers;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const passport = require("passport");
const FollowUnfollow = db.followunfollow;
const { Op } = require("sequelize"); // Import Op from sequelize
const cbor = require("cbor"); // Add this line

//-------------------for two-step authentication---------------------//
const Challenge = db.challenges;
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");
//-------------------for two-step authentication---------------------//

const sendAccVerificationEmail = require("../utils/sendAccVerificationEmail");
const sendPasswordEmail = require("../utils/sendPasswordEmail");

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
        res.redirect("http://localhost:5173/dashboard");
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

// const verifyEmailAcc = asyncHandler(async (req, res) => {
//   // Get the token
//   const verifyToken = req.params.verifyToken;

//   // Convert the token to actual token that has been saved in our db
//   const cryptoToken = crypto
//     .createHash("sha256")
//     .update(verifyToken)
//     .digest("hex");

//   // Find the user
//   const userFound = await User.findOne({
//     where: {
//       accountVerificationToken: cryptoToken,
//       // accountVerificationExpires: {
//       //   [Op.gt]: new Date(),
//       // },
//     },
//   });

//   if (!userFound) {
//     throw new Error("Account verification expires");
//   }

//   // Update the user field
//   userFound.isEmailVerified = true;
//   userFound.accountVerificationToken = null;
//   userFound.accountVerificationExpires = null;

//   // Resave the user
//   await userFound.save();

//   res.json({ message: "Account successfully verified" });
// });
const verifyEmailAcc = asyncHandler(async (req, res) => {
  // Get the user ID from the request parameters
  const userId = req.user;
  // Get the token from the request parameters
  const verifyToken = req.params.verifyToken;

  // Find the user by the user ID
  const userFound = await User.findByPk(userId);

  // If the user is not found, handle it gracefully
  if (!userFound) {
    return res.status(400).json({ message: "User not found" });
  }

  // If the user's email is already verified, send a success response
  if (userFound.isEmailVerified) {
    return res.json({ message: "Account already verified" });
  }

  // Convert the token to the format saved in the database
  const cryptoToken = crypto
    .createHash("sha256")
    .update(verifyToken)
    .digest("hex");

  // Check if the token matches the saved token and is not expired
  if (
    userFound.accountVerificationToken !== cryptoToken ||
    userFound.accountVerificationExpires < new Date()
  ) {
    return res.status(400).json({
      message: "Account verification token is invalid or has expired",
    });
  }

  // Update the user's verification status
  userFound.isEmailVerified = true;
  userFound.accountVerificationToken = null;
  userFound.accountVerificationExpires = null;

  // Save the updated user data
  await userFound.save();

  // Send a success response
  res.json({ message: "Account successfully verified" });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Find the user by email
  const user = await User.findOne({ where: { email } });
  if (!user) {
    throw new Error(`User with email ${email} is not found in our database`);
  }

  // Check if user registered with a social login
  if (user.authMethod !== "local") {
    throw new Error("Please login with your social account");
  }

  // Generate a password reset token
  const token = await user.generatePasswordResetToken();

  // Save the updated user
  await user.save();

  // Send the password reset email
  sendPasswordEmail(user.email, token);

  res.json({
    message: `Password reset email sent to ${email}`,
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const verifyToken = req.params.verifyToken;
  const { password } = req.body;

  const cryptoToken = crypto
    .createHash("sha256")
    .update(verifyToken)
    .digest("hex");

  const userFound = await User.findOne({
    where: {
      passwordResetToken: cryptoToken,
      passwordResetExpires: { [Op.gt]: Date.now() },
    },
  });

  if (!userFound) {
    throw new Error("Password reset token is invalid or has expired");
  }

  // Hash the new password
  const salt = await bcrypt.genSalt(10);
  userFound.password = await bcrypt.hash(password, salt);
  userFound.passwordResetToken = null;
  userFound.passwordResetExpires = null;

  // Save the updated user data
  await userFound.save();

  // Send a success response
  res.json({ message: "Password successfully reset" });
});

const updateProfilePic = asyncHandler(async (req, res) => {
  const userId = req.user;

  const [updatedRowsCount] = await User.update(
    { profilePicture: req.file.path },
    { where: { id: userId } }
  );

  if (updatedRowsCount === 0) {
    throw new Error("User not found or profile picture not updated");
  }

  // Send the success response
  res.json({
    message: "Profile picture updated successfully",
  });
});

const updateEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const userId = req.user;

  const user = await User.findByPk(userId);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  user.email = email;
  user.isEmailVerified = false;

  await user.save();

  const token = await user.generateAccVerificationToken();

  // Send the verification email
  sendAccVerificationEmail(user.email, token);

  await user.save();

  // Send the response
  res.json({
    message: `Account verification email sent to ${user.email}, token expires in 10 minutes`,
  });
});

const GetFollowers = async (req, res) => {
  const userId = req.user;

  const user = await User.findOne({
    where: { id: userId },
    include: [
      {
        model: User,
        as: "following",
        attributes: ["id", "username", "email", "profilePicture"],
        through: { attributes: [] },
      },
    ],
  });

  res.status(200).json({ followers: user.following });
};

const getFollowingByUserId = async (req, res) => {
  const userId = req.user;

  const user = await User.findByPk(userId, {
    include: {
      model: User,
      as: "followers",
      attributes: ["id", "username", "profilePicture", "email"],
      through: { attributes: [] },
    },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.status(200).json({ following: user.followers });
};

const getFollowersCount = asyncHandler(async (req, res) => {
  const userId = req.user;

  // Count followers for the given user
  const followersCount = await FollowUnfollow.count({
    where: { followerId: userId },
  });

  // Return the count of followers
  return res.status(200).json({ followersCount });
});
const getFollowingsCount = asyncHandler(async (req, res) => {
  const userId = req.user;

  // Count followers for the given user
  const followersCount = await FollowUnfollow.count({
    where: { userId: userId },
  });

  // Return the count of followers
  return res.status(200).json({ followersCount: followersCount });
});

// //for last day of the month
// // const calculateEarnings = async (req, res) => {
// //   const userId = req.user;

// //   try {
// //     // Get the start date of the current month and the last date of the current month
// //     const currentMonthStart = new Date(
// //       new Date().getFullYear(),
// //       new Date().getMonth(),
// //       1
// //     );
// //     const currentMonthEnd = new Date(
// //       new Date().getFullYear(),
// //       new Date().getMonth() + 1,
// //       0 // Setting day to 0 gives the last day of the previous month, which is the last day of the current month
// //     );

// //     // Retrieve all posts belonging to the user
// //     const posts = await Post.findAll({ where: { userId } });

// //     // Initialize responseData for the report
// //     const responseData = [];

// //     // Iterate over each post
// //     for (const post of posts) {
// //       // Find all views for the post within the current month
// //       const viewsThisMonth = await PostViewer.findAll({
// //         where: {
// //           postId: post.id,
// //           createdAt: {
// //             [Op.between]: [currentMonthStart, currentMonthEnd],
// //           },
// //         },
// //       });

// //       // Calculate the total views count for the current month
// //       const viewsCount = viewsThisMonth.length;

// //       // Calculate monthly earnings based on the views count
// //       const earningPerView = 0.01; // Example earning rate
// //       const monthlyEarnings = viewsCount * earningPerView;

// //       // Update the post with the calculated earnings for the current month
// //       await post.update({
// //         thisMonthEarnings: monthlyEarnings,
// //         viewsCount: post.viewsCount + viewsCount,
// //         lastCalculatedViewsCount: viewsCount,
// //       });

// //       // Check if today is the last day of the month
// //       const today = new Date();
// //       if (today.getDate() === currentMonthEnd.getDate()) {
// //         // Update the total earnings for the post if today is the last day of the month
// //         await post.update({
// //           totalEarnings: post.totalEarnings + monthlyEarnings,
// //         });
// //       }

// //       // Get the total earnings for the post
// //       const totalEarnings = post.totalEarnings;

// //       // Collect data for the report
// //       responseData.push({
// //         postId: post.id,
// //         totalViewsCount: viewsCount, // Total views count for the current month
// //         monthlyEarnings,
// //         totalEarnings, // Total earnings for the post
// //       });

// //       console.log(`Earnings calculated for post ID ${post.id}`);
// //     }

// //     console.log(`Earnings calculation completed for user ID: ${userId}`);

// //     // Return the report as response, including total earnings for each post
// //     return res.status(200).json({ data: responseData });
// //   } catch (error) {
// //     console.error("Error calculating earnings:", error);
// //     return res.status(500).json({ message: "Error calculating earnings" });
// //   }
// // };
// //for first day of the upcoming month
// const calculateEarnings = async (req, res) => {
//   const userId = req.user;

//   try {
//     // Get the start date of the current month and the first date of the upcoming month
//     const currentMonthStart = new Date(
//       new Date().getFullYear(),
//       new Date().getMonth(),
//       1
//     );
//     const upcomingMonthStart = new Date(
//       new Date().getFullYear(),
//       new Date().getMonth() + 1,
//       1
//     );

//     // Retrieve all posts belonging to the user
//     const posts = await Post.findAll({ where: { userId } });

//     // Initialize responseData for the report
//     const responseData = [];

//     // Iterate over each post
//     for (const post of posts) {
//       // Find all views for the post within the current month
//       const viewsThisMonth = await PostViewer.findAll({
//         where: {
//           postId: post.id,
//           createdAt: {
//             [Op.between]: [currentMonthStart, upcomingMonthStart],
//           },
//         },
//       });

//       // Calculate the total views count for the current month
//       const viewsCount = viewsThisMonth.length;

//       // Calculate monthly earnings based on the views count
//       const earningPerView = 0.01; // Example earning rate
//       const monthlyEarnings = viewsCount * earningPerView;

//       // Update the post with the calculated earnings for the current month
//       await post.update({
//         thisMonthEarnings: monthlyEarnings,
//         viewsCount: post.viewsCount + viewsCount,
//         lastCalculatedViewsCount: viewsCount,
//       });

//       // Check if today is the first day of the upcoming month
//       const today = new Date();
//       if (
//         today.getDate() === upcomingMonthStart.getDate() &&
//         today.getMonth() === upcomingMonthStart.getMonth() &&
//         today.getFullYear() === upcomingMonthStart.getFullYear()
//       ) {
//         // Update the total earnings for the post if today is the first day of the upcoming month
//         await post.update({
//           totalEarnings: post.totalEarnings + monthlyEarnings,
//         });
//       }

//       // Get the total earnings for the post
//       const totalEarnings = post.totalEarnings;

//       // Collect data for the report
//       responseData.push({
//         postId: post.id,
//         totalViewsCount: viewsCount, // Total views count for the current month
//         monthlyEarnings,
//         totalEarnings, // Total earnings for the post
//       });

//       console.log(`Earnings calculated for post ID ${post.id}`);
//     }

//     console.log(`Earnings calculation completed for user ID: ${userId}`);

//     // Return the report as response, including total earnings for each post
//     return res.status(200).json({ data: responseData });
//   } catch (error) {
//     console.error("Error calculating earnings:", error);
//     return res.status(500).json({ message: "Error calculating earnings" });
//   }
// };

const userEarnings = async (req, res) => {
  const userId = req.user;

  try {
    // Retrieve all posts belonging to the user
    const userPosts = await Post.findAll({ where: { userId } });

    if (!userPosts || userPosts.length === 0) {
      return res
        .status(404)
        .json({ message: "User not found or user has no posts" });
    }

    // Calculate total earnings
    const totalEarnings = userPosts.reduce(
      (accum, post) => accum + post.totalEarnings,
      0
    );

    // Return total earnings
    return res.status(200).json({ totalEarnings });
  } catch (error) {
    console.error("Error calculating total earnings:", error);
    return res
      .status(500)
      .json({ message: "Error calculating total earnings" });
  }
};

//-----------------------for single passkey two step authentication----------------------//

// const registerUserPasskeyCtrl = asyncHandler(async (req, res) => {
//   const userId = req.user;

//   // Check if user exists
//   const user = await User.findByPk(userId);
//   if (!user) {
//     return res.status(404).json({ error: "user not found!" });
//   }

//   // Generate the registration options
//   const challengePayload = await generateRegistrationOptions({
//     rpID: "localhost",
//     rpName: "My Localhost Machine",
//     attestationType: "none",
//     userName: user.username,
//     timeout: 30_000,
//   });

//   // Store the challenge in the database
//   await Challenge.create({
//     userId,
//     challenge: challengePayload.challenge,
//   });

//   return res.json({ options: challengePayload });
// });

// const registerPasskeyVerifyCtrl = asyncHandler(async (req, res) => {
//   const userId = req.user;
//   const { cred } = req.body;

//   // Retrieve the user from the database
//   const userFound = await User.findOne({ where: { id: userId } });
//   if (!userFound) {
//     throw new Error("User Not Found");
//   }

//   // Retrieve the challenge from the database
//   const challenge = await Challenge.findOne({ where: { userId: userId } });
//   if (!challenge) {
//     throw new Error("Challenge not found");
//   }

//   // Verify the registration response using the retrieved challenge
//   const verificationResult = await verifyRegistrationResponse({
//     expectedChallenge: challenge.challenge,
//     expectedOrigin: "http://localhost:5173",
//     expectedRPID: "localhost",
//     response: cred,
//   });

//   if (!verificationResult.verified) {
//     return res.json({ error: "could not verify" });
//   }

//   // Store the verification result (passkey) in the database
//   await Challenge.update(
//     {
//       passkey: {
//         ...verificationResult.registrationInfo,
//         credentialPublicKey: Buffer.from(
//           verificationResult.registrationInfo.credentialPublicKey
//         ).toString("base64"), // Convert Buffer to Base64 string
//       },
//     },
//     { where: { userId: userId } }
//   );

//   res.json({ verified: true });
// });

// const loginUserPassKey = asyncHandler(async (req, res) => {
//   const userId = req.user;

//   // Check if user exists
//   const user = await User.findByPk(userId);
//   if (!user) {
//     return res.status(404).json({ error: "user not found!" });
//   }

//   const opts = await generateAuthenticationOptions({
//     rpID: "localhost",
//   });

//   // Store the challenge in the database
//   await Challenge.create({
//     userId,
//     challenge: opts.challenge,
//     loginpasskey: true,
//   });

//   return res.json({ options: opts });
// });

// const loginPassKeyVerifyCtrl = asyncHandler(async (req, res) => {
//   const userId = req.user;
//   const { cred } = req.body;

//   // Retrieve the user from the database
//   const user = await User.findByPk(userId);
//   if (!user) return res.status(404).json({ error: "User not found!" });

//   // Retrieve the challenge record for the user
//   const challenge = await Challenge.findOne({
//     where: { userId: userId, loginpasskey: true },
//   });
//   if (!challenge)
//     return res.status(404).json({ error: "Challenge data not found!" });

//   // Retrieve the stored passkey from the challengepasskey object
//   const challengepasskey = await Challenge.findOne({
//     where: { userId: userId, loginpasskey: false },
//   });
//   if (!challengepasskey)
//     return res.status(404).json({ error: "Passkey data not found!" });

//   const passkey = challengepasskey.dataValues.passkey;

//   // Convert credentialPublicKey from Base64 string back to Buffer
//   passkey.credentialPublicKey = Buffer.from(
//     passkey.credentialPublicKey,
//     "base64"
//   );

//   // Verify the authentication response using the authenticator
//   const result = await verifyAuthenticationResponse({
//     expectedChallenge: challenge.challenge,
//     expectedOrigin: "http://localhost:5173",
//     expectedRPID: "localhost",
//     response: cred,
//     authenticator: {
//       credentialID: passkey.credentialID,
//       credentialPublicKey: passkey.credentialPublicKey,
//       counter: passkey.counter,
//     },
//   });

//   console.log("result---------", result);

//   // Handle verification result
//   if (!result.verified) {
//     return res.json({ error: "Authentication verification failed" });
//   } else {
//     await Challenge.destroy({ where: { userId: userId, loginpasskey: true } });

//     const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
//       expiresIn: "3d",
//     });

//     // Set the token into the cookie
//     res.cookie("token", token, {
//       httpOnly: true,
//       secure: false,
//       sameSite: "strict",
//       maxAge: 24 * 60 * 60 * 1000, // 1 day
//     });

//     res.json({ success: true });
//   }
// });

//-----------------------for single passkey two step authentication----------------------//



//-----------------------for multiple passkey two step authentication---------------------//

const registerUserPasskeyCtrl = asyncHandler(async (req, res) => {
  const userId = req.user;

  // Check if user exists
  const user = await User.findByPk(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found!" });
  }

  // Generate the registration options
  const challengePayload = await generateRegistrationOptions({
    rpID: "localhost",
    rpName: "My Localhost Machine",
    attestationType: "none",
    userName: user.username,
    timeout: 30_000,
  });

  // Store the challenge in the database
  await Challenge.create({
    userId,
    challenge: challengePayload.challenge,
    loginpasskey: false,
  });

  return res.json({ options: challengePayload });
});

const registerPasskeyVerifyCtrl = asyncHandler(async (req, res) => {
  const userId = req.user;
  const { cred } = req.body;

  // Retrieve the user from the database
  const userFound = await User.findOne({ where: { id: userId } });
  if (!userFound) {
    throw new Error("User not found");
  }

  // Retrieve the challenge from the database
  const challenge = await Challenge.findOne({
    where: { userId: userId, loginpasskey: false },
    order: [["createdAt", "DESC"]], // Get the most recent challenge
  });
  if (!challenge) {
    throw new Error("Challenge not found");
  }

  // Verify the registration response using the retrieved challenge
  const verificationResult = await verifyRegistrationResponse({
    expectedChallenge: challenge.challenge,
    expectedOrigin: "http://localhost:5173",
    expectedRPID: "localhost",
    response: cred,
  });

  if (!verificationResult.verified) {
    return res.json({ error: "Could not verify" });
  }

  // Update the challenge entry with the passkey data
  await Challenge.update(
    {
      passkey: {
        ...verificationResult.registrationInfo,
        credentialPublicKey: Buffer.from(
          verificationResult.registrationInfo.credentialPublicKey
        ).toString("base64"), // Convert Buffer to Base64 string
      },
    },
    { where: { id: challenge.id } }
  );

  res.json({ verified: true });
});

//-------------------------based on userid two step authenticaion-------------------------//
// const loginUserPassKey = asyncHandler(async (req, res) => {
//   const userId = req.user;

//   // Check if user exists
//   const user = await User.findByPk(userId);
//   if (!user) {
//     return res.status(404).json({ error: "User not found!" });
//   }

//   const opts = await generateAuthenticationOptions({
//     rpID: "localhost",
//   });

//   // Store the challenge in the database
//   await Challenge.create({
//     userId,
//     challenge: opts.challenge,
//     loginpasskey: true,
//   });

//   return res.json({ options: opts });
// });

// const loginPassKeyVerifyCtrl = asyncHandler(async (req, res) => {
//   const userId = req.user;
//   const { cred } = req.body;

//   // Retrieve the user from the database
//   const user = await User.findByPk(userId);
//   if (!user) return res.status(404).json({ error: "User not found!" });

//   // Retrieve the challenge record for the user
//   const challenge = await Challenge.findOne({
//     where: { userId: userId, loginpasskey: true },
//   });
//   if (!challenge)
//     return res.status(404).json({ error: "Challenge data not found!" });

//   // Retrieve all stored passkeys for the user
//   const passkeys = await Challenge.findAll({
//     where: { userId: userId, loginpasskey: false },
//   });
//   if (!passkeys || passkeys.length === 0)
//     return res.status(404).json({ error: "Passkey data not found!" });

//   let verified = false;

//   for (const challengepasskey of passkeys) {
//     const passkey = challengepasskey.dataValues.passkey;
//     passkey.credentialPublicKey = Buffer.from(
//       passkey.credentialPublicKey,
//       "base64"
//     );

//     const result = await verifyAuthenticationResponse({
//       expectedChallenge: challenge.challenge,
//       expectedOrigin: "http://localhost:5173",
//       expectedRPID: "localhost",
//       response: cred,
//       authenticator: {
//         credentialID: passkey.credentialID,
//         credentialPublicKey: passkey.credentialPublicKey,
//         counter: passkey.counter,
//       },
//     });

//     if (result.verified) {
//       verified = true;
//       break;
//     }
//   }

//   if (!verified) {
//     return res.json({ error: "Authentication verification failed" });
//   } else {
//     await Challenge.destroy({
//       where: { userId: userId, loginpasskey: true, id: challenge.id },
//     });

//     const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
//       expiresIn: "3d",
//     });

//     res.cookie("token", token, {
//       httpOnly: true,
//       secure: false,
//       sameSite: "strict",
//       maxAge: 24 * 60 * 60 * 1000, // 1 day
//     });

//     res.json({ success: true });
//   }
// });
//-------------------------based on userid two step authenticaion-------------------------//

const loginUserPassKey = asyncHandler(async (req, res) => {
  const { username } = req.body;

  // Find the user based on the username
  const user = await User.findOne({ where: { username } });
  if (!user) {
    return res.status(404).json({ error: "User not found!" });
  }

  const opts = await generateAuthenticationOptions({
    rpID: "localhost",
  });

  // Store the challenge in the database
  await Challenge.create({
    userId: user.id,
    challenge: opts.challenge,
    loginpasskey: true,
  });

  return res.json({ options: opts });
});

const loginPassKeyVerifyCtrl = asyncHandler(async (req, res) => {
  const { username, cred } = req.body;

  // Find the user based on the username
  const user = await User.findOne({ where: { username } });
  if (!user) {
    return res.status(404).json({ error: "User not found!" });
  }

  // Retrieve the challenge record for the user
  const challenge = await Challenge.findOne({
    where: { userId: user.id, loginpasskey: true },
  });
  if (!challenge) {
    return res.status(404).json({ error: "Challenge data not found!" });
  }

  // Retrieve all stored passkeys for the user
  const passkeys = await Challenge.findAll({
    where: { userId: user.id, loginpasskey: false },
  });
  if (!passkeys || passkeys.length === 0) {
    return res.status(404).json({ error: "Passkey data not found!" });
  }

  let verified = false;

  for (const challengepasskey of passkeys) {
    const passkey = challengepasskey.dataValues.passkey;
    passkey.credentialPublicKey = Buffer.from(
      passkey.credentialPublicKey,
      "base64"
    );

    const result = await verifyAuthenticationResponse({
      expectedChallenge: challenge.challenge,
      expectedOrigin: "http://localhost:5173",
      expectedRPID: "localhost",
      response: cred,
      authenticator: {
        credentialID: passkey.credentialID,
        credentialPublicKey: passkey.credentialPublicKey,
        counter: passkey.counter,
      },
    });

    if (result.verified) {
      verified = true;
      break;
    }
  }

  if (!verified) {
    return res.json({ error: "Authentication verification failed" });
  } else {
    await Challenge.destroy({
      where: { userId: user.id, loginpasskey: true, id: challenge.id },
    });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "3d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.json({ success: true });
  }
});

//-----------------------for multiple passkey two step authentication---------------------//


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
  forgotPassword,
  resetPassword,
  updateProfilePic,
  updateEmail,
  GetFollowers,
  getFollowingByUserId,
  getFollowersCount,
  getFollowingsCount,
  // calculateEarnings,
  userEarnings,
  registerUserPasskeyCtrl,
  registerPasskeyVerifyCtrl,
  loginUserPassKey,
  loginPassKeyVerifyCtrl,
};
