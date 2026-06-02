const { DataTypes } = require("sequelize");
const sequelize = require("../config/db"); // tumhara db connection

const Feedback = sequelize.define("Feedback", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  restaurant_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5,
    },
  },
  comments: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: "feedbacks",
  timestamps: true,
	 createdAt: "created_at",     // Laravel ka column name
  updatedAt: "updated_at",     // Laravel ka column name
});

module.exports = Feedback;
