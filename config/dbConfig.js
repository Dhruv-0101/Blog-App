require("dotenv").config();
module.exports = {
  HOST: "blog.cqrjjbvzh5sv.ap-south-1.rds.amazonaws.com",
  USER: "dhruv",
  PASSWORD: "92VpqGVPHD6nEmEgBCGS",
  DB: "blog",
  PORT:"5432",
  dialect: "postgres",

  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
};
