module.exports = (sequelize, DataTypes) => {
  const Challenge = sequelize.define(
    "challenge",
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      challenge: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      // username: {
      //   type: DataTypes.STRING,
      //   allowNull: false,
      // },
      passkey: {
        type: DataTypes.JSONB, // Use JSONB for PostgreSQL, JSON for MySQL
        // allowNull: false,
      },
      loginpasskey: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      timestamps: true,
    }
  );

  return Challenge;
};
