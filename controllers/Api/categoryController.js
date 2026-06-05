const { Op, fn, col ,where, cast} = require("sequelize");
const { Category,SubCategory,Filter, Product, Restaurant, RestaurantOffer, RestaurantRating, RestaurantTiming, ProductMedia,ProductVariant,Zone} = require("../../models");
const { isPointInsidePolygon } = require("../../utils/pointInPolygon");

// ─── HELPER: zone check + restaurant mapper (shared logic) ───────────────────
const getZoneAndMapper = async (latitude, longitude, filter_ids) => {
  const zones = await Zone.findAll();
  let activeZonePolygon = null;

  for (const zone of zones) {
    const polygon = JSON.parse(zone.coordinates).map(p => ({
      lat: parseFloat(p.lat),
      lng: parseFloat(p.lng),
    }));
    if (isPointInsidePolygon({ lat: parseFloat(latitude), lng: parseFloat(longitude) }, polygon)) {
      activeZonePolygon = polygon;
      break;
    }
  }

  if (!activeZonePolygon) return { activeZonePolygon: null, mapRestaurantData: null };

  const mapRestaurantData = (prod) => {
    const r = prod.restaurant;
    if (!r) return null;

    if (filter_ids?.includes(1) && r.rating < 4) return null;
    if (filter_ids?.includes(2)) {
      const time = parseInt(r.cooking_time?.split("-")[0]);
      if (!time || time > 30) return null;
    }
    if (filter_ids?.includes(3) && prod.price > 300) return null;
    if (filter_ids?.includes(4)) {
      if (!r.offers || !r.offers.some(o => o.discount_percent >= 20)) return null;
    }

    if (!isPointInsidePolygon({ lat: parseFloat(r.latitude), lng: parseFloat(r.longitude) }, activeZonePolygon)) return null;

    return {
      res_id: r.id,
      name: r.name,
      restaurant_title: r.restaurant_title,
      rating: r.rating,
      distance: r.distance,
      cooking_time: r.cooking_time,
      latitude: r.latitude,
      longitude: r.longitude,
      veg_type: r.veg_type,
      thumbnail_image: r.image,
      offers: r.offers || [],
      timings: r.timings || [],
      res_pro_title: "Rated for you",
    };
  };

  return { activeZonePolygon, mapRestaurantData };
};

