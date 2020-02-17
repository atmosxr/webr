.PHONY: all clean

all: webr.zip

clean:
	rm extension/injector.js dist/bundle.js webr.zip

webr.zip: extension extension/injector.js
	cd extension; zip ../webr.zip * */*

extension/injector.js: dist/bundle.js
	node src/make_content_script.js

dist/bundle.js: src/webr.js node_modules/cardboard-vr-display/dist/cardboard-vr-display.js
	./node_modules/.bin/webpack
