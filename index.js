const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const mongodb = require('mongodb');
const superagent = require('superagent');
const nodemailer = require('nodemailer');

const port = parseInt(process.env.PORT, 10) || 8000;
const valueInterval = 10000;

const emailConfig = require('./emailconfig.js');
/*
{
    host: 'smtp.mail.yahoo.com',
    port: 465,
    secure: true,
    auth: {
        user: 'example@yahoo.com',
        pass: 'password'
    }
}
*/

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
"/email"                        -> Read saved email value (GET)
"/email/name@example.com"       -> Write new email value (POST)
"/light"                        -> Read light value (GET)
"/light"                        -> Write light value (POST)
                                    BodyStructure:
                                    start: {
                                        hour: integer,
                                        minutes: integer,
                                        seconds: integer
                                    }
                                    end: {
                                        hour: integer,
                                        minutes: integer,
                                        seconds: integer
                                    }
"/threshold/wind"               -> Read threshold value of wind (GET)
"/threshold"                    -> Write threshold value of sensor (POST)
                                    BodyStructure:
                                    type: wind || temperature || humidity
                                    start: float
                                    end: float
                                    active: 1 || 0
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
let downEmailSent = false;

// create reusable transporter object using the default SMTP transport
let transporter = nodemailer.createTransport(emailConfig);

function sendArduinoDownEmail () {
    // setup email data with unicode symbols
    let mailOptions = {
        from: emailConfig.from,
        to: emailConfig.to,
        subject: 'Weather Station - ERROR',
        text: 'ERROR! El sistema no se encuentra activo',
        html: '<h1>Arduino Weather Station</h1>' +
              '<h3>El sistema se encuentra caido</h3>' +
              '<p>No se puede tener acceso al sistema Arduino del clima</p>'
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error);
        }
        downEmailSent = true;
        console.log('Message sent: %s', info.messageId);
    });
}


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

// Get value of email for alerts
app.route('/email')
.get((req, res) => {
    mongodb.MongoClient.connect(uri, function(err, db) {
        if(err) throw err;

        const dbEmail = db.collection('email');

        dbEmail.find().toArray(function (err, docs) {
            if(err) throw err;

            db.close(function (err) {
                if(err) throw err;
            });

            res.json(docs[0] || null);
        });
    });
});

// Set value of email for alerts
app.route('/email/:email')
.post((req, res) => {
    mongodb.MongoClient.connect(uri, function(err, db) {
        if(err) throw err;

        const email = req.params.email;
        const dbEmail = db.collection('email');

        dbEmail.remove();
        dbEmail.insert({email}, function(err, result) {
            if(err) throw err;

            res.json(result);
        });
    });
});

// Get value of light threshold
app.route('/light')
.get((req, res) => {
    mongodb.MongoClient.connect(uri, function(err, db) {
        if(err) throw err;

        const dbAlarm = db.collection('light');

        dbAlarm.find().toArray(function (err, docs) {
            if(err) throw err;

            db.close(function (err) {
                if(err) throw err;
            });

            res.json(docs[0] || null);
        });
    });
});

// Set value of light threshold
app.route('/light')
.post((req, res) => {
    mongodb.MongoClient.connect(uri, function(err, db) {
        if(err) throw err;

        const { start, end } = req.body;
        const dbAlarm = db.collection('light');

        dbAlarm.remove();
        dbAlarm.insert({ start, end }, function(err, result) {
            if(err) throw err;

            res.json(result);
        });
    });
});

// Get value of threshold sensor value
app.route('/threshold/:type')
.get((req, res) => {
    mongodb.MongoClient.connect(uri, function(err, db) {
        if(err) throw err;

        const type = req.params.type;

        if (type === 'temperature' || type === 'wind' || type === 'humidity') {
            const dbSelected = db.collection(`${type}_threshold`);

            dbSelected.find().sort({_id:-1}).toArray(function (err, docs) {
                if(err) throw err;

                db.close(function (err) {
                    if(err) throw err;
                });

                res.json(docs[0] || null);
            });
        }
    });
});

// Set value of threshold sensor value
app.route('/threshold')
.post((req, res) => {
    mongodb.MongoClient.connect(uri, function(err, db) {
        if(err) throw err;

        const { type, start, end, active } = req.body;

        if (type === 'temperature' || type === 'wind' || type === 'humidity') {
            const dbSelected = db.collection(`${type}_threshold`);

            dbSelected.remove();
            dbSelected.insert({ start, end, active }, function(err, result) {
                if(err) throw err;

                res.json(result);
            });
        }
    });
});

app.listen(port, function () {
  console.log('Arduino Weather Station');
  console.log(`App listening on port ${port}`);
  console.log('-----------------------------');
})

mongodb.MongoClient.connect(uri, function(err, db) {
    if(err) throw err;

    const wind_db = db.collection('wind');
    const humidity_db = db.collection('humidity');
    const temperature_db = db.collection('temperature');

    setInterval(() => {
        superagent.get('http://192.168.0.88/all')
        .end((s_err, s_res) => {
            if (s_err) {
              if (downEmailSent === false) {
                sendArduinoDownEmail();
              }
              return console.log('ERROR: Arduino disconnected.', s_err);
            }

            downEmailSent = false;

            const time = new Date();
            const windData = {
                value: s_res.body.value2,
                time
            };
            const humidityData = {
                value: s_res.body.value3,
                time
            };
            const tempData = {
                value: s_res.body.value4,
                time
            };

            wind_db.insert(windData, function(err, result) {
                if(err) throw err;
            });

            temperature_db.insert(tempData, function(err, result) {
                if(err) throw err;
            });

            humidity_db.insert(humidityData, function(err, result) {
                if(err) throw err;
            });
        });
    }, valueInterval);
});
