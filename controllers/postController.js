const asyncHandler = require("express-async-handler");
const db = require("../models/index");
const { Sequelize } = require("sequelize");

const Post = db.posts;
const Category = db.categories;
const User = db.users;
const PostViewers = db.postviewers;
const Comment = db.comments;
const LikeDisLike = db.likedislike;

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
    image: req?.file?.path,
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

  // const postFound = await Post.findByPk(postId);
  const postFound = await Post.findByPk(postId, {
    include: {
      model: User,
      attributes: ["username"],
    },
  });

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

const likePost = asyncHandler(async (req, res) => {
  const userId = req.user;
  const postId = req.params.postId;

  // Check if there is an existing like for the user and post
  let existingLike = await LikeDisLike.findOne({
    where: { userId, postId },
  });

  // If there is an existing like, return success message
  if (existingLike && existingLike.liked) {
    const likeCount = await LikeDisLike.count({
      where: { postId: postId, liked: true },
    });
    return res
      .status(400)
      .json({ likeCount: likeCount, message: "User already liked the post" });
  }

  // If no existing like found, create a new entry with 'liked' set to true
  if (!existingLike) {
    existingLike = await LikeDisLike.create({ userId, postId, liked: true });
  } else {
    // Update the existing entry to set 'liked' to true
    existingLike.liked = true;
    await existingLike.save();
  }

  // Count the number of likes after creating or updating the like entry
  const likeCount = await LikeDisLike.count({
    where: { postId: postId, liked: true },
  });

  res.status(201).json({
    likeCount: likeCount,
    message: "Post liked successfully",
  });
});

const dislikePost = asyncHandler(async (req, res) => {
  const userId = req.user;
  const postId = req.params.postId;

  // Check if there is an existing dislike for the user and post
  let existingDislike = await LikeDisLike.findOne({
    where: { userId, postId },
  });

  // If there is an existing dislike, return success message
  if (existingDislike && !existingDislike.liked) {
    const dislikeCount = await LikeDisLike.count({
      where: { postId: postId, liked: false },
    });
    return res.status(400).json({
      dislikeCount: dislikeCount,
      message: "User already disliked the post",
    });
  }

  // If no existing dislike found, create a new entry with 'liked' set to false
  if (!existingDislike) {
    existingDislike = await LikeDisLike.create({
      userId,
      postId,
      liked: false,
    });
  } else {
    // Update the existing entry to set 'liked' to false
    existingDislike.liked = false;
    await existingDislike.save();
  }

  // Count the number of dislikes after creating or updating the dislike entry
  const dislikeCount = await LikeDisLike.count({
    where: { postId: postId, liked: false },
  });

  res.status(201).json({
    dislikeCount: dislikeCount,
    message: "Post disliked successfully",
  });
});

const getLikesCount = asyncHandler(async (req, res) => {
  const postId = req.params.postId;

  const likesCount = await LikeDisLike.count({
    where: { postId: postId, liked: true },
  });

  res.status(200).json({
    likesCount: likesCount,
    message: "Likes count fetched successfully",
  });
});

const GetDisLikeCount = asyncHandler(async (req, res) => {
  const postId = req.params.postId;

  const dislikesCount = await LikeDisLike.count({
    where: { postId: postId, liked: false },
  });

  res.status(200).json({
    dislikesCount: dislikesCount,
    message: "Likes count fetched successfully",
  });
});

const getUserPostsController = async (req, res) => {
  const userId = req.user;

  const userPosts = await Post.findAll({ where: { userId } });

  if (!userPosts || userPosts.length === 0) {
    return res
      .status(404)
      .json({ message: "User not found or user has no posts" });
  }

  return res.status(200).json({ userPosts });
};

const getTotalPostViews = asyncHandler(async (req, res) => {
  const userId = req.user;

  // Find all posts for the user
  const userPosts = await Post.findAll({ where: { userId: userId } });
  console.log(userPosts);

  // If user has no posts
  if (!userPosts || userPosts.length === 0) {
    return res
      .status(404)
      .json({ message: "User not found or user has no posts" });
  }

  // Initialize total views count
  let totalUserViews = 0;

  // Iterate over each post to count views
  for (const post of userPosts) {
    // Find views count for current post
    const postViewsCount = await PostViewers.count({
      where: { postId: post.id },
    });
    console.log(postViewsCount);
    // Add current post views count to total views
    totalUserViews += postViewsCount;
  }

  // Return the total number of views for all the user's posts
  return res.status(200).json({ totalUserViews });
});

const getUserPostsCount = asyncHandler(async (req, res) => {
  const userId = req.user;

  // Count posts for the given user
  const postsCount = await Post.count({
    where: { userId: userId },
  });

  // Return the count of posts
  return res.status(200).json({ postsCount });
});

// const getUserPostLikes = asyncHandler(async (req, res) => {
//   const userId = req.user;

//   // Find all posts for the user
//   const userPosts = await Post.findAll({ where: { userId: userId } });

//   // If user has no posts, return 404
//   if (!userPosts || userPosts.length === 0) {
//     return res
//       .status(404)
//       .json({ message: "User not found or user has no posts" });
//   }

//   // Initialize an array to store likes count for each post
//   const postsWithLikeCount = [];

//   // Iterate over each post to count likes
//   for (const post of userPosts) {
//     // Find likes count for current post where liked is true
//     const postLikesCount = await LikeDisLike.count({
//       where: { postId: post.id, liked: true },
//     });

//     // Add the post and its like count to the array
//     postsWithLikeCount.push({
//       postId: post.id,
//       likesCount: postLikesCount,
//     });
//   }

//   // Return the array of posts with like counts
//   return res.status(200).json({ posts: postsWithLikeCount });
// });
const getUserPostLikes = asyncHandler(async (req, res) => {
  const userId = req.user;

  // Find all posts for the user
  const userPosts = await Post.findAll({ where: { userId: userId } });

  // If user has no posts, return 404
  if (!userPosts || userPosts.length === 0) {
    return res
      .status(404)
      .json({ message: "User not found or user has no posts" });
  }

  // Initialize total likes count
  let totalLikesCount = 0;

  // Iterate over each post to count likes
  for (const post of userPosts) {
    // Find likes count for current post where liked is true
    const postLikesCount = await LikeDisLike.count({
      where: { postId: post.id, liked: true },
    });

    // Add the current post likes count to total likes count
    totalLikesCount += postLikesCount;
  }

  // Return the total likes count for the user's posts
  return res.status(200).json({ totalLikesCount });
});
const getUserPostDisLikes = asyncHandler(async (req, res) => {
  const userId = req.user;

  // Find all posts for the user
  const userPosts = await Post.findAll({ where: { userId: userId } });

  // If user has no posts, return 404
  if (!userPosts || userPosts.length === 0) {
    return res
      .status(404)
      .json({ message: "User not found or user has no posts" });
  }

  // Initialize total likes count
  let totalLikesCount = 0;

  // Iterate over each post to count likes
  for (const post of userPosts) {
    // Find likes count for current post where liked is true
    const postLikesCount = await LikeDisLike.count({
      where: { postId: post.id, liked: false },
    });

    // Add the current post likes count to total likes count
    totalLikesCount += postLikesCount;
  }

  // Return the total likes count for the user's posts
  return res.status(200).json({ totalDisLikesCount: totalLikesCount });
});

module.exports = {
  createPost,
  fetchAllPosts,
  getPost,
  deletePost,
  likePost,
  dislikePost,
  getLikesCount,
  GetDisLikeCount,
  getUserPostsController,
  getTotalPostViews,
  getUserPostsCount,
  getUserPostLikes,
  getUserPostDisLikes,
};
