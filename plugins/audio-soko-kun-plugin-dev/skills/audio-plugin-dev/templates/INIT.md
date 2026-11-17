# <Plugin name>: requirements

## Purpose

<What the plugin does for the user, in one or two sentences. Who uses it and in which situation.>

## Background

<Why this plugin: existing plugins with the same idea and what differs, libraries that do the hard part.>

## Specification

| Item | Value |
| --- | --- |
| Name | <display name> |
| Plugin ID | <com.example.name> (never changes after the first release) |
| Category | instrument / effect / analyzer / midi / utility |
| Formats | VST 3 and CLAP |
| Platforms | Windows x64, Linux x86_64 (macOS only with a Developer ID signature and notarization) |
| Channels | <stereo in, stereo out> |
| Latency | <0 samples, or the reported latency> |
| GUI | <none (the host's generic view) / own window: why> |
| License | <MIT> |

| Parameter | Range | Default | Unit | Description |
| --- | --- | --- | --- | --- |
| <name> | <min to max> | <default> | <unit> | <what it changes> |

## Dependencies

| Library | Version and pin | License | Bundled in the release | Why |
| --- | --- | --- | --- | --- |
| clap-wrapper | <tag and commit SHA> | MIT | yes (with CLAP, VST 3 SDK, {fmt}) | VST 3 from the CLAP plugin |

## Decisions

| Item | State | Decided by, when, on what evidence |
| --- | --- | --- |
| <item> | final / provisional / undecided | <...> |

## Checked facts

| Fact | Source |
| --- | --- |
| <fact> | <URL, file and line, or command and output> |

## Open questions

| Question | Recommended answer | Answer |
| --- | --- | --- |
| <question> | <recommendation and why> | |

## Checks that can change the plan

<Prototypes to run first, with what each one decides. For example: the library runs at every sample rate the VST 3 validator tries; the GUI opens under pluginval in CI.>

## Tests

| Behaviour | Test | Breaking change that must fail it |
| --- | --- | --- |
| <the main effect> | <input and expected output> | <what you break to see it fail> |

## Completion criteria

- CI passes on Windows and Linux: unit tests, check-archive.py, pluginval at strictness 10, clap-validator, sanitizers
- The author has used the plugin in a DAW
- The release is immutable and every file has a verified attestation
- Audio Plugin Soko-kun lists the release, `list_my_plugins` shows no blocker that waits for the author, and the author has seen the review findings
