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

    // USERS COUNT
    const [users] = await db.query(
      "SELECT COUNT(id) AS totalUsers FROM users"
    );

    // RESTAURANTS COUNT
    const [restaurants] = await db.query(
      "SELECT COUNT(id) AS totalRestaurants FROM restaurants"
    );

    // ORDERS COUNT
    const [orders] = await db.query(
      "SELECT COUNT(id) AS totalOrders FROM orders"
    );

    // REVENUE (wallet id = 1)
    const [revenue] = await db.query(
      "SELECT total_balance FROM wallets WHERE id = 1"
    );

    // ORDER STATUS COUNTS
    const [orderStatus] = await db.query(`
      SELECT 
        SUM(order_status = 'pending') AS pending,
        SUM(order_status = 'preparing') AS preparing,
        SUM(order_status = 'out_for_delivery') AS out_for_delivery,
        SUM(order_status = 'delivered') AS delivered
      FROM orders
    `);

    res.render("admin/dashboard", {
      layout: "layout/administrator",
      admin: req.session.admin,

      totalUsers: users[0].totalUsers,
      totalRestaurants: restaurants[0].totalRestaurants,
      totalOrders: orders[0].totalOrders,
      totalRevenue: revenue[0]?.total_balance || 0,

      orderStatus: orderStatus[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).send("Dashboard Error");
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

