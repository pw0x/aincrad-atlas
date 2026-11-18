# Production on pw0studio

[Public site](https://aincrad.pw0studio.com/) · [Live revision](https://aincrad.pw0studio.com/api/version) · [Main builds](https://github.com/pw0x/aincrad-atlas/actions/workflows/ci.yml) · [Feedback delivery](../server/README.md)

## Publish a change

Link the issue and evidence in a PR. The protected `Test and build` check runs the spatial runtime, feedback and release tests, typechecks the client and builds the distribution. After a merge, the main build stamps the browser bundle with the exact commit. It sends those tested files and the API modules to the dedicated SSH receiver. The receiver checks their digest, stages a SHA-named release, switches the `current` symlink, restarts the Atlas API and waits for the exact SHA from the loopback version endpoint. On health-check failure it restores the previous working release when one exists. The last five releases retain their hashed assets for visitors with an older tab.

At handoff, open the named scene or reproduction URL in the deployed site and attach the working revision from `/api/version` to the original issue. The progress panel links both the deployed revision and recent GitHub activity. Its task count is the number of open issues labelled `agent-ready`. A marked visitor observation can wait in the durable queue while GitHub schedules the dispatch workflow.

## Host layout

| Path | Role |
| --- | --- |
| `/srv/aincrad-atlas/releases/<40-character SHA>` | Immutable site, backend and revision file |
| `/srv/aincrad-atlas/current` | Active release, common to nginx and the API |
| `/srv/aincrad-atlas/assets` | Shared hard links for hashed assets still used by retained releases |
| `/var/lib/aincrad-atlas` | Persistent SQLite database containing reports, screenshots, delivery state and progress cache |
| `/var/backups/aincrad-atlas/atlas.sqlite3` | Most recent verified daily SQLite snapshot, on the same host |
| `/etc/aincrad-atlas/api.env` | Root-readable public origin, private worker secret and loopback proxy settings |
| `/usr/local/libexec/aincrad-receive` | Root-owned copy of [the forced SSH command](receive.py) |

The three explicit HTML filenames are stable scene addresses. nginx serves `portal.html` at the bare domain, proxies `/api/` to loopback and serves ACME challenges from a dedicated webroot. The DNS A record belongs to the studio's existing Azure server. Certbot renews its own certificate and the host's deploy hook reloads nginx on successful renewal.

This shared host reserves 1 GiB of free disk and sets the intake database budget to 768 MiB. When either limit is reached, new reports receive a retryable error before acknowledgement. Existing receipts and queued deliveries remain available. Review disk space and transfer the backup to larger storage before raising the budget.

## Host installation and recovery

The host uses Ubuntu, nginx with gzip_static, certbot, systemd and system Python with Pillow. The unprivileged `aincrad-api` user owns the database. The separate `atlas-deploy` user can publish only under the Atlas release root and use sudo for the single exact command `/usr/bin/systemctl restart aincrad-atlas.service`. Its SSH key uses `restrict,command="/usr/local/libexec/aincrad-receive"` in a root-owned authorized_keys file. Pin the host's public key from an authenticated server session.

Install the checked-in [HTTP](http.conf) and [HTTPS](https.conf) configuration for this subdomain, [API service](aincrad-atlas.service), [renewal hook](renew-nginx) and [backup script](backup.py) with its [service](aincrad-backup.service) and [timer](aincrad-backup.timer). Validate nginx and unit files before reloading. Infrastructure under `deploy/` is audited in PRs and installed by the host operator. The constrained release receiver updates only the site and its API.

| Actions configuration | Value |
| --- | --- |
| Secret `ATLAS_DEPLOY_KEY` | Dedicated key for the forced SSH command |
| Variables `ATLAS_SSH_HOST`, `ATLAS_SSH_KNOWN_HOSTS` | SSH destination and pinned public host key |
| Variable `ATLAS_PUBLIC_ORIGIN` | Public HTTPS origin used by the feedback dispatcher |
| Secret `ATLAS_WORKER_SECRET` | Matches the intake service. The workflow uses a job-scoped GitHub token to write issues. |

For a failed release, inspect the main CI log, `journalctl -u aincrad-atlas` and the current link. Re-run the main workflow after fixing a transient failure. For a code rollback, revert the change in a PR so the new main commit rebuilds the previous behavior and records the reason. To restore a database, stop the API, save the current database **and its SQLite sidecar files** together, restore the verified snapshot into a clean state directory with service ownership, then start the API. Preserve the old files until receipts, evidence and worker delivery have been verified. The local snapshot assists recovery from an application error. Recovery from loss of the VM requires a separate off-host backup.

## 中文交接

合并前在 PR 中写清关联任务、复现机位和验收方法。主分支构建将同一份提交 SHA 写进浏览器与 API。发布结果可在 GitHub Actions 查询，线上版本可在首页开发进度和 `/api/version` 核对。验收时从原 Issue 恢复机位，附上实测版本和结果。排查反馈先查看回执，再查看派发工作流。需要回退代码时提交 revert PR，保留问题、修复和部署之间的来龙去脉。
