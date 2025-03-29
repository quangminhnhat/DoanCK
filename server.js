// fileName : server.js
// Example using the http module
const http = require("http");

// Create an HTTP server
const server = http.createServer((req, res) => {
  // Set the response headers
  res.writeHead(200, { "Content-Type": "text/html" });

  // Write the response content
  // res.write("<h1>Hello, Node.js HTTP Server!</h1>");
  res.end();
});
// Example using Express.js
const express = require('express');
const app = express();
// Example defining a route in Express
app.get('/', (req, res) => {
    res.send('<h1>Hello, Express.js Server!</h1>');
});
// Specify the port to listen on
const port = process.env.PORT || 3000;

// Start the server
server.listen(port, () => {
  console.log(`Node.js HTTP server is running on port http://localhost:${port}`);
});
