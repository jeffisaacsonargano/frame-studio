# Frame Studio

Working models of how Pigment plans: the calculation engine, the formula language, a model's data flow, and the custom-coded frames built on top. Everything runs in the browser on sample data.

| App | What it shows |
|---|---|
| Graphite | Pigment's calculation engine in 3D: sparse cells, scoped recalculation, access rights and scenarios |
| Formula Studio | A formula stepped through, with BY, REMOVE, ADD, SELECT and FILTER reshaping it |
| Blockflow | A model's data flow from concept to every block, with build plans played step by step |
| Framecraft | Lineage for a frame: trace every number back to its blocks, in 3D or 2D |
| Lumina frame | A full Pigment frame (dashboard, Ask why, Architecture Studio, Collaboration, shared notes) running on a mock of the Pigment SDK |
| Frame World | A first-person walk through a frame, its model, the warehouse behind it and out into the real world |
| Frame size | Where a real frame spends Pigment's 1 MiB frame code limit |

## Running it

The site is static. Serve the `docs/` folder with any web server, or turn on GitHub Pages for this repo with the source set to `docs/` on the main branch.

Some features in the original version used Claude through claude.ai (Ask Claude answers, shared state between viewers, viewer identity). On this site those parts fall back to their built-in, rule-based behaviour.

## Building

`docs/` is generated from the Frame Studio project's source files by a build script that copies the apps and leaves out internal material. Edits to the site are made in the source and rebuilt, not in `docs/` directly.

## Notes

This is an independent project. It is not made, endorsed or supported by Pigment, Snowflake, Databricks, Salesforce, Workday, NetSuite, Greenhouse, Slack, Notion or Anthropic. Product names are used only to describe what the demos depict; the marks drawn in the apps are original generic shapes, not the companies' logos. All figures are sample data.
