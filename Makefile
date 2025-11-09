CSSO ?= csso
UGLIFYJS ?= uglifyjs

CSS_SRC := css/main.css
CSS_MIN := css/main.min.css
JS_SRC  := js/main.js
JS_MIN  := js/main.min.js

.PHONY: all build css js clean

all: build

build: css js

css: $(CSS_MIN)

js: $(JS_MIN)

$(CSS_MIN): $(CSS_SRC)
	@mkdir -p $(dir $@)
	$(CSSO) --input $< --output $@

$(JS_MIN): $(JS_SRC)
	@mkdir -p $(dir $@)
	$(UGLIFYJS) $< --compress --mangle --output $@

clean:
	rm -f $(CSS_MIN) $(JS_MIN)
