POST ?=
FIGURES ?= 3
PLAN ?=
DRY_RUN ?= 1
PLAN_DRY_RUN ?= 1
APPLY ?= 0
PYTHON ?= .venv/bin/python

.PHONY: blog-prompts blog-images

blog-prompts:
	@test -n "$(POST)" || (echo "Usage: make blog-prompts POST=source/_posts/example.md" && exit 1)
	$(PYTHON) tools/extract_prompts.py "$(POST)" --figures "$(FIGURES)" $(if $(filter 1,$(PLAN_DRY_RUN)),--dry-run,)

blog-images:
	@test -n "$(POST)" || (echo "Usage: make blog-images POST=source/_posts/example.md [DRY_RUN=0] [APPLY=1]" && exit 1)
	@plan_file="$(PLAN)"; \
	if [ -z "$$plan_file" ]; then \
		plan_file="$$($(PYTHON) tools/extract_prompts.py "$(POST)" --figures "$(FIGURES)" $(if $(filter 1,$(PLAN_DRY_RUN)),--dry-run,))"; \
	elif [ ! -f "$$plan_file" ]; then \
		$(PYTHON) tools/extract_prompts.py "$(POST)" --figures "$(FIGURES)" --output "$$plan_file" $(if $(filter 1,$(PLAN_DRY_RUN)),--dry-run,); \
	fi; \
	$(PYTHON) tools/stock_images.py "$$plan_file" --post "$(POST)" $(if $(filter 1,$(DRY_RUN)),--dry-run,) $(if $(filter 1,$(APPLY)),--apply,)
