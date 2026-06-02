// models/Restaurant.js
module.exports = (sequelize, DataTypes) => {
  const Restaurant = sequelize.define("Restaurant", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: true },
    name_login: { type: DataTypes.STRING, allowNull: true },
	owner_name: { type: DataTypes.STRING, allowNull: true },
	email: { type: DataTypes.STRING, allowNull: true },
	fcm_token: { type: DataTypes.STRING, allowNull: true },
	mobile: { type: DataTypes.STRING, allowNull: true },
	  owner_mobile: { type: DataTypes.STRING, allowNull: true },
	restaurant_title: { type: DataTypes.STRING, allowNull: true },
    address: { type: DataTypes.STRING },
	   shop_no: { type: DataTypes.STRING },
	   shop_floor: { type: DataTypes.STRING },
	   city: { type: DataTypes.STRING },
	   state: { type: DataTypes.STRING },
	   pincode: { type: DataTypes.STRING },
	   cod_available: { type: DataTypes.TINYINT, defaultValue: 1 },
	   latitude: { type: DataTypes.DECIMAL },   // ✅ fixed
    longitude: { type: DataTypes.DECIMAL },  // ✅ fixed
	   rating: { type: DataTypes.DECIMAL },  // ✅ fixed
	  image: { type: DataTypes.STRING },
	   video: { type: DataTypes.STRING },
	  //delivery_time: { type: DataTypes.STRING },
	  cooking_time: { type: DataTypes.STRING },
    distance: { type: DataTypes.STRING },
   	veg_type: { type: DataTypes.STRING },
    is_active: { type: DataTypes.TINYINT, defaultValue: 0 },
	login_status: { type: DataTypes.TINYINT },
	step_id: { type: DataTypes.TINYINT, defaultValue: 0 },
  }, {
    tableName: "restaurants",
    timestamps: true,
	createdAt: "created_at",     // Laravel ka column name
  	updatedAt: "updated_at",     // Laravel ka column name
  });

  return Restaurant;
};
