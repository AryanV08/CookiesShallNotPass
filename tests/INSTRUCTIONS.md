**How to Add a New Test to the Code Base:**

1.Create a new test file:

/test/unit → for individual modules or functions

/test/integration → for testing interactions between modules

/test/e2e → for full end-to-end browser tests 

For example, a test of the rules engine belongs in 
tests/unit/rulesEngine.test.js

2.Import the target module or component

Example:
```
import { compileRules } from '../../src/background/rulesEngine.js';
import { expect } from 'chai';
```

3.Set up any required mocks or environment
extend tests/mocks/chrome.js with the necessary stub methods.
For UI tests, we use @testing-library/react to render components in a jsdom environment.

4.Write the test case
Set up a known initial state.
Call a single function or simulate a user action.
Assert that the output or UI matches the expected result.

Example:
```describe('Rules Engine', () => {
it('compiles valid DNR rules', () => {
    const rules = compileRules({ whitelist: ['example.com'], blacklist: [] });
    expect(rules.addRules).to.be.an('array');
  });
});
```
5.Run the test locally:
npm run test
