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
| Distribution | <A: free on GitHub, also sold or donated elsewhere / B: some features unlocked by payment> (C, paid files without public source, cannot be listed) |
| Paid features (`paidFeatures`) | <none / what is unlocked by payment> |
| Paid services (`paidServices`) | <none / names of paid services users subscribe to separately> |
| Restricted bundled assets (`restrictedAssets`) | <none / assets whose license restricts use, such as commercial use> |
| Support or purchase page (`supportUrl`) | <none / an https URL on booth.pm, gumroad.com, itch.io, patreon.com, ko-fi.com, or github.com/sponsors/<name>> |

| Parameter | Range | Default | Unit | Description |
| --- | --- | --- | --- | --- |
| <name> | <min to max> | <default> | <unit> | <what it changes> |

## Dependencies

| Library | Version and pin | License | Bundled in the release | Why |
| --- | --- | --- | --- | --- |
| clap-wrapper | <tag and commit SHA> | MIT | yes (with CLAP, VST 3 SDK, {fmt}) | VST 3 from the CLAP plugin |

| Bundled asset (impulse responses, HRTF data, models, samples, fonts, images) | Origin | License | Restricts use |
| --- | --- | --- | --- |
| <asset> | <URL or project> | <license> | <no / what is restricted> |

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
