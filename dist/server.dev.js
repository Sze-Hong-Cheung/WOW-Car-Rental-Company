"use strict";

//jshint esversion:6
var express = require("express");

var bodyParser = require("body-parser");

var https = require("https");

var mysql = require("mysql");

var router = express.Router();

var cors = require("cors");

var crypto = require("crypto");

var cookieParser = require("cookie-parser");

var session = require("express-session");

var Store = require("express-session").Store;

var passport = require("passport");

var LocalStrategy = require("passport-local").Strategy;

var flash = require("connect-flash");

var BetterMemoryStore = require("session-memory-store")(session);

var _require = require("async"),
    forEach = _require.forEach;

var _require2 = require("ejs"),
    render = _require2.render;

var app = express();
app.set("view engine", "ejs");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(cookieParser());
app.use(express["static"]("public")); //const store = new BetterMemoryStore({ expires: 60 * 60 * 1000, debug: true });

app.use(session({
  secret: "session secret of jesse",
  //store: store,
  saveUninitialized: true,
  resave: true
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
var salt = "7fa73b47df808d36c5fe328546ddef8b9011b2c6";
var serviceStatusArr = ["Applid", "Renting", "Waiting for Payment", "Completed", "Canceled"];
var vehicleClassArr = ["", "small car", "mid-size car", "luxury car", "SUV", "Premium SUV", "Mini Van", "Step Van", "Utility Van", "Station Wagon", "Motorcycle"];
var stateArr = ["CA", "TX", "NY"];
var connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "12345678",
  database: "wow_db"
});
connection.connect(function (err) {
  if (err) throw err;
  console.log("Connected!");
});
passport.use("local", new LocalStrategy({
  usernameField: "email",
  passwordField: "password",
  passReqToCallback: true //passback entire req to call back

}, function (req, email, password, done) {
  if (!email || !password) {
    return done(null, false, req.flash("message", "All fields are required."));
  }

  connection.query("SELECT * FROM shc_customer WHERE email = ?", [email], function (err, rows) {
    console.log(err);
    console.log("Username in db");
    console.log(rows[0]);
    if (err) return done(req.flash("message", err));

    if (!rows.length) {
      return done(null, false, {
        message: "Incorrect password."
      });
    }

    var encPassword = crypto.createHash("sha1").update(salt + "" + password).digest("hex");
    var dbPassword = rows[0].password;

    if (!(dbPassword == encPassword)) {
      return done(null, false, req.flash("message", "Invalid username or password."));
    }

    return done(null, rows[0]);
  });
}));
passport.serializeUser(function (user, done) {
  console.log("serializeUser:");
  console.log(user);
  done(null, user);
});
passport.deserializeUser(function (user, done) {
  done(null, user);
});
var signinHistory = {
  email: "",
  password: ""
};
app.get("/", function (req, res) {
  if (req.isAuthenticated()) {
    res.redirect("/user");
  }

  res.render("index");
});
app.post("/", passport.authenticate("local", {
  successRedirect: "/user",
  failureRedirect: "/failure",
  failureFlash: true
}), function (req, res) {
  res.redirect("/user");
});
var signupIHistory = {
  email: "",
  fname: "",
  lname: "",
  phone: "",
  street: "",
  city: "",
  state: "",
  driver_license_no: "",
  insurance_co_name: "",
  insurance_policy_no: ""
};
/********** signup-i ***********/

app.get("/signup-i", function (req, res) {
  res.render("signup-individual", {
    stateArr: stateArr,
    signupIHistory: signupIHistory
  });
});
app.post("/signup-i", function (req, res) {
  console.log("submit!");
  var sql = "CALL signup_individual_customer(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";
  var body = req.body;
  var sqlParam = [body.state, body.city, body.street, body.email, crypto.createHash("sha1").update(salt + body.password).digest("hex"), body.phone, body.fname, body.lname, body.driver_license_no, body.insurance_co_name, body.insurance_policy_no];
  connection.query(sql, sqlParam, function (error, results, fields) {
    if (error) throw error;
    console.log(results);
    connection.query("SELECT * FROM shc_customer WHERE email = ?", [body.email], function (error, results) {
      req.login(results[0], function (err) {
        if (err) {
          return next(err);
        }

        return res.render("signup-success");
      });
    });
  });
});
/****** pin_user */

app.get("/user", function (req, res) {
  console.log("req.isAuthenticated():");
  console.log(req.isAuthenticated());

  if (!req.isAuthenticated()) {
    res.redirect("/");
  } else {
    console.log("req.user:");
    console.log(req.user);
    var fname = "",
        lname = "";
    var user = req.user;

    if (user.type == "I") {
      connection.query("SELECT fname, lname FROM shc_indivdual WHERE cust_id=?", [user.cust_id], function (error, results, fields) {
        fname = results[0].fname;
        lname = results[0].lname;
      });
    }

    console.log(fname);
    connection.query("SELECT service_no, status FROM shc_service WHERE cust_id=?", [user.cust_id], function (error, results, fields) {
      if (error) console.log(error);
      var havePoccesingService = false;
      var poccesingServiceNo;

      for (var i = 0; i < results.length; i++) {
        if (results[i].status == 0 || results[i].status == 1 || results[i].status == 2) {
          poccesingServiceNo = results[i].service_no;
          havePoccesingService = true;
          console.log("find processing service: " + poccesingServiceNo);
          break;
        }
      }

      if (havePoccesingService == true) {
        var sql = "SELECT a.cust_id, a.service_no, a.vin, a.status, b.cust_type, date_format(a.s_pickup_date, '%Y-%m-%d %H:%i:%s') as s_pickup_date, date_format(a.s_dropoff_date, '%Y-%m-%d %H:%i:%s') as s_dropoff_date, date_format(a.pickup_date, '%Y-%m-%d %H:%i:%s') as pickup_date, date_format(a.dropoff_date, '%Y-%m-%d %H:%i:%s') as dropoff_date, c.vin, c.make, c.model, c.year, c.license_plate_no, d.state as pickup_state, d.city as pickup_city, d.street as pickup_street, e.state as dropoff_state, e.city as dropoff_city, e.street as dropoff_street FROM shc_service a join shc_customer b on a.cust_id = b.cust_id join shc_vehicle c on a.vin = c.vin join shc_office_location d on a.pickup_loc = d.office_id join shc_office_location e on a.dropoff_loc = e.office_id where service_no=" + poccesingServiceNo;
        connection.query(sql, function (error, results, fields) {
          if (error) console.log(error);
          console.log(results);
          res.render("user-page", {
            fname: fname,
            lname: lname,
            user: user,
            results: results[0],
            havePoccesingService: havePoccesingService,
            serviceStatusArr: serviceStatusArr
          });
        });
      } else {
        res.render("user-page", {
          fname: fname,
          lname: lname,
          user: user,
          results: results[0],
          havePoccesingService: havePoccesingService,
          serviceStatusArr: serviceStatusArr
        });
      }
    });
  }
});
/* pin_apply1 */

var apply1History = {
  pickup_loc: "",
  pickup_state: "",
  pickup_city: "",
  pickup_street: "",
  dropoff_loc: "",
  dropoff_state: "",
  dropoff_city: "",
  dropoff_street: "",
  s_pickup_date: "",
  s_dropoff_date: ""
};
app.get("/apply1", function (req, res) {
  console.log("req.isAuthenticated():");
  console.log(req.isAuthenticated());

  if (!req.isAuthenticated()) {
    res.redirect("/");
  } else {
    console.log("req.user:");
    console.log(req.user);
    var user = req.user;
    connection.query("SELECT office_id, state, city, street FROM shc_office_location", function (error, results, fields) {
      res.render("apply1", {
        user: user,
        results: results
      });
    });
  }
});
app.post("/apply1", function (req, res) {
  connection.query("SELECT state, city, street FROM shc_office_location WHERE office_id=" + req.body.pickup_loc, function (error, results, fields) {
    apply1History = {
      pickup_loc: req.body.pickup_loc,
      pickup_state: results[0].state,
      pickup_city: results[0].city,
      pickup_street: results[0].street,
      dropoff_loc: req.body.dropoff_loc,
      s_pickup_date: req.body.s_pickup_date,
      s_dropoff_date: req.body.s_dropoff_date
    };
    console.log("apply1History");
    console.log(apply1History);
    res.redirect("/apply2");
  });
});
/* pin_apply2 */

app.get("/apply2", function (req, res) {
  console.log("req.isAuthenticated():");
  console.log(req.isAuthenticated());

  if (!req.isAuthenticated()) {
    res.redirect("/");
  } else if (apply1History.pickup_loc == "") {
    res.redirect("/apply1");
  } else {
    /*console.log("req.user:");
    console.log(req.user);*/
    var user = req.user;
    var class_no = req.query.class_no == undefined ? "" : req.query.class_no;
    var make = req.query.make == undefined ? "" : req.query.make;
    var office_id = apply1History.pickup_loc;
    var sql = "SELECT vin, make, model, year FROM shc_vehicle WHERE vin IN (SELECT MIN(vin) FROM shc_vehicle WHERE office_id=" + office_id + (class_no != "" || make != "" ? " AND" : "");
    if (class_no != "") sql += " class_no=" + class_no + (make != "" ? " AND" : "");
    if (make != "") sql += ' make LIKE "%' + make + '%"';
    sql += " GROUP BY CONCAT(make, model, year));";
    console.log(sql);
    connection.query(sql, function (error, results, fields) {
      res.render("apply2", {
        user: user,
        class_no: class_no,
        make: make,
        results: results,
        apply1History: apply1History,
        vehicleClassArr: vehicleClassArr
      });
    });
  }
});
app.post("/apply2", function (req, res) {
  var sql = "INSERT INTO shc_service (cust_id, vin, apply_date, s_pickup_date, s_dropoff_date, pickup_loc, dropoff_loc, status) values (?,?, NOW(),?,?,?,?,0)";
  connection.query(sql, [req.user.cust_id, req.body.vin, apply1History.s_pickup_date, apply1History.s_dropoff_date, apply1History.pickup_loc, apply1History.dropoff_loc], function (error, results, fields) {
    if (error) console.log(error);
    res.redirect("/user");
  });
});
/********** /admin/service ***********/

app.get("/admin/service", function (req, res) {
  var service_no = req.query.service_no == undefined ? "" : req.query.service_no;
  var cust_id = req.query.cust_id == undefined ? "" : req.query.cust_id;
  var status = req.query.status == undefined ? "" : req.query.status;
  var sql = "SELECT service_no, cust_id, date_format(apply_date, '%Y-%m-%d %H:%i:%s') as apply_time, status FROM shc_service" + (service_no != "" || cust_id != "" || status != "" ? " WHERE" : "");
  if (service_no != "") sql += " service_no=" + service_no + (cust_id != "" || status != "" ? " AND" : "");
  if (cust_id != "") sql += " cust_id=" + cust_id + (status != "" ? " AND" : "");
  if (status != "") sql += " status=" + status;
  connection.query(sql, function (error, results, fields) {
    if (error) console.log(error);
    console.log(results);
    res.render("admin-service-list", {
      serviceData: results,
      serviceNoValue: service_no,
      custIdValue: cust_id,
      serviceStatus: serviceStatusArr,
      currentStatus: status
    });
  });
});
app.get("/admin/customer", function (req, res) {
  var cust_id = req.query.cust_id == undefined ? "" : req.query.cust_id;
  var cust_type = req.query.cust_type == undefined ? "" : req.query.cust_type;
  var email = req.query.email == undefined ? "" : req.query.email;
  var phone = req.query.phone == undefined ? "" : req.query.phone;
  var sql = "SELECT cust_id, cust_type, email, phone FROM shc_customer" + (cust_id != "" || cust_type != "" || email != "" || phone != "" ? " WHERE" : "");
  if (cust_id != "") sql += " cust_id=" + cust_id + (cust_type != "" || email != "" || phone != "" ? " AND" : "");
  if (cust_type != "") sql += ' cust_type="' + cust_type + '"' + (email != "" || phone != "" ? " AND" : "");
  if (email != "") sql += ' email LIKE "%' + email + '%"' + (phone != "" ? " AND" : "");
  if (phone != "") sql += ' phone LIKE "%' + phone + '%"';
  connection.query(sql, function (error, results, fields) {
    if (error) throw error;
    res.render("admin-customer-list", {
      customerData: results,
      cust_id: cust_id,
      cust_type: cust_type,
      email: email,
      phone: phone
    });
  });
});
app.get("/admin/vehicle", function (req, res) {
  var vin = req.query.vin == undefined ? "" : req.query.vin;
  var class_no = req.query.class_no == undefined ? "" : req.query.class_no;
  var make = req.query.make == undefined ? "" : req.query.make;
  var sql = "SELECT a.vin, a.class_no, b.class_name, a.make, a.model ,a.year FROM shc_vehicle a left join shc_vehicle_class b on a.class_no=b.class_no " + (vin != "" || class_no != "" || make != "" ? " WHERE" : "");
  if (vin != "") sql += ' a.vin LIKE "%' + vin + '%"' + (class_no != "" || make != "" ? " AND" : "");
  if (class_no != "") sql += " a.class_no=" + class_no + (make != "" ? " AND" : "");
  if (make != "") sql += ' a.make LIKE "%' + make + '%"';
  connection.query(sql, function (error, results, fields) {
    if (error) console.log(error);
    console.log(results);
    res.render("admin-vehicle-list", {
      vehicleClassArr: vehicleClassArr,
      vehicleData: results,
      vin: vin,
      class_no: class_no,
      make: make
    });
  });
});
app.get("/admin/customer/delete", function (req, res) {
  var cust_id = req.query.cust_id == undefined ? "" : req.query.cust_id;

  if (cust_id != "") {
    var sql = "DELETE from shc_customer WHERE cust_id=" + cust_id;
    connection.query(sql, function (error, results, fields) {
      if (error) console.log(error);
    });
    res.redirect("/admin/customer");
  }
});
/* pin_service_detail */

var couponInputStatus0 = "";
var odometerStatus0;
var couponStatus0;
var odometerInputStatus1 = "";
var odometerStatus1;
var locationStatus1;
/* get_Service_detail */

app.get("/admin/service/:service_no", function (req, res) {
  console.log("couponInputStatus0: " + couponInputStatus0);
  var service_no = req.params.service_no;
  var status = 0;
  var sql = "SELECT a.status, b.cust_type FROM shc_service a join shc_customer b on a.cust_id = b.cust_id WHERE service_no=" + service_no;
  connection.query(sql, function (error, results, fields) {
    if (error) throw error;
    status = results[0].status;
    console.log("status is " + status); //Status 0

    if (status == 0) {
      var _sql = "SELECT a.service_no, a.cust_id, a.vin, a.status, b.cust_type, date_format(a.s_pickup_date, '%Y-%m-%d %H:%i:%s') as s_pickup_date, date_format(a.s_dropoff_date, '%Y-%m-%d %H:%i:%s') as s_dropoff_date, c.vin, c.make, c.model, c.year, d.state as pickup_state, d.city as pickup_city, d.street as pickup_street, e.state as dropoff_state, e.city as dropoff_city, e.street as dropoff_street FROM shc_service a join shc_customer b on a.cust_id = b.cust_id join shc_vehicle c on a.vin = c.vin join shc_office_location d on a.pickup_loc = d.office_id join shc_office_location e on a.dropoff_loc = e.office_id where service_no=" + service_no;

      connection.query(_sql, function (error, results, fields) {
        if (error) throw error;
        res.render("admin-service-status0", {
          serviceData: results[0],
          serviceStatus: serviceStatusArr,
          couponInputStatus0: couponInputStatus0,
          odometerStatus0: odometerStatus0,
          couponStatus0: couponStatus0
        });
      }); //Status 1
    } else if (status == 1) {
      connection.query("SELECT office_id, state, city, street from shc_office_location", function (error, results, fields) {
        if (error) throw error;
        var allLocation = results;
        var sql = "SELECT a.service_no, a.cust_id, a.vin, a.status, a.coupon_no, a.start_odometer, b.cust_type, date_format(a.pickup_date, '%Y-%m-%d %H:%i:%s') as pickup_date, date_format(a.s_dropoff_date, '%Y-%m-%d %H:%i:%s') as s_dropoff_date, c.vin, c.make, c.model, c.year, d.state as pickup_state, d.city as pickup_city, d.street as pickup_street, e.state as dropoff_state, e.city as dropoff_city, e.street as dropoff_street FROM shc_service a join shc_customer b on a.cust_id = b.cust_id join shc_vehicle c on a.vin = c.vin join shc_office_location d on a.pickup_loc = d.office_id join shc_office_location e on a.dropoff_loc = e.office_id where service_no=" + service_no;
        connection.query(sql, function (error, results, fields) {
          if (error) throw error;
          res.render("admin-service-status1", {
            serviceData: results[0],
            serviceStatus: serviceStatusArr,
            allLocation: allLocation,
            odometerInputStatus1: odometerInputStatus1,
            odometerStatus1: odometerStatus1,
            locationStatus1: locationStatus1
          });
        });
      }); //Status 2
    } else if (status == 2) {
      var _sql2 = "SELECT a.service_no as service_no, a.cust_id, a.vin, a.status, a.start_odometer, a.coupon_no, b.cust_type, date_format(a.pickup_date, '%Y-%m-%d %H:%i:%s') as pickup_date, date_format(a.dropoff_date, '%Y-%m-%d %H:%i:%s') as dropoff_date, c.vin, c.make, c.model, c.year, d.state as pickup_state, d.city as pickup_city, d.street as pickup_street, e.state as dropoff_state, e.city as dropoff_city, e.street as dropoff_street, f.invoice_no, f.invoice_amount FROM shc_service a join shc_customer b on a.cust_id = b.cust_id join shc_vehicle c on a.vin = c.vin join shc_office_location d on a.pickup_loc = d.office_id join shc_office_location e on a.dropoff_loc = e.office_id join shc_invoice f on a.service_no = f.service_no where a.service_no=" + service_no;

      connection.query(_sql2, function (error, results, fields) {
        if (error) throw error;
        var serviceData = results[0];
        connection.query("SELECT payment_amount FROM shc_payment WHERE invoice_no=" + serviceData.invoice_no, function (error, results, fields) {
          if (error) throw error;
          var totalPaidAmount = 0;

          for (var i = 0; i < results.length; i++) {
            totalPaidAmount += results[i].payment_amount;
          }

          res.render("admin-service-status2", {
            serviceData: serviceData,
            serviceStatus: serviceStatusArr,
            totalPaidAmount: totalPaidAmount
          });
        });
      });
    }
  });
});
app.post("/admin/service/:service_no", function (req, res) {
  currentStatus = req.body.currentStatus;
  var service_no = req.params.service_no;

  if (currentStatus == 0) {
    couponInputStatus0 = "";
    odometerStatus0 = req.body.odometerStatus0;
    couponStatus0 = req.body.couponStatus0;
    var sql = "UPDATE shc_service SET pickup_date=NOW(), start_odometer=" + odometerStatus0 + (couponStatus0 == "" ? "" : ", coupon_no=" + couponStatus0) + ", status=1" + " WHERE service_no=" + service_no;

    if (couponStatus0 != "" && couponStatus0 != undefined) {
      console.log("Input coupon no:" + couponStatus0);
      connection.query("SELECT date_format(start_date, '%Y-%m-%d') as start_date, date_format(end_date, '%Y-%m-%d') as end_date FROM shc_coupon WHERE coupon_no=" + couponStatus0, function (error, results, fields) {
        if (error) throw error;

        if (results.length == 0) {
          couponInputStatus0 = "Coupon invalid";
          console.log(couponInputStatus0);
          res.redirect("/admin/service/" + service_no);
        } else if (results[0].end_date < new Date().toISOString().substring(0, 10)) {
          couponInputStatus0 = "Coupon expired";
          console.log(couponInputStatus0);
          res.redirect("/admin/service/" + service_no);
        } else {
          couponInputStatus0 = "";
          connection.query(sql, function (error, results, fields) {
            if (error) throw error;
            res.redirect("/admin/service/" + service_no);
          });
          console.log("coupon vaild");
        }
      });
    } else {
      couponInputStatus0 = "";
      connection.query(sql, function (error, results, fields) {
        if (error) throw error;
        res.redirect("/admin/service/" + service_no);
      });
    } //currentStatus 1

  } else if (currentStatus == 1) {
    odometerInputStatus1 = "";
    odometerStatus1 = req.body.odometerStatus1;
    locationStatus1 = req.body.locationStatus1;
    connection.query("SELECT start_odometer from shc_service WHERE service_no=" + service_no, function (error, results, fields) {
      if (error) throw error;

      if (results[0].start_odometer > odometerStatus1) {
        odometerInputStatus1 = "End odometer must be larger than start odometer.";
        console.log(odometerInputStatus1);
        res.redirect("/admin/service/" + service_no);
      } else {
        //Update service
        connection.query("UPDATE shc_service SET end_odometer=" + odometerStatus1 + ", dropoff_loc=" + locationStatus1 + ", dropoff_date=NOW()" + ", status=2 WHERE service_no=" + service_no, function (error, results, fields) {
          if (error) throw error;
          res.redirect("/admin/service/" + service_no);
        }); //Calculate fees

        connection.query("SELECT (datediff(a.dropoff_date, a.pickup_date)+1) as days, (a.end_odometer - a.start_odometer) as odometer, b.rental_rate, b.mileage_fee, b.odometer_limit FROM shc_service a join shc_vehicle c on a.vin = c.vin join shc_vehicle_class b on b.class_no = c.class_no WHERE a.service_no=" + service_no, function (error, results, fields) {
          if (error) throw error;
          var days = results[0].days;
          var odometer = results[0].odometer;
          var rental_rate = results[0].rental_rate;
          var mileage_fee = results[0].mileage_fee;
          var odometer_limit = results[0].odometer_limit;
          var totalFees = days * rental_rate;

          if (odometer > days * odometer_limit) {
            totalFees += (odometer - days * odometer_limit) * mileage_fee;
          }

          console.log("totalFees: " + totalFees);
          connection.query("INSERT INTO shc_invoice (invoice_date, invoice_amount, service_no) VALUES ( NOW(), " + totalFees + ", " + service_no + ");", function (error, results, fields) {
            if (error) throw error;
          });
        });
      }
    });
  }
});
/* pin_cancel */

app.get("/service/cancel/:service_no", function (req, res) {
  var service_no = req.params.service_no;
  connection.query("UPDATE shc_service SET status=4 WHERE service_no=" + service_no, function (error, results, fields) {
    if (error) throw error;
    res.redirect("/user");
  });
});
/* pin_signout */

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});
app.listen(3000, function () {
  console.log("Server started on port 3000");
});