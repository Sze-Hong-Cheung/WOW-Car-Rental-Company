//jshint esversion:6

const express = require("express");
const bodyParser = require("body-parser");
const https = require("https");
const mysql = require("mysql");
const router = express.Router();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const { forEach } = require("async");

var app = express();

app.set("view engine", "ejs");
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(cors());

app.use(cookieParser());
app.use(
  session({
    secret: "positronx",
    saveUninitialized: false,
    resave: false,
  })
);
app.use(express.static("public"));

let serviceStatusArr = [
  "Applid",
  "Renting",
  "Waiting for Payment",
  "Completed",
  "Canceled",
];

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "12345678",
  database: "wow_db",
});

connection.connect((err) => {
  if (err) throw err;
  console.log("Connected!");
});

app.get("/", function (req, res) {
  /*
    res.write("Hello"); //添加需要 send 的内容
    res.send("Hello"); //发送文字（或HTML）回应
    res.redirect("/"); //重定向
    */
  /*待添加:如果已登录，跳转个人主页 */

  res.sendFile(__dirname + "/index.html");
});

app.get("/user-page", function (req, res) {
  res.render("user-page", { userName: "Jesse" });
});

app.post("/", function (req, res) {
  console.log(req.body.email);
  let checkUserSql = "SELECT email, password FROM shc_customer WHERE email=?";
  let addSqlParams = [req.body.email];
  connection.query(checkUserSql, addSqlParams, function (
    error,
    results,
    fields
  ) {
    if (error) throw error;
    if (results.length == 0) {
      console.log("User doesn't exist.");
    } else {
      if (results[0].password === req.body.password) {
        console.log("Sign in Successfully.");
      } else {
        console.log("Wrong password.");
      }
    }
    console.log(results);
  });
});

app.get("/admin/service", function (req, res) {
  console.log(req.query.cust_id);
  let service_no = req.query.service_no;
  let cust_id = req.query.cust_id;
  let status = req.query.status;
  console.log("service_no is " + service_no);
  console.log("cust_id is " + cust_id);
  console.log("status is " + status);
  console.log(typeof status);
  let searchServiceSql =
    "SELECT service_no, cust_id, date_format(apply_date, '%Y-%m-%d %H:%i:%s') as apply_time, status FROM shc_service";

  if (service_no != "" || cust_id != "" || status != "") {
    console.log("have para");
    searchServiceSql += " WHERE";
    if (service_no != "") {
      searchServiceSql += " service_no=" + service_no;
      if (cust_id != "" || status != "") searchServiceSql += " AND";
    }
    if (cust_id != "") {
      searchServiceSql += " cust_id=" + cust_id;
      if (status != "") searchServiceSql += " AND";
    }
    if (status != "") {
      searchServiceSql += " status=" + status;
    }
  } else {
    console.log("no para");
  }
  connection.query(searchServiceSql, function (error, results, fields) {
    if (error) throw error;
    console.log(results);
    res.render("admin-service-list", {
      serviceData: results,
      serviceNoValue: service_no,
      custIdValue: cust_id,
      serviceStatus: serviceStatusArr,
      currentStatus: status,
    });
  });
});

//Service_detail
let couponInputStatus0 = "";
let odometerStatus0;
let couponStatus0;

let odometerInputStatus1 = "";
let odometerStatus1;
let locationStatus1;

