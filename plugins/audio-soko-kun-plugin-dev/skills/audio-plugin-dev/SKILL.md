---
name: audio-plugin-dev
description: Build an open-source audio plugin (VST 3 and CLAP, optionally with a GUI) with Claude Code and get it listed on Audio Plugin Soko-kun (音のプラグイン倉庫くん, https://audio-soko-kun.allegromoltov.jp). Use when the user wants to plan, scaffold, implement, test, release, or publish a DAW plugin (effect, instrument, analyzer, MIDI, or utility), build VST 3 from CLAP with clap-wrapper, validate with pluginval and clap-validator in CI, test a plugin GUI without a display, release with build provenance attestations and immutable releases, or submit a plugin to Audio Plugin Soko-kun or fix a release it held or rejected.
---

# Building an audio plugin and listing it on Audio Plugin Soko-kun

This skill walks through the stages of building a DAW plugin with Claude Code, from the first requirements to a listing on Audio Plugin Soko-kun. The knowledge comes from building six published plugins with Claude Code: noise generators, a pitch shifter, a glitch effect, a binaural spatializer, and a spectrum analyzer with a GPU-drawn GUI. Each stage lists what to do, what tends to go wrong, and when it is done. Details live in `references/`, and a project that builds and passes the validators as it is lives in `templates/project/`.

Audio Plugin Soko-kun checks every release against its review criteria. The single source of truth for the criteria is:

https://github.com/AllegroMoltoV/audio-plugin-soko-kun/blob/main/docs/design/review-criteria.md

The document is in Japanese and organizes criteria into listing conditions (`掲載の条件`), takeover signals (`乗っ取りの兆候`), review criteria (`審査の基準`), and recommendations (`推奨`). This skill names a criterion by its ID, such as `attestation`, and does not restate it. Read the criterion in that document when you need its exact wording, because the document can change after this skill was written.

The approach in this skill is CLAP first: write the plugin once against the CLAP C API, and let [clap-wrapper](https://github.com/free-audio/clap-wrapper) build the VST 3 plugin from the same code. It needs no framework license, and both formats come from one build. If the author already uses another framework, keep the stages and the release and listing parts, and adapt the build parts.

## Rules that apply to every stage

### Ask the author before writing to anything outside the working tree

Get the author's explicit approval in the conversation before each of these operations, and run them only after the approval:

- Creating a GitHub repository, or making a private repository public
- `git push` to any branch, and pushing tags
- Creating, disabling, or changing a branch or tag ruleset, even temporarily
- Creating, publishing, or deleting a GitHub release, and deleting tags or release assets
- Changing repository settings, such as turning on immutable releases, or the repository description
- Registering the plugin on Audio Plugin Soko-kun with `submit_plugin` (the default `submit` mode)

Claude Code's auto mode classifier blocks several of these operations, such as disabling a ruleset. Do not look for a way around the block. Explain the operation, wait for the author's approval, and let the author run it or allow it. Keep local commands out of the same shell command as the external operation, so that a block does not also stop the local work.

Read-only operations need no approval: `gh api` GET requests, `gh run list`, `gh release view`, `get_plugin`, `search_plugins`, `list_my_plugins`, and `submit_plugin` in `check` mode.

### Do not rename the release workflow

Audio Plugin Soko-kun remembers which workflow file signed the attestations of the first listed release. A later release signed by a workflow with another path is held for an administrator. Keep `.github/workflows/build.yaml` from the template under that name from the first release on.

### Do not put private information into the repository

Before the repository becomes public, keep these out of every commit in its history: local absolute paths, user names, API keys, license keys of commercial software, personal device names, other people's identifiers, and the author's own agent and editor settings (`CLAUDE.md`, `.claude/`, `.vscode/`, and similar). Check `git status` before each commit. Removing a file in a new commit leaves it readable in the history. If something private was committed, rewrite the history before the first push to a public repository, with the author's approval.

### Do not guess the cause of a failure

When a build, a test, a validator, or CI fails for a reason you cannot explain, do not try fixes one after another. Collect evidence first: the log, the exact command, and the validator's output. Before you change code for a bug report from the author, propose the options and let the author choose.

### Check that every test can fail

After you write a test, break the code it guards (remove the smoothing, swap a sign, skip a step) and confirm that the test fails, then restore the code. A test that passes on broken code gives false confidence. In the projects behind this skill, two click tests passed with the protection removed until this check found them.

## Stages

| Stage | Reference | External operations |
| --- | --- | --- |
| 1. Plan the plugin and choose its name | [planning.md](references/planning.md) | None |
| 2. Set up the project and the repository | [project-setup.md](references/project-setup.md) | Repository creation, settings, rulesets, push |
| 3. Implement the plugin | [implementation.md](references/implementation.md) | None |
| 4. Add a GUI (optional) | [gui.md](references/gui.md) | None |
| 5. Test in CI on Windows and Linux | [ci-tests.md](references/ci-tests.md) | Push |
| 6. Release with attestations | [release.md](references/release.md) | Tag, release |
| 7. List on Audio Plugin Soko-kun and check the listing | [audio-soko-kun.md](references/audio-soko-kun.md) | `submit_plugin` |

Read the reference file of the stage you are in. Do not start the next stage until the author agrees that the current stage is complete.

### 1. Plan

Write the requirements to a file in the repository before writing code, for example `.prompts/INIT.md`. Start from [templates/INIT.md](templates/INIT.md). Put the checks whose results can change the rest of the plan first, such as whether a library works at every sample rate a host may use, or whether a GUI library can open a window in CI. Prefer an existing open-source library to writing a DSP algorithm from scratch, and check its license before choosing it.

Done when:

- The requirements file lists the purpose, the parameters with ranges and defaults, the platforms, decisions (final, provisional, undecided), checked facts with sources, open questions with a recommended answer for each, and completion criteria that include the listing
- The author has answered the open questions
- The name is checked against GitHub, Audio Plugin Soko-kun (`search_plugins`), and well-known commercial products, and the plugin ID (`com.example.my-gain`) is final
- The author has decided the distribution type (A or B; C cannot be listed), the paid features and paid services, and the license of every bundled asset, so that the declarations in `.audio-soko-kun/config.json` can be written

### 2. Set up

Copy `templates/project/` into a new local folder with a short path, fill in the block at the top of `CMakeLists.txt` and the matching values in `.github/workflows/build.yaml`, update the pinned versions to the newest releases, and build. Create the GitHub repository, turn on immutable releases, push, and add the rulesets, in that order and with the author's approval for each.

Done when:

- The local build, the unit test, `check-archive.py`, pluginval at strictness 10, and clap-validator pass
- `gh api repos/<owner>/<repo>/immutable-releases` shows `"enabled": true` before any tag exists
- The first pull request passes CI on Windows and Linux

### 3. Implement

Write the processing in a file that does not depend on CLAP, so that unit tests can call it, and keep the CLAP layer thin. Read [references/implementation.md](references/implementation.md) before you write processing, parameters, or state.

Done when:

- `process()` allocates nothing, takes no locks, and makes no system calls (`realtime-safety`)
- The plugin activates at every sample rate the VST 3 validator tries, including 1234.5678 Hz, without crashing
- Unit tests cover the behaviour that a change could break, and each test fails when its guarded code is broken
- If the plugin uses the network, the README states what it sends, where, and why (`user-data-handling`)

### 4. Add a GUI (optional)

A plugin without its own window is fully usable through the host's generic parameter view. Add a GUI only when the plugin needs one, for example to show a display. Read [references/gui.md](references/gui.md): plugin windows live inside the host's window and event loop, VST 3 built by clap-wrapper rounds timers to 30 ms, and CI has no GPU.

Done when:

- pluginval at strictness 10 opens and closes the window in CI on both systems
- The numbers behind the picture are unit-tested, and the picture itself is compared with a golden image drawn in CI
- The author has checked the look and feel in a DAW with a checklist

### 5. Test in CI

The template's workflow builds on pinned Windows and Ubuntu runners, runs the unit tests, packs the release archive and checks it with `check-archive.py`, validates VST 3 with pluginval and CLAP with clap-validator, and runs the unit tests under AddressSanitizer and UndefinedBehaviorSanitizer. See [references/ci-tests.md](references/ci-tests.md).

Done when:

- Every job passes on a pull request
- Actions are pinned to full commit SHAs, `persist-credentials: false` is set, permissions are minimal, and Dependabot watches the Actions (`ci-hardening`). Do this before the first listed release, because later workflow changes hold the next release for an administrator

### 6. Release

Push an annotated tag `v<version>` that matches the version in `CMakeLists.txt`. The workflow attests every archive and creates a draft release. Verify the attestations, then publish. See [references/release.md](references/release.md).

Done when:

- `gh release view <tag> --json isImmutable` prints `true`
- `gh attestation verify <file> --repo <owner>/<repo>` passes for every downloaded release file
- The release has only the zip archives

### 7. List on Audio Plugin Soko-kun

Run `submit_plugin` in `check` mode, fix what it reports, register the plugin with the author's approval, and check the state with `list_my_plugins` 15 minutes or more after each release. See [references/audio-soko-kun.md](references/audio-soko-kun.md).

Done when:

- `get_plugin` returns the plugin with `listed` status
- `list_my_plugins` shows no blocker that waits for the author (`waitsFor: "author"`), and the author has seen the review findings and the notices
- The listed version declares `paidFeatures`, `paidServices`, and `restrictedAssets` in `.audio-soko-kun/config.json`, matching the README

## Templates

| Path | Purpose |
| --- | --- |
| [templates/INIT.md](templates/INIT.md) | Requirements file for stage 1 |
| `templates/project/` | A stereo gain plugin that builds, passes pluginval at strictness 10 and clap-validator, and releases with attestations as it is. Replace the gain with your processing |
| `templates/project/CMakeLists.txt` | CLAP-first build with clap-wrapper, hardening flags, a sanitizer option, and license texts in the release layout |
| `templates/project/src/` | The CLAP plugin (`plugin.cpp`), the exported entry (`plugin-entry.cpp`), and the processing without CLAP (`gain.h`) |
| `templates/project/tests/plugin-test.cpp` | Unit tests of the processing |
| `templates/project/.github/workflows/build.yaml` | CI and release workflow. Keep its name |
| `templates/project/.github/scripts/check-archive.py` | Checks a release archive the way Audio Plugin Soko-kun scans it |
| `templates/project/.github/scripts/fetch-validators.sh` | Downloads pluginval and clap-validator at pinned versions and checks their SHA-256 |
| `templates/project/.github/dependabot.yml` | Weekly updates of the pinned Actions |
| `templates/project/.audio-soko-kun/config.json` | Display name and category for the listing |
| `templates/project/.gitignore`, `.gitattributes` | Keep build output and editor and agent settings out of the repository, and store text with LF line endings |
| `templates/project/README.md`, `packaging/README.txt` | The repository README and the README inside each archive |
| [templates/rulesets/](templates/rulesets/) | Branch and tag rulesets for `gh api -X POST repos/<owner>/<repo>/rulesets --input <file>` |

The versions pinned in the templates were current when this skill was written. Update them before the first push, as described in [references/project-setup.md](references/project-setup.md).
