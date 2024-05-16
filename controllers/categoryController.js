const asyncHandler = require("express-async-handler");
const db = require("../models/index");
const Category = db.categories;

const createCategory = asyncHandler(async (req, res) => {
  const { categoryName, description } = req.body;

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
  try {
    const categories = await Category.findAll();
    res.json({
      status: "success",
      message: "Categories fetched successfully",
      categories,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
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

module.exports = {
  createCategory,
  fetchAllCategories,
  getCategory,
  deleteCategory,
  deleteCategory,
  updateCategory,
};
