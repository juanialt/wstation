const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const mongodb = require('mongodb');
const superagent = require('superagent');

const port = parseInt(process.env.PORT, 10) || 8000;

/*----------------------------------------------------------------------
API COMMANDS
========================================================================
"/digital/13"                   -> Read real value of DIGITAL pin number 13 (GET)
"/digital/13/1"                 -> Write real value on DIGITAL pin number 13 to HIGH (POST)
"/analog/2"                     -> Read real value of ANALOG pin number 2 (GET)
/analog/history/wind            -> Read history values of wind
/analog/history/temperature     -> Read history values of temperature
/analog/history/humidity        -> Read history values of humidity
"/function/wind"                -> Read value of WIND FUNCTION (GET)
"/function/temperature"         -> Read value of WIND FUNCTION (GET)
"/function/humidity"            -> Read value of WIND FUNCTION (GET)
"/function"                     -> Write function values => ax^2+bx+c (POST)
                                   BodyStructure:
                                   type: wind || temperature || humidity
                                   a: float
                                   b: float
                                   c: float
----------------------------------------------------------------------*/

// Parse application/json
app.use(bodyParser.json())

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Standard URI format ==> mongodb://<dbuser>:<dbpassword>@ds113566.mlab.com:13566/wstation
const uri = 'mongodb://admin:sistemas1234@ds113566.mlab.com:13566/wstation';

const IP = '192.168.0.88';

// Get value of analog pin
app.route('/analog/:pin')
.get((req, res) => {
    superagent.get(`http://192.168.0.88/a/${req.params.pin}`)
    .end((s_err, s_res) => {
        if (s_err) { return console.log(s_err); }
        res.json(s_res.body.value);
    });
})

// Get value of digital pin
app.route('/digital/:pin')
.get((req, res) => {
    superagent.get(`http://192.168.0.88/d/${req.params.pin}`)
    .end((s_err, s_res) => {
        if (s_err) { return console.log(s_err); }
        res.json(s_res.body.value);
    });
})

// Set value of digital pin
app.route('/digital/:pin/:action')
.post((req, res) => {
    superagent.get(`http://192.168.0.88/d/${req.params.pin}/${req.params.action}`)
    .end((s_err, s_res) => {
        if (s_err) { return console.log(s_err); }
        res.json(s_res.body.value);
    });
});

// Get history of given pin name wind or humidity or temperature
app.route('/analog/history/:pname')
.get((req, res) => {
    mongodb.MongoClient.connect(uri, function(err, db) {
        if(err) throw err;

        const dbSelected = db.collection(req.params.pname);

        dbSelected.find().sort({_id:-1}).limit(10).toArray(function (err, docs) {
            if(err) throw err;

            db.close(function (err) {
                if(err) throw err;
            });
            res.json(docs);
        });
    });
})

// Get function value of given type
app.route('/function/:type')
.get((req, res) => {
    mongodb.MongoClient.connect(uri, function(err, db) {
        if(err) throw err;

        const type = req.params.type;

        if (type === 'temperature' || type === 'wind' || type === 'humidity') {
            const dbSelected = db.collection(`${type}_function`);

            dbSelected.find().sort({_id:-1}).toArray(function (err, docs) {
                if(err) throw err;

                db.close(function (err) {
                    if(err) throw err;
                });

                res.json(docs[0] || null);
            });
        }
    });
})

// Set value of function
app.route('/function')
.post((req, res) => {
    const { type, a, b, c } = req.body;

    if (type && a && b && c) {
        mongodb.MongoClient.connect(uri, function(err, db) {
            if(err) throw err;

            const function_db = db.collection(`${type}_function`);

            function_db.insert({a, b, c}, function(err, result) {
                if(err) throw err;
            });
        });
    }
});

app.listen(port, function () {
  console.log('Arduino Weather Station');
  console.log(`App listening on port ${port}`);
  console.log('-----------------------------');
})

const dbStructure = {
    wind: [{
        time: '1511041213',
        value: '50'
    }, {
        time: '1511041260',
        value: '55'
    }],
    temperature: [{
        time: '1511041213',
        value: '-20'
    }, {
        time: '1511041260',
        value: '-15'
    }],
    humidity: [{
        time: '1511041213',
        value: '-20'
    }, {
        time: '1511041260',
        value: '-15'
    }],
    wind_function: {
      a: 2,
      b: -2,
      c: 0
    },
    temperature_function: {
      a: 1.5,
      b: 0,
      c: 3
    },
    humidity_function: {
      a: 0,
      b: 33,
      c: 0
    }
}
//
// mongodb.MongoClient.connect(uri, function(err, db) {
//     if(err) throw err;
//
//     const wind_db = db.collection('wind');
//     const humidity_db = db.collection('humidity');
//     const temperature_db = db.collection('temperature');
//
//     setInterval(() => {
//         superagent.get('http://192.168.0.88/all')
//         .end((s_err, s_res) => {
//             if (s_err) { return console.log(s_err); }
//
//             const time = new Date();
//             const windData = {
//                 value: s_res.body.value2,
//                 time
//             };
//             const humidityData = {
//                 value: s_res.body.value3,
//                 time
//             };
//             const tempData = {
//                 value: s_res.body.value4,
//                 time
//             };
//
//             wind_db.insert(windData, function(err, result) {
//                 if(err) throw err;
//             });
//
//             temperature_db.insert(tempData, function(err, result) {
//                 if(err) throw err;
//             });
//
//             humidity_db.insert(humidityData, function(err, result) {
//                 if(err) throw err;
//             });
//         });
//     }, 10000);
// });
