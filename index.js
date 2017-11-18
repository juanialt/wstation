const express = require('express')
const app = express()
const cors = require('cors')
const mongodb = require('mongodb');
const superagent = require('superagent');

/*
    API COMMANDS
	"/digital/13"     -> Read value of DIGITAL pin number 13
	"/digital/13/1"   -> Write value on DIGITAL pin number 13 to HIGH
	"/analog/2"      -> Read value of ANALOG pin number 2
*/

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Standard URI format ==> mongodb://<dbuser>:<dbpassword>@ds113566.mlab.com:13566/wstation
const uri = 'mongodb://admin:sistemas1234@ds113566.mlab.com:13566/wstation';

const IP = '192.168.0.88';

let pin2 = 0;
let pin3 = 0;
let pin4 = 0;
function query() {
    let aux2 = 0;
    let aux3 = 0;
    let aux4 = 0;

    superagent.get('http://192.168.0.88/a/2')
    .end((err, res) => {
        if (err) { return console.log(err); }
        aux2 = res.body.value;

        superagent.get('http://192.168.0.88/a/3')
        .end((err, res) => {
            if (err) { return console.log(err); }
            aux3 = res.body.value;

            superagent.get('http://192.168.0.88/a/4')
            .end((err, res) => {
                if (err) { return console.log(err); }
                aux4 = res.body.value;

                pin2 = aux2;
                pin3 = aux3;
                pin4 = aux4;

                process.stdout.write(('000' + pin2).slice(-4) + '      ' + ('000' + pin3).slice(-4) + '      ' + ('000' + pin4).slice(-4) + '\r');

                query();
            });
        });
    });
}

//query();

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

app.listen(8000, function () {
  console.log('App listening on port 8000!');
  console.log('Arduino Weather Station');
  console.log('---------------------------------');
  console.log('WIND      HUMI      TEMP');
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
