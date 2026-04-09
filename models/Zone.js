const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Zone = sequelize.define("zones", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    zone_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    coordinates: {
        type: DataTypes.TEXT,  // polygon json store hoga
        allowNull: false
    },
    is_active: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    }
}, {
    timestamps: true
});

module.exports = Zone;
