const { app, BrowserWindow, net, ipcMain } = require("electron");
var events = require('events');
var fs = require('fs');

var eventEmitter = new events.EventEmitter();

var winDash = "";
var win = "";

var dirConf = "conf/";
var dirHtm = "htm/"

function startApplication () {
  eventEmitter.setMaxListeners(20);
  createConfDir();
  loadCorrectWindowAtStart();

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
      winDash = createWindow("dashboard.htm");
      win.close();
      eventEmitter.removeListener('studentDataDownloaded', studentDownHandler);
    });
  });

  ipcMain.on('getStudentDataAndSendToRenderer', (event) => {
    getLoginDetails();
    eventEmitter.on("gotLoginDetails", function loginDetailsHandler(instituteCode,username,password) {
      getStudentData(instituteCode, username, password);
      eventEmitter.on('studentDataDownloaded', function studentDownHandler(studentData) {
        getTimetableData(instituteCode, username, password, studentData);
        eventEmitter.on("timetableDownloaded", function timetableHandler(studentData, timetableData) {
          if (studentData === 503) {
            winDash.webContents.send("gotError", studentData);
          } else if (studentData === 403) {
            winDash.webContents.send("gotError", studentData);
          } else {
            winDash.webContents.send("gotStudentData",studentData,timetableData);
          }
          eventEmitter.removeListener('studentDataDownloaded', studentDownHandler);
        });
      });
      eventEmitter.removeListener("gotLoginDetails", loginDetailsHandler);
    });
  });

  ipcMain.on('getStudentDataAndSendToRendererFirst', (event) => {
    getLoginDetails();
    eventEmitter.on("gotLoginDetails", function loginDetailsHandler(instituteCode,username,password) {
      getStudentData(instituteCode, username, password);
      eventEmitter.on('studentDataDownloaded', function studentDownHandler(studentData) {
        getTimetableData(instituteCode, username, password, studentData);
        eventEmitter.on("timetableDownloaded", function timetableHandler(studentData, timetableData) {
          if (studentData === 503) {
            winDash.webContents.send("gotError", studentData);
          } else if (studentData === 403) {
            winDash.webContents.send("gotError", studentData);
          } else {
            winDash.webContents.send("gotStudentData",studentData,timetableData);
          }
          eventEmitter.removeListener('studentDataDownloaded', studentDownHandler);
        });
      });
      eventEmitter.removeListener("gotLoginDetails", loginDetailsHandler);
    });
  });
}

function loadCorrectWindowAtStart() {
  fs.stat('./conf/logindetails.json', function(err, stat) {
    if(err == null) {
      winDash = createWindow("dashboard.htm");
    } else if(err.code === 'ENOENT') {
      win = createWindow("login.htm");
    }
  });
}

function createConfDir() {
  if (!fs.existsSync(dirConf))
    fs.mkdirSync(dirConf);
}

function createWindow(htmFile) {
  winL = new BrowserWindow({ width: 1000, height: 600, nodeIntegration: true, frame: false });
  winL.loadFile(dirHtm + htmFile);
  return winL;
}

function getTimetableData(instituteCode, username, password, studentData) {
  getAuthToken(instituteCode, username, password, studentData);
  eventEmitter.on('authTokenDownloaded', function authDownHandler(authToken, studentData) {
    if (authToken === 503) {
      eventEmitter.emit("timetableDownloaded", 503);
      return;
    } else if (authToken === 403) {
      eventEmitter.emit("timetableDownloaded", 403);
      return;
    }

    StartDate = getMonday(new Date());
    EndDate = addDays(StartDate, 6);

    var startYear = StartDate.getFullYear();
    var startMonth = AddZeroToMonth(StartDate.getMonth()+1);
    var startDay = AddZeroToMonth(StartDate.getDate());

    var endYear = EndDate.getFullYear();
    var endMonth = AddZeroToMonth(EndDate.getMonth()+1);
    var endDay = AddZeroToMonth(EndDate.getDate());

    var dateString = "/mapi/api/v1/Lesson?fromDate=" + startYear + "-" + startMonth + "-" + startDay + "&toDate=" + endYear + "-" + endMonth + "-" + endDay;

    if (studentData === undefined)
    studentData = 0;

    makeNetRequest("GET", "https:", instituteCode + ".e-kreta.hu",dateString,{'Authorization': 'Bearer ' + authToken},null,studentData);

    eventEmitter.on("makeNetRequestFinished",function netRequestHandler(response, other_args) {
      eventEmitter.emit("timetableDownloaded", other_args, JSON.parse(response));
      eventEmitter.removeListener("makeNetRequestFinished", netRequestHandler);
    });
    eventEmitter.on("makeNetRequestFinishedWithError",function netRequestHandler(response) {
      eventEmitter.emit("timetableDownloaded", response);
      eventEmitter.removeListener("makeNetRequestFinishedWithError", netRequestHandler);
    });
    eventEmitter.removeListener('authTokenDownloaded', authDownHandler);
  });
}

