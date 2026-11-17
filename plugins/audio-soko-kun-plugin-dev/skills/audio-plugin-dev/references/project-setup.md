# Setting up the project and the repository

## Copy the template to a short path

Copy `templates/project/` (including the hidden folders `.github` and `.audio-soko-kun`, and the hidden files `.gitignore` and `.gitattributes`) into a new folder. The `.gitignore` keeps build output out of the repository: `build/CMakeCache.txt` contains absolute paths with the user name. It also keeps editor and agent settings out (`agent-editor-config`); if the author wants to publish an `AGENTS.md` or a shared `.vscode/extensions.json` for contributors, remove its line on purpose. On Windows, use a short path such as `C:\src\my-gain-audio`: clap-wrapper downloads the VST 3 SDK, whose git submodules contain paths of more than 200 characters, and the checkout fails with `Filename too long` under a deep folder.

Fill in the block at the top of `CMakeLists.txt` (`project` name and version, `PRODUCT_NAME`, `PLUGIN_ID`, `PLUGIN_VENDOR`, `PLUGIN_URL`, `ARCHIVE_PREFIX`), and set the same `PRODUCT_NAME` and `ARCHIVE_PREFIX` in the `env` block of `.github/workflows/build.yaml`. Replace the names in `README.md`, `packaging/README.txt`, `.audio-soko-kun/config.json`, and the copyright line of `LICENSE`. Change the four-character `kStateMagic` in `src/plugin.cpp`.

## Update the pinned versions before the first push

The template pins every dependency by commit or hash, which the review expects (`dependency-pinning`, `hermetic-build`). The pinned versions were current when this skill was written. Before the first push:

| Pin | Where | How to update |
| --- | --- | --- |
| clap-wrapper | `GIT_TAG` in `CMakeLists.txt` | Take the newest release of free-audio/clap-wrapper and the full commit SHA of its tag (`gh api repos/free-audio/clap-wrapper/git/ref/tags/<tag>`) |
| pluginval, clap-validator | URLs and SHA-256 in `.github/scripts/fetch-validators.sh` | Take the newest releases, download the archives, and record `sha256sum` of each. pluginval 2 or later is needed; it embeds the VST 3 SDK validator |
| GitHub Actions | `uses:` lines in `build.yaml` | Take the newest release of each action and its full commit SHA, and keep the version in a comment |
| Runner images | `os:` in `build.yaml` | Use explicit images such as `windows-2022` and `ubuntu-24.04`, not `*-latest` |
| Any library you add | `FetchContent_Declare` | Use `URL` with an archive of a commit and `URL_HASH SHA256=...`, or `GIT_TAG` with a full commit SHA |

Dependabot (`.github/dependabot.yml`) proposes updates of the Actions only. It does not watch the CMake pins or the validators; review those yourself when you prepare a new version.

## Build and validate locally

```sh
# Windows
cmake -B build -A x64
# Linux
cmake -B build -DCMAKE_BUILD_TYPE=Release

cmake --build build --config Release --parallel
ctest --test-dir build -C Release --output-on-failure
cmake --install build --config Release --prefix dist
```

Pack `dist` as the CI does and run `python -I .github/scripts/check-archive.py <zip> windows-x64 "<PRODUCT_NAME>"`. Run pluginval (`pluginval validate --strictness-level 10 "dist/VST3/<PRODUCT_NAME>.vst3"`) and clap-validator (`clap-validator validate "dist/CLAP/<PRODUCT_NAME>.clap"`) from the versions that `fetch-validators.sh` downloads. Do not copy the build into the author's plugin folders without asking; the DAW scans them.

## Create the repository, in this order

Each step is an external operation. Get the author's approval for each.

1. Create the repository: `gh repo create <owner>/<repo> --public --source . --remote origin`. Audio Plugin Soko-kun lists only public repositories, and artifact attestations on GitHub Free, Pro, and Team work only in public repositories.
2. Turn on immutable releases before any tag exists: `gh api -X PUT repos/<owner>/<repo>/immutable-releases`, then check with `gh api repos/<owner>/<repo>/immutable-releases` that it prints `"enabled": true`. A release published before this setting stays mutable and cannot be listed (`immutable-release`).
3. Push `main`.
4. Add the rulesets from [../templates/rulesets/](../templates/rulesets/): `gh api -X POST repos/<owner>/<repo>/rulesets --input default-branch.json` and the same with `release-tags.json`. The branch ruleset blocks deletion and force pushes and requires a pull request with one approval. Its bypass list lets the repository admin merge their own pull request (`bypass_mode: pull_request`), so a single author can work without a reviewer. The tag ruleset lets only admins create, update, or delete tags (`repository-protection`).

After the rulesets exist, change `main` through pull requests. A single author merges with `gh pr merge <number> --merge --admin` after CI passes.

## The README

The template README has the sections the review looks for: what the plugin does, requirements, installation, how to verify the download (`user-verification-guide`), the build, the license with a table of third-party components (`license-notices`), the trademark notice, whether the plugin uses the network (`user-data-handling`), and an AI disclosure. Keep these when you rewrite it.

- Link only to this repository, Audio Plugin Soko-kun, and the SDK documentation hosts that the criteria allow (`steinbergmedia.github.io`, `cleveraudio.org`, `lv2plug.in`, `developer.apple.com`). A new link to another host in a later version holds that version for an administrator (`diff-external-link`). Name other projects without linking them.
- The VST Compatible logo may be used only under Steinberg's logo usage terms (https://steinbergmedia.github.io/vst3_dev_portal/pages/VST+3+Licensing/Usage+guidelines.html). Read them with the author before adding the logo files. The logo files are not covered by your plugin's license; say so in the README.
- Do not write instructions that bypass operating system protections or pipe a downloaded script into a shell (`no-security-bypass`, `no-terminal-paste`), even as a warning not to do it. The rules match the phrases themselves.
