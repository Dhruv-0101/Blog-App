const userController = require("../../controllers/userController");
const isAuthenticated = require("../../middleware/isAuthenticated");

const UserRouter = require("express").Router();

UserRouter.post("/create-user", userController.registerUserCtrl);
UserRouter.post("/login-user", userController.login);
UserRouter.get("/auth/google", userController.googleAuthMiddleware);
UserRouter.get("/auth/google/callback", userController.googleAuthCallback);
UserRouter.get("/checkAuthenticated", userController.checkAuthenticated);
UserRouter.get("/profile", isAuthenticated, userController.profile);
UserRouter.post(
  "/follow-user/:followerId",
  isAuthenticated,
  userController.followUser
);
UserRouter.post(
  "/unfollow-user/:followerId",
  isAuthenticated,
  userController.unfollowUser
);
UserRouter.get(
  "/get-user-follow/:followerId",
  isAuthenticated,
  userController.checkFollowing
);
UserRouter.post("/logout", isAuthenticated, userController.logout);

module.exports = UserRouter;
