.DEFAULT_GOAL := help

VERSION_FILE := manifest.json
CURRENT_VERSION := $(shell sed -n 's/.*"version": "\(.*\)".*/\1/p' $(VERSION_FILE))
LAST_TAG := $(shell git describe --tags --abbrev=0 2>/dev/null)

.PHONY: help release version

help: ## Show available targets
	@printf '\n\033[1;32m  InboxAI — Available targets\033[0m\n\n'
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo

version: ## Show current version info
	@echo "manifest.json: $(CURRENT_VERSION)"
	@echo "last git tag:  $(LAST_TAG)"

release: ## Create a release (usage: make release v=0.1.6)
	@if [ -z "$(v)" ]; then \
		echo "Usage: make release v=X.Y.Z"; \
		echo "Current version: $(CURRENT_VERSION)"; \
		echo "Last tag: $(LAST_TAG)"; \
		exit 1; \
	fi
	@echo "Releasing v$(v)..."
	@sed -i 's/"version": ".*"/"version": "$(v)"/' $(VERSION_FILE)
	@git add $(VERSION_FILE)
	@git commit -m "chore: bump version to $(v)"
	@git tag -a "v$(v)" -m "v$(v): $$(git log --oneline $(LAST_TAG)..HEAD~1 | paste -sd ', ')"
	@echo ""
	@echo "Done! Tag v$(v) created."
	@echo "Run 'git push origin main --tags' to publish."
