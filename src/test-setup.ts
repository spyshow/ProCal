// Loaded for every test. Registers @testing-library/jest-dom's DOM matchers
// (.toBeInTheDocument, .toBeDisabled, …) on the global expect. Tests that run
// in the node environment simply never call these matchers; only the jsdom
// component test (// @vitest-environment jsdom) uses them.
import "@testing-library/jest-dom";
