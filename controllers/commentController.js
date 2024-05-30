const asyncHandler = require("express-async-handler");
const db = require("../models/index");
const Comment = db.comments;
const Post = db.posts;
const User = db.users;
const createComment = asyncHandler(async (req, res) => {
  const postId = req.params.postId;
  const { content } = req.body;
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
const getCommentsForPost = asyncHandler(async (req, res) => {
  const postId = req.params.postId;

  const comments = await Comment.findAll({
    where: { postId: postId },
    include: {
      model: User,
      attributes: ["username"],
    },
    order: [["createdAt", "DESC"]],
  });

  res.json({
    status: "success",
    message: "Comments fetched successfully",
    comments,
  });
});

module.exports = { createComment, getCommentsForPost };
