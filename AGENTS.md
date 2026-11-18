# Working on Aincrad Atlas

This is the shared entry point for Codex, Claude and other contributing agents. Each agent acts within the authority of the person or account it represents. The initial scenes and this guide can be revised by the same proposal and review process as any later contribution.

Start with **World vision and building framework** to see how canon research, regional layouts, individual components, scene assembly and peer review fit together across a hundred floors. Pick one output and identify the task or contributor that will use it. [English](docs/WORLD_DESIGN.md#english) · [简体中文](docs/WORLD_DESIGN.md#简体中文) · [Open tasks](https://github.com/pw0x/aincrad-atlas/issues)

## Find a unit of work

1. Read the [task board](https://github.com/pw0x/aincrad-atlas/issues) and check open PRs touching the same area. Pick an existing issue or open one for a different idea. Record the deliverable, inputs, intended files or coordinates, and how a peer can verify it.
2. When authorized to post, leave a short claim with the area you will work on. GitHub write access or formal assignment is optional for working in a fork. Link overlapping work and agree on a boundary with its contributor. Contributors may split, return or hand off a task.
3. Work on one reviewable change. A source note, a centimetre-scale prop, a terrain tile and a renderer fix are all valid submissions. Preserve the owners and licences of source material. Identify the original work and passage behind a canon claim, mark inference and record invented details as artistic choices.

## Scene contracts

| Responsibility | Entry points and units |
| --- | --- |
| Castle exterior and its districts | `src/castle/` and `index.html`, metres, Y up |
| Floor 22 cabin and its furnishings | `src/cabin/` and `floor-22.html`, metres, Y up |
| Shared daylight, clouds, water and landscape | `src/environment/`; put scene-specific loads in the relevant scene |
| Streaming and renderer | `src/runtime/api.ts`, `resources.ts` and `finish.ts` |

Keep coarse geometry available at distance. Register expensive detail with an anchor and separate entry/exit radii. Check the nearest authored view and its distant silhouette. Depend on stable identifiers, local pivots and documented extents when another contributor supplies a neighbouring module.

## Verify and hand off

Use Node 24 and the committed lockfile. Run `npm ci`, `npm test` and `npm run build` for code or asset integration. Run `npm run dev` for the interactive views. Include a reproducible URL fragment or camera position and one before/after pair for a visual change. A research-only change can be verified against the cited passage. State which checks ran and what remains unverified.

Open a PR from your branch or fork when authorized. Include its issue, evidence, changed boundaries and a concrete check for the next agent. A peer can review, propose a competing interpretation or supply a stronger source. Discuss substantive disagreement on the issue. Maintainers with repository permissions carry out merges and releases. Authorship of a template gives no one a permanent veto over its design.

Every agent closes its task, including research and review, with a short note in the issue or PR. Link the result and its verification, teach one method a peer can repeat, and name the receiving task and its first step. Record any coordination snag and the improvement you tried, or suggest a small change the receiver can test. If the handoff went smoothly, identify what made it work. Handoff rules are shared work too. Any agent can propose a revision and bring the receiver’s experience back to peer review. [Worked handoff example](CONTRIBUTING.md#teach-the-next-agent)

The [contributing guide](CONTRIBUTING.md) contains templates and examples. The [licensing guide](docs/LICENSING.md) covers code, art, upstream assets and the original franchise.
