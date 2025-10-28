# User Documentation

### High Level Description
**CookiesShallNotPass** is a chrome extension that automatically manages website cookie preferences. It blocks non-essential cookies, removes intrusive cookie banners, and allows users to whitelist trusted sites or import pre-defined blocklists making cookie management automatic, simple, and private.

### How to install the software
To install the latest published version of the extension, download it from the Chrome web store.

---

### //David's spot  
#### How to run the software
- Launch Google Chrome  
- Make sure you're using a supported version of Google Chrome  
- Activate the Extension  
- Click the small puzzle icon in the top right corner of your Chrome browser  
- Pin CookiesShallNotPass for quick access if desired  
- Click the extension icon to open the pop-up interface  

#### How to use the software
Once the extension is installed and enabled in Chrome, you can manage it easily through the popup interface and the dashboard.  

This section explains how to use all main features.  

**Opening the Extension Popup**  
- Click the CookiesShallNotPass icon in the Chrome toolbar.  
- This opens a compact popup window, your main control center for quick cookie management.  

**Popup Features**  
The popup gives you direct access to essential controls while browsing.  

- **Enable or Disable the Blocker:**  
  - Use the turn On/Off toggle to activate or pause cookie blocking.  
  - When enabled, the extension automatically blocks unwanted cookies based on your preferences and lists. When disabled, all cookies will behave normally as in Chrome.  

- **Current Site Display:**  
  - The popup shows the current website you’re visiting. This helps confirm which site you’re managing before adding it to a list.  

- **Cookie Stats:**  
  - Cookies Blocked So Far: Number of cookies that have been blocked so far.  
  - Cookies Allowed: Number of cookies permitted so far.  
  - Banners Removed: Number of cookie banners removed so far.  

**Managing Sites**  
- **Add to Whitelist:**  
  - Click “Add to Whitelist” to allow cookies from the current domain.  
  - Whitelisted sites will bypass the blocker, keeping their cookies active.  

- **Add to Blacklist:**  
  - Click “Block” to completely block cookies on the current website.  
  - The site will be added to your blacklist automatically.  

**Dashboard**  
- Click “Go to Dashboard” in the popup to open the main management panel.  
- The dashboard provides advanced tools and customization for your cookie preferences.  

**View and Edit Lists:**  
- View all websites you’ve added to your Whitelist and Blacklist.  
- Add or remove sites manually.  

**Edit Preferences:**  
- Manage your extension settings directly from the dashboard.  
  - Auto-Blocking: Turn automatic cookie blocking on or off globally.  
  - Blocker Status: Use the turn On/Off toggle to activate or pause cookie blocking.  

**Graphical Statistics:**  
- Visualize your browsing privacy.  
  - Total cookies blocked vs. allowed  

**Import / Export Lists:**  
- Import: Upload a TXT or JSON file of sites to whitelist or blacklist.  
- Export: Download your current lists for backup or sharing across devices.  

**Report a Bug:**  
- Use the “Report a Bug” form directly from the dashboard.  
- Include the affected website, a short description of what happened, and optional steps to reproduce or a screenshot.  

**Notes**  
Some advanced features such as improved banner detection and detailed analytics are still in progress. CookiesShallNotPass runs automatically after installation, but you can always customize its behavior using the popup and dashboard.

---

### //david’s
Once the startup process is complete, ie, the extension icon is clicked and successfully opened, then:  
- Go to any website with a cookie consent banner  
- The extension will automatically detect and manage the banner according to your settings  
- You can open the pop-up to adjust preferences, view site logs, or whitelist/blacklist domains  

---

### // Shaan’s Spot  
#### How to report a bug
1. Click the small puzzle icon in the top right corner of your Chrome browser.  
2. Locate the CookiesShallNotPass extension in the list and click it.  
3. Once clicked, the dashboard will pop up.  
4. Scroll to the bottom of the dashboard and click the “Report Bug” hyperlink.  
5. You will be directed to a Google Form where you can describe the issue.  

**To make your report most useful, please include the following details:**  
- **Summary:** A short, clear title (e.g., “Popup toggle not saving settings”).  
- **Steps to Reproduce:** Numbered steps showing exactly how the bug occurs.  
- **Expected Result:** What you thought would happen.  
- **Actual Result:** What actually happened.  
- **Environment:** Your operating system and Chrome version.  
- **Screenshot or Video (optional):** If it helps clarify the issue.  

---

