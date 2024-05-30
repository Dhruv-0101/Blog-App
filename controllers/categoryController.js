const asyncHandler = require("express-async-handler");
const db = require("../models/index");
const sequelize = db.sequelize; // Import sequelize from your Sequelize configuration

const Category = db.categories;
const Post = db.posts;

const createCategory = asyncHandler(async (req, res) => {
  const { categoryName, description } = req.body;
  console.log(req.body);

  const categoryFound = await Category.findOne({
    where: { categoryName },
  });
  if (categoryFound) {
    throw new Error("Category already exists");
  }

  // Create the category
  const categoryCreated = await Category.create({
    categoryName,
    description,
    userId: req.user,
  });

  res.json({
    status: "success",
    message: "Category created successfully",
    categoryCreated,
  });
});

const fetchAllCategories = asyncHandler(async (req, res) => {
  const categories = await Category.findAll();
  res.json({
    status: "success",
    message: "Categories fetched successfully",
    categories,
  });
});

const getCategory = asyncHandler(async (req, res) => {
  const categoryId = req.params.categoryId;
  const categoryFound = await Category.findByPk(categoryId);
  if (!categoryFound) {
    throw new Error("Category not found");
  }
  res.json({
    status: "success",
    message: "Category fetched successfully",
    categoryFound,
  });
});

const deleteCategory = asyncHandler(async (req, res) => {
  const categoryId = req.params.categoryId;
  const categoryDeleted = await Category.destroy({
    where: { id: categoryId },
  });
  if (!categoryDeleted) {
    throw new Error("Category not found");
  }
  res.json({
    status: "success",
    message: "Category deleted successfully",
  });
});

const updateCategory = asyncHandler(async (req, res) => {
  const categoryId = req.params.categoryId;
  const { categoryName, description } = req.body;

  let category = await Category.findByPk(categoryId);
  if (!category) {
    throw new Error("Category not found");
  }

  // Update the category
  category = await category.update({
    categoryName,
    description,
  });

  res.json({
    status: "success",
    message: "Category updated successfully",
    categoryUpdated: category,
  });
});

const getCategoryPostCounts = asyncHandler(async (req, res) => {
  try {
    // Find all categories
    const categories = await Category.findAll({
      include: {
        model: Post,
        attributes: [], // We don't need any attributes from Post, just the count
      },
      attributes: {
        include: [
          [sequelize.fn("COUNT", sequelize.col("posts.id")), "postCount"], //for not by me
        ],
      },
      group: ["category.id"],
    });

    return res.status(200).json({ categories: categories });
  } catch (error) {
    console.error("Error fetching categories post counts:", error);
    return res
      .status(500)
      .json({ message: "Error fetching categories post counts" });
  }
});

module.exports = {
  createCategory,
  fetchAllCategories,
  getCategory,
  deleteCategory,
  deleteCategory,
  updateCategory,
  getCategoryPostCounts,
};
