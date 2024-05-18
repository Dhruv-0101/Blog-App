const crypto = require("crypto");

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "user",
    {
      username: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      profilePicture: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      googleId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      authMethod: {
        type: DataTypes.ENUM("google", "local", "facebook", "github"),
        allowNull: false,
        defaultValue: "local",
      },
      accountVerificationToken: {
        type: DataTypes.STRING,
        defaultValue: null,
      },
      accountVerificationExpires: {
        type: DataTypes.DATE,
        defaultValue: null,
      },
      passwordResetToken: {
        type: DataTypes.STRING,
        defaultValue: null,
      },
      passwordResetExpires: {
        type: DataTypes.DATE,
        defaultValue: null,
      },
      totalEarnings: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
      },
      nextEarningDate: {
        type: DataTypes.DATE,
        defaultValue: () =>
          new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1), // Sets to the first day of the next month
      },
      isEmailVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      hasSelectedPlan: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      lastLogin: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      timestamps: true,
    }
  );

  //   User.generateAccVerificationToken = function () {
  //     const emailToken = crypto.randomBytes(20).toString("hex");
  //     this.accountVerificationToken = crypto
  //       .createHash("sha256")
  //       .update(emailToken)
  //       .digest("hex");
  //     this.accountVerificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  //     return emailToken;
  //   };
  User.prototype.generateAccVerificationToken = function () {
    const emailToken = crypto.randomBytes(20).toString("hex");
    this.accountVerificationToken = crypto
      .createHash("sha256")
      .update(emailToken)
      .digest("hex");
    this.accountVerificationExpires = new Date(Date.now() + 1 * 60 * 1000); // 1 minutes

    return emailToken;
  };

  User.prototype.generatePasswordResetToken = function () {
    const emailToken = crypto.randomBytes(20).toString("hex");
    this.passwordResetToken = crypto
      .createHash("sha256")
      .update(emailToken)
      .digest("hex");
    this.passwordResetExpires = new Date(Date.now() + 1 * 60 * 1000); // 1 minutes
    return emailToken;
  };

  return User;
};
