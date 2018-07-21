const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const dom = new JSDOM(``, {
  url: "https://example.org/",
  referrer: "https://example.com/",
  contentType: "text/html",
  userAgent: "Mellblomenator/9000",
  includeNodeLocations: true
});

const {document} = dom.window;
console.log(document);

const pEl = document.querySelector("p");

console.log(pEl);
