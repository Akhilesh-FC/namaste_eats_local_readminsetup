const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Address = sequelize.define("Address", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
	name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  latitude: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  longitude: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  save_as: {
    type: DataTypes.ENUM("home", "work", "other"),
    allowNull: false,
  }
}, {
  tableName: "addresses",
  timestamps: true,
  createdAt: "created_at", // Laravel convention
  updatedAt: "updated_at",
});

module.exports = Address;