### Known bugs
- All of the known bugs will be documented in our spreadsheet in the google forum  
- There will be no trivial bugs in the implemented use cases  

---

# Developer Documentation

### // Shaan  
#### How to obtain the source code
1. Click the small puzzle icon in the top right corner of your Chrome browser.  
2. Locate the CookiesShallNotPass extension in the list and click it.  
3. Once clicked, the dashboard will pop up.  
4. Scroll to the bottom of the dashboard and click the “View Source” hyperlink.  
5. You will be redirected to the official GitHub repository in a new tab.  
6. To clone the repository locally, on the GitHub page, click the “Code” button (green dropdown).  
7. Copy the HTTPS URL: https://github.com/AryanV08/CookiesShallNotPass.git  
8. Open a terminal or command prompt and run:  
- Sure thing! I’ve taken your text exactly as-is and formatted it into proper Markdown (.md) with headings, bold, and lists. No wording has been changed or added — only formatting applied:
# User Documentation

### High Level Description
**CookiesShallNotPass** is a chrome extension that automatically manages website cookie preferences. It blocks non-essential cookies, removes intrusive cookie banners, and allows users to whitelist trusted sites or import pre-defined blocklists making cookie management automatic, simple, and private.

### How to install the software
To install the latest published version of the extension, download it from the Chrome web store.

---

### //David's spot  
#### How to run the software
- Launch Google Chrome  
- Make sure you're using a supported version of Google Chrome  
- Activate the Extension  
- Click the small puzzle icon in the top right corner of your Chrome browser  
- Pin CookiesShallNotPass for quick access if desired  
- Click the extension icon to open the pop-up interface  

#### How to use the software
Once the extension is installed and enabled in Chrome, you can manage it easily through the popup interface and the dashboard.  

This section explains how to use all main features.  

**Opening the Extension Popup**  
- Click the CookiesShallNotPass icon in the Chrome toolbar.  
- This opens a compact popup window, your main control center for quick cookie management.  

**Popup Features**  
The popup gives you direct access to essential controls while browsing.  

- **Enable or Disable the Blocker:**  
  - Use the turn On/Off toggle to activate or pause cookie blocking.  
  - When enabled, the extension automatically blocks unwanted cookies based on your preferences and lists. When disabled, all cookies will behave normally as in Chrome.  

- **Current Site Display:**  
  - The popup shows the current website you’re visiting. This helps confirm which site you’re managing before adding it to a list.  

- **Cookie Stats:**  
  - Cookies Blocked So Far: Number of cookies that have been blocked so far.  
  - Cookies Allowed: Number of cookies permitted so far.  
  - Banners Removed: Number of cookie banners removed so far.  

**Managing Sites**  
- **Add to Whitelist:**  
  - Click “Add to Whitelist” to allow cookies from the current domain.  
  - Whitelisted sites will bypass the blocker, keeping their cookies active.  

- **Add to Blacklist:**  
  - Click “Block” to completely block cookies on the current website.  
  - The site will be added to your blacklist automatically.  

**Dashboard**  
- Click “Go to Dashboard” in the popup to open the main management panel.  
- The dashboard provides advanced tools and customization for your cookie preferences.  

**View and Edit Lists:**  
- View all websites you’ve added to your Whitelist and Blacklist.  
- Add or remove sites manually.  

**Edit Preferences:**  
- Manage your extension settings directly from the dashboard.  
  - Auto-Blocking: Turn automatic cookie blocking on or off globally.  
  - Blocker Status: Use the turn On/Off toggle to activate or pause cookie blocking.  

**Graphical Statistics:**  
- Visualize your browsing privacy.  
  - Total cookies blocked vs. allowed  

**Import / Export Lists:**  
- Import: Upload a TXT or JSON file of sites to whitelist or blacklist.  
- Export: Download your current lists for backup or sharing across devices.  

**Report a Bug:**  
- Use the “Report a Bug” form directly from the dashboard.  
- Include the affected website, a short description of what happened, and optional steps to reproduce or a screenshot.  

**Notes**  
Some advanced features such as improved banner detection and detailed analytics are still in progress. CookiesShallNotPass runs automatically after installation, but you can always customize its behavior using the popup and dashboard.

---

### //david’s
Once the startup process is complete, ie, the extension icon is clicked and successfully opened, then:  
- Go to any website with a cookie consent banner  
- The extension will automatically detect and manage the banner according to your settings  
- You can open the pop-up to adjust preferences, view site logs, or whitelist/blacklist domains  

---

