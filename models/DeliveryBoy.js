// models/DeliveryBoy.js
module.exports = (sequelize, DataTypes) => {
  const DeliveryBoy = sequelize.define("DeliveryBoy", {
    first_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    mobile_number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    profile_picture: {
      type: DataTypes.STRING,
      allowNull: true,
    },
	  fcm_token: {
  type: DataTypes.STRING,
  allowNull: true,
},
	  address: {
  type: DataTypes.STRING,
  allowNull: true,
},

   
    vehicle_type: {
      type: DataTypes.ENUM("scooty", "bike"),
      allowNull: false,
    },
    identity_type: {
      type: DataTypes.ENUM("aadhar", "pan"),
      allowNull: false,
    },
    identity_number: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    identity_image: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    driving_license_number: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    driving_license_image: {
      type: DataTypes.STRING,
      allowNull: true,
    },
	  
	  // 🆕 Added fields
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
    },
    current_status: {
      type: DataTypes.ENUM("busy", "free"),
      allowNull: true,
      defaultValue: "free",
    },
    on_off_status: {
      type: DataTypes.ENUM("on", "off"),
      allowNull: true,
      defaultValue: "off",
    },
  });
	  
 

  return DeliveryBoy;
};
