const { app, BrowserWindow, net, ipcMain, shell } = require("electron");
const events = require('events');
const fs = require('fs');
const keytar = require('keytar');

var eventEmitter = new events.EventEmitter();

var winDash = "";
var win = "";

var dirConf = "./conf/";
var dirHtm = "./htm/"

var studentData = "";
var timetableData = "";

var isGetStudentDataRunning = false;

var globalInstituteCode = "";
var globalAuthToken = "";
var globalRefreshToken = "";

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

  ipcMain.on("isGetStudentDataRunning", () => {
    winDash.webContents.send("isGetStudentDataRunning", isGetStudentDataRunning);
  });

  ipcMain.on('getStudentData', (event) => {
    isGetStudentDataRunning = true;
    getAuthToken();
    eventEmitter.once("getAuthTokenSuccess", function getAuthTokenSuccess(authToken, instituteCode) {
      getStudentData(instituteCode, authToken);
      eventEmitter.once("getStudentDataSuccess", function getStudentDataSuccess(studentDataM) {
        studentData = studentDataM;
        getTimetableData(studentData.InstituteCode, studentData.authToken);
        eventEmitter.once("getTimetableDataSuccess", function getTimetableDataSuccess(timetableDataM) {
          timetableData = timetableDataM;
          winDash.webContents.send("getStudentDataSuccess",studentData,timetableData);
          isGetStudentDataRunning = false;
        });
      });
      eventEmitter.once("getStudentDataError", () => {
        isGetStudentDataRunning = false;
      });
    });
  });
}

function loadCorrectWindowAtStart() {
  var getInstituteCodePromise = keytar.getPassword("gkreta","instituteCode");
  getInstituteCodePromise.then(
    (result) => {
      if (result !== null && result !== undefined && result !== "") {
        winDash = createWindow("dashboard.htm");
      } else {
        win = createWindow("login.htm");
      }
    },
    (err) => {
      win = createWindow("login.htm");
    }
  );
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
    eventEmitter.once("getLoginDetailsSuccess", (instituteCode, authToken, refreshToken) => {
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

function refreshToken(instituteCode, refreshToken) {
  postData = "refresh_token=" + refreshToken + "&grant_type=refresh_token&client_id=919e0c1c-76a2-4646-a2fb-7085bbbf3c56";
  makeNetRequest("POST", "https:", instituteCode + ".e-kreta.hu", "/idp/api/v1/Token", {'Content-Type': 'application/x-www-form-urlencoded','Content-Length': Buffer.byteLength(postData)}, postData, instituteCode);
  eventEmitter.once("makeNetRequestSuccess", (response, instituteCode) => {
    response = JSON.parse(response);
    saveLoginDetails(instituteCode,response.access_token,response.refresh_token);
    eventEmitter.emit("refreshTokenSuccess", instituteCode, response.access_token, response.refresh_token);
  });

  eventEmitter.once("makeNetRequestError", () => {
    eventEmitter.emit("refreshTokenError");
  });
}

function getStudentData(instituteCode, authToken) {
  makeNetRequest("GET", "https:", instituteCode + ".e-kreta.hu","/mapi/api/v1/Student",{ "Authorization": "Bearer " + authToken}, null, authToken);

  eventEmitter.once("makeNetRequestSuccess", (studentData, authToken) => {
    studentData = JSON.parse(studentData);
    studentData.authToken = authToken;
    eventEmitter.emit("getStudentDataSuccess", studentData);
  });

  eventEmitter.once("makeNetRequestError", (response) => { 
    if (response.statusCode === 401) {
      refreshToken();
      eventEmitter.once("refreshTokenSuccess", (instituteCode, authToken, refreshToken) => {
        getStudentData(instituteCode, authToken);
      }); 
    } else {
      eventEmitter.emit("getStudentDataError", response);
    }
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
  globalAuthToken = authToken;
  globalRefreshToken = refreshToken;
  var setInstituteCodePromise = keytar.setPassword("gkreta","instituteCode",instituteCode);
  setInstituteCodePromise.then(
    () => {
      var setAuthTokenPromise = keytar.setPassword("gkreta","authToken",globalAuthToken);
      setAuthTokenPromise.then(
        () => {
          var setRefreshTokenPromise =keytar.setPassword("gkreta","refreshToken",globalRefreshToken);
          setRefreshTokenPromise.then(
            () => {
              eventEmitter.emit("saveLoginDetailsSuccess");
            }  
          );
        }  
      );
    }  
  );

  var setAuthTokenPromise = keytar.setPassword("gkreta","authToken",authToken);
  var setRefreshTokenPromise =keytar.setPassword("gkreta","refreshToken",refreshToken);
  eventEmitter.emit("saveLoginDetailsSuccess");
}

function getLoginDetails() {
  var getInstituteCodePromise = keytar.getPassword("gkreta", "instituteCode");
  getInstituteCodePromise.then(
    (result) => {
      globalInstituteCode = result;
      var getAuthTokenPromise = keytar.getPassword("gkreta", "authToken");
      getAuthTokenPromise.then(
        (result) => {
          globalAuthToken = result;
          var getRefreshTokenPromise = keytar.getPassword("gkreta", "refreshToken");
          getRefreshTokenPromise.then(
            (result) => {
              globalRefreshToken = result;
              eventEmitter.emit("getLoginDetailsSuccess", globalInstituteCode, globalAuthToken, globalRefreshToken);
            },
            (err) => {
            }
          );
        },
        (err) => {
        }
      );
    },
    (err) => {
    }
  );
}

function makeNetRequest(method, protocol, hostname, path, headers, post_data, otherArgs) {
  try {
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
  catch (e) {
    console.log(e);
  }
}

function saveSettings(settingsJson) {
  if (settingsJson === null || settingsJson === undefined || settingsJson === "")
    settingsJson = {"locale" : "en"};

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