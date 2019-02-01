const { app, BrowserWindow, net, ipcMain } = require("electron");
var events = require('events');
var fs = require('fs');

var eventEmitter = new events.EventEmitter();

function createWindow () {
  var dirConf = "conf/";
  if (!fs.existsSync(dirConf)){
    fs.mkdirSync(dirConf);
  }

  fs.stat('./conf/logindetails.json', function(err, stat) {
    if(err == null) {
      winDash = new BrowserWindow({ width: 1000, height: 600, nodeIntegration: true, frame: false });
      winDash.loadFile("dashboard.htm");
    } else if(err.code === 'ENOENT') {
      win = new BrowserWindow({ width: 1000, height: 600, nodeIntegration: true, frame: false });
      win.loadFile("login.htm");
    } else {
        console.log('ERROR: ', err.code);
    }
});

  ipcMain.on('getInstitutesAndSendToRenderer', (event)=> { 
    getInstitutes();
    eventEmitter.on('institutesDownloaded', function instDownHandler(institutes) {
      win.webContents.send("gotInstitutes",institutes);
      eventEmitter.removeListener('institutesDownloaded', instDownHandler);
    });
  });

  ipcMain.on('getStudentDataAndRegisterThenSendToRenderer', (event, instituteCode, username, password) => {
    getStudentData(instituteCode, username, password);
    eventEmitter.on('studentDataDownloaded', function studentDownHandler(studentData, instituteCode, username, password) {
      saveLoginDetails(instituteCode, username, password);
      winDash = new BrowserWindow({ width: 1000, height: 600, nodeIntegration: true, frame: false });
      winDash.loadFile("dashboard.htm");
      win.close();
      eventEmitter.removeListener('studentDataDownloaded', studentDownHandler);
    });
  });

  ipcMain.on('getStudentDataAndSendToRenderer', (event) => {
    getLoginDetails();
    eventEmitter.on("gotLoginDetails", function loginDetailsHandler(instituteCode,username,password) {
      getStudentData(instituteCode, username, password);
      eventEmitter.on('studentDataDownloaded', function studentDownHandler(studentData) {
        if (studentData === 503) {
          winDash.webContents.send("gotError503", studentData);
        } else if (studentData === 403) {
          winDash.webContents.send("gotError403", studentData);
        } else {
          winDash.webContents.send("gotStudentData",studentData);
        }
        eventEmitter.removeListener('studentDataDownloaded', studentDownHandler);
      });
      eventEmitter.removeListener("gotLoginDetails", loginDetailsHandler);
    });
  });
}

function getAuthToken(instituteCode, username, password) {
  post_data = "institute_code=" + instituteCode + "&userName=" + username + "&password=" + password + "&grant_type=password&client_id=919e0c1c-76a2-4646-a2fb-7085bbbf3c56";
  const request = net.request({
    method: "POST",
    protocol: "https:",
    hostname: instituteCode + ".e-kreta.hu",
    path: "/idp/api/v1/Token", 
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(post_data)
  }
  });

  res_string = "";
  request.on("response", (response) => {
    response.on('data', (chunk) => {
      res_string += chunk;
    });
    response.on('end', () => {
      if (response.statusCode === 200) {
        eventEmitter.emit("authTokenDownloaded", JSON.parse(res_string).access_token);
      } else {
        eventEmitter.emit("authTokenDownloaded", response.statusCode);
        return;
      }
    });
  });
  request.write(post_data);
  request.end();
}

function getStudentData(instituteCode, username, password) {
  getAuthToken(instituteCode, username, password);
  eventEmitter.on('authTokenDownloaded', function authDownHandler(authToken) {
    if (authToken === 503) {
      eventEmitter.emit("studentDataDownloaded", 503);
      return;
    } else if (authToken === 403) {
      eventEmitter.emit("studentDataDownloaded", 403);
      return;
    }

    const request = net.request({
      method: "GET",
      protocol: "https:",
      hostname: instituteCode + ".e-kreta.hu",
      path: "/mapi/api/v1/Student", 
      headers: {
        'Authorization': 'Bearer ' + authToken
      }
    });

    res_string = "";
    request.on("response", (response) => {
      response.on('data', (chunk) => {
        res_string += chunk;
      });
      response.on('end', () => {
        if (response.statusCode === 200) 
          eventEmitter.emit("studentDataDownloaded", JSON.parse(res_string), instituteCode, username, password);
        else
          eventEmitter.emit("studentDataDownloaded", response.statusCode);
      });
    });
    request.end();
    eventEmitter.removeListener('authTokenDownloaded', authDownHandler);
  });
}

function getInstitutes() {
  const request = net.request({
    method: "GET",
    protocol: "https:",
    hostname: "kretaglobalmobileapi.ekreta.hu",
    path: "/api/v1/Institute"
  });
  request.setHeader("apiKey","7856d350-1fda-45f5-822d-e1a2f3f1acf0");

  institutes = "";

  request.on("response", (response) => {
    response.on('data', (chunk) => {
      institutes += chunk;
    });
    response.on('end', () => {
      eventEmitter.emit("institutesDownloaded", institutes);
    });
  });
  request.end();
}

function saveLoginDetails(instituteCode, username, password) {
  var loginDetails = {
    "instituteCode" : instituteCode,
    "username" : username,
    "password" : password
  }
  fs.writeFile('./conf/logindetails.json', JSON.stringify(loginDetails), function (err) {
    if (err) throw err;
  });
}

function getLoginDetails() {
  fs.readFile("./conf/logindetails.json", "utf8", (err, data) => {
    if (err) throw err;
    eventEmitter.emit("gotLoginDetails",JSON.parse(data).instituteCode,JSON.parse(data).username,JSON.parse(data).password);
   });
}

app.on('ready', createWindow);