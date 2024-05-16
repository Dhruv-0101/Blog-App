const PostController = require("../../controllers/postController");
const isAuthenticated = require("../../middleware/isAuthenticated");
const postimageupload = require("../../config/PostImageConfig");

const PostRouter = require("express").Router();

PostRouter.post(
  "/create-post",
  isAuthenticated,
  postimageupload.single("image"),
  PostController.createPost
);
PostRouter.get("/get-posts", PostController.fetchAllPosts);
PostRouter.get(
  "/get-single-post/:postId",
  isAuthenticated,
  PostController.getPost
);
PostRouter.delete(
  "/delete-single-post/:postId",
  isAuthenticated,
  PostController.deletePost
);

module.exports = PostRouter;
