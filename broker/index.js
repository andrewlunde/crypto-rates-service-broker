'use strict';

const Broker = require('@sap/sbf');

//const express = require('express');
const request = require('request');
const xsenv = require('@sap/xsenv');

const serviceName = 'crypto-rates-uaa';
const serviceCredentials = xsenv.getServices({ products: serviceName }).products;
const uaaBrokerCreds = serviceCredentials;
const VCAP_APPLICATION = JSON.parse(process.env.VCAP_APPLICATION);
const SBF_SERVICE_CONFIG = JSON.parse(process.env.SBF_SERVICE_CONFIG);

const uaaURL = uaaBrokerCreds.url;
const clientId = uaaBrokerCreds.clientid;
const clientSecret = uaaBrokerCreds.clientsecret;
const tokenURL = `${uaaURL}/oauth/token`;

console.log("SBF: " + JSON.stringify(SBF_SERVICE_CONFIG));

const CREATE_SERVICE_MILLIS = 20 * 1000;
let provisionData = {};

const broker = new Broker({
  autoCredentials: true,
  hooks: {
    onProvision: (params, callback) => {
      console.log("onProvision: Starting %s", params['instance_id']);
      provisionData[params['instance_id']] = false;

      console.log(`Requesting access token at ${tokenURL}`);

      let additionalAttributes = {
        // here the application can pass arbitrary data to the service
        'application_id': VCAP_APPLICATION.application_id,
        'application_name': VCAP_APPLICATION.application_name
      };

      request.post(tokenURL, {
        // strictSSL: false,
        // rejectUnauthorized: false,
        // proxy: 'http://mitm.sap-partner-eng.com:8888',
        form: {
          'client_id': clientId,
          'client_secret': clientSecret,
          'grant_type': 'client_credentials',
          'response_type': 'token',
          'authorities': JSON.stringify({ 'az_attr': additionalAttributes })
        }
      }, (err, response, body) => {
        if (err) {
          console.error(err);
          // return res.status(500).send('Problem during requsting access token');
        }
        if (response.statusCode !== 200) {
          console.error(`Request to UAA failed: ${response.statusCode}, ${body}`);
          // return res.status(response.statusCode).send('Error from UAA service');
        }
    
        body = JSON.parse(body);
        console.log(`Got access token ` + body.access_token);

        const serviceURL = SBF_SERVICE_CONFIG['crypto-rates-service'].extend_credentials.per_plan.default.url;
        const accessToken = body.access_token;
        const url = `${serviceURL}/provision/` + params['instance_id'];
      
        console.log(`Requesting ${url}`);
      
        request.get(url, {
          // strictSSL: false,
          // rejectUnauthorized: false,
          // proxy: 'http://mitm.sap-partner-eng.com:8888',
          auth: {
            bearer: accessToken
          }
        }, (err, response, body) => {
          if (err) {
      
            console.error('Error requesting products service:', err);
            // return res.status(500).send(err);
          }
          if (response.statusCode !== 200) {
      
            console.error(`Request to products service failed: ${response.statusCode}, ${body}`);
            // return res.status(response.statusCode).send('Error from backend service');
          }
      
          // res.json(JSON.parse(body));
          console.log(`Requesting: ` + body);

          provisionData[params['instance_id']] = true;

        });

      });

      // // Delay the response with async function to simulate resource creation (like database schemas etc.)
      // setTimeout(() => {
      //   provisionData[params['instance_id']] = true;
      //   console.log("onProvision: Finished %s", params['instance_id']);
      // }, CREATE_SERVICE_MILLIS);

      // Because of { async: true } provision operation will be asynchronous
      callback(null, { async: true });
    },
    onDeprovision: (params, callback) => {
      console.log("onDeprovision: Starting %s", params['instance_id']);
      // Free any resources created during provision of the service instance

      console.log(`Requesting access token at ${tokenURL}`);

      let additionalAttributes = {
        // here the application can pass arbitrary data to the service
        'application_id': VCAP_APPLICATION.application_id,
        'application_name': VCAP_APPLICATION.application_name
      };

      request.post(tokenURL, {
        // strictSSL: false,
        // rejectUnauthorized: false,
        // proxy: 'http://mitm.sap-partner-eng.com:8888',
        form: {
          'client_id': clientId,
          'client_secret': clientSecret,
          'grant_type': 'client_credentials',
          'response_type': 'token',
          'authorities': JSON.stringify({ 'az_attr': additionalAttributes })
        }
      }, (err, response, body) => {
        if (err) {
          console.error(err);
          // return res.status(500).send('Problem during requsting access token');
        }
        if (response.statusCode !== 200) {
          console.error(`Request to UAA failed: ${response.statusCode}, ${body}`);
          // return res.status(response.statusCode).send('Error from UAA service');
        }
    
        body = JSON.parse(body);
        console.log(`Got access token ` + body.access_token);

        const serviceURL = SBF_SERVICE_CONFIG['crypto-rates-service'].extend_credentials.per_plan.default.url;
        const accessToken = body.access_token;
        const url = `${serviceURL}/deprovision/` + params['instance_id'];
      
        console.log(`Requesting ${url}`);
      
        request.get(url, {
          // strictSSL: false,
          // rejectUnauthorized: false,
          // proxy: 'http://mitm.sap-partner-eng.com:8888',
          auth: {
            bearer: accessToken
          }
        }, (err, response, body) => {
          if (err) {
      
            console.error('Error requesting products service:', err);
            // return res.status(500).send(err);
          }
          if (response.statusCode !== 200) {
      
            console.error(`Request to products service failed: ${response.statusCode}, ${body}`);
            // return res.status(response.statusCode).send('Error from backend service');
          }
      
          // res.json(JSON.parse(body));
          console.log(`Requesting: ` + body);

          provisionData[params['instance_id']] = true;

        });

      });

      callback(null, { async: true });

      // callback(null, {});
    },
    onLastOperation: (params, callback) => {
      let state = 'in progress';
      if (provisionData[params['instance_id']]) {
        state = 'succeeded';
      }
      console.log("onLastOperation: %s %s", params['instance_id'], state);
      callback(null, { state });
    }
  }
});
broker.start();
