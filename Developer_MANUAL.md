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
