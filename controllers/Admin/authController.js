const sequelize = require("../../config/db");
const { QueryTypes } = require("sequelize");

const db = require("../../config/db"); // mysql connection

exports.doLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      req.session.error = "Email & Password required";
      return res.redirect("/admin/login");
    }

    const admin = await sequelize.query(
      "SELECT * FROM admins WHERE email = :email LIMIT 1",
      {
        replacements: { email },
        type: QueryTypes.SELECT
      }
    );

    if (!admin || admin.length === 0) {
      req.session.error = "Admin not found";
      return res.redirect("/admin/login");
    }

    // ✅ DEFINE adminData PROPERLY
    const adminData = admin[0];

    // Password check (plain for now)
    if (adminData.password !== password) {
      req.session.error = "Invalid credentials";
      return res.redirect("/admin/login");
    }

    // ✅ SAVE SESSION (WITH session_version)
    req.session.admin = {
      id: adminData.id,
      name: adminData.name,
      email: adminData.email,
      session_version: adminData.session_version
    };

    return res.redirect("/admin/dashboard");

  } catch (error) {
    console.error("❌ LOGIN ERROR 👉", error);
    req.session.error = "Internal server error";
    return res.redirect("/admin/login");
  }
};



// LOGIN PAGE
exports.showLogin = (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin/dashboard");
  }

  const error = req.session.error || null;
  delete req.session.error;

  res.render("admin/login", {
    layout: false,
    error
  });
};


exports.dashboard = async (req, res) => {
  try {
    const q = (sql) => sequelize.query(sql, { type: QueryTypes.SELECT }).then(r => r[0]);

    const [
      totalUsers, totalRestaurants, totalOrders, totalDeliveryBoys,
      totalProducts, totalCategories, totalSubCategories, totalCoupons,
      revenue,
      todayOrders, todayUsers, todayDeliveryBoys,
      pendingOrders, preparingOrders, outOrders, deliveredOrders, cancelledOrders
    ] = await Promise.all([
      q("SELECT COUNT(id) AS v FROM users"),
      q("SELECT COUNT(id) AS v FROM restaurants"),
      q("SELECT COUNT(id) AS v FROM orders"),
      q("SELECT COUNT(id) AS v FROM deliveryboys"),
      q("SELECT COUNT(id) AS v FROM products"),
      q("SELECT COUNT(id) AS v FROM categories"),
      q("SELECT COUNT(id) AS v FROM sub_categories"),
      q("SELECT COUNT(id) AS v FROM coupons"),
      q("SELECT COALESCE(total_balance, 0) AS v FROM wallets WHERE id = 1"),
      q("SELECT COUNT(id) AS v FROM orders WHERE DATE(created_at) = CURDATE()"),
      q("SELECT COUNT(id) AS v FROM users WHERE DATE(created_at) = CURDATE()"),
      q("SELECT COUNT(id) AS v FROM deliveryboys WHERE DATE(createdAt) = CURDATE()"),
      q("SELECT COUNT(id) AS v FROM orders WHERE order_status = 'pending'"),
      q("SELECT COUNT(id) AS v FROM orders WHERE order_status = 'preparing'"),
      q("SELECT COUNT(id) AS v FROM orders WHERE order_status = 'out_for_delivery'"),
      q("SELECT COUNT(id) AS v FROM orders WHERE order_status = 'delivered'"),
      q("SELECT COUNT(id) AS v FROM orders WHERE order_status = 'cancelled'"),
    ]);

    // Last 7 days orders
    const last7 = await sequelize.query(
      `SELECT DATE(created_at) as day, COUNT(id) as cnt
       FROM orders
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(created_at)
       ORDER BY day ASC`,
      { type: QueryTypes.SELECT }
    );

    const days7 = [], orders7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('en-IN', { month:'short', day:'numeric' });
      const iso   = d.toISOString().split('T')[0];
      days7.push(label);
      const found = last7.find(r => r.day && r.day.toString().startsWith(iso));
      orders7.push(found ? parseInt(found.cnt) : 0);
    }

    res.render("admin/dashboard", {
      layout: "layout/administrator",
      admin: req.session.admin,
      totalUsers:         totalUsers?.v || 0,
      totalRestaurants:   totalRestaurants?.v || 0,
      totalOrders:        totalOrders?.v || 0,
      totalDeliveryBoys:  totalDeliveryBoys?.v || 0,
      totalProducts:      totalProducts?.v || 0,
      totalCategories:    totalCategories?.v || 0,
      totalSubCategories: totalSubCategories?.v || 0,
      totalCoupons:       totalCoupons?.v || 0,
      totalRevenue:       revenue?.v || 0,
      todayOrders:        todayOrders?.v || 0,
      todayUsers:         todayUsers?.v || 0,
      todayDeliveryBoys:  todayDeliveryBoys?.v || 0,
      orderStatus: {
        pending:          pendingOrders?.v || 0,
        preparing:        preparingOrders?.v || 0,
        out_for_delivery: outOrders?.v || 0,
        delivered:        deliveredOrders?.v || 0,
        cancelled:        cancelledOrders?.v || 0,
      },
      days7:   JSON.stringify(days7),
      orders7: JSON.stringify(orders7),
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).send("Dashboard Error: " + error.message);
  }
};


// LOGOUT
exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.set("Cache-Control", "no-store");
    res.redirect("/admin/login");
  });
};

exports.showChangePassword = (req, res) => {
  res.render("admin/change-password", {
    layout: "layout/administrator",
    error: null,
    success: null
  });
};

exports.changePassword = async (req, res) => {
  try {
    const { old_password, new_password, confirm_password } = req.body;

    if (!old_password || !new_password || !confirm_password) {
      return res.render("admin/change-password", {
        layout: "layout/administrator",
        error: "All fields are required",
        success: null
      });
    }

    if (new_password !== confirm_password) {
      return res.render("admin/change-password", {
        layout: "layout/administrator",
        error: "New password and confirm password do not match",
        success: null
      });
    }

    // Current admin fetch
    const admin = await sequelize.query(
      "SELECT * FROM admins WHERE id = :id LIMIT 1",
      {
        replacements: { id: req.session.admin.id },
        type: QueryTypes.SELECT
      }
    );

    if (!admin || admin.length === 0) {
      req.session.destroy(() => res.redirect("/admin/login"));
      return;
    }

    const adminData = admin[0];

    // Old password check
    if (adminData.password !== old_password) {
      return res.render("admin/change-password", {
        layout: "layout/administrator",
        error: "Old password is incorrect",
        success: null
      });
    }

    // 🔥 PASSWORD UPDATE + SESSION VERSION INCREMENT
    await sequelize.query(
      `UPDATE admins 
       SET password = :password, session_version = session_version + 1 
       WHERE id = :id`,
      {
        replacements: {
          password: new_password,
          id: adminData.id
        },
        type: QueryTypes.UPDATE
      }
    );

    // 🔥 CURRENT SESSION DESTROY (SELF LOGOUT)
    req.session.destroy(() => {
      res.redirect("/admin/login");
    });

  } catch (error) {
    console.error("❌ CHANGE PASSWORD ERROR 👉", error);
    res.render("admin/change-password", {
      layout: "layout/administrator",
      error: "Internal server error",
      success: null
    });
  }
};

