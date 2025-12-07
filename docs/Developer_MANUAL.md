# Developer Documentation

## How to Obtain the Source Code

### **Clone Directly from GitHub**
1. Open your terminal and run:
   ```bash
   git clone https://github.com/AryanV08/CookiesShallNotPass.git
   cd CookiesShallNotPass

---

### The layout of the directory structure
---

### **UI Layer (`/UI`)**
All user-facing interface code is stored inside the `UI` folder:

- `d3.min.js`
- `dashboard.html`
- `dashboard.css`
- `dashboard.js`
- `popup.html`
- `popup.css`
- `popup.js`
- `visual.js`

These files power the popup interface, dashboard, and all visualizations.
---
### **Core Extension Logic (root directory)**
The main behavior of the extension lives at the root:

- `background.js` — handles background tasks, rule updates, cleanup  
- `content.js` — runs in webpage context (if needed)  
- `rulesEngine.js` — generates and manages DNR rules  
- `storage.js` — handles storing and retrieving data  
- `tracker_domains.txt` — list of known tracking domains  

---

### **Configuration Files**
- `manifest.json` — Chrome MV3 configuration  
- `.gitignore`  
- `icon.png`

---

### **Documentation**
- `README.md` — main project guide  
- `Developer_MANUAL.md` — developer instructions  
- `USER_MANUAL.md` — end-user guide  
- `coding-guidelines.md` — style and contribution standards  

---

### **Node & Testing Resources**
Node.js is used for testing and automation:

- `package.json`  
- `package-lock.json`  

Tests are stored in the `tests/` directory (not shown in screenshot but required by the test runner).

---

## How to Build the Software

CookiesShallNotPass uses a simple front-end build system based on **HTML, CSS, JavaScript**, and Chrome’s **Manifest V3** framework. To build the software:

1. **Clone the repository**  
- Open a terminal or command prompt and run:  
  ```
  git clone https://github.com/AryanV08/CookiesShallNotPass.git
  cd CookiesShallNotPass
  ```

2. **Find the folder you just cloned**  
- Locate the `CookiesShallNotPass` folder on your machine.

3. **Verify the project structure**  
- Ensure the following files/folders are present:  
  - `manifest.json`  
  - `/UI`  
  - `background.js`  
  - `content.js`  
  - `rulesEngine.js`  
  - `storage.js`  
  - `icon.png`

4. **Create a release folder**  
- Create a new folder on your desktop and name it `CookiesShallNotPass Extension`.  
- Copy and paste the files/folders listed above into this new folder.

5. **Install Node.js and dependencies**  
- Install Node.js **20.x or above** from:  
  https://nodejs.org/en/download  
- In a terminal inside the cloned `CookiesShallNotPass` folder, run:  
  ```
  npm install
  ```

6. **Load the extension into Chrome for testing**  
- Open Chrome → click the three dots in the top-right corner → **Settings**.  
- In the left sidebar, click **Extensions**.  
- Enable **Developer mode** in the top-right corner.  
- Click **Load unpacked** in the top-left corner.  
- Select the `CookiesShallNotPass Extension` folder you created on your desktop.  
- Click the puzzle-piece icon in the top-right corner, then click the pin icon next to **CookiesShallNotPass** so it is easy to access.  
- Confirm the cookie icon for the extension appears next to the puzzle-piece icon and that the toggle switch for the extension is enabled (green).

7. **Run and verify components**  
- Click the cookie icon to open the popup, then click **Go To Dashboard** and confirm the dashboard and settings load correctly.  
- Modify preferences or import whitelist/blacklist files to confirm that the UI and backend are integrated and responding as expected.

---

### How to test the software
To run the provided test suite, run:  
- `npm i`  # same as 'npm install'
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
