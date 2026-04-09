const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Slider = sequelize.define("Slider", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  image: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  link: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.TINYINT, // 0 = inactive, 1 = active
    defaultValue: 1,
  },
}, {
  tableName: "sliders",
  timestamps: true,
  createdAt: "created_at",  // ✅ Laravel style
  updatedAt: "updated_at",
});

module.exports = Slider;
