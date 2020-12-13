"use strict";

//jshint esversion:6
var express = require("express");

var bodyParser = require("body-parser");

var https = require("https");

var mysql = require("mysql");

var crypto = require("crypto");

var cookieParser = require("cookie-parser");

var session = require("express-session");

var Store = require("express-session").Store;

var passport = require("passport");

var LocalStrategy = require("passport-local").Strategy;

var flash = require("connect-flash");

var _require = require("ejs"),
    render = _require.render;

var renderPaymentPage = require(__dirname + "/renderPaymentPage.js");

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
var serviceStatusArr = ["Applied", "Renting", "Waiting for Payment", "Completed", "Canceled"];
var vehicleClassArr = ["", "small car", "mid-size car", "luxury car", "SUV", "Premium SUV", "Mini Van", "Step Van", "Utility Van", "Station Wagon", "Motorcycle"];
var rentalRateArr = ["", 40, 60, 80, 65, 70, 50, 60, 50, 80, 25];
var mileageFeeArr = ["", 2, 2, 3, 2, 3, 2.5, 2.5, 2.5, 4, 1.5];
var odometerLimitArr = ["", 500, 500, 300, 600, 600, 700, 700, 700, 800, 500];
var stateArr = ["CA", "TX", "NY", "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "UT", "WA"];
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
passport.use("local-admin", new LocalStrategy({
  usernameField: "emp_id",
  passwordField: "password",
  passReqToCallback: true //passback entire req to call back

}, function (req, emp_id, password, done) {
  if (!emp_id || !password) {
    return done(null, false, req.flash("message", "All fields are required."));
  }

  connection.query("SELECT * FROM shc_emp WHERE emp_id = ?", [emp_id], function (err, rows) {
    console.log(err);
    console.log("emp_id in db");
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
  var pageStatus = req.query.status;

  if (req.isAuthenticated()) {
    res.redirect("/user");
  }

  res.render("index", {
    pageStatus: pageStatus
  });
});
app.post("/", passport.authenticate("local", {
  successRedirect: "/user",
  failureRedirect: "/?status=invaild",
  failureFlash: true
}), function (req, res) {
  console.log("/user");
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
/********** get_signup ***********/

app.get("/signup", function (req, res) {
  res.render("signup", {
    user: ""
  });
});
/********** get_signup-i ***********/

app.get("/signup-i", function (req, res) {
  res.render("signup-individual", {
    user: "",
    stateArr: stateArr,
    signupIHistory: signupIHistory
  });
});
/********** post_signup-i ***********/

app.post("/signup-i", function (req, res) {
  var body = req.body;
  var password = crypto.createHash("sha1").update(salt + body.password).digest("hex");
  connection.beginTransaction(function (err) {
    if (err) console.log(err);
    connection.query("INSERT INTO shc_address (state, city ,street) values (?, ?, ?);", [body.state, body.city, body.street], function (error, results, fields) {
      if (error) {
        return connection.rollback(function () {
          console.log(error);
        });
      }

      connection.query("INSERT INTO shc_customer (cust_type, email, phone, addr_id, password) values ('I',?,?,?,?);", [body.email, body.phone, results.insertId, password], function (error, results, fields) {
        if (error) {
          return connection.rollback(function () {
            console.log(error);
          });
        }

        connection.query("INSERT INTO shc_individual (cust_id, fname, lname, driver_license_no, insurance_co_name, insurance_policy_no) values (?,?,?,?,?,?);", [results.insertId, body.fname, body.lname, body.driver_license_no, body.insurance_co_name, body.insurance_policy_no], function (error, results, fields) {
          if (error) {
            return connection.rollback(function () {
              console.log(error);
            });
          }

          connection.commit(function (err) {
            if (err) {
              return connection.rollback(function () {
                console.log(err);
              });
            }

            connection.query("SELECT * FROM shc_customer WHERE email = ?", [body.email], function (error, results) {
              req.login(results[0], function (err) {
                if (err) {
                  return next(err);
                }

                return res.render("signup-success", {
                  user: ""
                });
              });
            });
          });
        });
      });
    });
  });
  /*connection.query(sql, sqlParam, function (error, results, fields) {
    if (error) throw error;
    console.log(results);
    connection.query(
      "SELECT * FROM shc_customer WHERE email = ?",
      [body.email],
      function (error, results) {
        req.login(results[0], function (err) {
          if (err) {
            return next(err);
          }
          return res.render("signup-success");
        });
      }
    );
  });*/
});
/********** get_signup-c ***********/

app.get("/signup-c", function (req, res) {
  res.render("signup-corporate", {
    user: "",
    stateArr: stateArr,
    signupIHistory: signupIHistory
  });
});
/********** post_signup-c ***********/

app.post("/signup-c", function (req, res) {
  var body = req.body;
  var password = crypto.createHash("sha1").update(salt + body.password).digest("hex");
  connection.beginTransaction(function (err) {
    if (err) console.log(err);
    connection.query("INSERT INTO shc_address (state, city ,street) values (?, ?, ?);", [body.state, body.city, body.street], function (error, results, fields) {
      if (error) {
        return connection.rollback(function () {
          console.log(error);
        });
      }

      connection.query("INSERT INTO shc_customer (cust_type, email, phone, addr_id, password) values ('C',?,?,?,?);", [body.email, body.phone, results.insertId, password], function (error, results, fields) {
        if (error) {
          return connection.rollback(function () {
            console.log(error);
          });
        }

        var cust_id = results.insertId;
        connection.query("SELECT corporate_id, registration_number FROM shc_corporation WHERE registration_number=?", [body.registration_number], function (error, results, fields) {
          if (error) {
            return connection.rollback(function () {
              console.log(error);
            });
          }

          if (results == undefined || results.length == 0) {
            connection.query("INSERT INTO shc_corporation (registration_number, cname, discount) values (?,?,?);", [body.registration_number, body.cname, 0.1], function (error, results, fields) {
              if (error) {
                return connection.rollback(function () {
                  console.log(error);
                });
              }

              console.log(results);
              connection.query("INSERT INTO shc_corporate (cust_id, emp_id, corporate_id) values (?,?,?);", [cust_id, body.emp_id, results.insertId], function (error, results, fields) {
                if (error) {
                  return connection.rollback(function () {
                    console.log(error);
                  });
                }

                connection.commit(function (err) {
                  if (err) {
                    return connection.rollback(function () {
                      console.log(err);
                    });
                  }

                  connection.query("SELECT * FROM shc_customer WHERE email = ?", [body.email], function (error, results) {
                    req.login(results[0], function (err) {
                      if (err) {
                        return next(err);
                      }

                      return res.render("signup-success", {
                        user: ""
                      });
                    });
                  });
                });
              });
            });
          } else {
            connection.query("INSERT INTO shc_corporate (cust_id, emp_id, corporate_id) values (?,?,?);", [cust_id, body.emp_id, results[0].corporate_id], function (error, results, fields) {
              if (error) {
                return connection.rollback(function () {
                  console.log(error);
                });
              }

              connection.commit(function (err) {
                if (err) {
                  return connection.rollback(function () {
                    console.log(err);
                  });
                }

                connection.query("SELECT * FROM shc_customer WHERE email = ?", [body.email], function (error, results) {
                  req.login(results[0], function (err) {
                    if (err) {
                      return next(err);
                    }

                    return res.render("signup-success", {
                      user: ""
                    });
                  });
                });
              });
            });
          }
        });
      });
    });
  });
});
/********** get_user ***********/

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
    var _user = req.user;

    if (_user.cuat_type == "I") {
      connection.query("SELECT fname, lname FROM shc_indivdual WHERE cust_id=?", [_user.cust_id], function (error, results, fields) {
        fname = results[0].fname;
        lname = results[0].lname;
      });
    }

    console.log(fname);
    connection.query("SELECT service_no, status FROM shc_service WHERE cust_id=?", [_user.cust_id], function (error, results, fields) {
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
        var _sql = "SELECT a.cust_id, a.service_no, a.vin, a.status, b.cust_type, date_format(a.s_pickup_date, '%Y-%m-%d %H:%i:%s') as s_pickup_date, date_format(a.s_dropoff_date, '%Y-%m-%d %H:%i:%s') as s_dropoff_date, date_format(a.pickup_date, '%Y-%m-%d %H:%i:%s') as pickup_date, date_format(a.dropoff_date, '%Y-%m-%d %H:%i:%s') as dropoff_date, c.vin, c.make, c.model, c.year, c.license_plate_no, d.state as pickup_state, d.city as pickup_city, d.street as pickup_street, e.state as dropoff_state, e.city as dropoff_city, e.street as dropoff_street FROM shc_service a join shc_customer b on a.cust_id = b.cust_id join shc_vehicle c on a.vin = c.vin join shc_office_location d on a.pickup_loc = d.office_id join shc_office_location e on a.dropoff_loc = e.office_id where service_no=" + poccesingServiceNo;

        connection.query(_sql, function (error, results, fields) {
          if (error) console.log(error);
          console.log(results);
          res.render("user-page", {
            fname: fname,
            lname: lname,
            user: _user,
            results: results[0],
            havePoccesingService: havePoccesingService,
            serviceStatusArr: serviceStatusArr
          });
        });
      } else {
        res.render("user-page", {
          fname: fname,
          lname: lname,
          user: _user,
          results: results[0],
          havePoccesingService: havePoccesingService,
          serviceStatusArr: serviceStatusArr
        });
      }
    });
  }
});
/* get_service_history */

app.get("/service/history", function (req, res) {
  console.log("req.isAuthenticated():");
  console.log(req.isAuthenticated());

  if (!req.isAuthenticated()) {
    res.redirect("/");
  } else {
    console.log("req.user:");
    console.log(req.user);
    var _user2 = req.user;
    connection.query("SELECT service_no, date_format(apply_date, '%Y-%m-%d %H:%i:%s') as apply_time, status from shc_service WHERE cust_id=? ORDER BY service_no DESC", [_user2.cust_id], function (error, results, fields) {
      res.render("service-history", {
        user: _user2,
        results: results,
        serviceStatusArr: serviceStatusArr
      });
    });
  }
});
/* get_service_detail */

app.get("/service/:service_no", function (req, res) {
  var service_no = req.params.service_no;
  var status = 0;
  var sql = "SELECT a.status, b.cust_type FROM shc_service a join shc_customer b on a.cust_id = b.cust_id WHERE service_no=?";
  connection.query(sql, [service_no], function (error, results, fields) {
    if (error) console.log(error);
    status = results[0].status;
    console.log("status is " + status); //Status 0

    if (status == 0 || status == 4) {
      var _sql2 = "SELECT a.service_no, a.cust_id, a.vin, a.status, b.cust_type, date_format(a.s_pickup_date, '%Y-%m-%d %H:%i:%s') as s_pickup_date, date_format(a.s_dropoff_date, '%Y-%m-%d %H:%i:%s') as s_dropoff_date, c.vin, c.make, c.model, c.year, d.state as pickup_state, d.city as pickup_city, d.street as pickup_street, e.state as dropoff_state, e.city as dropoff_city, e.street as dropoff_street FROM shc_service a join shc_customer b on a.cust_id = b.cust_id join shc_vehicle c on a.vin = c.vin join shc_office_location d on a.pickup_loc = d.office_id join shc_office_location e on a.dropoff_loc = e.office_id where service_no=" + service_no;

      connection.query(_sql2, function (error, results, fields) {
        if (error) throw error;
        res.render("service-status0", {
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
          res.render("service-status1", {
            serviceData: results[0],
            serviceStatus: serviceStatusArr,
            allLocation: allLocation,
            odometerInputStatus1: odometerInputStatus1,
            odometerStatus1: odometerStatus1,
            locationStatus1: locationStatus1
          });
        });
      }); //Status 2
    } else if (status == 2 || status == 3) {
      var _sql3 = "SELECT a.service_no as service_no, a.cust_id, a.vin, a.status, a.start_odometer, a.coupon_no, b.cust_type, date_format(a.pickup_date, '%Y-%m-%d %H:%i:%s') as pickup_date, date_format(a.dropoff_date, '%Y-%m-%d %H:%i:%s') as dropoff_date, c.vin, c.make, c.model, c.year, d.state as pickup_state, d.city as pickup_city, d.street as pickup_street, e.state as dropoff_state, e.city as dropoff_city, e.street as dropoff_street, f.invoice_no, f.invoice_amount FROM shc_service a join shc_customer b on a.cust_id = b.cust_id join shc_vehicle c on a.vin = c.vin join shc_office_location d on a.pickup_loc = d.office_id join shc_office_location e on a.dropoff_loc = e.office_id join shc_invoice f on a.service_no = f.service_no where a.service_no=" + service_no;

      connection.query(_sql3, function (error, results, fields) {
        if (error) throw error;
        var serviceData = results[0];
        connection.query("SELECT payment_amount FROM shc_payment WHERE invoice_no=" + serviceData.invoice_no, function (error, results, fields) {
          if (error) throw error;
          var totalPaidAmount = 0;

          for (var i = 0; i < results.length; i++) {
            totalPaidAmount += results[i].payment_amount;
          }

          res.render("service-status2", {
            serviceData: serviceData,
            serviceStatus: serviceStatusArr,
            totalPaidAmount: totalPaidAmount
          });
        });
      });
    }
  });
});
/* get_payment_list */

app.get("/payment/list/:service_no", function (req, res) {
  console.log("req.isAuthenticated():");
  console.log(req.isAuthenticated());

  if (!req.isAuthenticated()) {
    res.redirect("/");
  } else {
    console.log("req.user:");
    console.log(req.user);
    var _user3 = req.user;
    var service_no = req.params.service_no;
    connection.query("SELECT a.payment_no, a.payment_method, date_format(a.payment_date, '%Y-%m-%d %H:%i:%s') as payment_time, a.card_no, a.payment_amount, b.invoice_amount FROM shc_payment a left join shc_invoice b on a.invoice_no = b.invoice_no WHERE b.service_no=? ORDER BY payment_no DESC", [service_no], function (error, results, fields) {
      res.render("payment-list", {
        user: _user3,
        service_no: service_no,
        results: results
      });
    });
  }
});
/* get_change_profile */

app.get("/change-profile", function (req, res) {
  console.log("req.isAuthenticated():");
  console.log(req.isAuthenticated());
  var pageStatus = req.query.status;

  if (!req.isAuthenticated()) {
    res.redirect("/");
  } else {
    console.log("req.user:");
    console.log(req.user);
    var _user4 = req.user;
    connection.query("SELECT a.cust_id, a.email, a.phone, b.addr_id, b.street, b.city, b.state FROM shc_customer a JOIN shc_address b on a.addr_id = b.addr_id WHERE cust_id = ?;", [_user4.cust_id], function (error, results, fields) {
      if (error) throw error;
      console.log(results[0]);
      res.render("change-profile", {
        pageStatus: pageStatus,
        results: results[0],
        user: _user4,
        stateArr: stateArr
      });
    });
  }
});
app.post("/change-profile", function (req, res) {
  var user = req.user;
  connection.query("CALL change_profile(?,?,?,?,?,?)", [req.body.cust_id, req.body.addr_id, req.body.state, req.body.city, req.body.street, req.body.phone], function (error, results, fields) {
    if (error) throw error;
    res.redirect("/change-profile?status=success");
  });
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
/* get_apply1 */

app.get("/apply1", function (req, res) {
  console.log("req.isAuthenticated():");
  console.log(req.isAuthenticated());

  if (!req.isAuthenticated()) {
    res.redirect("/");
  } else {
    console.log("req.user:");
    console.log(req.user);
    var _user5 = req.user;
    connection.query("SELECT office_id, state, city, street FROM shc_office_location", function (error, results, fields) {
      res.render("apply1", {
        user: _user5,
        results: results
      });
    });
  }
});
/* post_apply1 */

app.post("/apply1", function (req, res) {
  connection.query("SELECT state, city, street FROM shc_office_location WHERE office_id=?", [req.body.pickup_loc], function (error, results, fields) {
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
/* get_apply2 */

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
    var _user6 = req.user;

    var _class_no = req.query.class_no == undefined ? "" : req.query.class_no;

    var _make = req.query.make == undefined ? "" : req.query.make;

    var _office_id = apply1History.pickup_loc;

    var _sql4 = "SELECT a.vin, a.make, a.model, a.year, b.rental_rate, b.mileage_fee, b.odometer_limit FROM shc_vehicle a join shc_vehicle_class b on a.class_no = b.class_no WHERE vin IN (SELECT MIN(vin) FROM shc_vehicle WHERE office_id=" + _office_id + (_class_no != "" || _make != "" ? " AND" : "");

    if (_class_no != "") _sql4 += " class_no=" + _class_no + (_make != "" ? " AND" : "");
    if (_make != "") _sql4 += ' make LIKE "%' + _make + '%"';
    _sql4 += " GROUP BY CONCAT(make, model, year)) ORDER BY CONCAT(make, model, year);";
    console.log(_sql4);
    connection.query(_sql4, function (error, results, fields) {
      res.render("apply2", {
        user: _user6,
        class_no: _class_no,
        make: _make,
        results: results,
        apply1History: apply1History,
        rentalRateArr: rentalRateArr,
        mileageFeeArr: mileageFeeArr,
        odometerLimitArr: odometerLimitArr,
        vehicleClassArr: vehicleClassArr
      });
    });
  }
});
/* post_apply2 */

app.post("/apply2", function (req, res) {
  var sql = "INSERT INTO shc_service (cust_id, vin, apply_date, s_pickup_date, s_dropoff_date, pickup_loc, dropoff_loc, status) values (?,?, NOW(),?,?,?,?,0)";
  connection.query(sql, [req.user.cust_id, req.body.vin, apply1History.s_pickup_date, apply1History.s_dropoff_date, apply1History.pickup_loc, apply1History.dropoff_loc], function (error, results, fields) {
    if (error) console.log(error);
    res.redirect("/user");
  });
});
app.get("/admin", function (req, res) {
  res.render("index-admin");
});
app.post("/admin", passport.authenticate("local-admin", {
  successRedirect: "/admin/service",
  failureRedirect: "/admin?status=invaild",
  failureFlash: true
}), function (req, res) {
  res.redirect("/admin");
});
/********** /admin/service ***********/

app.get("/admin/service", function (req, res) {
  console.log("req.isAuthenticated():");
  console.log(req.isAuthenticated());

  if (!req.isAuthenticated()) {
    res.redirect("/admin");
  } else {
    console.log("req.user:");
    console.log(req.user);
    user = req.user;
    var service_no = req.query.service_no == undefined ? "" : req.query.service_no;
    var cust_id = req.query.cust_id == undefined ? "" : req.query.cust_id;
    var status = req.query.status == undefined ? "" : req.query.status;

    var _sql5 = "SELECT service_no, cust_id, date_format(apply_date, '%Y-%m-%d %H:%i:%s') as apply_time, status FROM shc_service" + (service_no != "" || cust_id != "" || status != "" ? " WHERE" : "");

    if (service_no != "") _sql5 += " service_no=" + service_no + (cust_id != "" || status != "" ? " AND" : "");
    if (cust_id != "") _sql5 += " cust_id=" + cust_id + (status != "" ? " AND" : "");
    if (status != "") _sql5 += " status=" + status;
    _sql5 += " ORDER BY service_no DESC";
    connection.query(_sql5, function (error, results, fields) {
      if (error) console.log(error);
      console.log(results);
      res.render("admin-service-list", {
        user: user,
        serviceData: results,
        serviceNoValue: service_no,
        custIdValue: cust_id,
        serviceStatus: serviceStatusArr,
        currentStatus: status
      });
    });
  }
});
app.get("/admin/service/delete", function (req, res) {
  var service_no = req.query.service_no;
  sql = "CALL delete_service_by_no(?)";
  connection.query(sql, [service_no], function (error, results, fields) {
    if (error) console.log(error);
    res.redirect("/admin/service");
  });
});
app.get("/admin/customer", function (req, res) {
  console.log("req.isAuthenticated():");
  console.log(req.isAuthenticated());

  if (!req.isAuthenticated()) {
    res.redirect("/admin");
  } else {
    console.log("req.user:");
    console.log(req.user);
    user = req.user;
    var cust_id = req.query.cust_id == undefined ? "" : req.query.cust_id;
    var cust_type = req.query.cust_type == undefined ? "" : req.query.cust_type;
    var email = req.query.email == undefined ? "" : req.query.email;
    var phone = req.query.phone == undefined ? "" : req.query.phone;

    var _sql6 = "SELECT cust_id, cust_type, email, phone FROM shc_customer" + (cust_id != "" || cust_type != "" || email != "" || phone != "" ? " WHERE" : "");

    if (cust_id != "") _sql6 += " cust_id=" + cust_id + (cust_type != "" || email != "" || phone != "" ? " AND" : "");
    if (cust_type != "") _sql6 += ' cust_type="' + cust_type + '"' + (email != "" || phone != "" ? " AND" : "");
    if (email != "") _sql6 += ' email LIKE "%' + email + '%"' + (phone != "" ? " AND" : "");
    if (phone != "") _sql6 += ' phone LIKE "%' + phone + '%"';
    connection.query(_sql6, function (error, results, fields) {
      if (error) throw error;
      res.render("admin-customer-list", {
        user: user,
        customerData: results,
        cust_id: cust_id,
        cust_type: cust_type,
        email: email,
        phone: phone
      });
    });
  }
});
app.get("/admin/customer/:cust_id", function (req, res) {
  var cust_id = req.params.cust_id;
  sql = "SELECT cust_type FROM shc_customer WHERE cust_id = ?";
  connection.query(sql, [cust_id], function (error, results, fields) {
    if (error) throw error;

    if (results[0].cust_type == "I") {
      sql = "SELECT a.cust_id, a.cust_type, a.email, a.phone, b.state, b.city, b.street, c.fname, c.lname, c.driver_license_no, c.insurance_co_name, c.insurance_policy_no FROM shc_customer a join shc_address b on a.addr_id = b.addr_id join shc_individual c on a.cust_id = c.cust_id WHERE a.cust_id=?";
      connection.query(sql, [cust_id], function (error, results, fields) {
        if (error) throw error;
        res.render("admin-customer-detail", {
          results: results[0]
        });
      });
    } else {
      sql = "SELECT a.cust_id, a.cust_type, a.email, a.phone, b.state, b.city, b.street, c.emp_id, d.cname, d.discount, d.registration_number FROM shc_customer a join shc_address b on a.addr_id = b.addr_id join shc_corporate c on a.cust_id = c.cust_id join shc_corporation d on c.corporate_id = d.corporate_id WHERE a.cust_id=?";
      connection.query(sql, [cust_id], function (error, results, fields) {
        if (error) throw error;
        res.render("admin-customer-detail", {
          results: results[0]
        });
      });
    }
  });
});
app.get("/admin/customer/delete", function (req, res) {
  var cust_id = req.query.cust_id;
  sql = "CALL delete_custmoer_by_id(?)";
  connection.query(sql, [cust_id], function (error, results, fields) {
    if (error) console.log(error);
    res.redirect("/admin/customer");
  });
});
app.get("/admin/vehicle", function (req, res) {
  console.log("req.isAuthenticated():");
  console.log(req.isAuthenticated());

  if (!req.isAuthenticated()) {
    res.redirect("/admin");
  } else {
    console.log("req.user:");
    console.log(req.user);
    user = req.user;
    var vin = req.query.vin == undefined ? "" : req.query.vin;

    var _class_no2 = req.query.class_no == undefined ? "" : req.query.class_no;

    var _make2 = req.query.make == undefined ? "" : req.query.make;

    var _sql7 = "SELECT a.vin, a.class_no, b.class_name, a.make, a.model ,a.year, a.license_plate_no FROM shc_vehicle a left join shc_vehicle_class b on a.class_no=b.class_no " + (vin != "" || _class_no2 != "" || _make2 != "" ? " WHERE" : "");

    if (vin != "") _sql7 += ' a.vin LIKE "%' + vin + '%"' + (_class_no2 != "" || _make2 != "" ? " AND" : "");
    if (_class_no2 != "") _sql7 += " a.class_no=" + _class_no2 + (_make2 != "" ? " AND" : "");
    if (_make2 != "") _sql7 += ' a.make LIKE "%' + _make2 + '%"';
    connection.query(_sql7, function (error, results, fields) {
      if (error) console.log(error);
      console.log(results);
      res.render("admin-vehicle-list", {
        vehicleClassArr: vehicleClassArr,
        vehicleData: results,
        vin: vin,
        class_no: _class_no2,
        make: _make2
      });
    });
  }
});
/* pin_admin_service_detail */

var couponInputStatus0 = "";
var odometerStatus0;
var couponStatus0;
var odometerInputStatus1 = "";
var odometerStatus1;
var locationStatus1;
/* get_admin_service_detail */

app.get("/admin/service/:service_no", function (req, res) {
  console.log("couponInputStatus0: " + couponInputStatus0);
  var service_no = req.params.service_no;
  var status = 0;
  var sql = "SELECT a.status, b.cust_type FROM shc_service a join shc_customer b on a.cust_id = b.cust_id WHERE service_no=" + service_no;
  connection.query(sql, function (error, results, fields) {
    if (error) throw error;
    status = results[0].status;
    console.log("status is " + status); //Status 0

    if (status == 0 || status == 4) {
      var _sql8 = "SELECT a.service_no, a.cust_id, a.vin, a.status, b.cust_type, date_format(a.s_pickup_date, '%Y-%m-%d %H:%i:%s') as s_pickup_date, date_format(a.s_dropoff_date, '%Y-%m-%d %H:%i:%s') as s_dropoff_date, c.vin, c.make, c.model, c.year, d.state as pickup_state, d.city as pickup_city, d.street as pickup_street, e.state as dropoff_state, e.city as dropoff_city, e.street as dropoff_street FROM shc_service a join shc_customer b on a.cust_id = b.cust_id join shc_vehicle c on a.vin = c.vin join shc_office_location d on a.pickup_loc = d.office_id join shc_office_location e on a.dropoff_loc = e.office_id where service_no=" + service_no;

      connection.query(_sql8, function (error, results, fields) {
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
    } else if (status == 2 || status == 3) {
      var _sql9 = "SELECT a.service_no as service_no, a.cust_id, a.vin, a.status, a.start_odometer, a.coupon_no, b.cust_type, date_format(a.pickup_date, '%Y-%m-%d %H:%i:%s') as pickup_date, date_format(a.dropoff_date, '%Y-%m-%d %H:%i:%s') as dropoff_date, c.vin, c.make, c.model, c.year, d.state as pickup_state, d.city as pickup_city, d.street as pickup_street, e.state as dropoff_state, e.city as dropoff_city, e.street as dropoff_street, f.invoice_no, f.invoice_amount FROM shc_service a join shc_customer b on a.cust_id = b.cust_id join shc_vehicle c on a.vin = c.vin join shc_office_location d on a.pickup_loc = d.office_id join shc_office_location e on a.dropoff_loc = e.office_id join shc_invoice f on a.service_no = f.service_no where a.service_no=" + service_no;

      connection.query(_sql9, function (error, results, fields) {
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
/* post_admin_service_detail */

app.post("/admin/service/:service_no", function (req, res) {
  currentStatus = req.body.currentStatus;
  var service_no = req.params.service_no;

  if (currentStatus == 0) {
    couponInputStatus0 = "";
    odometerStatus0 = req.body.odometerStatus0;
    couponStatus0 = req.body.couponStatus0;

    var _sql10 = "UPDATE shc_service SET pickup_date=NOW(), start_odometer=" + odometerStatus0 + (couponStatus0 == "" ? "" : ", coupon_no=" + couponStatus0) + ", status=1" + " WHERE service_no=" + service_no;

    if (couponStatus0 != "" && couponStatus0 != undefined) {
      console.log("Input coupon no:" + couponStatus0);
      connection.query("SELECT coupon_no, date_format(start_date, '%Y-%m-%d') as start_date, date_format(end_date, '%Y-%m-%d') as end_date FROM shc_coupon WHERE coupon_no=" + couponStatus0, function (error, results, fields) {
        if (error) throw error;

        if (results.length == 0 || results[0].coupon_no == 10000) {
          couponInputStatus0 = "Coupon invalid";
          console.log(couponInputStatus0);
          res.redirect("/admin/service/" + service_no);
        } else if (results[0].end_date < new Date().toISOString().substring(0, 10)) {
          couponInputStatus0 = "Coupon expired";
          console.log(couponInputStatus0);
          res.redirect("/admin/service/" + service_no);
        } else {
          couponInputStatus0 = "";
          connection.query(_sql10, function (error, results, fields) {
            if (error) throw error;
            res.redirect("/admin/service/" + service_no);
          });
          console.log("coupon vaild");
        }
      });
    } else {
      couponInputStatus0 = "";
      connection.query("UPDATE shc_service SET pickup_date=NOW(), start_odometer=?, coupon_no=?, status=1 WHERE service_no=?", [odometerStatus0, couponStatus0 == "" ? 10000 : couponStatus0, service_no], function (error, results, fields) {
        if (error) throw error;
        res.redirect("/admin/service/" + service_no);
      });
    } //currentStatus 1

  } else if (currentStatus == 1) {
    odometerInputStatus1 = "";
    odometerStatus1 = req.body.odometerStatus1;
    locationStatus1 = req.body.locationStatus1;
    connection.query("SELECT a.cust_type, b.start_odometer from shc_customer a join shc_service b on a.cust_id = b.cust_id WHERE service_no=?", [service_no], function (error, results, fields) {
      if (error) throw error;
      var cust_type = results[0].cust_type;

      if (results.start_odometer > odometerStatus1) {
        odometerInputStatus1 = "End odometer must be larger than start odometer.";
        console.log(odometerInputStatus1);
        res.redirect("/admin/service/" + service_no);
      } else {
        //Update service
        connection.query("UPDATE shc_service SET end_odometer=?, dropoff_loc=?, dropoff_date=NOW(), status=2 WHERE service_no=?", [odometerStatus1, locationStatus1, service_no], function (error, results, fields) {
          if (error) throw error;
          res.redirect("/admin/service/" + service_no);
        }); //Calculate fees

        if (cust_type == "I") {
          connection.query("SELECT  (datediff(a.dropoff_date, a.pickup_date)+1) as days, (a.end_odometer - a.start_odometer) as odometer, b.rental_rate, b.mileage_fee, b.odometer_limit, d.discount FROM shc_service a join shc_vehicle c on a.vin = c.vin join shc_vehicle_class b on b.class_no = c.class_no join shc_coupon d on a.coupon_no = d.coupon_no WHERE a.service_no=" + service_no, function (error, results, fields) {
            if (error) throw error;
            var days = results[0].days;
            var odometer = results[0].odometer;
            var rental_rate = results[0].rental_rate;
            var mileage_fee = results[0].mileage_fee;
            var odometer_limit = results[0].odometer_limit;
            var discount = results[0].discount;
            var totalFees = days * rental_rate;

            if (odometer > days * odometer_limit) {
              totalFees += (odometer - days * odometer_limit) * mileage_fee;
            }

            totalFees *= 1 - discount;
            console.log("totalFees: " + totalFees);
            connection.query("INSERT INTO shc_invoice (invoice_date, invoice_amount,invoice_remain_amount, service_no) VALUES (NOW(),?,?,?);", [totalFees, totalFees, service_no], function (error, results, fields) {
              if (error) throw error;
            });
          });
        } else {
          connection.query("SELECT  (datediff(a.dropoff_date, a.pickup_date)+1) as days, (a.end_odometer - a.start_odometer) as odometer, b.rental_rate, b.mileage_fee, b.odometer_limit, f.discount FROM shc_service a join shc_vehicle c on a.vin = c.vin join shc_vehicle_class b on b.class_no = c.class_no join shc_customer d on a.cust_id = d.cust_id join shc_corporate e on d.cust_id = e.cust_id join shc_corporation f on e.corporate_id = f.corporate_id WHERE a.service_no=?", [service_no], function (error, results, fields) {
            if (error) throw error;
            var days = results[0].days;
            var odometer = results[0].odometer;
            var rental_rate = results[0].rental_rate;
            var mileage_fee = results[0].mileage_fee;
            var odometer_limit = results[0].odometer_limit;
            var discount = results[0].discount;
            var totalFees = days * rental_rate;

            if (odometer > days * odometer_limit) {
              totalFees += (odometer - days * odometer_limit) * mileage_fee;
            }

            totalFees *= 1 - discount;
            console.log("totalFees: " + totalFees);
            connection.query("INSERT INTO shc_invoice (invoice_date, invoice_amount,invoice_remain_amount, service_no) VALUES (NOW(),?,?,?);", [totalFees, totalFees, service_no], function (error, results, fields) {
              if (error) throw error;
            });
          });
        }
      }
    });
  }
});
/* get_payment */

app.get("/payment/:service_no", function (req, res) {
  console.log("req.isAuthenticated():");
  console.log(req.isAuthenticated());

  if (!req.isAuthenticated()) {
    res.redirect("/");
  } else {
    console.log("req.user:");
    console.log(req.user);
    var _user7 = req.user;
    var service_no = req.params.service_no;
    connection.query("SELECT cust_type FROM shc_customer a join shc_service b on a.cust_id = b.cust_id WHERE service_no=?", [service_no], function (error, results, fields) {
      if (error) throw error;

      if (results[0].cust_type == "I") {
        console.log("individual customer");
        connection.query("SELECT a.service_no, a.cust_id, a.vin, a.status, b.cust_type, (a.end_odometer - a.start_odometer) as odometer, (datediff(a.dropoff_date, a.pickup_date)+1) as days, c.vin, c.license_plate_no, c.make, c.model, c.year, d.class_name, d.rental_rate, d.mileage_fee, d.odometer_limit, e.coupon_no, e.discount, f.invoice_no, f.invoice_amount, f.invoice_remain_amount FROM shc_service a join shc_customer b on a.cust_id = b.cust_id join shc_vehicle c on a.vin = c.vin join shc_vehicle_class d on c.class_no = d.class_no join shc_coupon e on a.coupon_no = e.coupon_no join shc_invoice f on a.service_no = f.service_no where a.service_no=?", [service_no], function (error, results, fields) {
          if (error) throw error;
          console.log(service_no);
          console.log(results);
          res.render("payment", {
            user: _user7,
            results: results[0],
            service_no: service_no
          });
        });
      } else {
        console.log("corporate customer");
        connection.query("SELECT a.service_no, a.cust_id, a.vin, a.status, b.cust_type, (a.end_odometer - a.start_odometer) as odometer, (datediff(a.dropoff_date, a.pickup_date)+1) as days, c.vin, c.license_plate_no, c.make, c.model, c.year, d.class_name, d.rental_rate, d.mileage_fee, d.odometer_limit, f.invoice_no, f.invoice_amount, f.invoice_remain_amount, h.cname, h.discount FROM shc_service a join shc_customer b on a.cust_id = b.cust_id join shc_vehicle c on a.vin = c.vin join shc_vehicle_class d on c.class_no = d.class_no join shc_invoice f on a.service_no = f.service_no join shc_corporate g on b.cust_id = g.cust_id join shc_corporation h on h.corporate_id = g.corporate_id where a.service_no=?", [service_no], function (error, results, fields) {
          if (error) throw error;
          console.log(service_no);
          console.log(results);
          res.render("payment", {
            user: _user7,
            results: results[0],
            service_no: service_no
          });
        });
      }
    });
  }
});
/* post_payment */

app.post("/payment/:service_no", function (req, res) {
  console.log("req.isAuthenticated():");
  console.log(req.isAuthenticated());
  var user = req.user;
  var service_no = req.params.service_no;
  var payment_amount = req.body.payment_amount;
  var payment_method = req.body.payment_method;
  var invoice_remain_amount = req.body.invoice_remain_amount;
  var card_no = req.body.card_no;
  var invoice_no = req.body.invoice_no;
  connection.query("INSERT INTO shc_payment (payment_date, payment_amount, payment_method, card_no, invoice_no) VALUES (NOW(),?,?,?,?)", [payment_amount, payment_method, card_no, invoice_no], function (error, results, fields) {
    if (error) throw error;
    console.log(service_no);
    console.log(results);
    res.render("payment-success", {
      user: user,
      service_no: service_no,
      invoice_remain_amount: invoice_remain_amount,
      payment_amount: payment_amount
    });
  });
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
app.get("/admin/logout", function (req, res) {
  req.logout();
  res.redirect("/admin");
});
app.get("/populate/vehicle", function (req, res) {
  var len = 17;
  var chars = "ABCDEFGHJKMNPQRSTWXYZ2345678";
  var maxPos = chars.length;
  var makeList = ["Porsche", "Mercedes Benz", "Audi", "Volkswagen", "BMW", "Ford", "Tesla", "Toyota", "Honda", "Volvo", "Hyundai"];
  var modelList = ["1 Series", "100", "124 Spider", "1500 Classic Regular Cab", "190 E", "1500 Extended Cab"];
  var yearList = [1990, 1995, 2000, 2005, 2010, 1993, 2998, 2003, 2009];
  var classList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  var officeList = [10001, 10002, 10003, 10004, 10005, 10006, 10007, 10008, 10009, 10010];
  console.log(officeList);

  for (var i = 0; i < 1000; i++) {
    var vin = "";

    for (var j = 0; j < len; j++) {
      vin += chars.charAt(Math.floor(Math.random() * maxPos));
    }

    console.log(vin);
    var license_plate_no = "";

    for (var k = 0; k < 6; k++) {
      license_plate_no += chars.charAt(Math.floor(Math.random() * maxPos));
    }

    console.log(license_plate_no);
    make = makeList[Math.floor(Math.random() * makeList.length)];
    console.log(make);
    model = modelList[Math.floor(Math.random() * modelList.length)];
    year = yearList[Math.floor(Math.random() * yearList.length)];
    class_no = classList[Math.floor(Math.random() * classList.length)];
    office_id = officeList[Math.floor(Math.random() * officeList.length)];
    connection.query("INSERT INTO shc_vehicle VALUES (?,?,?,?,?,?,?,?)", [vin, license_plate_no, make, model, year, 0, class_no, office_id], function (error, results, fields) {
      if (error) throw error;
      console.log(results);
    });
  }
});
app.listen(3000, function () {
  console.log("Server started on port 3000");
});