### // Shaan’s Spot  
#### How to report a bug
1. Click the small puzzle icon in the top right corner of your Chrome browser.  
2. Locate the CookiesShallNotPass extension in the list and click it.  
3. Once clicked, the dashboard will pop up.  
4. Scroll to the bottom of the dashboard and click the “Report Bug” hyperlink.  
5. You will be directed to a Google Form where you can describe the issue.  

**To make your report most useful, please include the following details:**  
- **Summary:** A short, clear title (e.g., “Popup toggle not saving settings”).  
- **Steps to Reproduce:** Numbered steps showing exactly how the bug occurs.  
- **Expected Result:** What you thought would happen.  
- **Actual Result:** What actually happened.  
- **Environment:** Your operating system and Chrome version.  
- **Screenshot or Video (optional):** If it helps clarify the issue.  

---

### Known bugs
- All of the known bugs will be documented in our spreadsheet in the google forum  
- There will be no trivial bugs in the implemented use cases  

---

# Developer Documentation

### // Shaan  
#### How to obtain the source code
1. Click the small puzzle icon in the top right corner of your Chrome browser.  
2. Locate the CookiesShallNotPass extension in the list and click it.  
3. Once clicked, the dashboard will pop up.  
4. Scroll to the bottom of the dashboard and click the “View Source” hyperlink.  
5. You will be redirected to the official GitHub repository in a new tab.  
6. To clone the repository locally, on the GitHub page, click the “Code” button (green dropdown).  
7. Copy the HTTPS URL: https://github.com/AryanV08/CookiesShallNotPass.git  
8. Open a terminal or command prompt and run:  
- git clone https://github.com/AryanV08/CookiesShallNotPass.git
- cd CookiesShallNotPass
9. Now you can see all the source code!  

---

### The layout of your directory structure
The CookiesShallNotPass repository is organized to clearly separate source code, testing resources, documentation, and automated workflow configurations.  

- The main source files for the Chrome extension are located in the project’s root directory, including **index.html, index.css, main.js, and whitelist.js**, which together define the popup interface, core logic, and whitelist functionality of the extension.  
- The **manifest.json** file serves as the central configuration file recognized by Chrome, specifying metadata, permissions, and entry points.  
- Automated workflows for continuous integration and testing are stored in the **.github/workflows** directory.  
- The **tests** folder contains unit and integration test scripts that verify both the frontend and backend components.  
- Supporting metadata and dependencies for Node.js testing are managed through **package.json** and **package-lock.json**.  
- The **USER_MANUEL.md** file provides end-user instructions, whereas **coding-guidelines.md** outlines standards and contribution rules for developers.  
- General project information and setup instructions can be found in the **README.md**.  

---

### How to build the software
CookiesShallNotPass uses a simple front-end build system based on HTML, CSS, Javascript, and Chrome’s Manifest V3 framework.  

**To build the software:**  
1. Clone the repository  
2. Verify the project structure  
Ensure the following folders are present:  
- Manifest.json  
- /ui  
- /background  
- /conent  
- /rulesengine  
- /storage  

3. Install nodejs 20.x or above at https://nodejs.org/en/download  
4. Install dependencies with `npm install`  
5. Load into Chrome for testing  
- Open Chrome -> Settings -> Extensions  
- Enable Developer mode  
- Click “Load unpacked”  
- Select the project folder  
- The extension icon “CookiesShallNotPass” will appear in the toolbar  

6. Run and verify components  
- Open the popup -> confirm the dashboard and settings load correctly  
- Modify preferences or import whitelist/blacklist files to confirm UI-backend integration  

---

### How to test the software
To run the provided test suite, run:  
- npn run test
in the root directory of the repository.  

The tests will automatically be run on each commit and pull request to the github repository.  

---

### How to add new test
1. Tests are stored in the folder named **tests**  
2. At the top of the test file, import the function or module you want to test  
3. **Write a Test Case:** Each test is defined using the `test()` or `it()` function.  
4. **Group Tests with describe():** For better organization, related tests are grouped using `describe()`.  
5. **Run the Test:** Run Jest with:  
- npm run test

---

### How to build a release of the software
- **Check the code**  
Make sure all changes are saved and the code is up to date.  

- **Run tests**  
In the project folder:  
- npm run test
Make sure all tests pass.  

- **Load the extension in Chrome**  
- Open Chrome → Settings → Extensions → Enable Developer mode  
- Click Load unpacked and select the project folder  
- Check
