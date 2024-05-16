module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define(
    "category",
    {
      categoryName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      timestamps: true,
    }
  );

  return Category;
};
