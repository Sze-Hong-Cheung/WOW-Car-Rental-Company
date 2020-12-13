"use strict";

var express = require("express");

var bodyParser = require("body-parser");

var https = require("https");

var mysql = require("mysql");

var crypto = require("crypto");

var passport = require("passport");

var LocalStrategy = require("passport-local").Strategy;

var flash = require("connect-flash");

var app = express();

exports.renderPaymentPage = function (req, res, connection, service_no) {
  connection.query("SELECT a.service_no, a.cust_id, a.vin, a.status, b.cust_type, (a.end_odometer - a.start_odometer) as odometer, (datediff(a.dropoff_date, a.pickup_date)+1) as days, c.vin, c.license_plate_no, c.make, c.model, c.year, d.class_name, d.rental_rate, d.mileage_fee, d.odometer_limit, e.discount, f.invoice_amount FROM shc_service a join shc_customer b on a.cust_id = b.cust_id join shc_vehicle c on a.vin = c.vin join shc_vehicle_class d on c.class_no = d.class_no join shc_coupon e on a.coupon_no = e.coupon_no join shc_invoice f on a.service_no = f.service_no where a.service_no=?", [service_no], function (error, results, fields) {
    if (error) throw error;
    console.log(service_no);
    console.log(results);
    res.render("payment", {
      user: user,
      results: results[0]
    });
  });
};