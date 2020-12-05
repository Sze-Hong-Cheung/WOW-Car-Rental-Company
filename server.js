//jshint esversion:6

const express = require("express"); 
const bodyParser = require("body-parser");
const https = require("https");
const mysql = require('mysql');

var app = express(); 

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '12345678',
  database: 'project_db'
}); 
connection.connect((err) => {
  if (err) throw err;
  console.log('Connected!');
});

connection.query('SELECT * FROM shc_vehicle', function (error, results, fields) {
    if (error) throw error;
    console.log(results[0].make);
  });

app.listen(3000, function(){
    console.log("Server started on port 3000");
});

app.get("/", function(req, res){
    /*console.log(req); 
    res.write("Hello"); //添加需要 send 的内容
    res.send("Hello"); //发送文字（或HTML）回应
    res.redirect("/"); //重定向
    */
   res.sendFile(__dirname + "/index.html")
});

app.post("/", function(req, res){
    res.send("thanks for posting");

    console.log(req.body.email); 
    console.log(req.body.password); 
});

