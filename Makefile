# Makefile for MERN E-commerce Microservices

# Default mode is development
MODE ?= dev

# Compose files
DEV_COMPOSE = docker/compose.development.yaml
PROD_COMPOSE = docker/compose.production.yaml

# Set compose file based on mode
ifeq ($(MODE),prod)
    COMPOSE_FILE = $(PROD_COMPOSE)
else
    COMPOSE_FILE = $(DEV_COMPOSE)
endif

.PHONY: dev down prod prod-down logs test

dev:
	@echo "Starting development environment..."
	@if [ ! -f .env ]; then \
		echo "Copying .env.example to .env"; \
		cp .env.example .env; \
		cp .env.example docker/.env; \
	fi
	@docker-compose -f $(DEV_COMPOSE) --env-file .env up --build

down:
	@echo "Stopping development environment..."
	@docker-compose -f $(DEV_COMPOSE) --env-file .env down

prod:
	@echo "Starting production environment..."
	@docker-compose -f $(PROD_COMPOSE) --env-file .env up -d --build

prod-down:
	@echo "Stopping production environment..."
	@docker-compose -f $(PROD_COMPOSE) --env-file .env down

logs:
	@docker-compose -f $(COMPOSE_FILE) --env-file .env logs -f

test:
	@echo "--- Running Health Checks ---"
	@echo "Gateway health:"
	@curl http://localhost:5921/health
	@echo "\nBackend health via gateway:"
	@curl http://localhost:5921/api/health
	@echo "\n\n--- Running Product Management Tests ---"
	@echo "Create a product:"
	@curl -X POST http://localhost:5921/api/products \
		-H 'Content-Type: application/json' \
		-d '{"name":"Test Product","price":99.99}'
	@echo "\nGet all products:"
	@curl http://localhost:5921/api/products
	@echo "\n\n--- Running Security Test ---"
	@echo "Verify backend is not directly accessible (should fail):"
	@curl http://localhost:3847/api/products || echo "Command failed as expected."
