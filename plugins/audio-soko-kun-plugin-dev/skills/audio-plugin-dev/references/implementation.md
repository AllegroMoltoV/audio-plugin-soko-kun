# Implementing the plugin

The template's `src/plugin.cpp` is a complete CLAP plugin written against the plain C API, and clap-wrapper builds the VST 3 plugin from it. Each item below is a failure that happened in a published plugin, with the fix that the template already contains or that you need to keep.

## Structure

- Keep the processing in its own file without CLAP (the template's `gain.h`). Unit tests call it directly, and the CLAP layer only moves parameters and buffers.
- Share parameter values between the main thread and the audio thread through `std::atomic`. Apply parameter events in `process()` and in `params.flush()`.
- In `process()`, do not allocate memory, take locks, wait, log, or call the operating system (`realtime-safety`). Allocate in `activate()`. If the GUI needs data from the audio thread, pass it through a lock-free single-producer single-consumer ring that the audio thread never waits on.
- Copy the input to the output first when the host gives separate buffers, then process in place.

## Sample rates and activation

Hosts and validators call `activate()` with any sample rate. The VST 3 SDK validator, which pluginval runs, activates at 22050, 32000, 44100, 48000, 88200, 96000, 192000, and 384000 Hz, and also at 1234.5678, 12345.678, 123456.78, and 1234567.8 Hz. A refused activation fails the validator. A library that aborts the process at an unsupported rate (one spatial audio library calls `LOG(FATAL)`) crashes the validator.

Accept every rate in `activate()`. If your processing cannot run at a rate, pass the input through, delayed by the same latency you report, and test this path at all twelve rates in a unit test.

## Latency

If the processing has latency, report it with the CLAP `latency` extension, and make the output start exactly that many samples late, so that the host's delay compensation lines it up. Test it with an impulse.

## Denormal numbers

Filters and reverb tails that decay toward zero produce denormal numbers, which are very slow on x86. clap-validator warns when processing denormals takes much longer than normal numbers. Set flush-to-zero and denormals-are-zero for the scope of `process()` and restore the host's setting afterwards (`DenormalGuard` in the template). The warning can still appear now and then for very cheap processing, because the timing of a few microseconds varies; it does not block a listing.

## Parameters

- Give every parameter a range, a default, and flags. Use `CLAP_PARAM_IS_STEPPED | CLAP_PARAM_IS_ENUM` for choices, and return the choice names from `value_to_text`.
- Smooth parameters that change the gain or a filter, so that automation does not click. Test the smoothing with a jump and check that the test fails when the smoothing is removed.

## State

- Save a magic number, the number of parameters, and the values. A later version that adds parameters can still read an older state, and an unknown magic number is refused.
- After loading a state, call the host's `params.rescan(CLAP_PARAM_RESCAN_VALUES)`. Without it, clap-validator's state reproducibility tests fail, because the host keeps showing the old values.

## Descriptor and factory

- The first feature in the descriptor is the main category (`CLAP_PLUGIN_FEATURE_AUDIO_EFFECT`, `INSTRUMENT`, `ANALYZER`, `NOTE_EFFECT`, or `UTILITY`). Declare the category in `.audio-soko-kun/config.json` too, because the VST 3 plugin from clap-wrapper does not carry it in a form the catalog can read.
- Return a `clap_plugin_factory_as_vst3` from the entry for `CLAP_PLUGIN_FACTORY_INFO_VST3`. Without it, clap-wrapper fills the VST 3 vendor e-mail with the placeholder `info@`.
- Keep the plugin ID unchanged across versions (`stable-plugin-id`).
- Export only `clap_entry` from the CLAP binary and the VST 3 entry points from the VST 3 binary. The template hides all other symbols. Never export a VST 2 entry point (`no-vst2`); `check-archive.py` checks it.

## Tests

- Test the behaviour a change could break: the main effect with known input and expected output, boundaries of each parameter, silence in and silence out, every block size from 1 sample up (the output must not depend on how the host splits blocks), latency, and the sample rates above.
- Compute limits from the specification, not from the implementation. A click test that divided by the implementation's fade length passed even when the fade was removed.
- Compare floating-point output with a tolerance that you measured, not exact equality, when a library's output varies in the last bit. Write down why.
- Break each guarded piece of code once and see the test fail.
