const userController = require("../../controllers/userController");
const isAuthenticated = require("../../middleware/isAuthenticated");

const UserRouter = require("express").Router();

UserRouter.post("/create-user", userController.registerUserCtrl);
UserRouter.post("/login-user", userController.login);
UserRouter.get("/auth/google", userController.googleAuthMiddleware);
UserRouter.get("/auth/google/callback", userController.googleAuthCallback);
UserRouter.get("/checkAuthenticated", userController.checkAuthenticated);
UserRouter.get("/profile", isAuthenticated, userController.profile);

module.exports = UserRouter;
