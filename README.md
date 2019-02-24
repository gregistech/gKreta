![banner980150.png](https://raw.githubusercontent.com/thegergo02/gKreta/master/img/banner980150.png)

<p align="center"><img src="https://img.shields.io/github/repo-size/thegergo02/gKreta.svg?colorB=red&style=for-the-badge" alt="repo-size">
   
## Description
* Based on Electron, this is a replacement for KRÉTA's web interface.
    * You can easily select your school. (No need for that klik********* code.)
    * A dashboard.
    * You can see statistics about your evaluations, absences... (In the future, much more.)
    * All of your evaluations. 
    * An organized timetable.
    * All of your absences ordered by date.
    * Every note you get.
    * A settings panel.
    * Two languages: English and Hungarian. (Again, in the future I add more.)
    * Exporting function.

## Currently supported platforms
* Windows
* Linux
* ~~Mac~~ (In theory Electron supports it but I can't test Mac builds.)

## Install the application
### Linux
* Download the latest AppImage. (**The github release is the only trustable resource!!!**)
* Double-click on it, and enjoy! (The system will ask if you want to integrate the application with the system, your decision.)

* If you have permission troubles
    * Open the folder in terminal
    * `chmod +x ./EXECUTABLE_NAME` Where the *EXECUTABLE_NAME* is what you downloaded.
    
### Windows
* Download the latest release (for Windows).  (**The github release is the only trustable resource!!!**)
* Install the application with the installer. (Pretty straightforward)
* Run it and enjoy!


### Mac
* We don't have official releases, or build scripts for this you have to build it.

## Setup the project
```bash
git clone https://github.com/thegergo02/gKreta.git
cd gKreta
npm install
npm start
```

## Build the project
### Linux
```bash
npm run dist:linux
```
### Windows
```bash
npm run dist:win
```
(After building if you still want to start the debug build with `npm start`, you will have to...)
* `rm -r ./node_modules/`
* `npm install`

## Contributors
| Name | Contribution |
| ------------- | ------------- |
| [thegergo02](https://github.com/thegergo02) | Project Maintainer |
| [boapps](https://github.com/boapps) | Without [e-kreta-api-docs](https://github.com/boapps/e-kreta-api-docs), I couldn't start this project. |
| [szekelymilan](https://github.com/szekelymilan) | Helped with implementing keytar. |
| [icons8](https://icons8.com) | Provided free icons (for example window control icons) |

## Third-party software licenses
### keytar
```
Copyright (c) 2013 GitHub Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

This software is not affiliated with [KRÉTA](https://www.ekreta.hu/) or with [Max & Future Kft.](http://www.max.hu/hu/) 
