const http = require('http');

http.get('http://localhost:3000/inventory/warehouses/123-fake-id-to-test-compile', {
  headers: {
    // We are unauthenticated, so this will redirect, but if it compiles, it redirects. If it crashes, it gives 500!
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode));
}).on('error', console.error);
