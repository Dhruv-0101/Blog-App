module.exports = (sequelize, DataTypes) => {
  const FolloUnFollow = sequelize.define(
    "followunfollow",
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "users", // Refers to table name
          key: "id", // Refers to column name in referenced table
        },
      },
      followerId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "users", // Refers to table name
          key: "id", // Refers to column name in referenced table
        },
      },
    },
    { timestamps: true }
  );

  return FolloUnFollow;
};
