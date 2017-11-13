var express = require('express')
var app = express()

const superagent = require('superagent');

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

query();

app.get('/', function (req, response) {
    response.send('Arduino Weather Station');
})

app.listen(8000, function () {
  console.log('App listening on port 8000!');
  console.log('Arduino Weather Station');
  console.log('---------------------------------');
  console.log('WIND      HUMI      TEMP');
})
