// tests/setup/globals.js

// Mock Chrome APIs for jsdom test environment
global.chrome = {
    storage: {
      sync: {
        get: async () => ({}),
        set: async () => {}
      }
    },
    tabs: {
      query: async () => [{ url: 'https://example.com' }]
    }
  };
  
  // You can also mock console or window if needed
  global.console = console;
  