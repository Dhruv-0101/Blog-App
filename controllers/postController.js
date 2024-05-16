const asyncHandler = require("express-async-handler");
const db = require("../models/index");
const { Sequelize } = require("sequelize");

const Post = db.posts;
const Category = db.categories;
const User = db.users;
const PostViewers = db.postviewers;
const Comment = db.comments;

const createPost = asyncHandler(async (req, res) => {
  const { description, category } = req.body;

  const categoryFound = await Category.findByPk(category);
  if (!categoryFound) {
    throw new Error("Category not found");
  }

  const userFound = await User.findByPk(req.user);
  if (!userFound) {
    throw new Error("User not found");
  }

  const postCreated = await Post.create({
    description,
    // image: req.file,
    userId: req.user,
    categoryId: category,
  });

  if (categoryFound) {
    await categoryFound.update({ postId: postCreated.id });
  } else {
    throw new Error("Category not found");
  }

  // Create notification
  //   await Notification.create({
  //     userId: req.user,
  //     postId: postCreated.id,
  //     message: `New post created by ${userFound.username}`,
  //   });

  res.json({
    status: "success",
    message: "Post created successfully",
    postCreated,
  });
});

const fetchAllPosts = asyncHandler(async (req, res) => {
  const { category, title, page = 1, limit = 10 } = req.query;

  let where = {};
  if (category) {
    where.categoryId = category;
  }
  if (title) {
    where.description = { [Sequelize.Op.iLike]: `%${title}%` };
  }

  // Query posts with pagination and filtering
  const posts = await Post.findAndCountAll({
    where,
    include: [
      {
        model: Category,
        as: "category",
        include: {
          model: User,
          attributes: ["username"],
        },
      },
    ],
    order: [["createdAt", "DESC"]],
    limit,
    offset: (page - 1) * limit,
  });

  // Calculate pagination metadata
  const totalPages = Math.ceil(posts.count / limit);

  res.json({
    status: "success",
    message: "Posts fetched successfully",
    posts: posts.rows,
    currentPage: page,
    perPage: limit,
    totalPages,
  });
});

const getPost = asyncHandler(async (req, res) => {
  const postId = req.params.postId;
  const userId = req.user;

  const postFound = await Post.findByPk(postId);

  if (!postFound) {
    throw new Error("Post not found");
  }

  const viewerExists = await PostViewers.findOne({
    where: {
      userId: userId,
      postId: postId,
    },
  });

  if (!viewerExists) {
    await PostViewers.create({
      userId: userId,
      postId: postId,
    });
  }

  if (postFound) {
    const comments = await Comment.findAll({
      where: { postId: postId },
      include: [
        {
          model: User,
          attributes: ["username"],
        },
      ],
    });
    const viewersCount = await PostViewers.count({
      distinct: true,
      col: "userId",
      where: { postId: postId },
    });
    res.json({
      status: "success",
      message: "Post fetched successfully",
      postFound,
      comments,
      viewersCount,
    });
  } else {
    res.json({
      status: "success",
      message: "Post fetched successfully",
      postFound,
    });
  }
});

const deletePost = asyncHandler(async (req, res) => {
  const postId = req.params.postId;

  const deletedPostCount = await Post.destroy({
    where: {
      id: postId,
    },
  });

  if (deletedPostCount === 0) {
    res.status(404).json({
      status: "error",
      message: "Post not found",
    });
  } else {
    res.json({
      status: "success",
      message: "Post deleted successfully",
    });
  }
});

module.exports = { createPost, fetchAllPosts, getPost, deletePost };
