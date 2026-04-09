module.exports = (sequelize, DataTypes) => {
  const RestaurantOffer = sequelize.define("RestaurantOffer", {
    restaurant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    title: DataTypes.STRING,
    description: DataTypes.TEXT,
    discount: DataTypes.FLOAT,
    valid_till: DataTypes.DATE,
  }, {
    tableName: "restaurant_offers",
    timestamps: true,
	   createdAt: "created_at",     // Laravel ka column name
  updatedAt: "updated_at",     // Laravel ka column name
  });

  return RestaurantOffer;
};
