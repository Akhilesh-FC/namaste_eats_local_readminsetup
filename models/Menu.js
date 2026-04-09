const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Menu = sequelize.define("Menu", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false,
  }
}, {
  tableName: "menus",
  timestamps: false
});

module.exports = Menu;
