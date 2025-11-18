# Developer Documentation
 
#### How to obtain the source code
1. Click the small puzzle icon in the top right corner of your Chrome browser.  
2. Locate the CookiesShallNotPass extension in the list and click it.  
3. Once clicked, the dashboard will pop up.  
4. Scroll to the bottom of the dashboard and click the “View Source” hyperlink.  
5. You will be redirected to the official GitHub repository in a new tab.  
6. To clone the repository locally, on the GitHub page, click the “Code” button (green dropdown).  
7. Copy the HTTPS URL: https://github.com/AryanV08/CookiesShallNotPass.git  
8. Open a terminal or command prompt and run:  
- `git clone https://github.com/AryanV08/CookiesShallNotPass.git`
- `cd CookiesShallNotPass`
9. Now you can see all the source code!  

---

### The layout of your directory structure
The CookiesShallNotPass repository is organized to clearly separate source code, testing resources, documentation, and automated workflow configurations.  

- The main source files for the Chrome extension are located in **/UI**, including **dashboard.{css,html,js}, popup.{css,html,js}, and visual.js**, which together define the popup interface, core logic, and whitelist functionality of the extension.  
- The **manifest.json** file serves as the central configuration file recognized by Chrome, specifying metadata, permissions, and entry points.  
- Automated workflows for continuous integration and testing are stored in the **.github/workflows** directory.  
- The **tests** folder contains unit and integration test scripts that verify both the frontend and backend components.  
- Supporting metadata and dependencies for Node.js testing are managed through **package.json** and **package-lock.json**.  
- The **USER_MANUAL.md** file provides end-user instructions, whereas **coding-guidelines.md** outlines standards and contribution rules for developers.  
- General project information and setup instructions can be found in the **README.md**.  

---

### How to build the software
CookiesShallNotPass uses a simple front-end build system based on HTML, CSS, Javascript, and Chrome’s Manifest V3 framework.  

**To build the software:**  
1. Clone the repository
  - Open a terminal or command prompt and run:
  - `git clone https://github.com/AryanV08/CookiesShallNotPass.git`
  - `cd CookiesShallNotPass`
2. Find the folder you just cloned.
3. Verify the project structure (Ensure the following files/folders are present):
  - /ui
  - manifest.json
  - background.js
  - content.js
  - rulesEngine.js
  - storage.js
  - icon.png
  - tracker_domains.txt
4. Create a new folder on your desktop and name it “CookiesShallNotPass Extension”.
5. Copy and paste the previously listed files/folders into the new folder.
6. Install nodejs 24.0 at https://nodejs.org/en/download  
7. Install dependencies with `npm install`  
8. Load into Chrome for testing  
  - Open Chrome -> Click the three dots in the top right corner and click “Settings” at the bottom of the dropdown -> Click “Extensions” found in the bottom left corner.
  - Enable the “Developer mode” switch in the top right corner. 
  - Click “Load unpacked” in the top left corner.
  - Select the new folder you just created, “CookiesShallNotPass Extension".
  - Click the puzzle piece in the top right corner, and in the dropdown, click the pin icon next to the “CookiesShallNotPass” extension.
  - The extension’s cookie icon will now appear next to the puzzle piece icon.
  - Click the Cookie icon and enable or make sure the toggle switch is green.

9. Run and verify components  
  - Open the popup -> confirm the dashboard and settings load correctly  
  - Modify preferences or import whitelist/blacklist files to confirm UI-backend integration  

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
