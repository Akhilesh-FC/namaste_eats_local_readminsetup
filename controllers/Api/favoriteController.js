const { Op } = require("sequelize");
const Feedback = require("../../models/Feedback");
//const Favorite = db.Favorite;
const { User, Restaurant, Favorite,RestaurantOffer } = require("../../models");  // ✅ Correct import

// Add to favorite
exports.addFavorite = async (req, res) => {
  try {
    const { user_id, restaurant_id } = req.body;

    if (!user_id || !restaurant_id) {
      return res.status(400).json({
        status: false,
        message: "user_id and restaurant_id are required",
      });
    }

    // ✅ Check if user exists
    const user = await User.findOne({ where: { id: user_id } });
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // ✅ Check if restaurant exists
    const restaurant = await Restaurant.findOne({
      where: { id: restaurant_id },
      attributes: ["id", "name", "image"],
    });

    if (!restaurant) {
      return res.status(404).json({
        status: false,
        message: "Restaurant not found",
      });
    }

    // ✅ Check if already in favorites
    const exists = await Favorite.findOne({
      where: { user_id, restaurant_id },
    });

    if (exists) {
      return res.status(409).json({
        status: false,
        message: "This restaurant is already in your favorites",
      });
    }

    // ✅ Add to favorites
    const fav = await Favorite.create({ user_id, restaurant_id });

    return res.status(200).json({
      status: true,
      message: "Added to favorites",
      data: {
        id: fav.id,
        user_id: fav.user_id,
        restaurant_id: fav.restaurant_id,
        restaurant_name: restaurant.name,
        restaurant_image: restaurant.image,
      },
    });
  } catch (error) {
    console.error("Add Favorite Error:", error);

    // ✅ Handle unique constraint error
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        status: false,
        message: "This restaurant is already in your favorites",
      });
    }

    return res.status(500).json({
      status: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
};

// Get user's favorites (without associations)
exports.getFavorites = async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        status: false,
        message: "user_id is required",
      });
    }

    // ✅ Get all favorites
    const favorites = await Favorite.findAll({
      where: { user_id },
      raw: true,
    });

    if (!favorites.length) {
      return res.status(200).json({
        status: true,
        message: "No favorites found",
        data: [],
      });
    }

    // ✅ Restaurant IDs extract karo
    const restaurantIds = favorites.map(fav => fav.restaurant_id);

    // ✅ Restaurants data lao
    const restaurants = await Restaurant.findAll({
      where: { id: restaurantIds },
      attributes: [
        "id",
        "name",
        "rating",
        "cooking_time",
        "restaurant_title",
        "address",
        "distance",
        "image",
	    "latitude",
		"longitude"
      ],
      raw: true,
    });

    // ✅ Restaurant offers lao
    const offers = await RestaurantOffer.findAll({
      where: { restaurant_id: restaurantIds },
      attributes: ["id", "restaurant_id", "title", "description","discount_percent"],
      raw: true,
    });

    // ✅ Map restaurant info with favorites
    const data = favorites.map(fav => {
      const restaurant = restaurants.find(r => r.id === fav.restaurant_id);
      const offer = offers.find(o => o.restaurant_id === fav.restaurant_id);

      return {
        id: fav.id,
        user_id: fav.user_id,
        restaurant: restaurant
          ? {
              id: restaurant.id,
              name: restaurant.name,
              rating: restaurant.rating,
              cooking_time: restaurant.cooking_time,
              restaurant_title: restaurant.restaurant_title,
              address: restaurant.address,
              distance: restaurant.distance,
              image: restaurant.image,
			  latitude: restaurant.latitude,
			   longitude: restaurant.longitude,
              offer: offer
                ? {
                    id: offer.id,
                    title: offer.offer_title,
                    discount: offer.discount_percent,
					description: offer.description,
                  }
                : null,
            }
          : null,
      };
    });

    return res.status(200).json({
      status: true,
      message: "Favorites fetched successfully",
      data,
    });
  } catch (error) {
    console.error("Get Favorites Error:", error);
    return res.status(500).json({
      status: false,
      message: "Failed to fetch favorites",
      error: error.message,
    });
  }
};



// Remove from favorite (using POST method)
exports.removeFavorite = async (req, res) => {
  try {
    const { user_id, restaurant_id } = req.body;

    if (!user_id || !restaurant_id) {
      return res.status(400).json({
        status: false,
        message: "user_id and restaurant_id are required",
      });
    }

    // ✅ Delete record
    const deleted = await Favorite.destroy({
      where: { user_id, restaurant_id },
    });

    if (!deleted) {
      return res.status(404).json({
        status: false,
        message: "Favorite not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Removed from favorites",
    });
  } catch (error) {
    console.error("Remove Favorite Error:", error);
    return res.status(500).json({
      status: false,
      message: "Failed to remove favorite",
      error: error.message,
    });
  }
};