exports.categories_lists = async (req, res) => {
  try {
    const { cat_id, sub_category_id, filter_ids, latitude, longitude, veg_only } = req.body;
    const vegFilter = veg_only ? { veg_type: "veg" } : {};

    if (!latitude || !longitude) {
      return res.json({ status: false, message: "Latitude & Longitude required!" });
    }

    //-----------------------------------------------------------
    // STEP 1 → CHECK IF USER IS INSIDE ANY DELIVERY ZONE
    //-----------------------------------------------------------
    const zones = await Zone.findAll();
    let userInsideZone = false;
    let activeZonePolygon = null;

    zones.forEach((zone) => {
      const rawPolygon = JSON.parse(zone.coordinates);

      // Convert STRING → NUMBER
      const polygon = rawPolygon.map(p => ({
        lat: parseFloat(p.lat),
        lng: parseFloat(p.lng)
      }));

      // Check if user lies inside polygon
      if (
        isPointInsidePolygon(
          { lat: parseFloat(latitude), lng: parseFloat(longitude) },
          polygon
        )
      ) {
        userInsideZone = true;
        activeZonePolygon = polygon;
      }
    });

    // USER OUTSIDE ZONE → No service
    if (!userInsideZone) {
      return res.json({
        status: false,
        message: "Service not available in your area.",
        data: {
          sub_categories: [],
          recommended_for_you: { title: "Recommended for you", restaurants: [] },
          all_restaurants: {
            title: "Restaurant deliver to you",
            total_count: 0,
            restaurants: []
          }
        }
      });
    }

    //-----------------------------------------------------------
    // STEP 2 → Fetch Categories + SubCategories + Products + Restaurants
    //-----------------------------------------------------------
    const categories = await Category.findAll({
      where: cat_id ? { id: cat_id, status: 1 } : { status: 1 },
      order: [["id", "ASC"]],
      attributes: ["id", "name", "description", "icon", "image", "veg_type"],
      include: [
        {
          model: SubCategory,
          as: "sub_categories",
          where: sub_category_id ? { id: sub_category_id } : undefined,
          required: false,
          attributes: ["id", "name", "description", "icon", "image", "veg_type"],
          include: [
            {
              model: Product,
              as: "products",
              required: false,
              attributes: [
                "id",
                "name",
                "description",
                "price",
                "thumbnail_image",
                "status",
                "category_id",
                "sub_category_id",
              ],
              where: vegFilter,
              include: [
                {
                  model: Restaurant,
                  as: "restaurant",
                  attributes: [
                    "id",
                    "name",
                    "restaurant_title",
                    "veg_type",
                    "distance",
                    "cooking_time",
                    "rating",
                    "latitude",
                    "longitude",
                    "image",
                    "is_active",
                  ],
                  include: [
                    {
                      model: RestaurantOffer,
                      as: "offers",
                      attributes: [
                        "id",
                        "title",
                        "description",
                        "discount_percent",
                        "valid_till",
                      ],
                    },
                    {
                      model: RestaurantTiming,
                      as: "timings",
                      attributes: [
                        "id",
                        "day_of_week",
                        "open_time",
                        "close_time",
                        "is_active",
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },

        // CATEGORY → DIRECT PRODUCTS
        {
          model: Product,
          as: "products",
          required: false,
          attributes: ["id", "name", "price", "thumbnail_image", "category_id"],
          where: vegFilter,
          include: [
            {
              model: Restaurant,
              as: "restaurant",
              attributes: [
                "id",
                "name",
                "restaurant_title",
                "veg_type",
                "distance",
                "cooking_time",
                "rating",
                "latitude",
                "longitude",
                "image",
                "is_active",
              ],
              include: [
                {
                  model: RestaurantOffer,
                  as: "offers",
                  attributes: [
                    "id",
                    "title",
                    "description",
                    "discount_percent",
                    "valid_till",
                  ],
                },
                {
                  model: RestaurantTiming,
                  as: "timings",
                  attributes: [
                    "id",
                    "day_of_week",
                    "open_time",
                    "close_time",
                    "is_active",
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    //-----------------------------------------------------------
    // STEP 3 → FILTERS LIKE RATING, PRICE, OFFERS ETC.
    //-----------------------------------------------------------
    const applyFilters = (restaurant, product) => {
      if (!restaurant) return false;

      if (filter_ids?.includes(1) && restaurant.rating < 4) return false;

      if (filter_ids?.includes(2)) {
        const time = parseInt(restaurant.cooking_time?.split("-")[0]);
        if (!time || time > 30) return false;
      }

      if (filter_ids?.includes(3) && product.price > 300) return false;

      if (filter_ids?.includes(4)) {
        if (!restaurant.offers || !restaurant.offers.some(o => o.discount_percent >= 20))
          return false;
      }

      return true;
    };

    //-----------------------------------------------------------
    // STEP 4 → RESTAURANTS MUST BE INSIDE ACTIVE DELIVERY ZONE
    //-----------------------------------------------------------
    const mapRestaurantData = (prod) => {
      const r = prod.restaurant;

      if (!applyFilters(r, prod)) return null;

      const restaurantPoint = {
        lat: parseFloat(r.latitude),
        lng: parseFloat(r.longitude)
      };

      // RESTAURANT MUST BE INSIDE ZONE
      if (!isPointInsidePolygon(restaurantPoint, activeZonePolygon)) {
        return null;
      }

      return {
        res_id: r.id,
        name: r.name,
        restaurant_title: r.restaurant_title,
        rating: r.rating,
        distance: r.distance,
        cooking_time: r.cooking_time,
        latitude: r.latitude,
        longitude: r.longitude,
        veg_type: r.veg_type,
        thumbnail_image: r.image,
        offers: r.offers || [],
        timings: r.timings || [],
        res_pro_title: "Rated for you",
      };
    };

    //-----------------------------------------------------------
    // STEP 5 → Final Response Structure
    //-----------------------------------------------------------
    const recommendedMap = {};
    const allRestaurantsMap = {};
    const allSubCategories = [];

    categories.forEach((cat) => {
      cat.sub_categories.forEach((sub) => {

        const subProducts = sub.products
          .map((prod) => ({
            p_id: prod.id,
            name: prod.name,
            description: prod.description,
            price: prod.price,
            thumbnail_image: prod.thumbnail_image,
            status: prod.status,
            cat_id: prod.category_id,
            sub_cat_id: prod.sub_category_id,
            restaurant: mapRestaurantData(prod),
            res_pro_title: "Dish",
          }))
          .filter((p) => p.restaurant !== null);

        allSubCategories.push({
          cat_id: cat.id,
          sub_cat_id: sub.id,
          name: sub.name,
          description: sub.description,
          icon: sub.icon,
          image: sub.image,
          veg_type: sub.veg_type,
          products: subProducts,
        });

        subProducts.forEach((prod) => {
          const r = prod.restaurant;
          if (!r) return;

          if (!recommendedMap[r.res_id]) recommendedMap[r.res_id] = r;
          if (!allRestaurantsMap[r.res_id])
            allRestaurantsMap[r.res_id] = { ...r, banner: [] };

          allRestaurantsMap[r.res_id].banner.push({
            p_id: prod.p_id,
            name: prod.name,
            price: prod.price,
            image: prod.thumbnail_image,
            res_pro_title: "Dish",
          });
        });
      });

      // Category Level Products
      cat.products.forEach((prod) => {
        const r = mapRestaurantData(prod);
        if (!r) return;

        if (!recommendedMap[r.res_id]) recommendedMap[r.res_id] = r;

        if (!allRestaurantsMap[r.res_id])
          allRestaurantsMap[r.res_id] = { ...r, banner: [] };

        allRestaurantsMap[r.res_id].banner.push({
          p_id: prod.id,
          name: prod.name,
          price: prod.price,
          image: prod.thumbnail_image,
          res_pro_title: "Dish",
        });
      });
    });

    //-----------------------------------------------------------
    // FINAL RESPONSE
    //-----------------------------------------------------------
    return res.json({
      status: true,
      message: "Success!",
      data: {
        latitude,
        longitude,
        sub_categories: allSubCategories,
        recommended_for_you: {
          title: "Recommended for you",
          restaurants: Object.values(recommendedMap),
        },
        all_restaurants: {
          title: "Restaurant deliver to you",
          total_count: Object.values(allRestaurantsMap).length,
          restaurants: Object.values(allRestaurantsMap),
        },
      },
    });

  } catch (err) {
    console.log(err);
    return res.status(500).json({ status: false, message: err.message });
  }
};




exports.filterRestaurants = async (req, res) => {
  try {
    const { rating, time, price, great_offer } = req.query;

    // ✅ Active restaurants only
    let where = { is_active: 1 };

    // ✅ Rating filter
    if (rating) {
      where.rating = { [Op.gte]: parseFloat(rating) };
    }

    // ✅ Delivery time filter ("30-35 Min" -> check min <= time)
    if (time) {
      where.delivery_time = { [Op.ne]: null }; // just ensure not null
    }

    // ✅ Fetch restaurants with products + offers
    const restaurants = await Restaurant.findAll({
      where,
      attributes: [
        "id",
        "name",
        "restaurant_title",
        "veg_type",
        "address",
        "distance",
        "latitude",
        "longitude",
        "image",
        "is_active",
        "delivery_time",
        "rating",
      ],
      include: [
        {
          model: Product,
          as: "products",
          attributes: ["id", "name", "price", "thumbnail_image", "category_id"],
          include: [
            {
              model: ProductVariant,
              as: "variants",
              attributes: ["id", "product_id", "price"],
            },
          ],
        },
        {
          model: RestaurantOffer,
          as: "offers",
          attributes: ["id", "title", "description", "discount_percent"],
        },
      ],
    });

    // ✅ Mapping + Filtering logic
    const recommendedRestaurantsMap = {};
    const restaurantsMap = {};

    restaurants.forEach((res) => {
      // --- Delivery time filter ---
      if (time && res.delivery_time) {
        const minTime = parseInt(res.delivery_time.split("-")[0]); // e.g. "30-35 Min"
        if (isNaN(minTime) || minTime > parseInt(time)) return; // skip if not matching
      }

      // --- Great offer filter ---
  if (great_offer && Array.isArray(res.offers)) {
    const minOffer = parseFloat(great_offer);
    const filteredOffers = res.offers.filter(
        (o) => parseFloat(o.discount_percent) >= minOffer
    );
    if (filteredOffers.length === 0) return; // skip restaurant
    res.offers = filteredOffers;
}




      // --- Price filter ---
      if (price) {
        let hasCheapProduct = false;
        res.products.forEach((prod) => {
          if (prod.variants && prod.variants.length > 0) {
            prod.variants.forEach((v) => {
              if (v.price <= parseFloat(price)) {
                hasCheapProduct = true;
              }
            });
          } else if (prod.price && prod.price <= parseFloat(price)) {
            hasCheapProduct = true;
          }
        });
        if (!hasCheapProduct) return;
      }

      // --- Recommended for you ---
      if (!recommendedRestaurantsMap[res.id]) {
        recommendedRestaurantsMap[res.id] = {
          res_id: res.id,
          name: res.name,
          restaurant_title: res.restaurant_title,
          rating: res.rating,
          distance: res.distance,
          delivery_time: res.delivery_time,
          latitude: res.latitude,
          longitude: res.longitude,
          veg_type: res.veg_type,
          thumbnail_image: res.image,
        };
      }

      // --- All restaurants (deliver to you) ---
      if (!restaurantsMap[res.id]) {
        const restaurantProducts = res.products.map((p) => ({
          p_id: p.id,
          name: p.name,
          price: p.price,
          image: p.thumbnail_image,
        }));

        restaurantsMap[res.id] = {
          res_id: res.id,
          name: res.name,
          restaurant_title: res.restaurant_title,
          rating: res.rating,
          distance: res.distance,
          delivery_time: res.delivery_time,
          latitude: res.latitude,
          longitude: res.longitude,
          veg_type: res.veg_type,
          offers: res.offers || [],
          banner: restaurantProducts,
        };
      }
    });

    // ✅ Final response format
    const recommended_for_you = {
      title: "Recommended for you",
      restaurants: Object.values(recommendedRestaurantsMap),
    };

    const allRestaurants = {
      title: "Restaurant deliver to you",
      total_count: Object.values(restaurantsMap).length,
      restaurants: Object.values(restaurantsMap),
    };

    return res.json({
      status: true,
      message: "Restaurants fetched successfully",
      data: {
        recommended_for_you,
        all_restaurants: allRestaurants,
      },
    });
  } catch (error) {
    console.error("❌ Filter API Error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};


////////////////////////


// ─── API 1: sub_categories (category_id based, limit + offset + total) ────────
exports.getSubCategories = async (req, res) => {
  try {
    const { latitude, longitude, cat_id, filter_ids, veg_only } = req.body;
    const vegFilter = veg_only ? { veg_type: "veg" } : {};
    const limit = parseInt(req.body.limit) || 10;
    const offset = parseInt(req.body.offset) || 0;

    if (!latitude || !longitude) return res.json({ status: false, message: "Latitude & Longitude required!" });
    if (!cat_id) return res.json({ status: false, message: "cat_id is required!" });

    const { activeZonePolygon, mapRestaurantData } = await getZoneAndMapper(latitude, longitude, filter_ids);
    if (!activeZonePolygon) return res.json({ status: false, message: "Service not available in your area.", data: { total_count: 0, sub_categories: [] } });

    const categories = await Category.findAll({
      where: { id: cat_id, status: 1 },
      attributes: ["id", "name"],
      include: [{
        model: SubCategory,
        as: "sub_categories",
        required: false,
        attributes: ["id", "name", "description", "icon", "image", "veg_type"],
        limit,
        offset,
        include: [{
          model: Product,
          as: "products",
          required: false,
          attributes: ["id", "name", "description", "price", "thumbnail_image", "status", "category_id", "sub_category_id"],
          where: vegFilter,
          include: [{
            model: Restaurant,
            as: "restaurant",
            attributes: ["id", "name", "restaurant_title", "veg_type", "distance", "cooking_time", "rating", "latitude", "longitude", "image", "is_active"],
            include: [
              { model: RestaurantOffer, as: "offers", attributes: ["id", "title", "description", "discount_percent", "valid_till"] },
              { model: RestaurantTiming, as: "timings", attributes: ["id", "day_of_week", "open_time", "close_time", "is_active"] },
            ],
          }],
        }],
      }],
    });

    const total_count = await SubCategory.count({ where: { category_id: cat_id, status: 1 } });

    const allSubCategories = [];
    categories.forEach((cat) => {
      cat.sub_categories.forEach((sub) => {
        const subProducts = sub.products
          .map((prod) => ({
            p_id: prod.id, name: prod.name, description: prod.description,
            price: prod.price, thumbnail_image: prod.thumbnail_image,
            status: prod.status, cat_id: prod.category_id, sub_cat_id: prod.sub_category_id,
            restaurant: mapRestaurantData(prod), res_pro_title: "Dish",
          }))
          .filter((p) => p.restaurant !== null);

        allSubCategories.push({
          cat_id: cat.id, sub_cat_id: sub.id, name: sub.name,
          description: sub.description, icon: sub.icon, image: sub.image,
          veg_type: sub.veg_type, products: subProducts,
        });
      });
    });

    return res.json({
      status: true, message: "Sub categories fetched successfully!",
      data: { latitude, longitude, total_count, sub_categories: allSubCategories },
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ─── API 2: recommended_for_you (limit + offset + total) ─────────────────────
exports.getRecommended = async (req, res) => {
  try {
    const { latitude, longitude, cat_id, filter_ids, veg_only } = req.body;
    const vegFilter = veg_only ? { veg_type: "veg" } : {};
    const limit = parseInt(req.body.limit) || 10;
    const offset = parseInt(req.body.offset) || 0;

    if (!latitude || !longitude) return res.json({ status: false, message: "Latitude & Longitude required!" });

    const { activeZonePolygon, mapRestaurantData: baseMapper } = await getZoneAndMapper(latitude, longitude, filter_ids);
    if (!activeZonePolygon) return res.json({ status: false, message: "Service not available in your area.", data: { total_count: 0, restaurants: [] } });

    // veg_only check wrap karo
    const mapRestaurantData = (prod) => {
      const r = prod.restaurant;
      if (veg_only && r?.veg_type !== "veg") return null;
      return baseMapper(prod);
    };

    const categories = await Category.findAll({
      where: cat_id ? { id: cat_id, status: 1 } : { status: 1 },
      attributes: ["id"],
      include: [
        {
          model: SubCategory, as: "sub_categories", required: false, attributes: ["id"],
          include: [{
            model: Product, as: "products", required: false,
            attributes: ["id", "name", "price", "thumbnail_image", "category_id", "sub_category_id"],
            where: vegFilter,
            include: [{
              model: Restaurant, as: "restaurant",
              attributes: ["id", "name", "restaurant_title", "veg_type", "distance", "cooking_time", "rating", "latitude", "longitude", "image", "is_active"],
              include: [
                { model: RestaurantOffer, as: "offers", attributes: ["id", "title", "description", "discount_percent", "valid_till"] },
                { model: RestaurantTiming, as: "timings", attributes: ["id", "day_of_week", "open_time", "close_time", "is_active"] },
              ],
            }],
          }],
        },
        {
          model: Product, as: "products", required: false,
          attributes: ["id", "name", "price", "thumbnail_image", "category_id"],
          where: vegFilter,
          include: [{
            model: Restaurant, as: "restaurant",
            attributes: ["id", "name", "restaurant_title", "veg_type", "distance", "cooking_time", "rating", "latitude", "longitude", "image", "is_active"],
            include: [
              { model: RestaurantOffer, as: "offers", attributes: ["id", "title", "description", "discount_percent", "valid_till"] },
              { model: RestaurantTiming, as: "timings", attributes: ["id", "day_of_week", "open_time", "close_time", "is_active"] },
            ],
          }],
        },
      ],
    });

    const recommendedMap = {};
    categories.forEach((cat) => {
      cat.sub_categories.forEach((sub) => {
        sub.products.forEach((prod) => {
          const r = mapRestaurantData(prod);
          if (r && !recommendedMap[r.res_id]) recommendedMap[r.res_id] = r;
        });
      });
      cat.products.forEach((prod) => {
        const r = mapRestaurantData(prod);
        if (r && !recommendedMap[r.res_id]) recommendedMap[r.res_id] = r;
      });
    });

    const allRestaurants = Object.values(recommendedMap);
    const total_count = allRestaurants.length;
    const paginated = allRestaurants.slice(offset, offset + limit);

    return res.json({
      status: true, message: "Recommended restaurants fetched successfully!",
      data: {
        latitude, longitude,
        recommended_for_you: { title: "Recommended for you", total_count, restaurants: paginated },
      },
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ─── API 3: all_restaurants (limit + offset + total) ─────────────────────────
exports.getAllRestaurants = async (req, res) => {
  try {
    const { latitude, longitude, cat_id, filter_ids, veg_only } = req.body;
    const vegFilter = veg_only ? { veg_type: "veg" } : {};
    const limit = parseInt(req.body.limit) || 10;
    const offset = parseInt(req.body.offset) || 0;

    if (!latitude || !longitude) return res.json({ status: false, message: "Latitude & Longitude required!" });

    const { activeZonePolygon, mapRestaurantData } = await getZoneAndMapper(latitude, longitude, filter_ids);
    if (!activeZonePolygon) return res.json({ status: false, message: "Service not available in your area.", data: { total_count: 0, restaurants: [] } });

    const categories = await Category.findAll({
      where: cat_id ? { id: cat_id, status: 1 } : { status: 1 },
      attributes: ["id"],
      include: [
        {
          model: SubCategory, as: "sub_categories", required: false, attributes: ["id"],
          include: [{
            model: Product, as: "products", required: false,
            attributes: ["id", "name", "price", "thumbnail_image", "category_id", "sub_category_id"],
            include: [{
              model: Restaurant, as: "restaurant",
              attributes: ["id", "name", "restaurant_title", "veg_type", "distance", "cooking_time", "rating", "latitude", "longitude", "image", "is_active"],
              include: [
                { model: RestaurantOffer, as: "offers", attributes: ["id", "title", "description", "discount_percent", "valid_till"] },
                { model: RestaurantTiming, as: "timings", attributes: ["id", "day_of_week", "open_time", "close_time", "is_active"] },
              ],
            }],
          }],
        },
        {
          model: Product, as: "products", required: false,
          attributes: ["id", "name", "price", "thumbnail_image", "category_id"],
          include: [{
            model: Restaurant, as: "restaurant",
            attributes: ["id", "name", "restaurant_title", "veg_type", "distance", "cooking_time", "rating", "latitude", "longitude", "image", "is_active"],
            include: [
              { model: RestaurantOffer, as: "offers", attributes: ["id", "title", "description", "discount_percent", "valid_till"] },
              { model: RestaurantTiming, as: "timings", attributes: ["id", "day_of_week", "open_time", "close_time", "is_active"] },
            ],
          }],
        },
      ],
    });

    const allRestaurantsMap = {};
    categories.forEach((cat) => {
      cat.sub_categories.forEach((sub) => {
        sub.products.forEach((prod) => {
          const r = mapRestaurantData(prod);
          if (!r) return;
          if (!allRestaurantsMap[r.res_id]) allRestaurantsMap[r.res_id] = { ...r, banner: [] };
          allRestaurantsMap[r.res_id].banner.push({ p_id: prod.id, name: prod.name, price: prod.price, image: prod.thumbnail_image, res_pro_title: "Dish" });
        });
      });
      cat.products.forEach((prod) => {
        const r = mapRestaurantData(prod);
        if (!r) return;
        if (!allRestaurantsMap[r.res_id]) allRestaurantsMap[r.res_id] = { ...r, banner: [] };
        allRestaurantsMap[r.res_id].banner.push({ p_id: prod.id, name: prod.name, price: prod.price, image: prod.thumbnail_image, res_pro_title: "Dish" });
      });
    });

    const allList = Object.values(allRestaurantsMap);
    const total_count = allList.length;
    const paginated = allList.slice(offset, offset + limit);

    return res.json({
      status: true, message: "All restaurants fetched successfully!",
      data: {
        latitude, longitude,
        all_restaurants: { title: "Restaurant deliver to you", total_count, restaurants: paginated },
      },
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};
