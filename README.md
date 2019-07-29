# webr
Webr is a fairly simple extension that adds WebVR support on every page you visit!

## Installation
The easiest way to install webr is to get it from the chrome webstore: [webr on the chrome web store](https://chrome.google.com/webstore/detail/webr/jeajdmpboimeiomddahkamkgnjhjnefk).
Webr is currently targeted at chrome / chromium based browsers; if you're interested in support for something else, open an issue or make a PR!

## Install from source / developing
- First install Node.JS, yarn (npm may work but it hasn't been tested), and GNU make.
- Clone this repository, `git clone https://github.com/atmosxr/webr.git` and cd into it, `cd webr`
- Fetch the Node.JS dependencies with yarn, `yarn`
- Run `make`
- Open `chrome://extensions/` in your web browser
  - Enable developer mode
  - Load unpacked extension (select the `extension` folder of this repository)
  - To rebuild, run `make` (or `make clean && make` if necessary)
  - To reload the extension, refresh it or enable and disable it

## Build process
The main program, `src/webr.js` and its dependencies (webvr-polyfill and cardboard-vr-display) are minified and packed into a single file (`dist/bundle.js`) by webpack.
`dist/bundle.js` is processed by `src/make_content_script.js` to produce `extension/injector.js`.
The contents of the `extension/` folder is then made into a zipfile, `webr.zip`.
See the Makefile for more details.

## Position data
Webr can utilize position and rotation data from a local websocket server and allow access to it through the WebVR api.
It currently connects to `ws://127.0.0.1:7700` (hardcoded); the data format should not be considered stable currently and is therefore not documented here.
