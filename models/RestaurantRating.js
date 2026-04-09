module.exports = (sequelize, DataTypes) => {
  const RestaurantRating = sequelize.define("RestaurantRating", {
    restaurant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    rating: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    review: DataTypes.TEXT,
  }, {
    tableName: "restaurant_ratings",
    timestamps: true,
	   createdAt: "created_at",     // Laravel ka column name
  updatedAt: "updated_at",     // Laravel ka column name
  });

  return RestaurantRating;
};
