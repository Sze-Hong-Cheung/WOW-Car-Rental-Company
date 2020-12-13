"use strict";

exports.test = function test() {
  var connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "12345678",
    database: "wow_db"
  });
  connection.query("SELECT office_id, state, city, street FROM shc_office_location", function (error, results, fields) {
    return results;
  });
};