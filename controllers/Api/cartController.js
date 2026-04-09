const { Op, Sequelize } = require("sequelize");
const { Cart, Product,Restaurant  } = require("../../models"); // import from index.js
const sequelize = require("../../config/db");

exports.addOrRemoveCart = async (req, res) => {
  try {
    let { user_id, product_id, restaurant_id, quantity, variant_id } = req.body;

    product_id = parseInt(product_id) || 0;
    restaurant_id = parseInt(restaurant_id) || null;
    variant_id = variant_id ? parseInt(variant_id) : null;
    quantity = quantity !== "" && quantity !== null ? parseInt(quantity) : 0;

    if (!user_id) {
      return res.status(400).json({
        status: false,
        message: "user_id is required",
      });
    }

    // ✅ STEP 1: Agar product_id null ya 0 hai → direct remove
    if (!product_id || product_id === 0) {
      await Cart.destroy({
        where: { user_id, restaurant_id },
      });

      return res.json({
        status: true,
        message: "Product removed from cart (product_id null/0)",
      });
    }

    // ✅ STEP 2: product + variant ke sath check
    let cartItem = await Cart.findOne({
      where: { user_id, product_id, restaurant_id, variant_id },
    });

    if (cartItem) {
      if (quantity === 0) {
        await Cart.destroy({
          where: { user_id, product_id, restaurant_id, variant_id },
        });

        return res.json({
          status: true,
          message: "Product removed from cart (quantity 0)",
        });
      }

      await Cart.update(
        { quantity },
        { where: { id: cartItem.id } }
      );

      return res.json({
        status: true,
        message: "Cart updated successfully",
      });
    } else {
      if (quantity > 0) {
        await Cart.create({
          user_id,
          product_id,
          restaurant_id,
          variant_id,
          quantity,
        });

        return res.json({
          status: true,
          message: "Product added to cart successfully",
        });
      }

      return res.json({
        status: false,
        message: "Quantity must be greater than 0 to add",
      });
    }
  } catch (error) {
    console.error("❌ Error in addOrRemoveCart:", error);
    return res.status(500).json({
      status: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
};


exports.getCart = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        status: false,
        message: "user_id is required",
      });
    }

    // ✅ Raw SQL join with variants
    const [rows] = await sequelize.query(
      `SELECT 
         c.id AS cart_id, 
         c.quantity, 
         c.variant_id, 
         r.id AS restaurant_id, 
         r.name AS restaurant_name, 
         r.image AS restaurant_image,
         r.latitude, 
         r.longitude, 
         r.cooking_time,
         p.id AS product_id, 
         p.name AS product_name, 
         p.price AS base_price, 
         p.thumbnail_image,
         v.id AS variant_id,
         v.name AS variant_name,
         v.price AS variant_price
       FROM cart c
       JOIN restaurants r ON c.restaurant_id = r.id
       JOIN products p ON c.product_id = p.id
       LEFT JOIN product_variants v ON c.variant_id = v.id
       WHERE c.user_id = ?
       ORDER BY r.id`,
      {
        replacements: [user_id],
      }
    );

    if (!rows.length) {
      return res.json({
        status: true,
        message: "Cart is empty",
        data: [],
        charges: {},
      });
    }

    // ✅ Restaurant-wise grouping
    const restaurantMap = new Map();

    rows.forEach((row) => {
      const restId = row.restaurant_id;

      if (!restaurantMap.has(restId)) {
        restaurantMap.set(restId, {
          id: restId,
          name: row.restaurant_name,
          image: row.restaurant_image,
          cooking_time: row.cooking_time,
          latitude: row.latitude,
          longitude: row.longitude,
          products: [],
        });
      }

      restaurantMap.get(restId).products.push({
        id: row.product_id,
        name: row.product_name,
        base_price: row.base_price,
        thumbnail_image: row.thumbnail_image,
        quantity: row.quantity,
        cart_id: row.cart_id,
        variant: row.variant_id
          ? {
              id: row.variant_id,
              name: row.variant_name,
              price: row.variant_price,
            }
          : null,
      });
    });

    // ✅ Active charges fetch karo
    const [charges] = await sequelize.query(
      `SELECT charge_name, amount 
       FROM charges 
       WHERE is_active = 1`
    );

    const chargesObj = {};
    charges.forEach((c) => {
      chargesObj[c.charge_name] = c.amount;
    });

    // ✅ Final response
    const finalData = Array.from(restaurantMap.values());

    return res.json({
      status: true,
      message: "Cart fetched successfully",
      data: finalData,
      charges: chargesObj,
    });

  } catch (error) {
    console.error("❌ getCart error:", error);
    return res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};



