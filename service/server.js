'use strict';
/* eslint-disable no-console */

const express = require('express');
const xsenv = require('@sap/xsenv');
const passport = require('passport');
const JWTStrategy = require('@sap/xssec').JWTStrategy;
// const xmlparser = require('express-xml-bodyparser');
// const contentType = require('content-type')

// https://www.npmjs.com/package/sprintf-js#format-specification
const sprintf = require('sprintf-js').sprintf;


const getRawBody = require('raw-body');

const app = express();

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));
// xmlparser.regexp = /^text\/plain$/i;
// app.use(xmlparser());

app.use(function (req, res, next) {
  getRawBody(req, {
    length: req.headers['content-length'],
    limit: '1mb',
    // encoding: contentType.parse(req).parameters.charset
    encoding: 'utf-8',
  }, function (err, string) {
    if (err) return next(err)
    req.text = string
    next()
  });
});

passport.use(new JWTStrategy(xsenv.getServices({uaa:{tag:'xsuaa'}}).uaa));

app.use(passport.initialize());
app.use(passport.authenticate('JWT', { session: false }));

app.use((req, res, next) => {
  console.log('Service instance id:', req.authInfo.getCloneServiceInstanceId());
  console.log('Caller tenant id:', req.authInfo.getIdentityZone());
  console.log('Token grant type:', req.authInfo.getGrantType());
  console.log('Calling app has name %s and id %s',
    req.authInfo.getAdditionalAuthAttribute('application_name'),
    req.authInfo.getAdditionalAuthAttribute('application_id')
  );
  next();
});

var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(':memory:');

db.serialize(function() {
  db.run("CREATE TABLE tenants (tenant_id TEXT)");
  db.run("CREATE TABLE products (tenant_id TEXT, product TEXT)");
});

// db.close();

app.get('/provisioned', (req, res) => {
  console.log("Start Provisioned.");
  var registrations = [];
  db.all("SELECT rowid AS id, tenant_id FROM tenants", function(err, rows) {
    rows.forEach(row => {
      console.log(row.id + ": " + row.tenant_id);
      registrations.push(row.tenant_id);
    });
    console.log("End Provisioned.");
    res.json(registrations);
  });
});

// /products?action=add&product=beer
// /products?action=del&product=beer
app.get('/products', (req, res) => {
  let tenant_id = req.authInfo.getCloneServiceInstanceId();
  console.log("Start Products with " + tenant_id);
  if (req.query.action != undefined) {
    let action = req.query.action;
    if (action == "add") {
      if (req.query.product != undefined) {
        let product = req.query.product;
        db.serialize(function() {
          var stmt = db.prepare("INSERT INTO products VALUES (?,?)");
          stmt.run(tenant_id,product);
          stmt.finalize();
          console.log('inserted: ' + product);
          res.json([{ action: 'Add', tenant: tenant_id, product: product }]);
        });
      } else {
        console.log("End Products with " + tenant_id);
        res.json([{ error: "Product: was not provided."}]);
      }
    } else if (action == "del") {
      if (req.query.product != undefined) {
        let product = req.query.product;
        db.serialize(function() {
          // var stmt = db.prepare("DELETE FROM products WHERE tenant_id = '?' AND product = '?'");
          // WARNING: This is vulnerable to SQL injection attacks!  Demo ONLY!
          var query = "DELETE FROM products WHERE tenant_id = '" + tenant_id + "' AND product = '" + product + "'";
          console.log("Query: " + query);
          //var stmt = db.prepare("DELETE FROM products WHERE tenant_id = '" + tenant_id + "' AND product = '" + product + "'");
          var stmt = db.prepare(query);
          // stmt.run(tenant_id,product);
          stmt.run();
          stmt.finalize();
          console.log('deleted: ' + product);
          res.json([{ action: 'Delete', tenant: tenant_id, product: product }]);
        });
      } else {
        console.log("End Products with " + tenant_id);
        res.json([{ error: "Product: was not provided."}]);
      }
    } else {
      console.log("Unknown action: " + action);
      console.log("End Products with " + tenant_id);
      res.json([{ error: "Unknown action:" + action}]);
    }
  } else {
    var products = [];
    var query = "SELECT rowid AS id, product FROM products WHERE tenant_id = '" + tenant_id + "'";
    console.log("Query: " + query);
    db.all(query, [], function(err, rows) {
      rows.forEach(row => {
        console.log(row.id + ": " + row.product);
        products.push(row.product);
      });
      console.log("End Products with " + tenant_id);
      res.json(products);
    });
  }
});

