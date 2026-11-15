// 審査の基準の固定の文言。正本は docs/design/review-criteria.md で、ID・判定の方法・重大とする場合の一致をテストで確かめる。
// 作者の LLM に返す文言は英語に固定する。title・fix・viewpoint は本サービスが書き、LLM には書かせない。
export type CriterionKind = 'condition' | 'takeover' | 'criterion' | 'recommendation';
// future は、正本で「判定しない」と「ルール (将来)」の項目。判定せず、作者にも返さない。
export type JudgedBy = 'rule' | 'llm' | 'future';

export interface Criterion {
  id: string;
  kind: CriterionKind;
  judgedBy: JudgedBy;
  title: string;
  // LLM に渡す判定の観点。LLM が判定する項目だけが持つ。ルールで判定する項目の基準は src/review/rules.ts にある。
  viewpoint?: string;
  // 重大とする場合。審査の基準のうち、重大な指摘を管理者の確認待ちにする項目だけが持つ。
  serious?: string;
  fix: string;
}

const DOC = 'https://github.com/AllegroMoltoV/audio-plugin-soko-kun/blob/main/docs/design/review-criteria.md';

export function referenceOf(id: string): string {
  return `${DOC}#${id}`;
}

const ADMIN_REVIEWS = 'No action is needed if the change is intended. An administrator reviews it before listing.';

