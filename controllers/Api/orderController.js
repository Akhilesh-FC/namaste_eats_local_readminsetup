const { CASHFREE_CONFIG } = require("../../config/cashFreeConfig");
//const sequelize = require("../../config/db");

const { Op, Sequelize } = require("sequelize");
const sequelize = require("../../config/db");


const code = `NE${Math.floor(1000 + Math.random() * 9000)}`;
const PDFDocument = require("pdfkit");
const admin = require("../../config/firebase.js");
const { User,Cart, ProductVariant, RestaurantOffer, Order, OrderItem, Product,Restaurant,Transaction ,Payin,Wallet,CouponHistory } = require("../../models");
const fs = require("fs");
const path = require("path");
const Address = require("../../models/Address");
const Coupon = require("../../models/Coupon");

Wallet.addHook("beforeCreate", (wallet, options) => {
  console.log("🔥 BEFORE WALLET CREATE:", wallet.dataValues);
});
Wallet.addHook("afterCreate", (wallet, options) => {
  console.log("🔥 AFTER WALLET CREATE:", wallet.dataValues);
});

const initiateCheckout = async (req, res) => {
	
  try {
    const {
      user_id,
      coupon_id,
      coupon_discount_amount,
      charges,
      payment_status,
      payable_amount,
      wallet_payable_amount, // NEW OPTIONAL FIELD
      amount_as_per_restaurant,
      payment_order_id,
      address_id,
      paymode,
      latitude,
      longitude,
      gst,
      delivery_charges,
      current_address,
    } = req.body;

    if (!user_id || !Array.isArray(amount_as_per_restaurant) || amount_as_per_restaurant.length === 0) {
      return res.status(200).json({
        status: false,
        message: "Missing required fields or amount_as_per_restaurant is empty",
      });
    }

    // ------------------------------------------------------------
    // COUPON VALIDATION (NO CHANGE)
    // ------------------------------------------------------------
    if (coupon_id) {
      const coupon = await Coupon.findOne({ where: { id: coupon_id, is_active: true } });

      if (!coupon) {
        return res.status(200).json({
          status: false,
          message: "Invalid or inactive coupon",
        });
      }

      const today = new Date();
      if (new Date(coupon.validity) < today) {
        return res.status(200).json({
          status: false,
          message: "Coupon has expired",
        });
      }

      const alreadyUsed = await CouponHistory.findOne({
        where: { user_id, coupon_id },
      });

      if (alreadyUsed) {
        return res.status(200).json({
          status: false,
          message: "You have already used this coupon once",
        });
      }

      if (parseFloat(payable_amount) < parseFloat(coupon.min_availability)) {
        return res.status(200).json({
          status: false,
          message: `Minimum order amount to apply this coupon is ₹${coupon.min_availability}`,
        });
      }
    }

// ------------------------------------------------------------
// AUTO WALLET DEDUCTION (ONLY FOR ONLINE PAYMENT)
// COD & WALLET => NO AUTO WALLET
// ------------------------------------------------------------
let autoWalletDeduct = 0;

if (paymode !== "COD" && paymode !== "WALLET") {
  const userWallet = await Wallet.findOne({
    where: { entity_id: user_id, entity_type: "USER" },
  });

  if (userWallet && parseFloat(userWallet.total_balance) > 0) {
    autoWalletDeduct = Math.min(
      parseFloat(userWallet.total_balance),
      parseFloat(payable_amount)
    );

    const newTotalBalance =
      parseFloat(userWallet.total_balance) - autoWalletDeduct;

    await userWallet.update({
      total_balance: newTotalBalance,
      last_transaction_amount: autoWalletDeduct,
      last_transaction_type: "DEBIT",
      last_transaction_time: new Date(),
      last_transaction_id: "AUTO-WALLET-" + Date.now(),
    });

    await Transaction.create({
      entity_id: user_id,
      entity_type: "USER",
      order_id: payment_order_id || null,
      amount: autoWalletDeduct,
      type: "DEBIT",
      remarks: "Auto wallet deduction for online payment (total balance)",
    });
  }
}


    // ------------------------------------------------------------
    // WALLET PAYMENT CHECK (FULL PAYMENT) — NO CHANGE
    // ------------------------------------------------------------
   if (paymode === "WALLET") {
  const userWallet = await Wallet.findOne({
    where: { entity_id: user_id, entity_type: "USER" },
  });

  if (parseFloat(userWallet.total_balance) < parseFloat(payable_amount)) {
    return res.status(200).json({
      status: false,
      message: "Insufficient wallet balance",
    });
  }

  const newTotalBalance =
    parseFloat(userWallet.total_balance) - parseFloat(payable_amount);

  await userWallet.update({
    total_balance: newTotalBalance,
    last_transaction_amount: payable_amount,
    last_transaction_type: "DEBIT",
    last_transaction_time: new Date(),
    last_transaction_id: "WALLET-" + Date.now(),
  });

  await Transaction.create({
    entity_id: user_id,
    entity_type: "USER",
    order_id: payment_order_id || null,
    amount: payable_amount,
    type: "DEBIT",
    remarks: "Full wallet payment (total balance)",
  });
}

    // ------------------------------------------------------------
    // CREATE ORDERS PER RESTAURANT (NO CHANGE)
    // ------------------------------------------------------------
    const createdOrders = [];

    for (let item of amount_as_per_restaurant) {
      const cartItems = await Cart.findAll({
        where: { user_id, restaurant_id: item.restaurant_id },
      });

      if (!cartItems.length) {
        return res.status(200).json({
          status: false,
          message: `No cart found for restaurant_id ${item.restaurant_id}`,
        });
      }

      const randomOrderId = `NE${Math.floor(1000 + Math.random() * 9000)}`;
      const deliveryPin = Math.floor(1000 + Math.random() * 9000).toString();
      let totalRestaurantAmount = 0;

      for (let cartItem of cartItems) {
        const product = await Product.findOne({
          where: { id: cartItem.product_id },
        });

        if (!product) {
          return res.status(200).json({
            status: false,
            message: `Product not found for product_id ${cartItem.product_id}`,
          });
        }

        let productPrice = product.price;
        if (cartItem.variant_id) {
          const variant = await ProductVariant.findOne({
            where: { id: cartItem.variant_id },
          });
          if (variant) productPrice = variant.price;
        }

        const productTotal = productPrice * cartItem.quantity;
        totalRestaurantAmount += productTotal;

        const newOrder = await Order.create({
          order_id: randomOrderId,
          user_id,
          restaurant_id: item.restaurant_id,
          product_id: cartItem.product_id,
          product_variant_id: cartItem.variant_id || null,
          product_quantity: cartItem.quantity,
          coupon_discount_amount: coupon_discount_amount || 0,
          charges,
          payment_status:
            paymode === "COD"
              ? "PENDING"
              : paymode === "WALLET"
              ? "SUCCESS"
              : payment_status,
          payable_amount,
          amount: payable_amount,
          cf_order_id: payment_order_id,
          paymode,
          address_id,
          latitude,
          longitude,
          gst,
          delivery_charges,
          current_address,
          delivery_pin: deliveryPin,
        });

        createdOrders.push(newOrder);
      }

      await Cart.destroy({
        where: { user_id, restaurant_id: item.restaurant_id },
      });

      await Payin.create({
        user_id: user_id,
        restaurant_id: item.restaurant_id,
        order_id: randomOrderId,
        amount: payable_amount,
        payment_method: paymode,
        status: paymode === "COD" ? "PENDING" : "SUCCESS",
      });

      await Transaction.create({
        entity_id: item.restaurant_id,
        entity_type: "RESTAURANT",
        order_id: randomOrderId,
        amount: payable_amount,
        type: "CREDIT",
        remarks: "Order payment received",
      });

      const restWallet = await Wallet.findOne({
        where: {
          entity_id: item.restaurant_id,
          entity_type: "RESTAURANT",
        },
      });

      if (!restWallet) {
        return res.status(500).json({
          status: false,
          message: `Restaurant wallet not found for restaurant_id ${item.restaurant_id}. Please create wallet at registration.`,
        });
      }

      const newTotal =
        parseFloat(restWallet.total_balance) + parseFloat(totalRestaurantAmount);
      const newCurrent =
        parseFloat(restWallet.current_balance) + parseFloat(totalRestaurantAmount);

      await restWallet.update({
        total_balance: newTotal,
        current_balance: newCurrent,
        last_transaction_id: randomOrderId,
        last_transaction_amount: totalRestaurantAmount,
        last_transaction_type: "CREDIT",
        last_transaction_time: new Date(),
      });

      if (coupon_id) {
        await CouponHistory.create({
          coupon_id,
          user_id,
          order_id: randomOrderId,
          discount_amount: coupon_discount_amount || 0,
          status: "SUCCESS",
          remarks: "Coupon applied successfully",
        });
      }
    }

    return res.json({
      status: true,
      message: "Orders created successfully",
      orders: createdOrders,
    });

  } catch (err) {
    console.error("❌ initiateCheckout Error:", err);
    return res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};


const initiateCheckout_old = async (req, res) => {
  try {
    const {
      user_id,
      coupon_id,
      coupon_discount_amount,
      charges,
      payment_status,
      payable_amount,
      wallet_payable_amount, // NEW OPTIONAL FIELD
      amount_as_per_restaurant,
      payment_order_id,
      address_id,
      paymode,
      latitude,
      longitude,
      gst,
      delivery_charges,
      current_address,
    } = req.body;

    if (!user_id || !Array.isArray(amount_as_per_restaurant) || amount_as_per_restaurant.length === 0) {
      return res.status(200).json({
        status: false,
        message: "Missing required fields or amount_as_per_restaurant is empty",
      });
    }

    // ------------------------------------------------------------
    // COUPON VALIDATION (NO CHANGE)
    // ------------------------------------------------------------
    if (coupon_id) {
      const coupon = await Coupon.findOne({ where: { id: coupon_id, is_active: true } });

      if (!coupon) {
        return res.status(200).json({
          status: false,
          message: "Invalid or inactive coupon",
        });
      }

      const today = new Date();
      if (new Date(coupon.validity) < today) {
        return res.status(200).json({
          status: false,
          message: "Coupon has expired",
        });
      }

      const alreadyUsed = await CouponHistory.findOne({
        where: { user_id, coupon_id },
      });

      if (alreadyUsed) {
        return res.status(200).json({
          status: false,
          message: "You have already used this coupon once",
        });
      }

      if (parseFloat(payable_amount) < parseFloat(coupon.min_availability)) {
        return res.status(200).json({
          status: false,
          message: `Minimum order amount to apply this coupon is ₹${coupon.min_availability}`,
        });
      }
    }

    // ------------------------------------------------------------
    // EXTRA PARTIAL WALLET PAYMENT (NEW FEATURE)
    // ------------------------------------------------------------
    if (wallet_payable_amount && parseFloat(wallet_payable_amount) > 0) {
      const userWallet = await Wallet.findOne({
        where: { entity_id: user_id, entity_type: "USER" },
      });

      if (!userWallet) {
        return res.status(200).json({
          status: false,
          message: "Wallet not found for this user",
        });
      }

      if (parseFloat(userWallet.current_balance) < parseFloat(wallet_payable_amount)) {
        return res.status(200).json({
          status: false,
          message: "Insufficient wallet balance for wallet_payable_amount",
        });
      }

      const newBalance =
        parseFloat(userWallet.current_balance) - parseFloat(wallet_payable_amount);

      await userWallet.update({
        current_balance: newBalance,
        last_transaction_amount: wallet_payable_amount,
        last_transaction_type: "DEBIT",
        last_transaction_time: new Date(),
        last_transaction_id: "PARTIAL-WALLET-" + Date.now(),
      });

      await Transaction.create({
        entity_id: user_id,
        entity_type: "USER",
        order_id: payment_order_id || null,
       amount: parseFloat(wallet_payable_amount || 0), 
        type: "DEBIT",
        remarks: "Partial wallet amount deducted",
      });
    }

    // ------------------------------------------------------------
    // WALLET PAYMENT CHECK (FULL PAYMENT) — NO CHANGE
    // ------------------------------------------------------------
    if (paymode === "WALLET") {
      const userWallet = await Wallet.findOne({
        where: { entity_id: user_id, entity_type: "USER" },
      });

      if (!userWallet) {
        return res.status(200).json({
          status: false,
          message: "Wallet not found for this user",
        });
      }

      if (parseFloat(userWallet.current_balance) < parseFloat(payable_amount)) {
        return res.status(200).json({
          status: false,
          message: "Insufficient wallet balance",
        });
      }

      const newBalance =
        parseFloat(userWallet.current_balance) - parseFloat(payable_amount);

      await userWallet.update({
        current_balance: newBalance,
        last_transaction_amount: payable_amount,
        last_transaction_type: "DEBIT",
        last_transaction_time: new Date(),
        last_transaction_id: "WALLET-" + Date.now(),
      });

      await Transaction.create({
        entity_id: user_id,
        entity_type: "USER",
        order_id: payment_order_id || null,
        amount: payable_amount,
        type: "DEBIT",
        remarks: "Amount paid via wallet",
      });
    }

    // ------------------------------------------------------------
    // CREATE ORDERS PER RESTAURANT (NO CHANGE)
    // ------------------------------------------------------------
    const createdOrders = [];

    for (let item of amount_as_per_restaurant) {
      const cartItems = await Cart.findAll({
        where: { user_id, restaurant_id: item.restaurant_id },
      });

      if (!cartItems.length) {
        return res.status(200).json({
          status: false,
          message: `No cart found for restaurant_id ${item.restaurant_id}`,
        });
      }

      const randomOrderId = `NE${Math.floor(1000 + Math.random() * 9000)}`;
      const deliveryPin = Math.floor(1000 + Math.random() * 9000).toString();
      let totalRestaurantAmount = 0;

      for (let cartItem of cartItems) {
        const product = await Product.findOne({
          where: { id: cartItem.product_id },
        });

        if (!product) {
          return res.status(200).json({
            status: false,
            message: `Product not found for product_id ${cartItem.product_id}`,
          });
        }

        let productPrice = product.price;
        if (cartItem.variant_id) {
          const variant = await ProductVariant.findOne({
            where: { id: cartItem.variant_id },
          });
          if (variant) productPrice = variant.price;
        }

        const productTotal = productPrice * cartItem.quantity;
        totalRestaurantAmount += productTotal;

        const newOrder = await Order.create({
          order_id: randomOrderId,
          user_id,
          restaurant_id: item.restaurant_id,
          product_id: cartItem.product_id,
          product_variant_id: cartItem.variant_id || null,
          product_quantity: cartItem.quantity,
          coupon_discount_amount: coupon_discount_amount || 0,
          charges,
          payment_status:
            paymode === "COD"
              ? "PENDING"
              : paymode === "WALLET"
              ? "SUCCESS"
              : payment_status,
          payable_amount,
          amount: productTotal,
          cf_order_id: payment_order_id,
          paymode,
          address_id,
          latitude,
          longitude,
          gst,
          delivery_charges,
          current_address,
          delivery_pin: deliveryPin,
        });

        createdOrders.push(newOrder);
      }

      await Cart.destroy({
        where: { user_id, restaurant_id: item.restaurant_id },
      });

      await Payin.create({
        user_id: user_id,
        restaurant_id: item.restaurant_id,
        order_id: randomOrderId,
        amount: totalRestaurantAmount,
        payment_method: paymode,
        status: paymode === "COD" ? "PENDING" : "SUCCESS",
      });

      await Transaction.create({
        entity_id: item.restaurant_id,
        entity_type: "RESTAURANT",
        order_id: randomOrderId,
        amount: totalRestaurantAmount,
        type: "CREDIT",
        remarks: "Order payment received",
      });

      const restWallet = await Wallet.findOne({
        where: {
          entity_id: item.restaurant_id,
          entity_type: "RESTAURANT",
        },
      });

      if (!restWallet) {
        return res.status(500).json({
          status: false,
          message: `Restaurant wallet not found for restaurant_id ${item.restaurant_id}. Please create wallet at registration.`,
        });
      }

      const newTotal =
        parseFloat(restWallet.total_balance) + parseFloat(totalRestaurantAmount);
      const newCurrent =
        parseFloat(restWallet.current_balance) + parseFloat(totalRestaurantAmount);

      await restWallet.update({
        total_balance: newTotal,
        current_balance: newCurrent,
        last_transaction_id: randomOrderId,
        last_transaction_amount: totalRestaurantAmount,
        last_transaction_type: "CREDIT",
        last_transaction_time: new Date(),
      });

      if (coupon_id) {
        await CouponHistory.create({
          coupon_id,
          user_id,
          order_id: randomOrderId,
          discount_amount: coupon_discount_amount || 0,
          status: "SUCCESS",
          remarks: "Coupon applied successfully",
        });
      }
    }

    return res.json({
      status: true,
      message: "Orders created successfully",
      orders: createdOrders,
    });

  } catch (err) {
    console.error("❌ initiateCheckout Error:", err);
    return res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

// 📌 Order Summary API
const getOrderSummary = async (req, res) => {
	console.log('sanjana')
  try {
    const { order_id } = req.body;

    // 1️⃣ Fetch orders by order_id
    const orders = await Order.findAll({
      where: { order_id },
      attributes: [
        "id",
        "order_id",
        "user_id",
        "restaurant_id",
        "product_id",
        "product_variant_id",   // ✅ include variant id
        "product_quantity",
        "amount",
        "paymode",
        "order_status",
		"delivery_pin",
        "payment_status",
        "gst",
        "delivery_charges",
        "coupon_discount_amount",
        "address_id",
        "created_at",
      ],
    });

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Order not found",
      });
    }

    // 2️⃣ Restaurant Details
    const restaurant = await Restaurant.findOne({
      where: { id: orders[0].restaurant_id },
      attributes: ["id", "name", "address", "image", "veg_type","latitude","longitude"],
    });

    // 3️⃣ User Details
    const user = await User.findOne({
      where: { id: orders[0].user_id },
      attributes: ["id", "name", "mobile_no"],
    });

    // 4️⃣ Address Details
    const address = await Address.findOne({
      where: { id: orders[0].address_id },
      attributes: ["id", "address", "phone", "name", "save_as"],
    });

    // 5️⃣ Products List with Variant details
    const productDetails = await Promise.all(
      orders.map(async (order) => {
        // ✅ Product info
        const product = await Product.findOne({
          where: { id: order.product_id },
          attributes: ["id", "name", "price","veg_type"],
        });

        let variant = null;
        let productPrice = product.price;

        // ✅ Agar order me variant ho
        if (order.product_variant_id) {
          variant = await ProductVariant.findOne({
            where: { id: order.product_variant_id },
            attributes: [
              "id",
              "name",
              "price",
              "quantity",
              "unit_type_id",
              "is_available",
            ],
          });

          if (variant) {
            productPrice = variant.price;
          }
        }

        return {
          product_id: product.id,
          product_name: product.name,
		  product_veg_type: product.veg_type,
          product_quantity: order.product_quantity,
          line_total: order.product_quantity * productPrice,

          // 🔥 Variant ka detail
          variant: variant
            ? {
                variant_id: variant.id,
                variant_name: variant.name,
                variant_price: variant.price,
                variant_quantity: variant.quantity,
                unit_type_id: variant.unit_type_id,
                is_available: variant.is_available,
              }
            : null,
        };
      })
    );

    // 6️⃣ Totals
    const subtotal = productDetails.reduce(
      (acc, item) => acc + item.line_total,
      0
    );
    const gst = Number(orders[0].gst) || 0;
    const delivery_charges = Number(orders[0].delivery_charges) || 0;
    const discount = Number(orders[0].coupon_discount_amount) || 0;

    const total_amount = subtotal + gst + delivery_charges - discount;

    // 7️⃣ Invoice file path
    const invoicePath = path.join(
      __dirname,
      `../../invoices/${orders[0].order_id}.pdf`
    );

    const invoiceUrl = `${req.protocol}://${req.get("host")}/api/order/order_invoice/${orders[0].order_id}`;

    // 8️⃣ If invoice not generated, create it
    if (!fs.existsSync(invoicePath)) {
      const doc = new PDFDocument();
      doc.pipe(fs.createWriteStream(invoicePath));

      doc.fontSize(20).text("Order Invoice", { align: "center" });
      doc.moveDown();
      doc.fontSize(12).text(`Order ID: ${orders[0].order_id}`);
      doc.text(`Restaurant: ${restaurant?.name || "N/A"}`);
      doc.text(`Customer: ${user?.name} (${user?.mobile_no})`);
      doc.text(`Delivery Address: ${address?.address}`);
      doc.moveDown();

      doc.text("Products:");
      productDetails.forEach((p) => {
        if (p.variant) {
          doc.text(
            `${p.product_name} (${p.variant.variant_name}) x ${p.product_quantity} = ₹${p.line_total}`
          );
        } else {
          doc.text(
            `${p.product_name} x ${p.product_quantity} = ₹${p.line_total}`
          );
        }
      });

      doc.moveDown();
      doc.text(`Subtotal: ₹${subtotal}`);
      doc.text(`GST: ₹${gst}`);
      doc.text(`Delivery Charges: ₹${delivery_charges}`);
      doc.text(`Discount: -₹${discount}`);
      doc.text(`Total Amount: ₹${total_amount}`);
      doc.moveDown();

      doc.text(`Payment Mode: ${orders[0].paymode}`);
      doc.text(`Payment Status: ${orders[0].payment_status}`);
      doc.text(`Order Status: ${orders[0].order_status}`);
      doc.text(`Order Date: ${orders[0].created_at}`);

      doc.end();
    }

    // 9️⃣ Final Response
    return res.status(200).json({
      status: true,
      message: "Order summary fetched successfully",
      data: {
        order_id: orders[0].order_id,
        restaurant,
        user,
        address,
        products: productDetails,
        subtotal,
        gst,
        delivery_charges,
		delivery_pin: orders[0].delivery_pin,
        discount,
        total_amount,
        paymode: orders[0].paymode,
        payment_status: orders[0].payment_status,
        order_status: orders[0].order_status,
        order_date: orders[0].created_at,
        invoice_url: invoiceUrl,
      },
    });
  } catch (error) {
    console.error("Error in getOrderSummary:", error);
    return res.status(500).json({
      status: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
};



/////////////////download invocie/////////////
const downloadInvoice = async (req, res) => {
  try {
    const { order_id } = req.params;

    // 1️⃣ Order details fetch karo
    const orders = await Order.findAll({ where: { order_id } });
    if (!orders || orders.length === 0) {
      return res.status(404).json({ status: false, message: "Order not found" });
    }

    const restaurant = await Restaurant.findOne({ where: { id: orders[0].restaurant_id } });
    const user = await User.findOne({ where: { id: orders[0].user_id } });
    const address = await Address.findOne({ where: { id: orders[0].address_id } });

    // 2️⃣ Product + Variant details
    const productDetails = await Promise.all(
      orders.map(async (order) => {
        const product = await Product.findOne({
          where: { id: order.product_id },
          attributes: ["id", "name", "price"],
        });

        let variant = null;
        let finalPrice = product.price;

        if (order.product_variant_id) {
          variant = await ProductVariant.findOne({
            where: { id: order.product_variant_id },
            attributes: ["id", "name", "price", "quantity", "unit_type_id", "is_available"],
          });

          if (variant) {
            finalPrice = variant.price;
          }
        }

        return {
          product_name: product.name,
          product_qty: order.product_quantity,
          price: finalPrice,
          total: finalPrice * order.product_quantity,
          variant: variant
            ? {
                variant_id: variant.id,
                variant_name: variant.name,
                variant_price: variant.price,
                variant_quantity: variant.quantity,
                unit_type_id: variant.unit_type_id,
                is_available: variant.is_available,
              }
            : null,
        };
      })
    );

    // 3️⃣ Totals
    const subtotal = productDetails.reduce((acc, p) => acc + p.total, 0);
    const gst = Number(orders[0].gst) || 0;
    const delivery_charges = Number(orders[0].delivery_charges) || 0;
    const discount = Number(orders[0].coupon_discount_amount) || 0;
    const total = subtotal + gst + delivery_charges - discount;

    // 4️⃣ Invoice file path
    const invoiceDir = path.join(__dirname, "..", "invoices");
    if (!fs.existsSync(invoiceDir)) fs.mkdirSync(invoiceDir);

    const filePath = path.join(invoiceDir, `${order_id}.pdf`);

    // 5️⃣ Generate PDF
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(20).text("Order Invoice", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Order ID: ${order_id}`);
    doc.text(`Restaurant: ${restaurant?.name || "N/A"}`);
    doc.text(`Customer: ${user?.name} (${user?.mobile_no})`);
    doc.text(`Delivery Address: ${address?.address}`);
    doc.moveDown();

    doc.text("Products:");
    productDetails.forEach((p) => {
      if (p.variant) {
        doc.text(
          `${p.product_name} (${p.variant.variant_name}) x ${p.product_qty} = ₹${p.total}`
        );
      } else {
        doc.text(`${p.product_name} x ${p.product_qty} = ₹${p.total}`);
      }
    });

    doc.moveDown();
    doc.text(`Subtotal: ₹${subtotal}`);
    doc.text(`GST: ₹${gst}`);
    doc.text(`Delivery Charges: ₹${delivery_charges}`);
    doc.text(`Discount: -₹${discount}`);
    doc.text(`Total Amount: ₹${total}`);
    doc.moveDown();

    doc.text(`Payment Mode: ${orders[0].paymode}`);
    doc.text(`Payment Status: ${orders[0].payment_status}`);
    doc.text(`Order Status: ${orders[0].order_status}`);
    doc.text(`Order Date: ${orders[0].created_at}`);

    doc.end();

    // 6️⃣ Jab PDF ready ho jaaye → download karwao
    stream.on("finish", () => {
      res.download(filePath);
    });

  } catch (err) {
    console.error("Error in downloadInvoice:", err);
    res.status(500).json({ status: false, message: "Error generating invoice" });
  }
};


//////////////order history////////////////////////////


const getOrderHistory = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        status: false,
        message: "user_id is required",
      });
    }

    // ✅ 1) Fetch all orders of the user
    const orders = await Order.findAll({
      where: { user_id },
      order: [["created_at", "DESC"]],
    });

    if (!orders || orders.length === 0) {
      return res.json({
        status: true,
        message: "Order history fetched successfully",
        pendingOrders: [],
        completedOrders: [],
      });
    }

    // ✅ 2) Collect unique IDs
    const restaurantIds = new Set();
    const productIds = new Set();
    const variantIds = new Set();

    for (const o of orders) {
      if (o.restaurant_id) restaurantIds.add(Number(o.restaurant_id));
      if (o.product_id) productIds.add(Number(o.product_id));
      if (o.product_variant_id) variantIds.add(Number(o.product_variant_id));
    }

    // ✅ 3) Fetch restaurants, products, variants
    const restaurants = await Restaurant.findAll({
      where: { id: { [Op.in]: Array.from(restaurantIds) } },
    });

    const products = await Product.findAll({
      where: { id: { [Op.in]: Array.from(productIds) } },
      attributes: ["id", "name", "veg_type"],
    });

    const variants = await ProductVariant.findAll({
      where: { id: { [Op.in]: Array.from(variantIds) } },
      attributes: [
        "id",
        "product_id",
        "name",
        "unit_type_id",
        "quantity",
        "price",
        "is_available",
      ],
    });

    // ✅ 4) Build lookup maps
    const restaurantMap = new Map();
    restaurants.forEach((r) => restaurantMap.set(Number(r.id), r));

    const productMap = new Map();
    products.forEach((p) => productMap.set(Number(p.id), p));

    const variantMap = new Map();
    variants.forEach((v) => variantMap.set(Number(v.id), v));

    // ✅ 5) Group orders
    const grouped = new Map();

    for (const o of orders) {
      const oid = o.order_id;
      const rest = restaurantMap.get(Number(o.restaurant_id)) || {};
      const prod = productMap.get(Number(o.product_id)) || null;
      const variant = variantMap.get(Number(o.product_variant_id)) || null;

      if (!grouped.has(oid)) {
        grouped.set(oid, {
          order_id: oid,
          restaurant: rest || null, // 🔥 full restaurant object
          payment_status: o.payment_status,
          order_status: o.order_status?.toUpperCase() || "UNKNOWN",
          order_placed_at: o.created_at,
          total_amount: 0,
		  delivery_pin: o.delivery_pin || null, // 🆕 Added here
          products: [],
        });
      }

      const priceNum = variant?.price ? parseFloat(variant.price) : 0;
      const qty = o.product_quantity || 1;
      const lineTotal = priceNum * qty;

      grouped.get(oid).products.push({
        product_id: Number(o.product_id),
        product_name: prod ? prod.name : null,
        variant_id: variant ? variant.id : null,
        variant_name: variant ? variant.name : null,
        product_veg_type: prod ? prod.veg_type : null,
        unit_type_id: variant ? variant.unit_type_id : null,
        variant_quantity: variant ? variant.quantity : null,
        variant_price: variant ? variant.price : null,
        is_available: variant ? variant.is_available : null,
        quantity: qty,
        line_total: lineTotal.toFixed(2),
      });

      grouped.get(oid).total_amount += lineTotal;
    }

    const formattedOrders = Array.from(grouped.values());

    // ✅ Normalize status to uppercase (for safety)
    formattedOrders.forEach((o) => {
      o.order_status = o.order_status?.toUpperCase();
    });

    // ✅ Categorize by status
    const pendingOrders = formattedOrders.filter(
      (o) =>
        o.order_status === "PENDING" ||
        o.order_status === "PREPARING" ||
        o.order_status === "ORDER_ACCEPT" ||
        o.order_status === "READY_TO_PICKUP"||
		 o.order_status === "CANCELLED"||
		 o.order_status === "ON_THE_WAY"||
		 o.order_status === "ASSIGN_TO_DELIVERY_BOY"||
		 o.order_status === "ORDER_REQUEST_TO_DB"|| 
		 o.order_status === "ORDER_ACCEPT_BY_DB"||
		 o.order_status === "REACH_PICKUP_POINT"||
		 o.order_status === "REACH_DROP_POINT"||
		 o.order_status === "ON_THE_WAY_FOR_RESTRO"
		
    );

    const completedOrders = formattedOrders.filter(
      (o) =>
        o.order_status === "DELIVERED"
       
    );

    // ✅ Final response
    return res.json({
      status: true,
      message: "Order history fetched successfully",
      pendingOrders,
      completedOrders,
    });
  } catch (err) {
    console.error("❌ Error in getOrderHistory:", err);
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};


const createSession = async (req, res) => {
  try {
    const { amount, customer_id, customer_email, customer_phone } = req.body;

    // 🔹 Order ID generate कर रहे हैं
    const orderId = "order_" + Date.now();

    const response = await fetch(`${CASHFREE_CONFIG.BASE_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_CONFIG.APP_ID,
        "x-client-secret": CASHFREE_CONFIG.SECRET_KEY,
        "x-api-version": CASHFREE_CONFIG.API_VERSION,
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amount || 100.0,
        order_currency: "INR",
        customer_details: {
          customer_id: customer_id || "cust_001",
          customer_email: customer_email || "test@example.com",
          customer_phone: customer_phone || "9999999999",
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();

    // 🔹 Response सीधे return कर रहे हैं, कहीं save नहीं हो रहा
    return res.status(200).json({
      status: true,
      message: "Payment session created successfully",
      pg_res: {
        cf_order_id: data.cf_order_id,
        order_id: data.order_id,
        order_status: data.order_status,
        payment_session_id: data.payment_session_id,
      },
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};


// 🚀 Step 2: Payment Success Callback (Webhook or frontend confirm)
const paymentSuccess = async (req, res) => {
  try {
    const { cf_order_id, order_id, user_id, restaurant_id, product_id, quantity, address_id, amount } = req.body;

    // 1️⃣ Save order
    const order = await Order.create({
      order_id,
      cf_order_id,
      payment_session_id: req.body.payment_session_id,
      user_id,
      restaurant_id,
      address_id,
      amount,
      order_status: "PLACED",
      payment_status: "SUCCESS",
    });

    // 2️⃣ Save order item
    await OrderItem.create({
      order_id: order.order_id,
      product_id,
      quantity,
      price: amount,
    });

    // 3️⃣ (Optional) Clear cart
    await Cart.destroy({ where: { user_id, restaurant_id, product_id } });

    res.json({
      status: true,
      message: "Order created successfully",
      order,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

const checkPaymentStatus = async (req, res) => {
  try {
    const { user_id, order_id } = req.query;

    if (!user_id || !order_id) {
      return res.status(400).json({
        status: false,
        message: "user_id and order_id are required",
      });
    }

    // 🔍 TABLE me cf_order_id + user_id se search karna hai
    const order = await Order.findOne({
      where: { 
        cf_order_id: order_id,   // cf_order_id match
        user_id: user_id         // user_id match
      }
    });

    if (!order) {
      return res.status(404).json({
        status: false,
        message: "Order not found for this user",
      });
    }

    // 🔥 Return only required fields
    return res.status(200).json({
      status: true,
      message: "Payment status fetched successfully",
      data: {
        order_id: order.cf_order_id,        // return cf order id
        payment_status: order.payment_status,
        order_status: order.order_status,
        amount: order.amount
      }
    });

  } catch (err) {
    console.error("Payment status API error:", err.message);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

module.exports = { initiateCheckout, paymentSuccess,createSession,getOrderHistory, getOrderSummary, downloadInvoice,checkPaymentStatus };
