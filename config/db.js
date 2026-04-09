const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",

    logging: false,

    timezone: "+05:30",

    dialectOptions: {
      timezone: "local",
      dateStrings: true,
      typeCast: function (field, next) {
        if (field.type === "DATETIME" || field.type === "TIMESTAMP") {
          return field.string(); // 🔥 EXACT DB VALUE
        }
        return next();
      },
    },
  }
);

sequelize.authenticate()
  .then(() => console.log("✅ Database connected"))
  .catch((err) => console.log("❌ Error: " + err));

module.exports = sequelize;
