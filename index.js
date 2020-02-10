var express = require('express')
var app = express()
var mongoose = require('mongoose')
var morgan = require('morgan')
var dotenv = require('dotenv')
dotenv.config()
var db = mongoose.connect(
  process.env.MONGODB_URI || 'mongodb://localhost/test',
  { useNewUrlParser: true, useUnifiedTopology: true }
)
var Url = require('./Model/url')

app.use(morgan('dev'))
app.use(express.static(__dirname + '/View'))

function validateURL(url) {
  // Checks to see if it is an actual url
  // Regex from https://gist.github.com/dperini/729294
  var regex = /^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,}))\.?)(?::\d{2,5})?(?:[/?#]\S*)?$/i
  return regex.test(url)
}

function saveUrl(rand, req, res) {
  var fullUrl = req.protocol + '://' + req.get('host') + '/'

  var url = new Url()
  var orignal = req.url.replace('/new/', '')
  url.short_url = fullUrl + rand.toString()
  url.orignal_url = orignal

  url.save(function(err, savedUrl) {
    if (err) {
      res.status(500).send({
        error: "Couldn't save URL"
      })
    } else {
      res.json({
        orignal_url: savedUrl.orignal_url,
        short_url: savedUrl.short_url
      })
    }
  })
}

function checkAndUpdate(rand, req, res) {
  mongoose.connection.db
    .listCollections({ name: 'urls' })
    .next(function(err, collinfo) {
      if (!collinfo) {
        var url = new Url()
        saveUrl(rand, req, res)
      } else {
        saveUrl(rand, req, res)
      }
    })
}

function checkCodeAndUpdate(rand, req, res, orignal) {
  Url.find(
    {
      code: rand
    },
    function(err, codes) {
      if (err) {
        res.send(err)
      } else {
        if (codes.length > 0) {
          rand = rand * 2 + 1
          checkCodeAndUpdate(rand, req, res)
        } else {
          checkAndUpdate(rand, req, res)
        }
      }
    }
  )
}

app.get('/new/*', function(req, res) {
  var rand = Math.floor(Math.random() * 10000 + 1)
  var orig = req.url.replace('/new/', '')

  if (validateURL(orig)) {
    checkCodeAndUpdate(rand, req, res)
  } else {
    res.status(500).send({ error: 'Invalid URL!' })
  }
})

app.get('/*', function(req, res) {
  var code = req.url.slice(1)
  var shortUrl = req.protocol + '://' + req.get('host') + '/' + code

  Url.findOne({
    short_url: shortUrl
  })
    .exec()
    .then(function(urlItem) {
      if (urlItem) {
        res.redirect(urlItem.orignal_url)
      } else {
        res.send({
          error: 'No short_url is found'
        })
      }
    })
})

app.get('/', function(req, res) {
  res.sendFile(__dirname + 'index.html')
})
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Our app is running on port ${PORT}`)
})
