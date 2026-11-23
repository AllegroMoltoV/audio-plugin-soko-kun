// 固定ページの英語版。利用規約とプライバシーポリシーを除き、この版が正。
import type { PageContent, PageKey } from '../content';

export const en: Record<PageKey, PageContent> = {
  about: {
    title: 'What is Audio Plugin Soko-kun?',
    sections: [
      {
        heading: 'What this service is',
        paragraphs: [
          'Audio Plugin Soko-kun is an independent, open registry of open-source audio plugins. It is an unofficial service that is not affiliated with the developers of plugin formats or DAWs.',
          { formats: 'Supported formats' },
          'The registry does not host files. It records information from public GitHub repositories and links to the zip archives that authors publish in GitHub Releases.',
          'Download files directly from GitHub, because this platform does not host them.',
          'Files listed here are always free to download from the public GitHub releases. Some authors also sell their plugins or accept donations elsewhere. Paid features, paid services, restricted bundled assets, and support links on a plugin page are declared by the author, and this platform does not verify them. The listing policy explains which ways of distribution can be listed: {{ORIGIN}}/policy',
        ],
      },
      {
        heading: 'Use from AI agents (MCP)',
        paragraphs: [
          'Connect an MCP client to the endpoint /mcp on this site. In Claude Code, run:',
          { code: 'claude mcp add --transport http audio-plugin-soko-kun {{ORIGIN}}/mcp' },
          'In Codex, run:',
          { code: 'codex mcp add audio-plugin-soko-kun --url {{ORIGIN}}/mcp' },
          'Searching and viewing details work without signing in to GitHub. To submit a repository, sign in with GitHub from the MCP client (in Claude Code, run /mcp; in Codex, run codex mcp login audio-plugin-soko-kun). This platform itself never gets write access to your GitHub repositories.',
          'Example requests: "Find a pitch shift plugin that works on Windows", "Find a CLAP reverb for Apple Silicon Macs", "Register the audio plugin in this GitHub repository", "Check whether my plugin\'s new release is listed".',
        ],
      },
      {
        heading: 'Supporting development',
        paragraphs: [
          'Audio Plugin Soko-kun is free to use. If you would like to help with its running costs and development, you can sponsor the developer on GitHub Sponsors: https://github.com/sponsors/AllegroMoltoV',
          'Sponsoring is optional. It has no effect on how plugins are listed or checked.',
        ],
      },
    ],
  },
  policy: {
    title: 'Listing policy',
    sections: [
      {
        heading: 'Listing conditions',
        paragraphs: [
          { important: true },
          'This platform lists open-source audio plugins that the author, who administers the GitHub repository, submits and that meet all of the following conditions.',
          { formats: 'Supported formats' },
          {
            list: [
              'The repository is public on GitHub and is not archived.',
              'The license that GitHub detects at the release tag is approved by the OSI or recognized as free by the FSF, according to the SPDX License List.',
              'The release is an immutable release. Turn on immutable releases in the repository settings before you publish it.',
              'Every file in the release, including installers, has a build provenance attestation created by the release workflow of the repository, for example with actions/attest-build-provenance.',
              'The plugins are distributed as zip archives. This platform guides users only to zip archives that contain VST 3, CLAP, LV2, or Audio Unit bundles. It does not guide users to installers such as exe, msi, or pkg files.',
              'No archive contains VST 2. If any archive in a release contains a VST 2 bundle or entry point, this platform does not list the release.',
              'macOS bundles are signed with a Developer ID certificate and notarized by Apple. This platform does not guide users to archives whose macOS bundles fail this check. LV2 bundles for macOS are not guided, because Gatekeeper does not assess LV2 bundles.',
              'The release passes the other automated checks described on the Security page, including the lookup in a database of known malware.',
            ],
          },
          'The license check relies on the license that GitHub detects for the repository. This platform does not guarantee the licenses of bundled materials such as samples, presets, or fonts.',
          'Some authors also sell their plugins or accept payments for them. Whether a plugin can be listed depends on how its files are distributed:',
          {
            list: [
              'A. The same files are free on GitHub and are also sold or offered for donations elsewhere: the plugin can be listed.',
              'B. Some features are unlocked by payment: the plugin can be listed if the author declares paidFeatures in .audio-soko-kun/config.json.',
              'C. Only paid files are distributed, without public source code: the plugin is not listed, because users cannot check the contents before buying.',
            ],
          },
        ],
      },
      {
        heading: 'What a listing means',
        paragraphs: [
          'Whether AI was used to develop a plugin does not affect listing. The same conditions apply to every plugin. Disclosing the use of AI is not required.',
          'This platform does not certify safety or quality by listing a plugin, so check plugins yourself before using them.',
          'Listed files are always free to download from the public GitHub releases. Paid features, paid services, restricted bundled assets, and support links shown on a plugin page are declared by the author in .audio-soko-kun/config.json. This platform does not verify these declarations.',
        ],
      },
      {
        heading: 'Licenses for audio plugins',
        paragraphs: [
          'This short guide helps authors choose a license. It is not legal advice, and this platform gives no legal guarantee.',
          {
            list: [
              'The VST 3 SDK and the CLAP SDK are available under the MIT license, so they leave the choice of your plugin license to you.',
              'JUCE is available under the AGPLv3 or a commercial license. A plugin built with JUCE without a commercial license must be released under the AGPLv3.',
              'List each bundled asset, such as impulse responses, HRTF data, models, samples, fonts, and images, with its origin and license in the README or NOTICE.',
              'If a bundled asset restricts commercial use or has other usage restrictions, declare restrictedAssets as true in .audio-soko-kun/config.json.',
            ],
          },
        ],
      },
    ],
  },
  submit: {
    title: 'Submit a plugin',
    sections: [
      {
        heading: 'Plugins you can submit',
        paragraphs: [
          { important: true },
          'This platform lists open-source audio plugins whose author administers the GitHub repository and submits it.',
          { formats: 'Supported formats' },
          'Before submitting, check that the repository and its latest release meet the listing conditions: {{ORIGIN}}/policy',
          'This platform determines the formats, OS, architectures, and category of a plugin from the bundles in its zip archives. You do not need to enter them.',
          'Do not include the word VST in the name of your plugin or repository. The VST 3 SDK does not allow VST in product names, and the review reports such a name as a recommendation.',
        ],
      },
      {
        heading: 'Build your plugin with Claude Code',
        paragraphs: [
          'If you build your plugin with Claude Code, you can install a skill that collects what the developer of this platform learned from making six audio plugins. It covers planning, a project template that builds CLAP and VST 3 from the same code with clap-wrapper, validation with pluginval and clap-validator in CI, testing a GUI without a display, releases with build provenance attestations, and listing on this platform.',
          'Install it by running the following in a terminal:',
          {
            code: 'claude plugin marketplace add AllegroMoltoV/audio-plugin-soko-kun\nclaude plugin install audio-soko-kun-plugin-dev@audio-plugin-soko-kun',
          },
          'The plugin also connects Claude Code to the MCP server of this platform. The skill follows the listing conditions and the review criteria of this platform: https://github.com/AllegroMoltoV/audio-plugin-soko-kun/blob/main/docs/design/review-criteria.md',
        ],
      },
      {
        heading: 'Check your repository before a release',
        paragraphs: [
          'Before you publish a release, ask your AI agent to run submit_plugin in check mode. It checks the listing conditions on the latest release and reviews the latest commit of the default branch. It does not register the plugin. You can use check mode up to 5 times in 24 hours. Check mode also requires signing in with GitHub. Before the first release, check mode still returns the conditions that need a release as unchecked, with how to meet them, and checks the shape of .audio-soko-kun/config.json on the default branch. A listed release must be an immutable release, and files cannot be added to it after it is published: attach all files to a draft release first, then publish it. The rules that look for instructions to turn off a security feature or to run a downloaded command also match sentences that tell users not to do it.',
          'The review follows the review criteria, which are public on GitHub: https://github.com/AllegroMoltoV/audio-plugin-soko-kun/blob/main/docs/design/review-criteria.md',
          'Check mode does not inspect the archives or the macOS signatures, because those checks download the files in GitHub Actions after registration. The agent shows what these checks require.',
        ],
      },
      {
        heading: 'How to submit',
        paragraphs: [
          'Connect your MCP client to {{ORIGIN}}/mcp. In Claude Code, run:',
          { code: 'claude mcp add --transport http audio-plugin-soko-kun {{ORIGIN}}/mcp' },
          'Sign in with your GitHub account from the MCP client. In Claude Code, run /mcp and choose audio-plugin-soko-kun. In Codex, connect with codex mcp add audio-plugin-soko-kun --url {{ORIGIN}}/mcp, then sign in with codex mcp login audio-plugin-soko-kun. This platform itself never gets write access to your GitHub repositories.',
          'Ask the AI agent to submit your repository, for example: "Register the audio plugin in https://github.com/<owner>/<repository>".',
        ],
      },
      {
        heading: 'After submitting',
        paragraphs: [
          'This platform registers the plugin as waiting for checks. Until a release passes the checks, the plugin does not appear in search or on its own page.',
          'Checks run every 15 minutes and usually finish within a few hours.',
          'This platform lists only releases that pass the checks. When you publish a new release on GitHub, this platform picks it up and checks it automatically. You do not need to submit it again.',
          'To see the results, ask your AI agent to check your plugin with list_my_plugins, for example: "Check whether my plugin\'s new release is listed". The agent shows the state of each release, the reasons a release or a file is not listed, the review findings, and how to fix them.',
          'Some releases wait for an administrator to confirm them. To explain the changes in such a release, open an issue in the repository of this platform: https://github.com/AllegroMoltoV/audio-plugin-soko-kun/issues',
        ],
      },
      {
        heading: 'When a submission is refused',
        paragraphs: [
          'The AI agent shows the reason code and how to fix it. Fix the cause and submit again.',
          {
            list: [
              'not_admin: You do not have admin permission on the repository. Ask an administrator of the repository to submit it.',
              'private_repository, archived_repository: Make the repository public, or unarchive it.',
              'no_license: Put a LICENSE file with an open source license at the root of the repository, then publish a new release.',
              'license_unrecognized: GitHub cannot identify the license. Keep only the standard license text in LICENSE, move other notices to NOTICE or README, then publish a new release.',
              'license_not_open: License the plugin under a license approved by the OSI or recognized as free by the FSF, then publish a new release.',
              'no_release, no_verifiable_asset: Publish a release with the plugin files attached (up to 30 files).',
              'no_archive: Attach the plugin bundles to the release as zip archives.',
              'not_immutable: Turn on immutable releases in the repository settings, then publish a new release.',
              'no_attestation: Add actions/attest-build-provenance to the release workflow so that every file, including installers, has an attestation, then publish a new release.',
              'duplicate: The repository is already registered. Open its page from the search.',
              'name_reserved: A listed plugin used this repository name before it was renamed. Rename the repository to a name that no listed plugin has used.',
              'rate_limited: You can submit up to 10 times in 24 hours. Try again later.',
              'invalid_url: Give the repository URL in the form https://github.com/<owner>/<repository>.',
              'not_found: The repository was not found. Check the URL and that the repository is public.',
              'unsupported_tag: Use a release tag with only letters, digits, ".", "-", and "_", up to 100 characters.',
              'github_unavailable: GitHub did not respond normally. Try again later.',
            ],
          },
        ],
      },
      {
        heading: 'When a release or a file is not listed',
        paragraphs: [
          'list_my_plugins shows why a release or a file is not listed. The main reasons that the author fixes are the following.',
          {
            list: [
              'vst2_detected: An archive contains a VST 2 bundle or entry point. Remove VST 2 from every archive, then publish a new release.',
              'no_plugin_detected, no_plugin_in_archive: No supported plugin bundle was found in the archives. Put the built bundles in the zip archives. Source code archives need no change.',
              'content_undetermined: An archive contains items that cannot be inspected, such as installers, nested archives, unsafe paths, links that leave the bundle, duplicate names, or folder entries that carry data. Put the plugin bundles directly in the zip archive and remove these items.',
              'macos_not_signed, macos_adhoc, macos_not_developer_id, macos_not_notarized: Sign the macOS bundles with a Developer ID certificate and notarize them with Apple.',
              'declaration_mismatch, not_declared: The declarations in .audio-soko-kun/config.json and the inspected archives disagree. Fix the declarations, then publish a new release.',
              'installer_not_guided: Installers are not guided. Users get the plugins from the zip archives.',
              'macos_lv2_not_guided: An archive contains only LV2 bundles for macOS, which are not guided. Add VST 3, CLAP, or Audio Unit bundles for macOS, signed with a Developer ID certificate and notarized.',
            ],
          },
        ],
      },
      {
        heading: 'Logo and description image',
        paragraphs: [
          'Authors can show one logo and one description image. Place the images in the .audio-soko-kun folder of the repository.',
          { code: '.audio-soko-kun/logo.png\n.audio-soko-kun/image.gif' },
          {
            list: [
              'Logo: name the file logo. Keep it within 256 KB and 1,024 px on each side.',
              'Description image: name the file image. Keep it within 1.5 MB and 4,096 px on each side. GIF images play as animations.',
            ],
          },
          'This platform does not accept SVG, which can contain scripts, so use the extension png, jpg, jpeg, gif, or webp.',
          'This platform takes the images at the tag of the latest release, so publish a new release after you change an image.',
          'This platform does not show images that do not meet these conditions, so check the conditions if an image does not appear.',
        ],
      },
      {
        heading: '.audio-soko-kun/config.json',
        paragraphs: [
          'Authors can declare the display name, the category, and the OS, architectures, and formats of each archive in .audio-soko-kun/config.json. Place the file in the same .audio-soko-kun folder as the images.',
          {
            code: '{\n  "name": "Simple Pitch Shift",\n  "category": "effect",\n  "assets": [\n    {\n      "pattern": "simple-pitchshift-*-windows-x64.zip",\n      "os": "windows",\n      "arch": ["x86_64"],\n      "formats": ["vst3", "clap"]\n    }\n  ]\n}',
          },
          {
            list: [
              'name: The display name, from 1 to 60 characters. Without it, this platform shows the repository name.',
              'category: One of instrument, effect, analyzer, midi, and utility. This platform uses it only when it cannot infer the category from the bundles.',
              'assets: Up to 20 declarations of archives. pattern matches the archive name, where * matches any text. os is one of windows, macos, and linux. arch is an array of x86_64, x86, and arm64. formats is an array of vst3, clap, lv2, and au.',
            ],
          },
          'All fields are optional. This platform takes the formats, OS, and architectures from the inspected bundles, and uses the declarations only to check them and to choose the archives to guide.',
          'With assets, this platform guides users only to the archives that match a pattern. It does not list a release whose file is invalid, whose archives match no pattern, or whose inspected archives disagree with the declarations.',
          'This platform reads the file at the tag of each new release, so publish a new release after you change the file.',
          'The smallest valid file declares only the display name:',
          { code: '{\n  "name": "Simple Pitch Shift"\n}' },
          'This platform decides the category in this order. First, it infers the category from the inspected bundles: the type of Audio Unit components (aumu, aufx, aumf, aumi) and the Sub Categories in moduleinfo.json of VST 3 bundles. When the bundles point to several categories, instrument, midi, analyzer, and effect take precedence in this order. If nothing can be inferred, it uses category in this file, and otherwise utility. An inferred category takes precedence over the declared one.',
          'CLAP features are not used for the category, because this platform does not run plugin binaries. VST 3 bundles without moduleinfo.json, such as those built with clap-wrapper, also give no hint. For a CLAP-only plugin, declare category in this file.',
          'Authors can also declare four optional items about payment and bundled assets:',
          {
            code: '{\n  "name": "Simple Pitch Shift",\n  "paidFeatures": false,\n  "paidServices": ["Example Cloud"],\n  "restrictedAssets": true,\n  "supportUrl": "https://example.booth.pm/items/1"\n}',
          },
          {
            list: [
              'paidFeatures: true if some features are unlocked by paying the author, and otherwise false.',
              'paidServices: An array of up to 5 names, each up to 60 characters, of paid services that users contract separately. [] declares that there are none.',
              'restrictedAssets: true if a bundled asset has usage restrictions, such as no commercial use, and otherwise false.',
              'supportUrl: A support or purchase page, up to 300 characters. Only https URLs on booth.pm, gumroad.com, itch.io, patreon.com, ko-fi.com, or their subdomains, and https://github.com/sponsors/<name> are accepted.',
            ],
          },
          'This platform shows these items on the plugin page as declarations by the author, and does not verify them. An item that is not written is shown as not declared by the author. A wrong value only makes that item not declared, and does not stop the listing. list_my_plugins shows which items were treated as not declared.',
          'Write supportUrl and any other external link, such as a shop, a support page, or the license page of an asset, from the first release. If a supportUrl or another external link is added after the first listed version, that version waits for an administrator to confirm it (diff-external-link). Put shop links in supportUrl.',
          'The obligation "Do not list false information" in the terms of use also covers these declarations: {{ORIGIN}}/terms',
        ],
      },
      {
        heading: 'Updating and withdrawing',
        paragraphs: [
          'To update a listing, publish a new release on GitHub. This platform picks it up automatically and lists it after it passes the checks. This platform also updates the summary from the repository description.',
          'If a new release is not listed, ask your AI agent to check it with list_my_plugins. The agent shows the reason and how to fix it.',
          'To withdraw a listing, make the repository private or delete it, or send a request as described on the Report page.',
        ],
      },
      {
        heading: 'Protecting your releases',
        paragraphs: [
          'Tag each release on a commit of the default branch. A release whose tag points to a commit that is not on the default branch waits for an administrator to confirm it.',
          'Anyone with write access to the repository can create a release. This platform recommends protecting the default branch with a ruleset that blocks deletion and force pushes and requires a pull request with at least one approval, and protecting release tags with a tag ruleset that lets only repository admins create, update, or delete them. These settings are not listing conditions. If you develop alone, add the Repository admin role to the bypass list of the branch ruleset with "For pull requests only", so that you can merge your own pull request while force pushes and deletion stay blocked. Do not use "Always allow", which also allows force pushes and deletion.',
        ],
      },
      {
        id: 'rename',
        heading: 'Renaming or transferring the repository',
        paragraphs: [
          'This platform follows the repository by its GitHub ID, so you do not need to do anything when you rename the repository. The listing moves to the new name within 15 minutes, and links to the old name redirect to the new one.',
          'Do not create another repository with the old name. This platform keeps the old name for the renamed plugin and does not register another repository under it.',
          'If you transfer the repository to another account or organization, the listed release stays listed, and an administrator reviews the next release before listing it.',
          'To change the display name, change name in .audio-soko-kun/config.json and publish a new release.',
        ],
      },
    ],
  },
  security: {
    title: 'Security and disclaimer',
    sections: [
      {
        heading: 'Automated checks',
        paragraphs: [
          'This platform checks every new release before listing it. It lists only releases that pass the checks.',
          { formats: 'Formats inspected' },
          {
            list: [
              'Provenance: Every file must have a build provenance attestation. A GitHub Actions workflow verifies its signature. The workflow also confirms that the attestation matches the repository, the release tag, the commit of the tag, and the release workflow recorded for the plugin.',
              'Immutable release: The release must be immutable. Files in an immutable release cannot be replaced after it is published.',
              'Archive inspection: A GitHub Actions workflow downloads each zip archive and reads the plugin bundles in it without running them. The formats, OS, and architectures shown here come from this inspection. A release that contains VST 2 in any archive, or an archive that cannot be inspected, is not listed.',
              'macOS signing and notarization: An archive with macOS bundles is guided only after its bundles are confirmed to be signed with a Developer ID certificate and notarized by Apple.',
              'Malware lookup: The SHA-256 digest of each file, as published by GitHub, is looked up in MalwareBazaar, a database of known malware samples. Listed files are looked up again regularly.',
              'Changes since the listed release: The changes from the listed release to the new release are checked against rules. A release that matches a rule waits for an administrator to confirm it.',
              'Development practice review: Items that the repository files decide, such as pinned actions, release workflows, and install instructions in the README, are checked by rules. Only the items that need reading text, such as how the README explains the data the plugin sends, are judged by an LLM, with facts computed by the catalog. Instructions that turn off a security feature or run a downloaded command are checked in the README, the release notes, and the other documents in the repository, including edits to the release notes after listing. After listing, the README on the default branch is also checked once a day; if a new instruction appears, no version of the plugin is listed until an administrator confirms it. The source code is only searched as text for network API calls and for these instructions. It is never built or run. A release with a serious finding waits for an administrator to confirm it.',
            ],
          },
          'The review criteria are public on GitHub: https://github.com/AllegroMoltoV/audio-plugin-soko-kun/blob/main/docs/design/review-criteria.md',
          'Releases that have not passed the checks are not shown. Until a new release passes, the previously listed release stays listed.',
          'A file reported as malicious suspends the plugin. An administrator can also suspend a release.',
          'Suspended releases are announced on the notices page {{ORIGIN}}/notices with the version, the SHA-256 of each file, and the period they were listed here. The plugin page also shows a warning.',
        ],
      },
      {
        heading: 'Limits of the checks',
        paragraphs: [
          'The malware lookup detects only threats already known to MalwareBazaar. New or targeted malware may not be detected, so use plugins carefully even when nothing is detected.',
          'A Developer ID signature and notarization show who signed a macOS bundle and that Apple scanned it. They are not evidence that the plugin is safe.',
          'The archive inspection identifies formats from the structure of the bundles and the functions they export. It cannot tell whether a plugin that implements the VST 3 interface was built with the VST 3 SDK.',
          'The digest identifies the file that GitHub served when it was recorded. Compare the SHA-256 of the file you download with the value shown here.',
        ],
      },
      {
        heading: 'Disclaimer',
        paragraphs: [
          'This platform is provided as is, without warranty of any kind, so install plugins at your own risk. The authors of each plugin are responsible for their software.',
        ],
      },
    ],
  },
  report: {
    title: 'Report',
    sections: [
      {
        heading: 'Public reports',
        paragraphs: [
          'Report incorrect information or policy issues as an issue in the GitHub repository: https://github.com/AllegroMoltoV/audio-plugin-soko-kun/issues',
          'Report wrong declarations by authors, such as paid features, paid services, restricted assets, or support links, in the same way.',
        ],
      },
      {
        heading: 'Private reports',
        paragraphs: [
          'Report suspected malware or security problems privately through GitHub private vulnerability reporting: https://github.com/AllegroMoltoV/audio-plugin-soko-kun/security/advisories/new',
          'Reports are reviewed by a person. A report alone does not suspend a listing. When a clear danger is confirmed, the listing is suspended and stays suspended even if the repository changes.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: ['Send other inquiries to the developer contact shown by the button below.', { contact: true }],
      },
    ],
  },
  terms: {
    title: 'Terms of use',
    sections: [
      {
        heading: 'Scope',
        paragraphs: [
          'Established: November 15, 2026',
          'These terms apply to everyone who uses the website and the MCP endpoint of Audio Plugin Soko-kun (this platform), so use this platform only after agreeing to these terms.',
          'The Japanese version of these terms is authoritative, and other language versions are reference translations.',
        ],
      },
      {
        heading: 'What this platform provides',
        paragraphs: [
          'This platform collects information about audio plugins from GitHub, lists it, and guides users to files that authors published on GitHub.',
          'This platform does not host files and does not guarantee the safety, quality, or behavior of plugins, so check plugins yourself before using them.',
        ],
      },
      {
        heading: 'Obligations of authors who submit plugins',
        paragraphs: [
          'Authors who submit plugins must follow these rules.',
          {
            list: [
              'Submit only repositories that you administer.',
              'Do not list false information.',
              'Do not distribute malware or programs that harm users.',
              'Do not infringe the rights of others.',
            ],
          },
        ],
      },
      {
        heading: 'Prohibited acts',
        paragraphs: [
          'Do not do any of the following.',
          {
            list: [
              'Disrupt the operation of this platform with mass submissions or requests.',
              'Access the platform without authorization or exploit vulnerabilities.',
              'Interfere with other users or the operator.',
              'Violate laws or regulations.',
            ],
          },
        ],
      },
      {
        heading: 'Suspension and removal of listings',
        paragraphs: [
          'The operator may suspend or remove a listing without prior notice when the operator confirms a violation of these terms or a danger to users.',
        ],
      },
      {
        heading: 'Disclaimer',
        paragraphs: [
          'The operator is not liable for damages arising from the use of this platform or the installation of plugins, except in cases of the operator’s intent or gross negligence.',
          'The operator may change the contents of this platform, or suspend or end it, without notice.',
        ],
      },
      {
        heading: 'Changes to these terms',
        paragraphs: [
          'The operator changes these terms as needed and posts the changed terms and their effective date on this page, so check this page regularly.',
        ],
      },
      {
        heading: 'Governing law and jurisdiction',
        paragraphs: [
          'These terms are governed by the laws of Japan.',
          'The district court having jurisdiction over the operator’s address is the exclusive court of first instance for disputes about these terms or this platform.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [
          'Send questions about these terms to the developer contact shown by the button below.',
          { contact: true },
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    sections: [
      {
        heading: 'Privacy policy',
        paragraphs: [
          'The Japanese version of this privacy policy is authoritative, and other language versions are reference translations.',
        ],
      },
      {
        heading: 'What is stored',
        paragraphs: [
          'When you sign in to submit a plugin, the service stores your GitHub user ID and login name, and the GitHub access token needed to check your repository permissions, together with the refresh token used to renew it. The tokens are stored encrypted and are used only to check permissions on the repositories you submit.',
          'To limit abuse, the service stores a one-way hash of your IP address for a short time. Browsing the catalog does not require cookies, except one that remembers your language choice.',
        ],
      },
      {
        heading: 'Your choices',
        paragraphs: [
          'You can revoke access at any time in GitHub settings under Applications. To ask for deletion of your data, open a private report as described on the Report page.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: ['Send other inquiries to the developer contact shown by the button below.', { contact: true }],
      },
    ],
  },
};
