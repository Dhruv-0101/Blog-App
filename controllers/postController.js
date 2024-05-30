const asyncHandler = require("express-async-handler");
const db = require("../models/index");
const { Sequelize } = require("sequelize");
const { Op } = require("sequelize"); // Import Op from sequelize
const sendNotification = require("../utils/sendNotification");

const Post = db.posts;
const Category = db.categories;
const User = db.users;
const PostViewers = db.postviewers;
const Comment = db.comments;
const LikeDisLike = db.likedislike;
const PostViewer = db.postviewers;
const Notification = db.notifications;
const FolloUnFollow = db.followunfollow;

const createPost = asyncHandler(async (req, res) => {
  const { description, category } = req.body;

  // Find the category
  const categoryFound = await Category.findByPk(category);
  if (!categoryFound) {
    throw new Error("Category not found");
  }

  // Find the user
  const userFound = await User.findByPk(req.user);
  if (!userFound) {
    throw new Error("User not found");
  }

  // Create the post
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

  // Find all follower entries from the followunfollow table where the followerId matches the current user
  const followerEntries = await FolloUnFollow.findAll({
    where: { followerId: req.user },
  });

  // Extract follower IDs from the follower entries
  const followerIds = followerEntries.map((entry) => entry.userId);

  // Find all users who are followers
  const followers = await User.findAll({
    where: {
      id: followerIds,
    },
  });

  // Send notifications to each follower and create a notification entry
  for (const follower of followers) {
    const followerEmail = follower.email;
    await sendNotification(followerEmail, postCreated.id);

    // Create a notification for each follower
    await Notification.create({
      userId: follower.id,
      postId: postCreated.id,
      message: `📢 New post created by ${userFound.username}. <a href="http://localhost:5173/posts/${postCreated.id}" target="_blank" style="color: blue; text-decoration: underline;">View post</a>`,
    });
  }

  res.json({
    status: "success",
    message: "Post created successfully and notifications sent to followers",
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

const updatePostController = asyncHandler(async (req, res) => {
  const postId = req.params.postId;
  const { description, category } = req.body;

  // Check if the post exists and belongs to the user
  const post = await Post.findOne({ where: { id: postId, userId: req.user } });
  if (!post) {
    res.status(404);
    throw new Error(
      "Post not found or user not authorized to update this post"
    );
  }

  // If a category is provided, check if it exists
  if (category) {
    const categoryFound = await Category.findByPk(category);
    if (!categoryFound) {
      res.status(404);
      throw new Error("Category not found");
    }
    post.categoryId = category;
  }

  // Update only the image and description fields
  if (req?.file?.path) {
    post.image = req.file.path;
  }
  if (description) {
    post.description = description;
  }

  // Save the updated post
  await post.save();

  res.json({
    status: "success",
    message: "Post updated successfully",
    post,
  });
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

// const getUserPostsController = async (req, res) => {
//   const userId = req.user;

//   const userPosts = await Post.findAll({ where: { userId } });

//   if (!userPosts || userPosts.length === 0) {
//     return res
//       .status(404)
//       .json({ message: "User not found or user has no posts" });
//   }

//   return res.status(200).json({ userPosts });
// };

const getUserPostsController = async (req, res) => {
  const userId = req.user;

  try {
    // Get the start date of the current month and the first date of the upcoming month
    const currentMonthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );
    const upcomingMonthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      1
    );

    // Retrieve all posts belonging to the user
    const userPosts = await Post.findAll({ where: { userId } });

    if (!userPosts || userPosts.length === 0) {
      return res
        .status(404)
        .json({ message: "User not found or user has no posts" });
    }

    // Initialize responseData for the report
    const responseData = [];

    // Iterate over each post
    for (const post of userPosts) {
      // Find all views for the post within the current month
      const viewsThisMonth = await PostViewer.findAll({
        where: {
          postId: post.id,
          createdAt: {
            [Op.between]: [currentMonthStart, upcomingMonthStart],
          },
        },
      });

      // Calculate the total views count for the current month
      const viewsCount = viewsThisMonth.length;

      // Calculate monthly earnings based on the views count
      const earningPerView = 0.01; // Example earning rate
      const monthlyEarnings = viewsCount * earningPerView;

      // Update the post with the calculated earnings for the current month
      await post.update({
        thisMonthEarnings: monthlyEarnings,
        viewsCount: post.viewsCount + viewsCount,
        lastCalculatedViewsCount: viewsCount,
      });

      // Check if today is the first day of the upcoming month
      const today = new Date();
      if (
        today.getDate() === upcomingMonthStart.getDate() &&
        today.getMonth() === upcomingMonthStart.getMonth() &&
        today.getFullYear() === upcomingMonthStart.getFullYear()
      ) {
        // Update the total earnings for the post if today is the first day of the upcoming month
        await post.update({
          totalEarnings: post.totalEarnings + monthlyEarnings,
        });
      }

      // Get the total earnings for the post
      const totalEarnings = post.totalEarnings;

      // Collect data for the report
      responseData.push({
        postId: post.id,
        totalViewsCount: viewsCount, // Total views count for the current month
        monthlyEarnings,
        totalEarnings, // Total earnings for the post
      });

      console.log(`Earnings calculated for post ID ${post.id}`);
    }

    console.log(`Earnings calculation completed for user ID: ${userId}`);

    // Return both user posts and the earnings report
    return res.status(200).json({
      userPosts, // Original user posts response
      // earningsReport: responseData, // New earnings report
    });
  } catch (error) {
    console.error("Error calculating earnings:", error);
    return res.status(500).json({ message: "Error calculating earnings" });
  }
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

const EARNING_RATE_PER_VIEW = 0.01; // Example: $0.01 per view

const getUserPostEarnings = asyncHandler(async (req, res) => {
  const userId = req.user;

  // Find all posts for the user
  const userPosts = await Post.findAll({ where: { userId: userId } });

  // If user has no posts, return 404
  if (!userPosts || userPosts.length === 0) {
    return res
      .status(404)
      .json({ message: "User not found or user has no posts" });
  }

  // Initialize total earnings and array to store each post's data
  let totalEarnings = 0;
  const postsData = [];

  // Iterate over each post to count views and calculate earnings
  for (const post of userPosts) {
    // Find views count for current post
    const postViewsCount = await PostViewer.count({
      where: { postId: post.id },
    });

    // Calculate earnings for current post
    const postEarnings = postViewsCount * EARNING_RATE_PER_VIEW;

    // Add current post earnings to total earnings
    totalEarnings += postEarnings;

    // Add current post data to the array
    postsData.push({
      postId: post.id,
      description: post.description,
      viewsCount: postViewsCount,
      earnings: postEarnings,
    });
  }

  // Return the total earnings and each post's data
  return res.status(200).json({ totalEarnings, posts: postsData });
});

const getAllUsersEarningsAndRankings = asyncHandler(async (req, res) => {
  try {
    // Find all users
    const users = await User.findAll();

    // Array to store user earnings and post count data
    const usersData = [];

    // Iterate over each user to calculate earnings, post count, and store data
    for (const user of users) {
      // Find all posts for the user
      const userPosts = await Post.findAll({ where: { userId: user.id } });

      // If user has no posts, skip to the next user
      if (!userPosts || userPosts.length === 0) {
        continue;
      }

      // Calculate total earnings for the user
      let totalEarnings = 0;

      // Iterate over each post to count views and calculate earnings
      for (const post of userPosts) {
        // Find views count for current post
        const postViewsCount = await PostViewer.count({
          where: { postId: post.id },
        });

        // Calculate earnings for current post
        const postEarnings = postViewsCount * EARNING_RATE_PER_VIEW;

        // Add current post earnings to total earnings
        totalEarnings += postEarnings;
      }

      // Push user data to the array
      usersData.push({
        userId: user.id,
        username: user.username, // Assuming you have a 'username' field in your User model
        totalEarnings: totalEarnings,
        totalPosts: userPosts.length, // Total post count for the user
        profilePicture: user.profilePicture, // Assuming 'profilePicture' is the attribute name in the User model
      });
    }

    // Sort users based on total earnings in descending order
    usersData.sort((a, b) => b.totalEarnings - a.totalEarnings);

    // Assign ranks to users
    let rank = 1;
    for (let i = 0; i < usersData.length; i++) {
      if (
        i > 0 &&
        usersData[i].totalEarnings < usersData[i - 1].totalEarnings
      ) {
        rank = i + 1;
      }
      usersData[i].rank = rank;
    }

    // Respond with the ranked users and their earnings
    res.json(usersData);
  } catch (error) {
    console.error("Error retrieving user earnings rankings:", error);
    res.status(500).json({ error: "An internal server error occurred" });
  }
});

const fetchUserPostsWithCommentsCount = asyncHandler(async (req, res) => {
  const userId = req.user;

  // Fetch all posts of the user
  const userPosts = await Post.findAll({
    where: { userId },
  });

  // Initialize total comment count
  let totalCommentCount = 0;

  // Iterate over each post to count comments and accumulate total count
  for (const post of userPosts) {
    // Count comments for each post
    const commentCount = await Comment.count({
      where: { postId: post.id },
    });

    // Accumulate comment counts
    totalCommentCount += commentCount;
  }

  res.status(200).json({ totalCommentCount });
});

//for notifications
const getNotificationsForUser = asyncHandler(async (req, res) => {
  const userId = req.user;

  // Find all notifications for the given userId
  const notifications = await Notification.findAll({
    where: { userId: userId, isRead: false },
    order: [["createdAt", "DESC"]],
  });

  const unreadCount = await Notification.count({
    where: { userId, isRead: false },
  });

  res.json({
    status: "success",
    unreadCount,
    notifications,
  });
});

const updateNotificationsForUser = asyncHandler(async (req, res) => {
  const userId = req.user;
  const notificationId = req.params.notificationId;

  // Update the notifications to set isRead to true
  const [updatedRows] = await Notification.update(
    { isRead: true },
    {
      where: {
        userId: userId,
        id: notificationId,
      },
    }
  );

  if (updatedRows === 0) {
    return res.status(404).json({
      status: "failure",
      message: "No notifications found to update",
    });
  }

  res.json({
    status: "success",
    message: "Notifications updated successfully",
    updatedRows,
  });
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
  getUserPostEarnings,
  getAllUsersEarningsAndRankings,
  updatePostController,
  fetchUserPostsWithCommentsCount,
  getNotificationsForUser,
  updateNotificationsForUser,
};
