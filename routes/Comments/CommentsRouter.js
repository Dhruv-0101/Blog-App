const commentController = require("../../controllers/commentController");
const isAuthenticated = require("../../middleware/isAuthenticated");

const CommentRouter = require("express").Router();

CommentRouter.post(
  "/create-comment",
  isAuthenticated,
  commentController.createComment
);

module.exports = CommentRouter;
