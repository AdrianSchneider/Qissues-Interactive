PROJECT = "qissues"

test: test-unit test-domain test-ui

test-unit: ;@echo "Unit Testing ${PROJECT}"; \
    node_modules/.bin/mocha tests --recursive -R dot;

test-domain: ;@echo "Domain Testing ${PROJECT}"; \
		node_modules/.bin/cucumber.js tests/domain --require tests/domain/support --require tests/domain/step_definitions -f progress;

test-ui: ;@echo "UI Testing ${PROJECT}"; \
		node_modules/.bin/cucumber.js tests/ui --require tests/ui/support --require tests/ui/step_definitions -f progress;

coverage: ;@echo "Making Coverage for ${PROJECT}"; \
		istanbul cover -x src/app/commands/index.js -x src/bootstrap.js --include-all-sources ./node_modules/mocha/bin/_mocha tests -- --recursive -R spec;

.PHONY: test test-domain test-unit test-ui coverage
