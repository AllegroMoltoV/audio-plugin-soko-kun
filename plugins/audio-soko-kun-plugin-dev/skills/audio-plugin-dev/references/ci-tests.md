# Testing in CI

The template's `.github/workflows/build.yaml` covers the criteria about building and validating in CI (`ci-source-build`, `ci-plugin-validation`, `hermetic-build`, `ci-hardening`). Keep its structure and add your own steps.

## What the workflow does

| Job | Steps |
| --- | --- |
| `build` (Windows 2022 and Ubuntu 24.04) | Configure, build, unit tests with CTest, install into `dist/`, pack the zip, `check-archive.py`, download the validators, pluginval at strictness 10 on the VST 3 bundle (under Xvfb on Linux), clap-validator on the CLAP file, upload the zip |
| `sanitize` (Ubuntu 24.04) | The unit tests built with AddressSanitizer and UndefinedBehaviorSanitizer (`-DPLUGIN_SANITIZE=ON`) |
| `release` (tags only) | Checks that the tag matches the version, attests every zip, and creates a draft release. See [release.md](release.md) |

The validators test the files in `dist/`, which are the files that go into the archive. pluginval 2 embeds the VST 3 SDK validator and runs it at strictness level 5 and above, so one run covers both.

The sanitizers cover the unit tests only. The plugin modules are not built with them, because clap-wrapper links the VST 3 module with `--no-undefined`, which the sanitizer runtimes do not satisfy. Windows has no UndefinedBehaviorSanitizer in MSVC, and the processing code is the same on both systems, so one Linux job is enough.

## Pinning and permissions

- Runner images are explicit (`windows-2022`, `ubuntu-24.04`). When `windows-latest` moved to a new image, a build that named a Visual Studio generator broke without any change in the repository.
- Every action is pinned to a full commit SHA with the version in a comment. `persist-credentials: false` on checkout. `permissions: contents: read` at the top, and the release job asks for its own `contents: write`, `id-token: write`, and `attestations: write`.
- The validators are downloaded at fixed versions and their SHA-256 is checked before they run (`fetch-validators.sh`). The Linux archive of clap-validator contains a tarball inside the zip; the script unpacks both.
- The Windows runner has `python` but not `python3`; the workflow picks the right name per system.

## Pin the workflow before the first listed release

Audio Plugin Soko-kun holds a new version for an administrator when its workflow files changed since the listed version (`diff-workflow-changed`), including action updates from Dependabot. Settle the workflow, its pins, and its permissions before the release you list first. Later workflow changes are fine, but each release that contains one waits for an administrator.

## Reported latency

pluginval's log prints `Reported latency: 0` in its plugin information even for a plugin that has latency. The value is read before the plugin is activated, and the VST 3 plugin from clap-wrapper reports the CLAP latency only after activation. Do not take that line as a failure.

The validators do not check that the reported latency matches the output. Check it in the unit tests of the processing (see [implementation.md](implementation.md)). To check the value that a host sees, a small test host can load the plugin, activate it, and read the CLAP `latency` extension, or `IAudioProcessor::getLatencySamples` for VST 3. Pass an `IHostApplication` context to the VST 3 plugin's `initialize`: the plugin from clap-wrapper crashed without one in one project.

## When a validator fails

- Read the validator's log first. pluginval writes per-test logs to the `--output-dir` folder; print or upload them.
- Reproduce locally with the same validator version, on the files in `dist/`.
- Common causes in published plugins: a refused activation at an odd sample rate, a missing `rescan` after loading state, and a crash in a library at an unsupported sample rate. See [implementation.md](implementation.md).