function AddZeroToMonth(month) {
  if (month < 10)
    return "0" + month.toString();
  else
    return month;
}

function addDays(date, days) {
  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getMonday(d) {
  d = new Date(d);
  var day = d.getDay(),
      diff = d.getDate() - day + (day == 0 ? -6:1); // adjust when day is sunday
  return new Date(d.setDate(diff));
}

function getAuthToken(instituteCode, username, password, studentData) {
  post_data = "institute_code=" + instituteCode + "&userName=" + username + "&password=" + password + "&grant_type=password&client_id=919e0c1c-76a2-4646-a2fb-7085bbbf3c56";
  makeNetRequest("POST", "https:", instituteCode + ".e-kreta.hu", "/idp/api/v1/Token", {'Content-Type': 'application/x-www-form-urlencoded','Content-Length': Buffer.byteLength(post_data)}, post_data);
  
  eventEmitter.on("makeNetRequestFinished", function netRequestHandler(response) {
    eventEmitter.emit("authTokenDownloaded", JSON.parse(response).access_token, studentData);
    eventEmitter.removeListener("makeNetRequestFinished", netRequestHandler);
  });

  eventEmitter.on("makeNetRequestFinishedWithError", function netRequestHandler(response){
    eventEmitter.emit("authTokenDownloaded", response);
    eventEmitter.removeListener("makeNetRequestFinishedWithError", netRequestHandler);
  });
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
    var other_args = new Array();
    other_args[0] = instituteCode;
    other_args[1] = username;
    other_args[2] = password;
    makeNetRequest("GET", "https:", instituteCode + ".e-kreta.hu","/mapi/api/v1/Student",{ "Authorization": "Bearer " + authToken},null,other_args);

    eventEmitter.on("makeNetRequestFinished", function netRequestHandler(response, other_args) {
      eventEmitter.emit("studentDataDownloaded", JSON.parse(response), other_args[0], other_args[1], other_args[2]);
      eventEmitter.removeListener("makeNetRequestFinished", netRequestHandler);
      return;
    });

    eventEmitter.on("makeNetRequestFinishedWithError", function netRequestHandler(response) {
      eventEmitter.emit("studentDataDownloaded", response);
      eventEmitter.removeListener("makeNetRequestFinishedWithError", netRequestHandler);
      return;
    });
    eventEmitter.removeListener('authTokenDownloaded', authDownHandler);
  });
}

function getInstitutes() {
  makeNetRequest("GET","https:","kretaglobalmobileapi.ekreta.hu","/api/v1/Institute", {"apiKey": "7856d350-1fda-45f5-822d-e1a2f3f1acf0"});

  eventEmitter.on("makeNetRequestFinished",function netRequestHandler(response) {
    eventEmitter.emit("institutesDownloaded", response);
    eventEmitter.removeListener("makeNetRequestFinished", netRequestHandler);
  });
  eventEmitter.on("makeNetRequestFinishedWithError",function netRequestHandler(response) {
    eventEmitter.emit("institutesDownloaded", response);
    eventEmitter.removeListener("makeNetRequestFinishedWithError", netRequestHandler);
  });
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

function makeNetRequest(method, protocol, hostname, path, headers, post_data, other_args) {
  const request = net.request({
    method: method,
    protocol: protocol,
    hostname: hostname,
    path: path, 
    headers: headers
  });

  res_string = "";
  request.on("response", (response) => {
    response.on('data', (chunk) => {
      res_string += chunk;
    });
    response.on('end', () => {
      if (response.statusCode === 200) {
        eventEmitter.emit("makeNetRequestFinished", res_string, other_args);
        return;
      } else {
        eventEmitter.emit("makeNetRequestFinishedWithError", response.statusCode, other_args);
        return;
      }
    });
  });
  if (post_data !== undefined && post_data !== null)  
    request.write(post_data);
  request.end();
}

app.on('ready', startApplication);