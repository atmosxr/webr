const fs = require("fs");
const path = require("path");

const base = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(base, "dist", "bundle.js"));

function toContentScript(src) {
  return "(function(d,t,s) {s=d.createElement(\"script\");s.textContent=t;d.documentElement.appendChild(s);})(document,"+
         JSON.stringify(src)+
         ");";
}

fs.writeFileSync(path.join(base, "extension", "injector.js"), toContentScript(src.toString()));