app.get('/provision/*', (req, res) => {
  console.log('Provision:');

  var tenant = "unknown";
  var parts = req.path.split("/");
  if (parts.length >= 3) {
    tenant = parts[2];
  }

  console.log('tenant: ' + tenant);

  db.serialize(function() {
    var stmt = db.prepare("INSERT INTO tenants VALUES (?)");
    stmt.run(tenant);
    stmt.finalize();
    console.log('inserted: ' + tenant);
    res.json([{ action: 'Provision', tenant: tenant }]);
  });

});

app.get('/deprovision/*', (req, res) => {
  console.log('Deprovision:');

  var tenant = "unknown";
  var parts = req.path.split("/");
  if (parts.length >= 3) {
    tenant = parts[2];
  }

  console.log('tenant: ' + tenant);

  db.serialize(function() {
    var stmt = db.prepare("DELETE FROM tenants WHERE tenant_id = ?");
    stmt.run("tenant: " + tenant);
    stmt.finalize();
    console.log('deleted: ' + tenant);
    res.json([{ action: 'Deprovision', tenant: tenant }]);
  });

});

app.post('/uploadMarketData', (req, res) => {
  console.log("Start uploadMarketData.");
  if (req.query.async != undefined) {
    let async = req.query.async;
    console.log('async: ' + async);
  }

  console.log("Assemble Output uploadMarketData.");
  // res.json([{ async: async }]);
  res.status(201).end();
});

