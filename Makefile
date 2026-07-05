.PHONY: help up down build logs train test lint clean

GREEN := \033[32m
RESET := \033[0m

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}; {printf "$(GREEN)%-18s$(RESET) %s\n", $$1, $$2}'

up: ## Start everything (docker compose up)
	@cp -n .env.example .env 2>/dev/null && echo "Created .env from template" || true
	docker compose up -d
	@echo "$(GREEN)Running:$(RESET)"
	@echo "  API  → http://localhost:8000"
	@echo "  UI   → http://localhost:3000"
	@echo "  Docs → http://localhost:8000/docs"

down: ## Stop all services
	docker compose down

build: ## Rebuild Docker images
	docker compose build --no-cache

logs: ## Follow all logs
	docker compose logs -f

logs-backend: ## Backend logs only
	docker compose logs -f backend

train-sensor: ## Train XGBoost sensor model (~30s)
	PYTHONPATH=. python -m ml.train --no-cv

train-seg: ## Train U-Net segmentation model (E: drive, ~45min)
	PYTHONPATH=. python ml/segmentation_v2/train_e_drive.py --size 512 --batch 8

dev-backend: ## Run backend with hot-reload
	PYTHONPATH=. uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

dev-ui: ## Run Next.js dev server
	cd ui && npm run dev

test: ## Run all tests
	PYTHONPATH=. python -m pytest tests/ -v --tb=short

test-fast: ## Fast tests only (skip ML training)
	PYTHONPATH=. python -m pytest tests/test_api.py -v

lint: ## Lint with ruff
	ruff check backend/ ml/ tests/ --select=E,F,W --ignore=E501

clean: ## Remove Docker artifacts and cache
	docker compose down -v --remove-orphans
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	rm -rf ui/.next .pytest_cache .ruff_cache
