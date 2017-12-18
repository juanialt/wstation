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
let lightHours = null;
let lightIsOn = false;

let temperatureThreshold = null;
let windThreshold = null;
let humidityThreshold = null;

let temperatureFunction = null;
let windFunction = null;
let humidityFunction = null;

let humidityEmailCount = 0;
let tempEmailCount = 0;
let windEmailCount = 0;

let alertEmail = null;

// create reusable transporter object using the default SMTP transport
let transporter = nodemailer.createTransport(emailConfig);

function sendArduinoDownEmail () {
    // setup email data with unicode symbols
    let mailOptions = {
        from: emailConfig.from,
        to: alertEmail || emailConfig.from,
        subject: 'Weather Station - ERROR',
        text: 'ERROR! El sistema no se encuentra activo',
        html: '<h1>Arduino Weather Station</h1>' +
              '<h3>El sistema se encuentra caido</h3>' +
              '<p>No se puede tener acceso al sistema Arduino del clima</p>'
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error, '--------------------------------');
        }
        downEmailSent = true;
        console.log('Message sent: %s', info.messageId);
        console.log('--------------------------------');
    });
}

function sendThresholdAlertEmail (sensorName, start, end, current) {
    // setup email data with unicode symbols
    let mailOptions = {
        from: emailConfig.from,
        to: alertEmail || emailConfig.from,
        subject: 'Weather Station - ERROR',
        text: 'ERROR! Sensor fuera de rango',
        html: '<h1>Arduino Weather Station</h1>' +
              `<h3>El sensor de ${sensorName} se encuentra fuera de rango</h3>` +
              `<p>El sensor de ${sensorName} esta fuera del rango establecido</p>` +
              `<p>Valor actual ${current}` +
              `<p>Rango de alerta entre ${start} y ${end}</p>`
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error, '--------------------------------');
        }
        downEmailSent = true;
        console.log('Message sent: %s', info.messageId);
        console.log('--------------------------------');
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

