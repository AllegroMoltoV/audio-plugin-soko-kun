# My Gain

A stereo gain plugin for DAWs. VST® 3 and CLAP formats for Windows x64 and Linux x86_64.

<!-- After the first release is listed, link the listing page here:
Listed on [Audio Plugin Soko-kun](https://audio-soko-kun.allegromoltov.jp/plugins/<owner>/<repository>?lang=en), which links only to releases that passed its checks. -->

## Features

| Parameter | Range | Default | Description |
| --- | --- | --- | --- |
| Gain | -60 to +12 dB | 0 dB | Level of the output. -60 dB is silence |

- The latency is 0 samples.
- Gain changes glide over about 20 ms, so automation does not click.
- The plugin does not use the network. It sends no audio or data anywhere.

## Requirements

- Windows 10 / 11 x64, or Linux x86_64
- A DAW that supports VST 3 or CLAP

The Linux build is checked in CI with pluginval and clap-validator. It has not been tested in a Linux DAW.

## Install

1. Close your DAW.
2. Download the zip for your system from [GitHub Releases](https://github.com/your-account/my-gain-audio/releases) and extract it: `my-gain-<version>-windows-x64.zip` or `my-gain-<version>-linux-x86_64.zip`.
3. On Windows, copy the folder `VST3\My Gain.vst3` to `%LOCALAPPDATA%\Programs\Common\VST3\` (only you) or `C:\Program Files\Common Files\VST3\` (all users, needs administrator).
4. On Windows, for CLAP hosts, copy `CLAP\My Gain.clap` to `%LOCALAPPDATA%\Programs\Common\CLAP\` or `C:\Program Files\Common Files\CLAP\`.
5. On Linux, copy the folder `VST3/My Gain.vst3` to `~/.vst3/` and `CLAP/My Gain.clap` to `~/.clap/`.
6. Start your DAW and rescan plug-ins if needed.

There is no installer.

## Verify the download

Each release file has a build provenance attestation from GitHub Actions. Check it with the GitHub CLI:

```sh
gh attestation verify my-gain-<version>-<system>.zip --repo your-account/my-gain-audio
```

Releases are immutable: their files cannot be replaced after publication.

## Build

CMake 3.21 or later and a C++17 compiler. Windows uses Visual Studio 2022 or later; Linux uses GCC.

```sh
# Windows
cmake -B build -A x64
# Linux
cmake -B build -DCMAKE_BUILD_TYPE=Release

cmake --build build --config Release
ctest --test-dir build -C Release
```

## License

MIT License. See [LICENSE](LICENSE).

The archives contain these third-party components. Their license texts are in `THIRD_PARTY_LICENSES` in each zip.

| Component | Use | License |
| --- | --- | --- |
| CLAP | The CLAP format | MIT |
| clap-wrapper | Builds the VST 3 plugin from the CLAP plugin | MIT |
| {fmt} | Used by clap-wrapper | MIT |
| VST 3 SDK | The VST 3 format | MIT |

VST is a registered trademark of Steinberg Media Technologies GmbH.

## AI disclosure

The source code, workflow, and documentation of this plugin were written with Anthropic Claude Code. The author decided the requirements and approved each external operation.

## Changelog

### 1.0.0

- First release.
