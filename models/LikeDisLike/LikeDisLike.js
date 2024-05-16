module.exports = (sequelize, DataTypes) => {
  const LikeDislike = sequelize.define(
    "likedislike",
    {
      userId: DataTypes.INTEGER,
      postId: DataTypes.INTEGER,
      liked: DataTypes.BOOLEAN,
    },
    {}
  );

  return LikeDislike;
};