//Get_Service_detail
app.get("/admin/service/:service_no", function (req, res) {
  console.log("couponInputStatus0: " + couponInputStatus0);
  let service_no = req.params.service_no;
  let status = 0;
  let sql =
    "SELECT a.status, b.cust_type FROM shc_service a join shc_customer b on a.cust_id = b.cust_id WHERE service_no=" +
    service_no;

  connection.query(sql, function (error, results, fields) {
    if (error) throw error;
    status = results[0].status;
    console.log("status is " + status);

    //Status 0
    if (status == 0) {
      let sql =
        "SELECT a.service_no, a.cust_id, a.vin, a.status, b.cust_type, date_format(a.s_pickup_date, '%Y-%m-%d %H:%i:%s') as s_pickup_date, date_format(a.s_dropoff_date, '%Y-%m-%d %H:%i:%s') as s_dropoff_date, c.vin, c.make, c.model, c.year, d.state as pickup_state, d.city as pickup_city, d.street as pickup_street, e.state as dropoff_state, e.city as dropoff_city, e.street as dropoff_street FROM shc_service a join shc_customer b on a.cust_id = b.cust_id join shc_vehicle c on a.vin = c.vin join shc_office_location d on a.pickup_loc = d.office_id join shc_office_location e on a.dropoff_loc = e.office_id where service_no=" +
        service_no;
      connection.query(sql, function (error, results, fields) {
        if (error) throw error;
        res.render("admin-service-status0", {
          serviceData: results[0],
          serviceStatus: serviceStatusArr,
          couponInputStatus0: couponInputStatus0,
          odometerStatus0: odometerStatus0,
          couponStatus0: couponStatus0,
        });
      });

      //Status 1
    } else if (status == 1) {
      connection.query(
        "SELECT office_id, state, city, street from shc_office_location",
        function (error, results, fields) {
          if (error) throw error;
          let allLocation = results;
          let sql =
            "SELECT a.service_no, a.cust_id, a.vin, a.status, a.coupon_no, b.cust_type, date_format(a.pickup_date, '%Y-%m-%d %H:%i:%s') as pickup_date, date_format(a.s_dropoff_date, '%Y-%m-%d %H:%i:%s') as s_dropoff_date, c.vin, c.make, c.model, c.year, d.state as pickup_state, d.city as pickup_city, d.street as pickup_street, e.state as dropoff_state, e.city as dropoff_city, e.street as dropoff_street FROM shc_service a join shc_customer b on a.cust_id = b.cust_id join shc_vehicle c on a.vin = c.vin join shc_office_location d on a.pickup_loc = d.office_id join shc_office_location e on a.dropoff_loc = e.office_id where service_no=" +
            service_no;
          connection.query(sql, function (error, results, fields) {
            if (error) throw error;
            res.render("admin-service-status1", {
              serviceData: results[0],
              serviceStatus: serviceStatusArr,
              allLocation: allLocation,
              odometerInputStatus1: odometerInputStatus1,
              odometerStatus1: odometerStatus1,
              locationStatus1: locationStatus1,
            });
          });
        }
      );
      //Status 2
    } else if (status == 2) {
      let sql =
        "SELECT a.service_no as service_no, a.cust_id, a.vin, a.status, b.cust_type, date_format(a.pickup_date, '%Y-%m-%d %H:%i:%s') as pickup_date, date_format(a.dropoff_date, '%Y-%m-%d %H:%i:%s') as dropoff_date, c.vin, c.make, c.model, c.year, d.state as pickup_state, d.city as pickup_city, d.street as pickup_street, e.state as dropoff_state, e.city as dropoff_city, e.street as dropoff_street, f.invoice_no, f.invoice_amount FROM shc_service a join shc_customer b on a.cust_id = b.cust_id join shc_vehicle c on a.vin = c.vin join shc_office_location d on a.pickup_loc = d.office_id join shc_office_location e on a.dropoff_loc = e.office_id join shc_invoice f on a.service_no = f.service_no where a.service_no=" +
        service_no;
      connection.query(sql, function (error, results, fields) {
        if (error) throw error;
        let serviceData = results[0];
        connection.query("SELECT payment_amount FROM shc_payment WHERE invoice_no=" + serviceData.invoice_no, function (error, results, fields) {
          if (error) throw error;
          let totalPaidAmount = 0;
          for (let i = 0; i < results.length; i++) {
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

  let service_no = req.params.service_no;

  if (currentStatus == 0) {
    couponInputStatus0 = "";
    odometerStatus0 = req.body.odometerStatus0;
    couponStatus0 = req.body.couponStatus0;
    let sql =
      "UPDATE shc_service SET start_odometer=" +
      odometerStatus0 +
      (couponStatus0 == "" ? "" : ", coupon_no=" + couponStatus0) +
      ", status=1" +
      " WHERE service_no=" +
      service_no;
    if (couponStatus0 != "" && couponStatus0 != undefined) {
      console.log("Input coupon no:" + couponStatus0);
      connection.query(
        "SELECT date_format(start_date, '%Y-%m-%d') as start_date, date_format(end_date, '%Y-%m-%d') as end_date FROM shc_coupon WHERE coupon_no=" +
          couponStatus0,
        function (error, results, fields) {
          if (error) throw error;
          if (results.length == 0) {
            couponInputStatus0 = "Coupon invalid";
            console.log(couponInputStatus0);
            res.redirect("/admin/service/" + service_no);
          } else if (
            results[0].end_date < new Date().toISOString().substring(0, 10)
          ) {
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
        }
      );
    } else {
      couponInputStatus0 = "";
      connection.query(sql, function (error, results, fields) {
        if (error) throw error;
        res.redirect("/admin/service/" + service_no);
      });
    }

    //currentStatus 1
  } else if (currentStatus == 1) {
    odometerInputStatus1 = "";
    odometerStatus1 = req.body.odometerStatus1;
    locationStatus1 = req.body.locationStatus1;
    connection.query(
      "SELECT start_odometer from shc_service WHERE service_no=" + service_no,
      function (error, results, fields) {
        if (error) throw error;
        if (results[0].start_odometer > odometerStatus1) {
          odometerInputStatus1 =
            "End odometer must be larger than start odometer.";
          console.log(odometerInputStatus1);
          res.redirect("/admin/service/" + service_no);
        } else {
          //Update service
          connection.query(
            "UPDATE shc_service SET end_odometer=" +
              odometerStatus1 +
              ", dropoff_loc=" +
              locationStatus1 +
              ", dropoff_date=NOW()" +
              ", status=2 WHERE service_no=" +
              service_no,
            function (error, results, fields) {
              if (error) throw error;
              res.redirect("/admin/service/" + service_no);
            }
          );
          //Calculate fees
          connection.query(
            "SELECT (datediff(a.dropoff_date, a.pickup_date)+1) as days, (a.end_odometer - a.start_odometer) as odometer, b.rental_rate, b.mileage_fee, b.odometer_limit FROM shc_service a join shc_vehicle c on a.vin = c.vin join shc_vehicle_class b on b.class_no = c.class_no WHERE a.service_no=" +
              service_no,
            function (error, results, fields) {
              if (error) throw error;
              let days = results[0].days;
              let odometer = results[0].odometer;
              let rental_rate = results[0].rental_rate;
              let mileage_fee = results[0].mileage_fee;
              let odometer_limit = results[0].odometer_limit;
              let totalFees = days * rental_rate;
              if (odometer > days * odometer_limit) {
                totalFees += (odometer - days * odometer_limit) * mileage_fee;
              }
              console.log("totalFees: " + totalFees);
              connection.query(
                "INSERT INTO shc_invoice (invoice_date, invoice_amount, service_no) VALUES ( NOW(), " +
                  totalFees +
                  ", " +
                  service_no +
                  ");",
                function (error, results, fields) {
                  if (error) throw error;
                }
              );
            }
          );
        }
      }
    );
  }
});

app.listen(3000, function () {
  console.log("Server started on port 3000");
});
