const { app, BrowserWindow, net, ipcMain, shell } = require("electron");
var events = require('events');
var fs = require('fs');

var eventEmitter = new events.EventEmitter();

var winDash = "";
var win = "";

var dirConf = "./conf/";
var dirHtm = "./htm/"

var studentData = "";
var timetableData = "";

function startApplication () {
  eventEmitter.setMaxListeners(Infinity);
  createConfDir();
  loadCorrectWindowAtStart();

  ipcMain.on("saveSettings", (event,settingsJson) => {
    saveSettings(settingsJson);
    winDash.reload();
  });

  ipcMain.on("openExternalLink", (event, link) => {
    shell.openExternal(link);
  });

  ipcMain.on("getInstitutes", (event) => {
    getInstitutes();
    eventEmitter.once('getInstitutesSuccess', (institutes) => {
      win.webContents.send("getInstitutesSuccess",institutes);
    });
  });

  ipcMain.on("registerStudent", (event, instituteCode, username, password) => {
    saveSettings();
    getAuthToken(instituteCode, username, password);
    globalInstituteCode = instituteCode;
    eventEmitter.once("getAuthTokenSuccess", ( authToken, instituteCode, refreshToken) => {
      saveLoginDetails(instituteCode, authToken, refreshToken);
      eventEmitter.once("saveLoginDetailsSuccess", () => {
        winDash = createWindow("dashboard.htm");
        winDash.on("closed", () => {
          winL = null;
          app.quit();
        });
        win.close();
      });
    });

    eventEmitter.once("getAuthTokenError", () => {
      win.reload();
    });
  });

  ipcMain.on('getStudentData', (event) => {
    getAuthToken();
    eventEmitter.on("getAuthTokenSuccess", function getAuthTokenSuccess(authToken, instituteCode) {
      getStudentData(instituteCode, authToken);
      eventEmitter.on("getStudentDataSuccess", function getStudentDataSuccess(studentDataM) {
        studentData = studentDataM;
        getTimetableData(studentData.InstituteCode, studentData.authToken);
        eventEmitter.on("getTimetableDataSuccess", function getTimetableDataSuccess(timetableDataM) {
          timetableData = timetableDataM;
          winDash.webContents.send("getStudentDataSuccess",studentData,timetableData);
        });
      });
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

function getTimetableData(instituteCode, authToken) {
  var weekDetails = getWeekDetails(getMonday(new Date()));

  var dateString = "/mapi/api/v1/Lesson?fromDate=" + weekDetails.startYear + "-" + weekDetails.startMonth + "-" + weekDetails.startDay + "&toDate=" + weekDetails.endYear + "-" + weekDetails.endMonth + "-" + weekDetails.endDay;

  makeNetRequest("GET", "https:", instituteCode + ".e-kreta.hu", dateString,{ "Authorization": "Bearer " + authToken});

  eventEmitter.once("makeNetRequestSuccess", function makeNetRequestSuccess(timetableData) {
    eventEmitter.emit("getTimetableDataSuccess", JSON.parse(timetableData));
  });

  eventEmitter.once("makeNetRequestError", function makeNetRequestSuccess(errorCode) { 
  });
}

function getWeekDetails(startDate) {
  endDate = addDays(startDate, 6)

  weekDetails = {
    startYear: startDate.getFullYear(),
    startMonth: AddZeroToMonth(startDate.getMonth()+1),
    startDay: AddZeroToMonth(startDate.getDate()),

    endYear: endDate.getFullYear(),
    endMonth: AddZeroToMonth(endDate.getMonth()+1),
    endDay: AddZeroToMonth(endDate.getDate())
  }

  return weekDetails;
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

function getAuthToken(instituteCode, username, password) {
  if (instituteCode === undefined || instituteCode === null) {
    getLoginDetails();
    eventEmitter.once("getLoginDetailsSuccess", (authToken, instituteCode, refreshToken) => {
      eventEmitter.emit("getAuthTokenSuccess", authToken, instituteCode, refreshToken);
    });
  } else {
    postData = "institute_code=" + instituteCode + "&userName=" + username + "&password=" + password + "&grant_type=password&client_id=919e0c1c-76a2-4646-a2fb-7085bbbf3c56";
    makeNetRequest("POST", "https:", instituteCode + ".e-kreta.hu", "/idp/api/v1/Token", {'Content-Type': 'application/x-www-form-urlencoded','Content-Length': Buffer.byteLength(postData)}, postData, instituteCode);
    eventEmitter.once("makeNetRequestSuccess", (response, instituteCode) => {
      response = JSON.parse(response);
      eventEmitter.emit("getAuthTokenSuccess", response.access_token, instituteCode, response.refresh_token);
    });

    eventEmitter.once("makeNetRequestError", () => {
      eventEmitter.emit("getAuthTokenError");
    });
  }
}

function getStudentData(instituteCode, authToken) {
  makeNetRequest("GET", "https:", instituteCode + ".e-kreta.hu","/mapi/api/v1/Student",{ "Authorization": "Bearer " + authToken}, null, authToken);

  eventEmitter.once("makeNetRequestSuccess", function makeNetRequestSuccess(studentData, authToken) {
    studentData = JSON.parse(studentData);
    studentData.authToken = authToken;
    eventEmitter.emit("getStudentDataSuccess", studentData);
  });

  eventEmitter.once("makeNetRequestError", function makeNetRequestSuccess(response) { 
  });
}

function getInstitutes() {
  makeNetRequest("GET","https:","kretaglobalmobileapi.ekreta.hu","/api/v1/Institute", {"apiKey": "7856d350-1fda-45f5-822d-e1a2f3f1acf0"});

  eventEmitter.on("makeNetRequestSuccess",function netRequestHandler(response) {
    eventEmitter.emit("getInstitutesSuccess", response);
    eventEmitter.removeListener("makeNetRequestFinished", netRequestHandler);
  });
  eventEmitter.on("makeNetRequestError",function netRequestHandler(response) {
    eventEmitter.emit("getInstitutesError", response);
    eventEmitter.removeListener("makeNetRequestFinishedWithError", netRequestHandler);
  });
}

function saveLoginDetails(instituteCode, authToken, refreshToken) {
  var loginDetails = {
    "instituteCode": instituteCode,
    "authToken": authToken,
    "refreshToken": refreshToken 
  }
  fs.writeFile('./conf/logindetails.json', JSON.stringify(loginDetails), function (err) {
    if (err) throw err;
    eventEmitter.emit("saveLoginDetailsSuccess");
  });
}

function getLoginDetails() {
  fs.readFile("./conf/logindetails.json", "utf8", (err, data) => {
    if (err) throw err;
    eventEmitter.emit("getLoginDetailsSuccess",JSON.parse(data).authToken,JSON.parse(data).instituteCode,JSON.parse(data).refreshToken);
   });
}

function makeNetRequest(method, protocol, hostname, path, headers, post_data, otherArgs) {
    const request = net.request({
      method: method,
      protocol: protocol,
      hostname: hostname,
      path: path, 
      headers: headers
    });

    res_string = {
      otherArgs: otherArgs,
      message: ""
    };
    request.on("response", (response) => {
      response.on('data', (chunk) => {
        res_string.message += chunk;
      });
      response.on('end', () => {
        if (response.statusCode === 200) {
          eventEmitter.emit("makeNetRequestSuccess", res_string.message, res_string.otherArgs);
          return;
        } else {
          eventEmitter.emit("makeNetRequestError", response, res_string.otherArgs);
          return;
        }
      });
    });
    if (post_data !== undefined && post_data !== null)  
      request.write(post_data);
    request.end();
}

function saveSettings(settingsJson) {
  if (settingsJson === null || settingsJson === undefined || settingsJson === "")
    settingsJson = {"locale" : "en", "encrypt" : "false"};

  fs.writeFile(dirConf + '/settings.json', JSON.stringify(settingsJson), function (err) {
    if (err) throw err;
  });
  eventEmitter.emit("savedSettings");
}

function getSettings() {
  fs.readFile(dirConf + "/settings.json", "utf8", (err, data) => {
    if (err) saveSettings();
    eventEmitter.emit("gotSettings",JSON.parse(data));
   });
}

app.on('ready', startApplication);