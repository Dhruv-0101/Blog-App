const categoryController = require("../../controllers/categoryController");
const isAuthenticated = require("../../middleware/isAuthenticated");

const CategoryRouter = require("express").Router();

CategoryRouter.post(
  "/create-category",
  isAuthenticated,
  categoryController.createCategory
);
CategoryRouter.get(
  "/get-all-category",
  isAuthenticated,
  categoryController.fetchAllCategories
);
CategoryRouter.get(
  "/get-single-category/:categoryId",
  isAuthenticated,
  categoryController.getCategory
);
CategoryRouter.delete(
  "/delete-single-category/:categoryId",
  isAuthenticated,
  categoryController.deleteCategory
);
CategoryRouter.put(
  "/update-single-category/:categoryId",
  isAuthenticated,
  categoryController.updateCategory
);
module.exports = CategoryRouter;