app.post('/downloadMarketData', (req, res) => {
  console.log("Start downloadMarketData.");
  if (req.query.async != undefined) {
    let async = req.query.async;
    console.log('async: ' + async);
  }

  var content_type = "";

  if (req.headers['content-type'] != undefined) {
    content_type = req.headers['content-type'];
    console.log('Content-Type: ' + content_type);
  }

  console.log("End downloadMarketData.");

  if (content_type == "application/json") {
    console.log('JSON');
    res.json([{
      "providerCode": "ECB",
      "marketDataCategory": "01",
      "marketDataSource": "ECB",
      "marketDataKey": "EUR~USD",
      "marketDataProperty": "C",
      "validFromDate": "2018-05-01",
      "validFromTime": "00:00:00",
      "marketDataValue": 1.2310000000,
      "currency": null,
      "fromFactor": null,
      "toFactor": null,
      "priceNotation": null,
      "termInDays": "",
      "messageType": "",
      "messageText": ""
    }]);
  } else if ((content_type == "text/plain") || (content_type == "text/plain; charset=utf-8")) {
    console.log('TEXT');
    console.log(req.text);
    var lines = req.text.split("\n");
    var line = "";
    var parsing_input = false;

    // <"SAP_Internet_Market_Data_Request_Format_Version" "text/html 1.0">
    // <"TableRow1" "RINID1    Instrument Name">20
    // <"TableRow2" "RINID2    Data Source">15
    // <"TableRow3" "SPRPTY    Instrument Property">15
    // <"TableRow4" "DFROMDATE Historical Data Start Date">8
    // <"TableRow5" "DFROMTIME Historical Data Start Time">6
    // <"TableRow6" "DTODATE Historical Data End Date">8
    // <"TableRow7" "DTOTIME Historical Data End Time">6
    // <"TableRow8" "UNAME     SAP User Requesting">12

    var instrument_name = "";
    var data_source = "";
    var instrument_property = "";
    var data_start_date = "";
    var data_start_time = "";
    var data_end_date = "";
    var data_end_time = "";
    var user_requesting = "";
 
    var stridx = 0;
    var strlen = 0;
    for (var i = 0; i < lines.length; i++) {
      line = lines[i].trim();
      // console.log(i + ": " + line);
      if (line == "</body>") {
        parsing_input = false;
      }
      if (parsing_input) {
        console.log(i + ": '" + line + "'");
        stridx += strlen; strlen = 20;
        instrument_name = line.substring(stridx, stridx+strlen);
        stridx += strlen; strlen = 15;
        data_source = line.substring(stridx, stridx+strlen);
        stridx += strlen; strlen = 15;
        instrument_property = line.substring(stridx, stridx+strlen);
        stridx += strlen; strlen = 8;
        data_start_date = line.substring(stridx, stridx+strlen);
        stridx += strlen; strlen = 6;
        data_start_time = line.substring(stridx, stridx+strlen);
        stridx += strlen; strlen = 8;
        data_end_date = line.substring(stridx, stridx+strlen);
        stridx += strlen; strlen = 6;
        data_end_time = line.substring(stridx, stridx+strlen);
        stridx += strlen; strlen = 12;
        user_requesting = line.substring(stridx, stridx+strlen);

        console.log("instrument_name: " + instrument_name);
        console.log("data_source: " + data_source);
        console.log("instrument_property: " + instrument_property);
        console.log("data_start_date: " + data_start_date);
        console.log("data_start_time: " + data_start_time);
        console.log("data_end_date: " + data_end_date);
        console.log("data_end_time: " + data_end_time);
        console.log("user_requesting: " + user_requesting);

      }
      if (line == "<body>") {
        parsing_input = true;
      }
    }

    // <"SAP_Internet_Market_Data_Answer_Format_Version" "text/plain 1.0">
    // <"TableRow1" "RINID1    Instrument Name">20
    // <"TableRow2" "RINID2    Data Source">15
    // <"TableRow3" "SPRPTY    Instrument Property">15
    // <"TableRow4" "SSTATS Request Status: Blanks, if ok ">2
    // <"TableRow5" "ERROR Error Message relating to STATUS ">80
    // <"TableRow6" "RSUPID Data source">10
    // <"TableRow7" "RCONID Contributor Identification">10
    // <"TableRow8" "RCONCN Contributor Country Identification">5
    // <"TableRow9" "DATE Date in YYYYMMDD Format">8
    // <"TableRow10" "TIME Time in HHMMSS Format">6
    // <"TableRow11" "VALUE Value with decimal point optionally">20
    // <"TableRow12" "CURRENCY Currency Information for security prices">5
    // <"TableRow13" "MKIND Market Indicator for security prices">5
    // <"TableRow14" "CFFACT Currency: From factor">7
    // <"TableRow15" "CTFACT Currency: To factor">7
    // <"TableRow16" "UNAME Currency: User Name">12
    // <"TableRow17" "RZUSATZ Volatilities: Number of Days">10
    // <"TableRow18" "NEWLINE Line Feed Character/Newline">1
 

    // https://www.npmjs.com/package/sprintf-js#format-specification

    res.header('content-type', 'text/plain');
    var txtout = "";
    var testout = sprintf("%-20s", instrument_name.trim());

    // txtout += "EUR~USD:01          ECB            CLO                                                                                                                       201805010000001.2310000000                                                      \n";
    txtout += testout;
    txtout += data_source;
    txtout += instrument_property;
    txtout += sprintf("%-2s", ""); // Request Status
    txtout += sprintf("%-80s", ""); // Error Message
    txtout += sprintf("%-10s", ""); // Data Source
    txtout += sprintf("%-10s", ""); // Contributor ID
    txtout += sprintf("%-5s", ""); // Contributor Country
    txtout += sprintf("%-8s", "20200101"); // Date in YYYYMNDD
    txtout += sprintf("%-6s", "000000"); // Time in HHMMSS
    txtout += sprintf("%-20s", "1.231"); // Value with decimal point optionally // This is going to be an issue with cryptomoney
    txtout += sprintf("%-5s", ""); // Currency Information for security prices
    txtout += sprintf("%-5s", ""); // Market Indicator for security prices
    txtout += sprintf("%-7s", ""); // Currency: From factor
    txtout += sprintf("%-7s", ""); // Currency: To factor
    txtout += sprintf("%-12s", ""); // Currency: User Name
    txtout += sprintf("%-10s", ""); // Volatilities: Number of Days
    // txtout += "ECB            CLO                                                                                                                       201805010000001.2310000000                                                      \n";
    txtout += "\n";
    console.log(txtout);
    res.send(txtout);
  } else {
    console.log('UNKNOWN');
    res.header('content-type', 'text/plain');
    res.send("Something happened that was not expected.");
  }

});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`SBF framework demo: products service application listening on port ${port} !`);
});
