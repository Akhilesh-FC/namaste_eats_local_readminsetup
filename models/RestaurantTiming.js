module.exports = (sequelize, DataTypes) => {
  const RestaurantTiming = sequelize.define("RestaurantTiming", {
    restaurant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    day_of_week: {
      type: DataTypes.STRING,
      allowNull: false,
    },
	  is_active: {
      type: DataTypes.ENUM('0', '1'),
      allowNull: false,
	  defaultValue: '1',
    },
    open_time: DataTypes.TIME,
    close_time: DataTypes.TIME,
  }, {
    tableName: "restaurant_timings",
    timestamps: true,
	createdAt: "created_at",     
  	updatedAt: "updated_at",    
  });

  return RestaurantTiming;
};
