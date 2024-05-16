const dbConfig = require("../config/dbConfig.js");

const { Sequelize, DataTypes } = require("sequelize");

const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
  host: dbConfig.HOST,
  dialect: dbConfig.dialect,
  operatorsAliases: false,

  pool: {
    max: dbConfig.pool.max,
    min: dbConfig.pool.min,
    acquire: dbConfig.pool.acquire,
    idle: dbConfig.pool.idle,
  },
});

sequelize
  .authenticate()
  .then(() => {
    console.log("connected..");
  })
  .catch((err) => {
    console.log("Error" + err);
  });

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

//-----------------------------------------------------------------------------------------------------//

db.users = require("../models/User/User.js")(sequelize, DataTypes);
db.categories = require("../models/Category/Category.js")(sequelize, DataTypes);
db.posts = require("./Post/Post.js")(sequelize, DataTypes);
db.comments = require("./Comments/Comments.js")(sequelize, DataTypes);
db.plans = require("./Plan/Plan.js")(sequelize, DataTypes);
db.postviewers = require("./PostViewers/PostViewers.js")(sequelize, DataTypes);
db.likedislike = require("./LikeDisLike/LikeDisLike.js")(sequelize, DataTypes);

db.sequelize.sync({ force: false }).then(() => {
  console.log("yes re-sync done!");
});

//----------------------------------------------Relations------------------------------------------------//

/-/;
//user and category relations
db.users.hasMany(db.categories, { onDelete: "CASCADE" });
db.categories.belongsTo(db.users);

/-/;
//user and post relations
db.users.hasMany(db.posts, { onDelete: "CASCADE" });
db.posts.belongsTo(db.users);

/-/;
//post and category relations
db.categories.hasMany(db.posts, { onDelete: "CASCADE" });
db.posts.belongsTo(db.categories);

/-/;
//user and comment realtions
db.users.hasMany(db.users, { onDelete: "CASCADE" });
db.comments.belongsTo(db.users);

/-/;
//post and comments relations
db.posts.hasMany(db.comments, { onDelete: "CASCADE" });
db.comments.belongsTo(db.posts);

/-/;
//plan and user relation
db.plans.hasOne(db.users, { onDelete: "CASCADE" });

/-/;
//post and viewers relation
db.users.belongsToMany(
  db.posts,
  { through: db.postviewers },
  { onDelete: "CASCADE" }
);
db.posts.belongsToMany(
  db.users,
  { through: db.postviewers },
  { onDelete: "CASCADE" }
);

db.users.hasMany(db.likedislike);
db.likedislike.belongsTo(db.users);

db.posts.hasMany(db.likedislike);
db.likedislike.belongsTo(db.users);

module.exports = db;
