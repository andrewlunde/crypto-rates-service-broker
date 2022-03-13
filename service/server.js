'use strict';
/* eslint-disable no-console */

const express = require('express');
const xsenv = require('@sap/xsenv');
const passport = require('passport');
const JWTStrategy = require('@sap/xssec').JWTStrategy;

const app = express();

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

  console.log("End uploadMarketData.");
  // res.json([{ async: async }]);
  res.status(201).end();
});

app.post('/downloadMarketData', (req, res) => {
  console.log("Start downloadMarketData.");
  if (req.query.async != undefined) {
    let async = req.query.async;
    console.log('async: ' + async);
  }

  console.log("End downloadMarketData.");
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
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`SBF framework demo: products service application listening on port ${port} !`);
});