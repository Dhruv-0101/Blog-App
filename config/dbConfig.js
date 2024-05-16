module.exports = {
    HOST: 'localhost',
    USER: 'postgres',
    PASSWORD: 'dhruvpatel2341',
    DB: 'Blog',
    dialect: 'postgres',

    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
}