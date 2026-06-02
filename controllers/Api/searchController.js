const { Op } = require("sequelize");
const { Product, Restaurant, Category } = require("../../models");

// 🔍 Global Search
exports.globalSearch = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.json({ status: false, message: "Search query is required" });
    }

    // ✅ Products
    const products = await Product.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${query}%` } },
          { description: { [Op.like]: `%${query}%` } },
        ],
      },
      attributes: ["id", "name", "description", "thumbnail_image"],
      limit: 10,
    });

    // ✅ Restaurants
    const restaurants = await Restaurant.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${query}%` } },
          { restaurant_title: { [Op.like]: `%${query}%` } },
        ],
      },
      attributes: ["id", "name", "restaurant_title", "image", "rating"],
      limit: 10,
    });

    // ✅ Categories
    const categories = await Category.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${query}%` } },
          { description: { [Op.like]: `%${query}%` } },
        ],
      },
      attributes: ["id", "name", "description", "image"],
      limit: 10,
    });

    // 🔥 Merge results
    const results = [
      // Products → thumbnail_image => image + type = dish
      ...products.map((p) => {
        const obj = p.toJSON();
        return {
          id: obj.id,
          name: obj.name,
          description: obj.description,
          image: obj.thumbnail_image || null,
          type: "dish", // ✅ product -> dish
        };
      }),

      // Restaurants → type = "Rated X for you"
      ...restaurants.map((r) => {
        const obj = r.toJSON();
        return {
          id: obj.id,
          name: obj.name,
          restaurant_title: obj.restaurant_title,
          image: obj.image,
          type: obj.rating
            ? `Rated ${obj.rating} for you`
            : "Rated 0 for you", // ✅ formatted string
        };
      }),

      // Categories → type = dish (as per your last request)
      ...categories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        image: c.image,
        type: "dish",
      })),
    ];

    return res.json({
      status: true,
      query,
      results,
    });
  } catch (err) {
    console.error("Global Search Error:", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};
