module.exports = (sequelize, DataTypes) => {
  const Plan = sequelize.define(
    "plan",
    {
      planName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      features: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
      },
      price: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
    },
    { timestamps: true }
  );

  return Plan;
};
