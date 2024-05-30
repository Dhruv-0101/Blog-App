module.exports = (sequelize, DataTypes) => {
  const Post = sequelize.define(
    "post",
    {
      description: {
        type: DataTypes.TEXT, 
        allowNull: false,
        trim: true,
      },
      image: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      categoryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      nextEarningDate: {
        type: DataTypes.DATE,
        defaultValue: () =>
          new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      },
      thisMonthEarnings: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
      },
      totalEarnings: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
      },
      lastCalculatedViewsCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      viewsCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      isBlocked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    { timestamps: true }
  );

  return Post;
};
