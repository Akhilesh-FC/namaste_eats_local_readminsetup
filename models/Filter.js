const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Filter = sequelize.define("Filter", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  filter_name: {
    type: DataTypes.STRING,
    allowNull: false,
  }
}, {
  tableName: "filters",
  timestamps: true,
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = Filter;
