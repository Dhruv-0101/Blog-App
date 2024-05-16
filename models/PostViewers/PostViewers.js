module.exports = (sequelize, DataTypes) => {
  const PostViewer = sequelize.define("postviewer", {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    postId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  });

  return PostViewer;
};
