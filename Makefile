.DEFAULT_GOAL := help

VERSION_FILE := manifest.json
CURRENT_VERSION := $(shell sed -n 's/.*"version": "\(.*\)".*/\1/p' $(VERSION_FILE))
LAST_TAG := $(shell git describe --tags --abbrev=0 2>/dev/null)

XPI := InboxAI.xpi
LINTER_DIR := external/webext-linter
LINTER_CACHE := .linter-cache
STAMPS := .stamps

.PHONY: help release version build test lint check clean

help: ## Show available targets
	@printf '\n\033[1;32m  InboxAI — Available targets\033[0m\n\n'
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo

version: ## Show current version info
	@echo "manifest.json: $(CURRENT_VERSION)"
	@echo "last git tag:  $(LAST_TAG)"

build: ## Build the XPI package
	@./build.sh

test: ## Run the JavaScript and packaging tests
	@for t in tests/test_*.js; do echo "--> $$t"; node "$$t" || exit 1; done
	@for t in tests/test_*.sh; do echo "--> $$t"; bash "$$t" || exit 1; done

lint: $(STAMPS)/.built-linter-deps build ## Run the Thunderbird webext-linter against the built XPI
	@node $(LINTER_DIR)/verify.js $(XPI) \
		--cache-schema-dir $(LINTER_CACHE)/schema \
		--cache-hash-db-dir $(LINTER_CACHE)/hash-db \
		--cache-cdn-lookup-dir $(LINTER_CACHE)/cdn-lookup \
		--cache-experiments-dir $(LINTER_CACHE)/experiments
	@rm -rf $(XPI).extracted*

check: test lint ## Run the full test suite and the ATN linter

clean: ## Remove build output, linter caches, and stamps
	@rm -rf $(XPI) $(XPI).extracted* $(LINTER_CACHE) $(STAMPS)

$(LINTER_DIR)/package.json:
	@git submodule update --init --recursive $(LINTER_DIR)

$(STAMPS)/.built-linter-deps: $(LINTER_DIR)/package.json
	@mkdir -p $(STAMPS)
	@npm --prefix $(LINTER_DIR) ci --silent
	@touch $@

release: ## Create a release (usage: make release v=0.1.6)
	@if [ -z "$(v)" ]; then \
		echo "Usage: make release v=X.Y.Z"; \
		echo "Current version: $(CURRENT_VERSION)"; \
		echo "Last tag: $(LAST_TAG)"; \
		exit 1; \
	fi
	@if ! git diff --quiet || ! git diff --cached --quiet; then \
		echo "Release aborted: commit or stash tracked changes first."; \
		exit 1; \
	fi
	@if git rev-parse -q --verify "refs/tags/v$(v)" >/dev/null; then \
		echo "Release aborted: tag v$(v) already exists."; \
		exit 1; \
	fi
	@echo "Releasing v$(v)..."
	@tmp_version_file="$$(mktemp)"; \
	sed 's/"version": "[^"]*"/"version": "$(v)"/' $(VERSION_FILE) > "$$tmp_version_file"; \
	mv "$$tmp_version_file" $(VERSION_FILE)
	@git add $(VERSION_FILE)
	@git commit -m "chore: bump version to $(v)" -- $(VERSION_FILE)
	@tmp_tag_file="$$(mktemp)"; \
	if [ -n "$(LAST_TAG)" ]; then \
		{ \
			echo "Release v$(v)"; \
			echo ""; \
			echo "Changes since $(LAST_TAG):"; \
			git log --format='- %s' $(LAST_TAG)..HEAD; \
		} > "$$tmp_tag_file"; \
	else \
		{ \
			echo "Release v$(v)"; \
			echo ""; \
			echo "- Initial release."; \
		} > "$$tmp_tag_file"; \
	fi; \
	git tag -a "v$(v)" -F "$$tmp_tag_file"; \
	rm -f "$$tmp_tag_file"
	@echo ""
	@echo "Done! Tag v$(v) created."
	@echo "Run 'git push origin main --tags' to publish."
