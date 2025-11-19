# Developer Documentation

---

## How to Obtain the Source Code

### ** Clone Directly from GitHub**
1. Visit the repository:  
   **https://github.com/AryanV08/CookiesShallNotPass**
2. Click the green **Code** button and copy the **HTTPS URL**.
3. Open your terminal and run:
   ```bash
   git clone https://github.com/AryanV08/CookiesShallNotPass.git
   cd CookiesShallNotPass

---

### The layout of the directory structure
---

CookiesShallNotPass/
├── UI/ --- These files power the popup interface, dashboard, and all visualizations.
│   ├── d3.min.js
│   ├── dashboard.css
│   ├── dashboard.html
│   ├── dashboard.js
│   ├── popup.css
│   ├── popup.html
│   ├── popup.js
│   └── visual.js

│The main behavior of the extension lives at the root:
├── .gitignore  
├── background.js  — handles background tasks, rule updates, cleanup  
├── coding-guidelines.md  — style and contribution standards 
├── content.js   — runs in webpage context (if needed)  
├── Developer_MANUAL.md    — developer instructions  
├── icon.png
├── manifest.json    — Chrome MV3 configuration  
├── package-lock.json
├── package.json
├── README.md     — main project guide  
├── rulesEngine.js   — generates and manages DNR rules 
├── storage.js
├── tracker_domains.txt   — list of known tracking domains  
└── USER_MANUAL.md   — end-user guide 


Tests are stored in the `tests/` directory (not shown in screenshot but required by the test runner).

---


### How to build the software

CookiesShallNotPass is a Chrome extension built with **HTML, CSS, JavaScript**, and **Manifest V3**.  
There is no compilation step — you simply install dependencies and load the project into Chrome.

---

1. Open your terminal and run:
   ```bash
   git clone https://github.com/AryanV08/CookiesShallNotPass.git
   cd CookiesShallNotPass


---


### How to test the software
To run the provided test suite, run:  
- `npm run test`
in the root directory of the repository.  

The tests will automatically be run on each commit and pull request to the github repository.  

---

### How to add new test
1. Tests are stored in the folder named **tests**  
2. At the top of the test file, import the function or module you want to test  
3. **Write a Test Case:** Each test is defined using the `test()` or `it()` function.  
4. **Group Tests with describe():** For better organization, related tests are grouped using `describe()`.  
5. **Run the Test:** Run Jest with:  
- `npm run test`

---

### How to build a release of the software
- **Check the code**  
Make sure all changes are saved and the code is up to date.  

- **Run tests**  
In the project folder:  
- `npm run test`
Make sure all tests pass.  

- **Load the extension in Chrome**  
- Open Chrome → Settings → Extensions → Enable Developer mode  
- Click Load unpacked and select the project folder  
- Check that the extension icon appears and the popup opens correctly

- **Test key features**
- Turn the blocker on/off
- Add/remove sites from whitelist/blacklist
- Open the dashboard and confirm stats and settings work
