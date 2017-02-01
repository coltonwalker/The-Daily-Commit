var fs = require('fs');
var jwt = require('jsonwebtoken');
var http = require('http');
var Mongo = require('mongodb').MongoClient;
var express = require('express');
var bodyParser = require('body-parser');
var mongo_url = 'mongodb://localhost:27017/apcsp';
//static MongoDB operations
Mongo.connect(mongo_url, function (err, db) {
    if (err) {
        console.log('MongoDB connection error');
    }
    else {
        console.log('Connectedd to MongoDB');
    }
});

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(allowCrossDomain);
app.use(authorize);

app.post('/login', function(req, res) {
    log('/login req.body = ', req.body);
    var query = {
        id: req.body.id
    };
    Mongo.ops.upsert('login', query, req.body);
    res.status(201).send('ok');
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended : false }));

app.get('/', function(req, res) {
    res.send('hello');
});

app.listen(3000);
console.log('listening to 3000');

function allowCrossDomain(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');

    // end pre flights
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
    } else {
        next();
    }
}

function authorize(req, res, next) {

    // jwt.decode: https://github.com/auth0/node-jsonwebtoken#jwtdecodetoken--options
    // jwt.verify: https://github.com/auth0/node-jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback

    try {
        var token       = req.headers.authorization;
        var decoded     = jwt.decode(token, { complete: true });
        var keyID       = decoded.header.kid;
        var algorithm   = decoded.header.alg;
        var iss         = decoded.payload.iss;
        var pem         = getPem(keyID);

        if (iss === 'accounts.google.com' || iss === 'https://accounts.google.com') {
            var options = {
                audience: CLIENT_ID,
                issuer: iss,
                algorithms: [algorithm]
            }

            jwt.verify(token, pem, options, function(err) {
                if (err) {
                    res.writeHead(401);
                    res.end();
                } else {
                    next();
                }
            });            

        } else {
            res.writeHead(401);
            res.end();
        }
    } catch (err) {
        res.writeHead(401);
        res.end();
    }
}

function getPem(keyID) {
    var jsonWebKeys = keyCache.keys.filter(function(key) {
        return key.kid === keyID;
    });
    return jwkToPem(jsonWebKeys[0]);
}

function cacheWellKnownKeys() {

    // get the well known config from google
    request('https://accounts.google.com/.well-known/openid-configuration', function(err, res, body) {
        var config = JSON.parse(body);
        var address = config.jwks_uri; // ex: https://www.googleapis.com/oauth2/v3/certs

        // get the public json web keys
        request(address, function(err, res, body) {

            keyCache.keys = JSON.parse(body).keys;

            // example cache-control header: 
            // public, max-age=24497, must-revalidate, no-transform
            var cacheControl = res.headers['cache-control'];
            var values = cacheControl.split(',');
            var maxAge = parseInt(values[1].split('=')[1]);

            // update the key cache when the max age expires
            setTimeout(cacheWellKnownKeys, maxAge * 1000);

            log('Cached keys = ', keyCache.keys);
        });
    });
}

function log(msg, obj) {
    console.log('\n');
    if (obj) {
        try {
            console.log(msg + JSON.stringify(obj));
        } catch (err) {
            var simpleObject = {};
            for (var prop in obj) {
                if (!obj.hasOwnProperty(prop)) {
                    continue;
                }
                if (typeof(obj[prop]) == 'object') {
                    continue;
                }
                if (typeof(obj[prop]) == 'function') {
                    continue;
                }
                simpleObject[prop] = obj[prop];
            }
            console.log('circular-' + msg + JSON.stringify(simpleObject)); // returns cleaned up JSON
        }
    } else {
        console.log(msg);
    }
}