const PostController = require("../../controllers/postController");
const isAuthenticated = require("../../middleware/isAuthenticated");
const postimageupload = require("../../config/PostImageConfig");
const isAccountVerified = require("../../middleware/isAccountVerified");
const checkUserPlan = require("../../middleware/checkUserPlan");

const PostRouter = require("express").Router();

PostRouter.post(
  "/create-post",
  isAuthenticated,
  isAccountVerified,
  checkUserPlan,
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
PostRouter.post("/like-post/:postId", isAuthenticated, PostController.likePost);
PostRouter.post(
  "/dislike-post/:postId",
  isAuthenticated,
  PostController.dislikePost
);
PostRouter.get("/like-count/:postId", PostController.getLikesCount);
PostRouter.get("/dislike-count/:postId", PostController.GetDisLikeCount);

module.exports = PostRouter;
