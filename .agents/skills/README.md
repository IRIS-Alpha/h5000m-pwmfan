# Project Skills

Use these skills at the matching stage of LuCI interface work:

| Stage | Skill | Use |
| --- | --- | --- |
| Design or restructure a page | `$frontend-design` | Establish or revise page structure and visual direction while following the confirmed project requirements and Vantage reference. |
| Iterate on rendered visuals | `$impeccable` | Review and refine spacing, hierarchy, typography, responsive behavior, and interaction details against the running preview. |
| Final interface review | `$web-design-guidelines` | Check the changed UI files against the bundled accessibility, focus, form, animation, typography, and content rules before delivery. |

The skills are vendored for this project, so no user-global installation is required. Keep upstream skill files and their references together. Refresh them only as a deliberate dependency update, preserving the source commit and any upstream license or notice files.

## Upstream Sources

| Skill | Source | Pinned commit | License notes |
| --- | --- | --- | --- |
| `frontend-design` | `anthropics/skills/skills/frontend-design` | `e4bb5d960d87126ff3b3a8af1a104b7db67560ba` | Includes upstream `LICENSE.txt` (Apache-2.0). |
| `impeccable` | `pbakaus/impeccable/.agents/skills/impeccable` | `b49177d32788f2dc585c42831d845dacf1ebed2c` | Includes upstream `LICENSE` (Apache-2.0) and `NOTICE.md`. |
| `web-design-guidelines` | `vercel-labs/agent-skills/skills/web-design-guidelines` | `5a37a6329fbad3666c3207392a6a7c0110e92efb` | The upstream repository has no root license file; its source and bundled rules are attributed in the skill. |

`impeccable` includes its upstream references and helper scripts. Its optional installer hook and subagent configuration are not enabled; invoke its skill directly when doing visual refinement.
