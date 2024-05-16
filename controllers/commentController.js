const asyncHandler = require("express-async-handler");
const db = require("../models/index");
const Comment = db.comments
const Post = db.posts;
const createComment = asyncHandler(async (req, res) => {
  const { postId, content } = req.body;
  console.log(postId);
  const post = await Post.findByPk(postId);
  if (!post) {
    throw new Error("Post not found");
  }

  // Create the comment
  const commentCreated = await Comment.create({
    content,
    userId: req.user,
    postId,
  });

  if (post) {
    await post.update({ postId: commentCreated.id });
  } else {
    throw new Error("post not found");
  }

  // Send the response
  res.json({
    status: "success",
    message: "Comment created successfully",
    commentCreated,
  });
});

module.exports = { createComment };
