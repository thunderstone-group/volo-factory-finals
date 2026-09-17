---
name: ready-navigation
description: Connect existing navigation modules to prepared state and synchronous rendering.
---

# Ready navigation

Use when an initial render or navigation depends on state that arrives too late.
When supplied, retain the existing VoloNavigation module and backend bootstrap
helper unchanged. Initialize required server data before accepting requests and
load the bootstrap script before application code. Include only state that the
current visitor may access.

VoloNavigation.create calls render immediately. Its render(route, state, nav)
callback must synchronously return a DOM node or fragment from prepared state.
Use the callback's nav argument during initial render, not an outer variable that
has yet to receive create's return value. For example, construct a destination
with nav.link(requirementDerivedName, route); use nav.go for internal navigation.
Await a mutation before nav.update(nextState). Preserve server fallback to the
application entry for direct routes and test back/forward as well as link clicks.

Evidence and limits: this contract is grounded in the supplied shared module's
implementation and limited local navigation observations. It does not establish
cross-application reliability or implement authorization, persistence, or all
business routes. Missing route data must be resolved from requirements and source;
caller-run browser checks are still needed.
