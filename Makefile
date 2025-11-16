PYTHON ?= python3
NPM ?= npm
PORT ?= 8000

CSSO := build/node_modules/.bin/csso
UGLIFYJS := build/node_modules/.bin/uglifyjs
CONTENT_GENERATOR := build/generate_writing.py
CONTENT_SRC := $(wildcard content/writing/*.md)

CSS_SRC := css/main.css
CSS_MIN := css/main.min.css
JS_SRC  := js/main.js
JS_MIN  := js/main.min.js
NODE_MODULES := build/node_modules
DEV_INFO_DIR := build/.dev_servers

.PHONY: all build css js content clean clean-all dev-start dev-stop dev-status install

all: build

build: css js content

install: $(NODE_MODULES)

$(NODE_MODULES): build/package.json
	cd build && $(NPM) install
	@touch $(NODE_MODULES)

css: $(CSS_MIN)

js: $(JS_MIN)

$(CSS_MIN): $(CSS_SRC) $(NODE_MODULES)
	@mkdir -p $(dir $@)
	$(CSSO) --input $< --output $@

$(JS_MIN): $(JS_SRC) $(NODE_MODULES)
	@mkdir -p $(dir $@)
	$(UGLIFYJS) $< --compress --mangle --output $@

content: $(CONTENT_GENERATOR) $(CONTENT_SRC)
	@$(PYTHON) $(CONTENT_GENERATOR)

clean:
	rm -f $(CSS_MIN) $(JS_MIN)

clean-all: clean
	rm -rf $(NODE_MODULES) build/package-lock.json

dev-start:
	@mkdir -p $(DEV_INFO_DIR)
	@if [ -f $(DEV_INFO_DIR)/$(PORT).pid ]; then \
		PID=$$(cat $(DEV_INFO_DIR)/$(PORT).pid); \
		if ps -p $$PID > /dev/null 2>&1; then \
			echo "Dev server is already running on http://localhost:$(PORT) (PID $$PID)"; \
			echo "Use 'make dev stop PORT=$(PORT)' to stop it, or use a different PORT"; \
			exit 1; \
		else \
			rm -f $(DEV_INFO_DIR)/$(PORT).pid; \
		fi; \
	fi
	@echo "Starting dev server on port $(PORT)..."
	@$(PYTHON) build/server.py $(PORT) > /tmp/dev_server_output_$$$$.log 2>&1 & \
	SERVER_PID=$$!; \
	sleep 0.5; \
	if ps -p $$SERVER_PID > /dev/null 2>&1; then \
		echo "$$SERVER_PID" > $(DEV_INFO_DIR)/$(PORT).pid; \
		echo "Dev server started on http://localhost:$(PORT) (PID $$SERVER_PID)"; \
		echo "Use 'make dev stop PORT=$(PORT)' to stop it"; \
		rm -f /tmp/dev_server_output_$$$$.log; \
	else \
		echo "Failed to start dev server on port $(PORT)"; \
		cat /tmp/dev_server_output_$$$$.log 2>/dev/null; \
		rm -f /tmp/dev_server_output_$$$$.log; \
		echo ""; \
		echo "Port $(PORT) may already be in use. Try a different port:"; \
		echo "  make dev PORT=3000"; \
		exit 1; \
	fi

dev-stop:
	@if [ -f $(DEV_INFO_DIR)/$(PORT).pid ]; then \
		PID=$$(cat $(DEV_INFO_DIR)/$(PORT).pid); \
		if ps -p $$PID > /dev/null 2>&1; then \
			echo "Stopping dev server on port $(PORT) (PID $$PID)..."; \
			kill $$PID; \
			rm -f $(DEV_INFO_DIR)/$(PORT).pid; \
			echo "Dev server stopped"; \
		else \
			echo "Dev server on port $(PORT) is not running (stale PID file)"; \
			rm -f $(DEV_INFO_DIR)/$(PORT).pid; \
		fi; \
	else \
		echo "No dev server running on port $(PORT)"; \
	fi

dev-status:
	@if [ -d $(DEV_INFO_DIR) ] && [ -n "$$(ls -A $(DEV_INFO_DIR) 2>/dev/null)" ]; then \
		echo "Running dev servers:"; \
		for pidfile in $(DEV_INFO_DIR)/*.pid; do \
			if [ -f "$$pidfile" ]; then \
				PORT=$$(basename $$pidfile .pid); \
				PID=$$(cat $$pidfile); \
				if ps -p $$PID > /dev/null 2>&1; then \
					echo "  http://localhost:$$PORT (PID $$PID)"; \
				else \
					rm -f $$pidfile; \
				fi; \
			fi; \
		done; \
	else \
		echo "No dev servers running"; \
	fi
