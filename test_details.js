const http = require('http');

http.get('http://localhost:3000/inventory/warehouses', (res) => { // wait, I don't have the uuid of the warehouse!
  console.log('Warehouses redirect:', res.statusCode);
}).on('error', console.error);
