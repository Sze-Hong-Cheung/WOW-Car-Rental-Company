//jshint esversion:6

const express = require("express");
const bodyParser = require("body-parser");
const https = require("https");
const mysql = require("mysql");

var app = express();

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let serviceStatusArr = ["Applid", "Renting", "Completed", "Closed", "Canceled"];

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

let resultOfServiceDate = [];
let service_no = "";
let cust_id = "";
let status = "";

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

app.get("/admin/service/:service_no", function (req, res) {
  let service_no = req.params.service_no;
  let status = "";
  let serviceResult = {};
  let sql = "SELECT status FROM shc_service WHERE service_no=" + service_no;
  connection.query(sql, function (error, results, fields) {
    if (error) throw error;
    status = results[0].status;
    console.log("status is " + status);
  });
  if (status == 0) {
    let sql =
      "SELECT a.service_no, a.cust_id, a.vin, a.status, date_format(a.s_pickup_date, '%Y-%m-%d %H:%i:%s') as s_pickup_date, date_format(a.s_dropoff_date, '%Y-%m-%d %H:%i:%s') as s_dropoff_date, c.vin, c.make, c.model, c.year, d.state as pickup_state, d.city as pickup_city, d.street as pickup_street, e.state as dropoff_state, e.city as dropoff_city, e.street as dropoff_street FROM shc_service a join shc_customer b on a.cust_id = b.cust_id join shc_vehicle c on a.vin = c.vin join shc_office_location d on a.pickup_loc = d.office_id join shc_office_location e on a.dropoff_loc = e.office_id where service_no=" +
      service_no;
    connection.query(sql, function (error, results, fields) {
      if (error) throw error;
      serviceResult = results[0];
      res.render("admin-service-detail", {
        serviceData: serviceResult,
        serviceStatus: serviceStatusArr,
      });
    });
  }
});

app.listen(3000, function () {
  console.log("Server started on port 3000");
});
