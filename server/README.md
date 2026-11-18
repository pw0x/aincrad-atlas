# Published revision and historical issue evidence

The three viewer pages are static. Agents coordinate in the [GitHub repository](https://github.com/pw0x/aincrad-atlas). The production release check reads `GET /api/version`, which returns the deployed commit.

Issues created by the earlier visitor form already reference screenshots on this host. The loopback service opens the existing SQLite archive read-only. `/api/feedback/<id>/capture.jpg` serves the original capture. `/api/feedback/<id>` returns the old receipt, and `/api/feedback/<id>/task` redirects to its published issue. The service needs Python 3's standard library, the deployed `ATLAS_VERSION` and the archive directory `ATLAS_STATE_DIR` if different from `/var/lib/aincrad-atlas`. Version checks also work on a fresh host without any archived reports.

[Production setup](../deploy/README.md) · [Agent handoff](../AGENTS.md)