// Get transformed value of analog type wind, temperature or humidity
app.route('/analog/parsed/:type')
.get((req, res) => {
    const type = req.params.type;

    if (type === 'temperature' && temperatureFunction) {
        superagent.get('http://192.168.0.88/a/4')
        .end((s_err, s_res) => {
            if (s_err) { return console.log(s_err); }

            const a = parseFloat(temperatureFunction.a.replace(',', '.'));
            const b = parseFloat(temperatureFunction.b.replace(',', '.'));
            const c = parseFloat(temperatureFunction.c.replace(',', '.'));
            const value = parseInt(s_res.body.value);
            const parsed = a * Math.pow(value, 2) + b * value + c;
            const min = a * 0 + b * 0 + c;
            const max = a * 1023 + b * 1023 + c;

            res.json({
                value: parsed,
                min,
                max
            });
        });
    }

    if (type === 'wind' && windFunction) {
        superagent.get('http://192.168.0.88/a/2')
        .end((s_err, s_res) => {
            if (s_err) { return console.log(s_err); }

            const a = parseFloat(windFunction.a.replace(',', '.'));
            const b = parseFloat(windFunction.b.replace(',', '.'));
            const c = parseFloat(windFunction.c.replace(',', '.'));
            const value = parseInt(s_res.body.value);
            const parsed = a * Math.pow(value, 2) + b * value + c;
            const min = a * 0 + b * 0 + c;
            const max = a * 1023 + b * 1023 + c;

            res.json({
                value: parsed,
                min,
                max
            });
        });
    }

    if (type === 'humidity' && humidityFunction) {
        superagent.get('http://192.168.0.88/a/3')
        .end((s_err, s_res) => {
            if (s_err) { return console.log(s_err); }

            const a = parseFloat(humidityFunction.a.replace(',', '.'));
            const b = parseFloat(humidityFunction.b.replace(',', '.'));
            const c = parseFloat(humidityFunction.c.replace(',', '.'));
            const value = parseInt(s_res.body.value);
            const parsed = a * Math.pow(value, 2) + b * value + c;
            const min = a * 0 + b * 0 + c;
            const max = a * 1023 + b * 1023 + c;

            res.json({
                value: parsed,
                min,
                max
            });
        });
    }

    return 0;
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

function turnLightOn() {
    superagent.get('http://192.168.0.88/d/6/1')
    .end((s_err, s_res) => {
        if (s_err) { return console.log(s_err); }
        console.log('Ligth is turned ON');
    });
}

function turnLightOff() {
    superagent.get('http://192.168.0.88/d/6/0')
    .end((s_err, s_res) => {
        if (s_err) { return console.log(s_err); }
        console.log('Ligth is turned OFF');
    });
}

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

function getFunctionSensor(type) {
    mongodb.MongoClient.connect(uri, function(err, db) {
        if(err) throw err;

        if (type === 'temperature' || type === 'wind' || type === 'humidity') {
            const dbSelected = db.collection(`${type}_function`);

            dbSelected.find().sort({_id:-1}).toArray(function (err, docs) {
                if(err) throw err;

                db.close(function (err) {
                    if(err) throw err;
                });

                if (type === 'temperature') {
                    temperatureFunction = docs[0];
                } else if (type === 'wind') {
                    windFunction = docs[0];
                } else {
                    humidityFunction = docs[0];
                }
            });
        }
    });
}

// Set value of function
app.route('/function')
.post((req, res) => {
    const { type, a, b, c } = req.body;

    if (type && a && b && c) {
        mongodb.MongoClient.connect(uri, function(err, db) {
            if(err) throw err;

            const function_db = db.collection(`${type}_function`);

            function_db.remove();
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
app.route('/email')
.post((req, res) => {
    mongodb.MongoClient.connect(uri, function(err, db) {
        if(err) throw err;

        const { email } = req.body;
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

function getLightHours() {
    mongodb.MongoClient.connect(uri, function(err, db) {
        if(err) throw err;

        const dbAlarm = db.collection('light');

        dbAlarm.find().toArray(function (err, docs) {
            if(err) throw err;

            db.close(function (err) {
                if(err) throw err;
            });

            lightHours = docs[0];
        });
    });
}

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

function getThresholdSensor(type) {
    mongodb.MongoClient.connect(uri, function(err, db) {
        if(err) throw err;

        if (type === 'temperature' || type === 'wind' || type === 'humidity') {
            const dbSelected = db.collection(`${type}_threshold`);

            dbSelected.find().sort({_id:-1}).toArray(function (err, docs) {
                if(err) throw err;

                db.close(function (err) {
                    if(err) throw err;
                });

                if (type === 'temperature') {
                    temperatureThreshold = docs[0];
                } else if (type === 'wind') {
                    windThreshold = docs[0];
                } else {
                    humidityThreshold = docs[0];
                }
            });
        }
    });
}

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

function getEmail() {
    mongodb.MongoClient.connect(uri, function(err, db) {
        if(err) throw err;

        const dbAlarm = db.collection('email');

        dbAlarm.find().toArray(function (err, docs) {
            if(err) throw err;

            db.close(function (err) {
                if(err) throw err;
            });

            alertEmail = docs[0].email;
        });
    });
}

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

    // Get DB light hours
    setInterval(() => {
        getLightHours();
    }, 5000);
    // Get DB Sensor threshold and functions
    setInterval(() => {
        getThresholdSensor('wind');
        getThresholdSensor('humidity');
        getThresholdSensor('temperature');

        getFunctionSensor('wind');
        getFunctionSensor('humidity');
        getFunctionSensor('temperature');
    }, 5000);
    // Get DB Sensor threshold and functions
    setInterval(() => {
        getEmail();
    }, 5000);

    // Check if we need to turn the light on
    setInterval(() => {
        const currentTime = new Date();
        const hours = currentTime.getHours();
        const minutes = currentTime.getMinutes();

        if (lightHours &&
            lightHours.start.hours <= hours &&
            lightHours.start.minutes <= minutes &&
            lightHours.end.hours >= hours &&
            lightHours.end.minutes >= minutes) {
            if (!lightIsOn) {
                turnLightOn();
                lightIsOn = true;
            }
        } else if (lightIsOn){
            turnLightOff();
            lightIsOn = false;
        }
    }, 1000);

    setInterval(() => {
        superagent.get('http://192.168.0.88/all')
        .end((s_err, s_res) => {
            if (s_err) {
              if (downEmailSent === false) {
                sendArduinoDownEmail();
              }
              return console.log('ERROR: Arduino disconnected.', s_err, '--------------------------------');
            }

            downEmailSent = false;

            const time = new Date();
            const windData = {
                value: s_res.body.value2,
                time
            };
            const humidityData = {
                value: s_res.body.value,
                time
            };
            const tempData = {
                value: s_res.body.value4,
                time
            };

            if (windThreshold && windFunction) {
                const start = windThreshold.start;
                const end = windThreshold.end;

                const a = parseFloat(windFunction.a.replace(',', '.'));
                const b = parseFloat(windFunction.b.replace(',', '.'));
                const c = parseFloat(windFunction.c.replace(',', '.'));
                const windValue = parseInt(windData.value);
                const windParsed = a * Math.pow(windValue, 2) + b * windValue + c;

                if (windParsed >= start && windParsed <= end) {
                    console.log('WIND ALARM - The wind sensor is on ALERT range');
                    console.log(`Current Value: ${windParsed}`);
                    console.log(`Alarm Range: (START: ${start} // END: ${end})`);
                    console.log('--------------------------------');
                    if (windEmailCount <= 5) {
                        sendThresholdAlertEmail ('Viento', start, end, windParsed);
                        windEmailCount += 1;
                    }
                } else {
                    windEmailCount = 0;
                }
            }

            if (humidityThreshold && humidityFunction) {
                const start = humidityThreshold.start;
                const end = humidityThreshold.end;

                const a = parseFloat(humidityFunction.a.replace(',', '.'));
                const b = parseFloat(humidityFunction.b.replace(',', '.'));
                const c = parseFloat(humidityFunction.c.replace(',', '.'));
                const humidityValue = parseInt(humidityData.value);
                const humidityParsed = a * Math.pow(humidityValue, 2) + b * humidityValue + c;

                if (humidityParsed >= start && humidityParsed <= end) {
                    console.log('HUMIDITY ALARM - The humidity sensor is on ALERT range');
                    console.log(`Current Value: ${humidityParsed}`);
                    console.log(`Alarm Range: (START: ${start} // END: ${end})`);
                    console.log('--------------------------------');
                    if (humidityEmailCount <= 5) {
                        sendThresholdAlertEmail ('Humedad', start, end, humidityParsed);
                        humidityEmailCount += 1;
                    }
                } else {
                    humidityEmailCount = 0;
                }
            }

            if (temperatureThreshold && temperatureFunction) {
                const start = temperatureThreshold.start;
                const end = temperatureThreshold.end;

                const a = parseFloat(String(temperatureFunction.a).replace(',', '.'));
                const b = parseFloat(String(temperatureFunction.b).replace(',', '.'));
                const c = parseFloat(String(temperatureFunction.c).replace(',', '.'));
                const tempValue = parseInt(tempData.value);
                const tempParsed = a * Math.pow(tempValue, 2) + b * tempValue + c;

                if (tempParsed >= start && tempParsed <= end) {
                    console.log('TEMPERATURE ALARM - The temperature sensor is on ALERT range');
                    console.log(`Current Value: ${tempParsed}`);
                    console.log(`Alarm Range: (START: ${start} // END: ${end})`);
                    console.log('--------------------------------');
                    if (tempEmailCount <= 5) {
                        sendThresholdAlertEmail ('Temperatura', start, end, tempParsed);
                        tempEmailCount += 1;
                    }
                } else {
                    tempEmailCount = 0;
                }
            }

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
