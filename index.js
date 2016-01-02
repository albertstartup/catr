#!/usr/bin/env node

var Q = require('q'),
  tumblr = require('tumblr.js'),
  fs = require('fs'),
  _ = require('underscore'),
  inquirer = require('inquirer'),
  open = require('open');

var tumblrRegisterAppUrl = "https://www.tumblr.com/oauth/apps"
var tumblrApiConsoleUrl = "https://api.tumblr.com/console/calls/user/info"

var tumblrClient;
var blogHostName;

var configPath = process.env.HOME + '/.catrrc';

function createTodaysHourlyPost(update) {
  var deferred = Q.defer();
  var localeTimeString = (new Date(Date.now())).toLocaleTimeString();
  var body = ('<p>' + localeTimeString + ' - ' + update + '</p>').toLowerCase();
  tumblrClient.text(blogHostName, { title: 'Hourly', body: body }, function (error, response) {
    if (error) deferred.reject(new Error(error));
    else deferred.resolve(response.id);
  });
  return deferred.promise;
}

function appendToTodaysHourlyPost(post, update) {
  var deferred = Q.defer()
  var localeTimeString = (new Date(Date.now())).toLocaleTimeString();
  var newBody = (post.body + '<p>' + localeTimeString + ' - ' + update + '</p>').toLowerCase();
  tumblrClient.edit(blogHostName, { id: post.id, body: newBody }, function(error, response) {
    if (error) deferred.reject(new Error(error));
    else deferred.resolve(response)
  });
  return deferred.promise;
}

function selectTodaysHourlyPostFromPosts(posts) {
  var todayLocaleDateString = (new Date(Date.now())).toLocaleDateString();
  var hourlyPost = _.find(posts, function(post) {
    var postDate = new Date(post.date);
    if (post.title == "Hourly" && postDate.toLocaleDateString() == todayLocaleDateString) {
      return true;
    }
  });
  if (hourlyPost) return hourlyPost;
  else throw new Error("Todays hourly post does not exist.");
}

function getPosts() {
  var deferred = Q.defer()
  tumblrClient.posts(blogHostName, { type: 'text' }, function (error, response) {
    if (error) deferred.reject(new Error(error));
    else deferred.resolve(response.posts);
  });
  return deferred.promise
}

function getTodaysHourlyPost() {
  return getPosts()
  .then(function(posts) {
    return selectTodaysHourlyPostFromPosts(posts);
  })
  .then(function(post) {
    return { id: post.id, body: post.body };
  }, function(error) {
    throw new Error(error);
  });
}

function checkIfConfigFileExists() {
  return Q.nfcall(fs.access, configPath);
}

function checkIfConfigFileIsWrittable() {
  return Q.nfcall(fs.access, configPath, fs.W_OK);
}

function checkIfConfigFileIsReadable(argument) {
  return Q.nfcall(fs.access, configPath, fs.R_OK);
}

function getConfiguration() {
  return Q.nfcall(fs.readFile, configPath).then(function(data) {
    return JSON.parse(data)
  }, function(error) {
    throw new Error(error)
  })
}

// Yolo swag a.k.a im very sorry about this mess, ill fix it up before I even add more features :)
function askForPrompt() {
  var deferred = Q.defer()
  console.log("Yo! Looks like this is your first time using catr. Awesome!");
  console.log("Before you can post, you need to configure catr.");
  console.log("This is simple.");
  console.log("All you need is 5 pieces of information:");
  console.log("  1. consumer_key")
  console.log("  2. consumer_secret")
  console.log("  3. token")
  console.log("  4. token_secret")
  console.log("  5. blog-hostname")
  console.log("To get the firt two, you have to register an application with Tumblr");
  inquirer.prompt([{
    type: "input",
    name: "didOpenRegisterApp",
    message: "Press [Enter] to open the Tumblr Developer website"
  }], function() {
    console.log("To get the last there, use the Tumblr Api Console");
    open(tumblrRegisterAppUrl)
    inquirer.prompt([{
        type: 'input',
        name: 'didOpenApiConsole',
        message: 'Press [Enter] to open the Tumblr Api Console website'
    }], function() {
      console.log('Now enter the info')
      open(tumblrApiConsoleUrl)
      inquirer.prompt([{
          type: 'input',
          name: 'consumerKey',
          message: 'consumer_key: '
      },{
          type: 'input',
          name: 'consumerSecret',
          message: 'consumer_secret: '
      },{
          type: 'input',
          name: 'token',
          message: 'token: '
      },{
          type: 'input',
          name: 'tokenSecret',
          message: 'token_secret: '
      },{
          type: 'input',
          name: 'blogHostName',
          message: 'blog-hostname: '
      }], function(answers) {
        var config = {
          oauth: {
            consumer_key: answers.consumerKey,
            consumer_secret: answers.consumerSecret,
            token: answers.token,
            token_secret: answers.tokenSecret
          },
          "blog-hostname": answers.blogHostName
        }
        loadConfig(config)
        saveConfig(config)
      });
    });
  });
  return deferred.promise
}

function loadConfig(config) {
  tumblrClient = tumblr.createClient(config.oauth);
  blogHostName = config["blog-hostname"]
}

function saveConfig(config) {
  var string = JSON.stringify(config);

  fs.writeFile(configPath, string, function(error) {
    console.log(error)
  })
}


function configure() {

  return askForPrompt()
}

function setup() {
  return getConfiguration()
  .then(function(config) {
    return loadConfig(config)
  }, function(error) {
    return configure()
  })
}

function update(update) {
  return setup().then(function() {
    return getTodaysHourlyPost().then(function(post) {
      return appendToTodaysHourlyPost(post, update)
    }, function(error) {
      return createTodaysHourlyPost(update);
    });
  })
}

update(process.argv[2].toString()).then(function() {
  console.log('Winning!')
}, function(error) {
  console.log('Oops! This happened:\n', error)
}).done();