export const CRITERIA: Criterion[] = [
  {
    id: 'immutable-release',
    kind: 'condition',
    judgedBy: 'rule',
    title: 'The release is immutable',
    fix: 'Enable immutable releases in the repository settings (Settings > General > Releases), then publish a new release.',
  },
  {
    id: 'distribution-format',
    kind: 'condition',
    judgedBy: 'rule',
    title: 'The plugin is distributed as zip archives',
    fix: 'Attach the plugin bundles to the release as zip archives, then publish a new release. Installers (exe, msi, pkg, dmg) and other files are not guided to users.',
  },
  {
    id: 'attestation',
    kind: 'condition',
    judgedBy: 'rule',
    title: 'Every release file has a build provenance attestation',
    fix: 'Add actions/attest-build-provenance to the job that creates the release, with subject-checksums covering every release file, and grant id-token: write and attestations: write. Then publish a new release.',
  },
  {
    id: 'plugin-content',
    kind: 'condition',
    judgedBy: 'rule',
    title: 'A zip archive contains a VST 3, CLAP, LV2, or Audio Unit bundle',
    fix: 'Put the built plugin bundles in the zip archives, then publish a new release.',
  },
  {
    id: 'no-vst2',
    kind: 'condition',
    judgedBy: 'rule',
    title: 'No release file contains a VST 2 plugin',
    fix: 'Remove the VST 2 build from every release file, then publish a new release.',
  },
  {
    id: 'macos-signing',
    kind: 'condition',
    judgedBy: 'rule',
    title: 'macOS bundles are signed with a Developer ID and notarized',
    fix: 'Sign the macOS bundles with a Developer ID certificate and notarize them, then publish a new release. macOS files without notarization are not guided to users. LV2 bundles for macOS are not guided because Gatekeeper does not assess them.',
  },
  {
    id: 'declaration',
    kind: 'condition',
    judgedBy: 'rule',
    title: 'The declaration file, if present, is valid and matches the inspected contents',
    fix: 'Correct .audio-soko-kun/config.json so that it matches the zip archives, or remove it, then publish a new release.',
  },
  {
    id: 'open-source-license',
    kind: 'condition',
    judgedBy: 'rule',
    title: 'The license at the release tag is OSI approved or FSF free',
    fix: 'Put a LICENSE file with an OSI approved or FSF free license at the root of the repository, then publish a new release.',
  },
  {
    id: 'diff-workflow-changed',
    kind: 'takeover',
    judgedBy: 'rule',
    title: 'A workflow changed since the listed version',
    fix: ADMIN_REVIEWS,
  },
  {
    id: 'diff-binary-added',
    kind: 'takeover',
    judgedBy: 'rule',
    title: 'A binary file was added or changed since the listed version',
    fix: ADMIN_REVIEWS,
  },
  {
    id: 'diff-external-link',
    kind: 'takeover',
    judgedBy: 'rule',
    title: 'A link or download to another host was added since the listed version',
    fix: ADMIN_REVIEWS,
  },
  {
    id: 'diff-too-large',
    kind: 'takeover',
    judgedBy: 'rule',
    title:
      'The change since the listed version is too large to read in full, and its file list shows changes under .github/, build scripts, or binaries, or could not be read in full',
    fix: `${ADMIN_REVIEWS} Large changes that do not touch .github/, build scripts, or binaries are checked automatically.`,
  },
  {
    id: 'tag-not-on-default-branch',
    kind: 'takeover',
    judgedBy: 'rule',
    title: 'The release tag points to a commit that is not on the default branch',
    fix: 'No action is needed if this is intended, for example a release branch. An administrator reviews it before listing. Tag releases on the default branch to have them checked automatically.',
  },
  {
    id: 'owner-changed',
    kind: 'takeover',
    judgedBy: 'rule',
    title: 'The repository owner changed since the plugin was registered',
    fix: 'No action is needed if the transfer is intended. An administrator reviews the next release before listing.',
  },
  {
    id: 'team-id-mismatch',
    kind: 'takeover',
    judgedBy: 'rule',
    title: 'The macOS bundles of the version are signed with different Team IDs',
    fix: ADMIN_REVIEWS,
  },
  {
    id: 'ci-source-build',
    kind: 'criterion',
    judgedBy: 'future',
    title: 'Release files are built from source in CI',
    fix: 'Build the release files from source in the GitHub Actions job that creates the release.',
  },
  {
    id: 'ci-plugin-validation',
    kind: 'criterion',
    judgedBy: 'llm',
    title: 'CI loads the built plugin into a validation tool',
    viewpoint:
      'CI loads the built plugin into a validation tool such as pluginval, the VST 3 SDK validator, clap-validator, lv2lint, or auval and runs it, not only builds it. The facts list the workflow lines that mention such tools and the scripts under .github/scripts; read the workflows that call them.',
    fix: 'Add a CI step that runs pluginval, the VST 3 SDK validator, clap-validator, lv2lint, or auval on the built plugin.',
  },
  {
    id: 'no-security-bypass',
    kind: 'criterion',
    judgedBy: 'rule',
    title: 'Users are not told to turn off security features',
    serious: 'The instructions tell users to turn off a security feature.',
    fix: 'Remove instructions that remove the quarantine attribute, disable Gatekeeper, or turn off SmartScreen, Microsoft Defender, or Smart App Control. Sign and notarize the files instead, and explain how to verify them.',
  },
  {
    id: 'no-terminal-paste',
    kind: 'criterion',
    judgedBy: 'rule',
    title: 'Users are not told to paste a command that downloads and runs code',
    serious: 'The instructions tell users to paste a command that downloads and runs code.',
    fix: 'Remove commands that pipe downloaded content into a shell, PowerShell, or osascript. Tell users to download the zip archive from the release page instead.',
  },
  {
    id: 'dependency-pinning',
    kind: 'criterion',
    judgedBy: 'rule',
    title: 'Dependencies are installed by a package manager or submodule with fixed versions',
    fix: 'Pin each dependency: use submodules or FetchContent with a commit SHA, a vcpkg baseline, or a download with an expected hash, and do not commit binaries.',
  },
  {
    id: 'ci-hardening',
    kind: 'criterion',
    judgedBy: 'rule',
    title: 'CI runs with least privilege',
    fix: 'Set minimal permissions in each workflow, pin actions to full commit SHAs, set persist-credentials: false, and add .github/dependabot.yml.',
  },
  {
    id: 'third-party-provenance',
    kind: 'criterion',
    judgedBy: 'future',
    title: 'Bundled third-party assets and binaries document their origin and license',
    fix: 'Document the upstream URL, version, hash, and license terms of each bundled sample, impulse response, preset, font, image, model, or binary.',
  },
  {
    id: 'license-compatibility',
    kind: 'criterion',
    judgedBy: 'future',
    title: 'The plugin license is compatible with its dependencies',
    fix: 'Check that each dependency license is compatible with the plugin license, and replace dependencies that are not.',
  },
  {
    id: 'user-data-handling',
    kind: 'criterion',
    judgedBy: 'llm',
    title: 'Audio, project files, settings, and keys are not sent out without telling users',
    // ソースのコードは入力に含まない。通信の API の検出の結果 (事実) と、README とワークフローから判定する。
    // 重大は、通信の API があり、README が外部への送信に一切触れていないときに限る。README で説明している作者を止めないため。
    viewpoint:
      'If the facts show network API use in the source, or the README or the workflows show that the plugin sends audio, project files, settings, or keys to another host, the README states where and what is sent. Read the network API lines in the facts to see what is sent. License activation and update checks are common for audio plugins; judge only whether what is sent is stated. If the facts say none found and the files show no sending, answer met. If the facts say not scanned and the files do not show whether the plugin sends such data, answer unclear.',
    serious:
      'The facts show network API use in the source, and the README mentions no external host and no sending of data at all.',
    fix: 'State in the README what data is sent and where, or remove the transmission.',
  },
  {
    id: 'build-hardening',
    kind: 'criterion',
    judgedBy: 'rule',
    title: 'The build has hardening options',
    fix: 'Add a build option for sanitizers and enable stack protection flags such as -fstack-protector-strong or /GS.',
  },
  {
    id: 'windows-code-signing',
    kind: 'recommendation',
    judgedBy: 'future',
    title: 'Windows binaries are signed',
    fix: 'Consider Authenticode signing. Unsigned binaries can be blocked by Smart App Control. This is not required for listing.',
  },
  {
    id: 'plugin-name',
    kind: 'recommendation',
    judgedBy: 'rule',
    title: 'The plugin and repository names do not include VST',
    fix: 'Avoid the word VST in the plugin and repository names, as the VST 3 SDK README asks. This is not required for listing.',
  },
  {
    id: 'no-impersonation',
    kind: 'recommendation',
    judgedBy: 'future',
    title: 'The name does not imitate a well-known commercial plugin',
    fix: 'Avoid names of well-known commercial plugins and words such as crack or keygen.',
  },
  {
    id: 'user-verification-guide',
    kind: 'recommendation',
    judgedBy: 'rule',
    title: 'Users are shown how to verify downloads',
    fix: 'Add a short section to the README that shows how to verify a download with gh attestation verify.',
  },
  {
    id: 'install-location',
    kind: 'recommendation',
    judgedBy: 'rule',
    title: 'The README shows the standard install folder of each plugin format',
    fix: 'Tell users the standard folders, such as C:\\Program Files\\Common Files\\VST3 and C:\\Program Files\\Common Files\\CLAP on Windows, and the folders under ~/Library/Audio/Plug-Ins/ on macOS.',
  },
  {
    id: 'stable-plugin-id',
    kind: 'recommendation',
    judgedBy: 'future',
    title: 'Plugin IDs stay the same across versions',
    fix: 'Keep the CLAP ID, VST 3 class ID, Audio Unit type, subtype, and manufacturer, and LV2 URI unchanged across versions.',
  },
  {
    id: 'realtime-safety',
    kind: 'recommendation',
    judgedBy: 'future',
    title: 'The audio thread does not allocate, lock, or do file I/O',
    fix: 'Avoid memory allocation, locks, and file I/O on the audio thread, and test real-time safety in CI.',
  },
  {
    id: 'cpu-compatibility',
    kind: 'recommendation',
    judgedBy: 'rule',
    title: 'Instruction sets such as AVX2 are not required unconditionally',
    fix: 'Use runtime CPU dispatch instead of requiring AVX2 or -march=native for the whole plugin.',
  },
  {
    id: 'dll-footprint',
    kind: 'recommendation',
    judgedBy: 'future',
    title: 'Few shared libraries are bundled',
    fix: 'Link dependencies statically where licenses allow, to avoid conflicts with other plugins in the same host process.',
  },
  {
    id: 'hermetic-build',
    kind: 'recommendation',
    judgedBy: 'rule',
    title: 'Build runner images have fixed versions',
    fix: 'Use runner images with a fixed version, such as windows-2022, instead of windows-latest.',
  },
  {
    id: 'repository-protection',
    kind: 'recommendation',
    judgedBy: 'rule',
    title: 'The default branch and release tags are protected by rulesets',
    fix: 'Add a branch ruleset for the default branch that blocks deletion and force pushes and requires a pull request with at least one approval, and a tag ruleset that restricts creating, updating, and deleting release tags to repository admins. If you develop alone, add the Repository admin role to the bypass list of the branch ruleset with "For pull requests only" (bypass_mode: pull_request), so that you can merge your own pull request without an approval while force pushes and deletion stay blocked. Do not use the default "Always allow", which also allows force pushes and deletion. The catalog cannot read bypass lists and does not check them.',
  },
  {
    id: 'contribution-compliance',
    kind: 'recommendation',
    judgedBy: 'rule',
    title: 'Contributors agree to the license and sign off',
    fix: 'Ask contributors for DCO sign-off and license agreement in CONTRIBUTING.md.',
  },
  {
    id: 'reuse-compliance',
    kind: 'recommendation',
    judgedBy: 'future',
    title: 'The repository complies with REUSE',
    fix: 'Consider adding SPDX headers or REUSE.toml and running reuse lint in CI.',
  },
  {
    id: 'license-notices',
    kind: 'recommendation',
    judgedBy: 'future',
    title: 'Bundled dependencies and assets are credited with their licenses',
    fix: 'List the licenses of bundled dependencies and assets in the README or a notices file.',
  },
  {
    id: 'diagnostic-logging',
    kind: 'recommendation',
    judgedBy: 'future',
    title: 'Failures are logged with enough detail to find the cause',
    fix: 'Log failures with what failed and why.',
  },
  {
    id: 'security-policy',
    kind: 'recommendation',
    judgedBy: 'future',
    title: 'SECURITY.md states how to report issues',
    fix: 'Add SECURITY.md with a reporting channel and the supported versions.',
  },
];

export const CRITERIA_BY_ID = new Map(CRITERIA.map((criterion) => [criterion.id, criterion]));

export const LLM_CRITERIA = CRITERIA.filter((criterion) => criterion.judgedBy === 'llm');
