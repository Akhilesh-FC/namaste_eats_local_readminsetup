const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const User = sequelize.define("User", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  u_id: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true, // Laravel me unique tha
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true, // Laravel me unique tha
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true, // Laravel me nullable tha (register me password check nahi tha)
  },
  mobile_no: {
    type: DataTypes.STRING(10),
    allowNull: true,
    unique: true, // Laravel me unique tha
  },
	dob: {
    type: DataTypes.STRING(10),
    allowNull: true,
    unique: true, // Laravel me unique tha
  },
	latitude: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  longitude: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  fcm_token: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: "users",          // Laravel default table name
  timestamps: true,            // created_at, updated_at enable
  createdAt: "created_at",     // Laravel ka column name
  updatedAt: "updated_at",     // Laravel ka column name
});

module.exports = User;
