# Planning the plugin

## Write the requirements first

Start from [../templates/INIT.md](../templates/INIT.md) and write the requirements to a file in the repository, for example `.prompts/INIT.md`. Ask the author only what you cannot find out yourself. Before asking, look up what can be checked: existing plugins with the same idea, libraries that do the hard part, their licenses, and the listing conditions.

Separate decisions into final, provisional, and undecided. For a provisional or undecided item, write who decides it, when, and on what evidence. Put a recommended answer next to every open question, so that the author can answer with a word.

## Put the checks that can change the plan first

Some facts decide the rest of the plan. Check them before writing the plugin:

- Does the library you want to use work at every sample rate a host can use? Some libraries abort the process on a rate they cannot handle, and the VST 3 validator tries rates such as 1234.5678 Hz (see [implementation.md](implementation.md)).
- Does the GUI library open a window on a CI runner without a GPU? See [gui.md](gui.md).
- Does the processing fit in real time? Measure the CPU time per block at the highest sample rate you support.

Keep these checks small: a prototype that answers one question, then a decision with the author.

## Do not reinvent

For anything beyond simple processing (pitch shifting, spatial audio, convolution, FFT), look for a maintained open-source library first. Check:

- The license allows bundling in your plugin's license. GPL code makes the whole plugin GPL. For an MIT plugin, use MIT, BSD, Apache-2.0, zlib, ISC, or MPL-2.0 (unmodified) code. JUCE is AGPL or commercial.
- The library is pinned by commit or release hash in the build (`dependency-pinning`), and its license text goes into the release archive (`license-notices`).
- Every file the library embeds into your binary has a compatible license too. A GUI library may embed fonts and icons with their own licenses (see [gui.md](gui.md)).
- Bundled assets (impulse responses, HRTF data, models, samples, fonts, images) have their own licenses. Record the origin and license of each one in the requirements file. If any license restricts use, such as commercial use, the plugin declares `"restrictedAssets": true`, and the README or a NOTICE file describes the restriction (see [audio-soko-kun.md](audio-soko-kun.md)).
- Decide with the author how the plugin is distributed. The files are always free on GitHub. Selling the same files elsewhere or taking donations is fine; features unlocked by payment must be declared as `paidFeatures`; a paid plugin without public source cannot be listed.

## Choose the name and the ID

- Search GitHub, Audio Plugin Soko-kun (`search_plugins`), and the web for the name. Avoid names of commercial products and trademarks (`plugin-name`, `no-impersonation`). Do not put "VST" in the plugin's name; "VST" is a trademark of Steinberg.
- Choose the plugin ID, a reverse-domain string such as `com.example.my-gain`. It must never change after the first release, because hosts and saved projects find the plugin by it, and clap-wrapper derives the VST 3 class ID from it (`stable-plugin-id`).
- Choose the category for the listing: `instrument`, `effect`, `analyzer`, `midi`, or `utility`.

## Platforms

The template builds for Windows x64 and Linux x86_64. macOS needs a Developer ID signature and notarization from Apple for a listing (`macos-signing`), which needs a paid Apple Developer account. If the author has no such account, leave macOS out and state it in the README. Do not tell users how to get around Gatekeeper; that is a serious finding (`no-security-bypass`).

## Completion criteria to write down

- The parameters with ranges, defaults, and units
- The platforms and formats
- The tests that guard the behaviour, including at least one scenario test of the main feature
- The listing on Audio Plugin Soko-kun, with no blocker that waits for the author
