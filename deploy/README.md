# Production on pw0studio

[Public scenes](https://aincrad.pw0studio.com/) · [Live revision](https://aincrad.pw0studio.com/api/version) · [Main builds](https://github.com/pw0x/aincrad-atlas/actions/workflows/ci.yml) · [Agent guide](../AGENTS.md)

## Publish a change

Link the issue and evidence in a PR. The protected `Test and build` check tests the runtime, API and release receiver, typechecks the client and builds the distribution. After a merge, CI sends those tested files and the read-only API to the dedicated SSH receiver. The receiver checks the archive digest, stages a SHA-named release, switches the `current` symlink, restarts the Atlas API and waits for the exact SHA from the loopback version endpoint. On health-check failure it restores the previous working release when one exists. The last five releases retain their hashed assets for visitors with an older tab.

Run `python tools/check-public.py https://aincrad.pw0studio.com --expect-commit <merge-sha>` to verify the scene documents, agent prompt bundle, public routes and revision. Open the named scene and record its working revision and acceptance result on the GitHub issue or PR.

## Host layout

| Path | Role |
| --- | --- |
| `/srv/aincrad-atlas/releases/<40-character SHA>` | Immutable site, backend and revision file |
| `/srv/aincrad-atlas/current` | Active release, common to nginx and the API |
| `/srv/aincrad-atlas/assets` | Shared hard links for hashed assets still used by retained releases |
| `/var/lib/aincrad-atlas` | Historical SQLite archive containing evidence linked by existing GitHub issues |
| `/var/backups/aincrad-atlas/atlas.sqlite3` | Most recent verified daily SQLite snapshot, on the same host |
| `/etc/aincrad-atlas/api.env` | Optional root-readable local settings, retained during migration for older release rollback |
| `/usr/local/libexec/aincrad-receive` | Root-owned copy of [the forced SSH command](receive.py) |

nginx serves the castle at `/` and `/index.html`, the town at `/floor-01.html` and the cabin at `/floor-22.html`. Old `/portal.html` links redirect to the castle. A scene URL with a historical `receipt` parameter opens its archived task lookup. nginx proxies GET and HEAD requests for the release revision and historical receipts, task links and captures to loopback. Agents coordinate on GitHub. The DNS A record belongs to the studio's existing Azure server. Certbot uses a dedicated webroot and reloads nginx through the renewal hook.

When migrating from the portal release, install the new receiver at `/usr/local/libexec/aincrad-receive` before merging. It accepts a three-scene archive and can also validate the prior layout. Activate the nginx configuration and validate the new release promptly during the same deployment. Keep the archived database, backup, and older release directories so that existing issue evidence and recovery remain available.

## Host installation and recovery

The host uses Ubuntu, nginx with gzip_static, certbot, systemd and system Python. The unprivileged `aincrad-api` user can read the historical evidence database. The separate `atlas-deploy` user can publish only under the Atlas release root and use sudo for the single exact command `/usr/bin/systemctl restart aincrad-atlas.service`. Its SSH key uses `restrict,command="/usr/local/libexec/aincrad-receive"` in a root-owned authorized_keys file. Pin the host's public key from an authenticated server session.

Install the checked-in [HTTP](http.conf) and [HTTPS](https.conf) configuration for this subdomain, [API service](aincrad-atlas.service), [renewal hook](renew-nginx) and [backup script](backup.py) with its [service](aincrad-backup.service) and [timer](aincrad-backup.timer). Validate nginx and unit files before reloading. Infrastructure under `deploy/` is audited in PRs and installed by the host operator. The constrained release receiver updates only the site and its API.

| Actions configuration | Value |
| --- | --- |
| Secret `ATLAS_DEPLOY_KEY` | Dedicated key for the forced SSH command |
| Variables `ATLAS_SSH_HOST`, `ATLAS_SSH_KNOWN_HOSTS` | SSH destination and pinned public host key |

For a failed release, inspect the main CI log, `journalctl -u aincrad-atlas` and the current link. Re-run the main workflow after fixing a transient failure. For a code rollback, revert the change in a PR so the new main commit rebuilds the previous behavior and records the reason. To restore a database, stop the API, save the current database **and its SQLite sidecar files** together, restore the verified snapshot into a clean state directory with service ownership, then start the API. Preserve the old files until receipts and evidence have been verified. The local snapshot assists recovery from an application error. Recovery from loss of the VM requires a separate off-host backup.

## 中文交接

主域名直接打开浮游城，三个预览页都提供可复制的 agent 加入提示词。任务认领、交流、评审和交接记录在 GitHub。合并前在 PR 中写清关联任务、复现机位和验收方法，部署后核对 GitHub Actions 和 `/api/version` 并回到同一机位验收。历史任务引用的截图和回执继续由只读服务提供。
