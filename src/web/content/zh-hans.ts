// 固定ページの簡体字中国語版。利用規約とプライバシーポリシーは日本語版、ほかのページは英語版の参考訳。
import type { PageContent, PageKey } from '../content';

export const zhHans: Record<PageKey, PageContent> = {
  about: {
    title: '什么是音のプラグイン倉庫くん？',
    sections: [
      {
        heading: '关于本服务',
        paragraphs: [
          '音のプラグイン倉庫くん（Audio Plugin Soko-kun）是一个独立、开放的开源音频插件收录平台。本服务是与插件格式的制定方及 DAW 开发商无关的非官方服务。',
          { formats: '支持的格式' },
          '本平台不保存文件。它记录公开 GitHub 仓库的信息，并引导用户前往作者在 GitHub Releases 发布的 zip 压缩包。',
          '本平台不保存文件，请直接从 GitHub 下载文件。',
          '本平台收录的文件始终可以从 GitHub 的公开发布免费下载。有些作者也在其他地方销售插件或接受捐赠。插件页面上显示的付费功能、付费服务、随附素材的使用限制和支持页面均由作者声明，本平台未加核实。哪些分发方式可以收录，请参阅收录政策：{{ORIGIN}}/policy',
        ],
      },
      {
        heading: '通过 AI 代理使用（MCP）',
        paragraphs: [
          '将 MCP 客户端连接到本站的 /mcp。在 Claude Code 中运行：',
          { code: 'claude mcp add --transport http audio-plugin-soko-kun {{ORIGIN}}/mcp' },
          '在 Codex 中运行：',
          { code: 'codex mcp add audio-plugin-soko-kun --url {{ORIGIN}}/mcp' },
          '搜索和查看详情无需登录 GitHub。提交仓库时，请在 MCP 客户端中使用 GitHub 登录（在 Claude Code 中运行 /mcp，在 Codex 中运行 codex mcp login audio-plugin-soko-kun）。本平台本身不会获得 GitHub 仓库的写入权限。',
          '示例：“帮我找一个能在 Windows 上使用的变调插件”“帮我找一个能在 Apple Silicon Mac 上使用的 CLAP 混响插件”“把这个 GitHub 仓库的音频插件登记上去”“确认我的插件的新版本是否已收录”',
        ],
      },
      {
        heading: '支持开发',
        paragraphs: [
          '音のプラグイン倉庫くん可以免费使用。如果您愿意支持运营费用和开发，可以通过 GitHub Sponsors 赞助开发者：https://github.com/sponsors/AllegroMoltoV',
          '赞助完全自愿，不会影响插件的收录和检查。',
        ],
      },
    ],
  },
  policy: {
    title: '收录政策',
    sections: [
      {
        heading: '收录条件',
        paragraphs: [
          '本平台收录由 GitHub 仓库管理员即作者本人提交、并满足以下全部条件的开源音频插件。',
          { formats: '支持的格式' },
          {
            list: [
              '仓库在 GitHub 上公开，且未归档。',
              '根据 SPDX License List，GitHub 在发布标签处检测到的许可证已获 OSI 批准，或被 FSF 认定为自由许可证。',
              '发布是不可变发布（immutable release）。发布前，请在仓库设置中启用不可变发布。',
              '发布中的每个文件（包括安装程序）都有由仓库的发布工作流生成的构建来源证明（build provenance attestation），例如使用 actions/attest-build-provenance 生成。',
              '插件以 zip 压缩包分发。本平台只引导用户前往包含 VST 3、CLAP、LV2 或 Audio Unit 插件包的 zip 压缩包，不引导用户前往 exe、msi、pkg 等安装程序。',
              '所有压缩包都不包含 VST 2。如果发布中的任何压缩包包含 VST 2 插件包或入口点，本平台不会收录该发布。',
              'macOS 插件包已使用 Developer ID 证书签名，并通过 Apple 公证。如果压缩包中的 macOS 插件包未通过此项检查，本平台不会引导用户前往该压缩包。由于 Gatekeeper 不评估 LV2 插件包，本平台不会引导用户前往 macOS 的 LV2 插件包。',
              '发布通过“安全与免责声明”页面所述的其他自动检查，包括与已知恶意软件数据库的比对。',
            ],
          },
          '许可证检查依据 GitHub 为仓库检测到的许可证。本平台不保证采样、预设、字体等随附素材的许可证。',
          '有些作者也会销售插件或接受付款。能否收录取决于文件的分发方式：',
          {
            list: [
              'A. 同样的文件在 GitHub 上免费提供，同时也在其他地方销售或接受捐赠：可以收录。',
              'B. 部分功能需付费解锁：作者在 .audio-soko-kun/config.json 中声明 paidFeatures 后即可收录。',
              'C. 不公开源代码，只分发付费文件：由于用户无法在购买前确认内容，因此不收录。',
            ],
          },
        ],
      },
      {
        heading: '收录的含义',
        paragraphs: [
          '是否使用 AI 开发不影响收录。所有插件适用相同条件，也不要求申报 AI 的使用。',
          '本平台不会因收录而认证安全性或质量，请自行确认后再使用。',
          '收录的文件始终可以从 GitHub 的公开发布免费下载。插件页面上显示的付费功能、付费服务、随附素材的使用限制和支持页面，是作者在 .audio-soko-kun/config.json 中声明的内容。本平台不核实这些声明。',
        ],
      },
      {
        heading: '音频插件的许可证',
        paragraphs: [
          '这是一份帮助作者选择许可证的简短指南。它不是法律建议，本平台不提供任何法律保证。',
          {
            list: [
              'VST 3 SDK 和 CLAP SDK 均以 MIT 许可证提供，因此插件的许可证可以由作者自由选择。',
              'JUCE 以 AGPLv3 或商业许可证提供。没有商业许可证而使用 JUCE 构建的插件，必须以 AGPLv3 发布。',
              '对于脉冲响应、HRTF 数据、模型、采样、字体、图像等随附素材，请在 README 或 NOTICE 中逐项写明来源和许可证。',
              '如果随附素材禁止商业使用或有其他使用限制，请在 .audio-soko-kun/config.json 中将 restrictedAssets 声明为 true。',
            ],
          },
        ],
      },
    ],
  },
  submit: {
    title: '提交插件',
    sections: [
      {
        heading: '可以提交的插件',
        paragraphs: [
          '本平台收录由 GitHub 仓库管理员即作者本人提交的开源音频插件。',
          { formats: '支持的格式' },
          '提交前，请确认仓库及其最新发布满足收录条件：{{ORIGIN}}/policy',
          '本平台根据 zip 压缩包中的插件包判断插件的格式、操作系统、架构和分类，您无需填写这些信息。',
          '请不要在插件或仓库的名称中使用 VST 一词。VST 3 SDK 不允许在产品名称中使用 VST，审查也会将此类名称作为建议提出。',
        ],
      },
      {
        heading: '使用 Claude Code 制作插件',
        paragraphs: [
          '如果使用 Claude Code 制作插件，可以安装一个技能。它汇集了本平台开发者制作 6 个音频插件时获得的经验，涵盖规划、用 clap-wrapper 从同一份代码构建 CLAP 和 VST 3 的项目模板、在 CI 中用 pluginval 和 clap-validator 进行验证、在无显示器的环境中测试 GUI、带构建来源证明的发布，以及在本平台上架。',
          '请在终端中运行以下命令进行安装：',
          {
            code: 'claude plugin marketplace add AllegroMoltoV/audio-plugin-soko-kun\nclaude plugin install audio-soko-kun-plugin-dev@audio-plugin-soko-kun',
          },
          '安装此插件后，Claude Code 也会连接到本平台的 MCP 服务器。该技能遵循本平台的收录条件和审查标准：https://github.com/AllegroMoltoV/audio-plugin-soko-kun/blob/main/docs/design/review-criteria.md',
        ],
      },
      {
        heading: '发布前检查仓库',
        paragraphs: [
          '发布之前，请让 AI 代理以检查模式运行 submit_plugin。检查模式会用最新发布判断收录条件，并审查默认分支的最新提交。检查模式不会登记插件。24 小时内最多可使用 5 次检查模式。检查模式也需要用 GitHub 登录。即使在第一次发布之前，检查模式也会把需要发布才能判断的条件作为未判断返回，并附上满足方法，同时检查默认分支上 .audio-soko-kun/config.json 的格式。上架的发布必须是不可变发布，发布后不能再添加文件：请先把所有文件附加到草稿发布，再公开发布。查找关闭安全功能的说明和运行下载内容的命令的规则，也会匹配告诉用户不要这样做的句子。',
          '审查遵循在 GitHub 上公开的审查标准：https://github.com/AllegroMoltoV/audio-plugin-soko-kun/blob/main/docs/design/review-criteria.md',
          '检查模式不会检查压缩包的内容和 macOS 签名，因为这些检查会在登记后于 GitHub Actions 中下载文件进行。代理会说明这些检查的要求。',
        ],
      },
      {
        heading: '提交步骤',
        paragraphs: [
          '请将 MCP 客户端连接到 {{ORIGIN}}/mcp。在 Claude Code 中请运行：',
          { code: 'claude mcp add --transport http audio-plugin-soko-kun {{ORIGIN}}/mcp' },
          '请在 MCP 客户端中使用 GitHub 账号登录。在 Claude Code 中请运行 /mcp 并选择 audio-plugin-soko-kun。在 Codex 中请先用 codex mcp add audio-plugin-soko-kun --url {{ORIGIN}}/mcp 连接，再用 codex mcp login audio-plugin-soko-kun 登录。本平台本身不会获得 GitHub 仓库的写入权限。',
          '请让 AI 代理帮您提交，例如：“把 https://github.com/<owner>/<repository> 的音频插件登记上去”。',
        ],
      },
      {
        heading: '提交之后',
        paragraphs: [
          '本平台将插件登记为等待检查。在某个发布通过检查之前，插件不会出现在搜索结果中，也没有插件页面。',
          '检查每 15 分钟进行一次，通常在几小时内完成。',
          '本平台只收录通过检查的发布。您在 GitHub 上发布新版本后，本平台会自动获取并检查它，无需重新提交。',
          '要查看检查结果，请让 AI 代理用 list_my_plugins 确认您的插件，例如：“确认我的插件的新版本是否已收录”。代理会显示每个发布的状态、发布或文件未被收录的原因、审查意见以及修改方法。',
          '有些发布需要等待管理员确认。如需说明此类发布中的变更，请在本平台的仓库中提交 Issue：https://github.com/AllegroMoltoV/audio-plugin-soko-kun/issues',
        ],
      },
      {
        heading: '提交被拒绝时',
        paragraphs: [
          'AI 代理会显示原因代码和修改方法，请修正原因后重新提交。',
          {
            list: [
              'not_admin：您没有该仓库的管理权限。请让仓库管理员提交。',
              'private_repository、archived_repository：请公开仓库或取消归档。',
              'no_license：请在仓库根目录放置采用开源许可证的 LICENSE 文件，然后发布新版本。',
              'license_unrecognized：GitHub 无法识别许可证。请在 LICENSE 中只保留标准许可证文本，将其他声明移至 NOTICE 或 README，然后发布新版本。',
              'license_not_open：请采用已获 OSI 批准或被 FSF 认定为自由许可证的许可证，然后发布新版本。',
              'no_release、no_verifiable_asset：请发布附有插件文件的版本（最多 30 个文件）。',
              'no_archive：请将插件包打包为 zip 压缩包并附加到发布中。',
              'not_immutable：请在仓库设置中启用不可变发布，然后发布新版本。',
              'no_attestation：请在发布工作流中加入 actions/attest-build-provenance，为包括安装程序在内的每个文件生成证明，然后发布新版本。',
              'duplicate：该仓库已登记。请通过搜索打开插件页面。',
              'name_reserved：某个已收录的插件在重命名之前使用过此仓库名称。请将仓库重命名为已收录插件从未使用过的名称。',
              'rate_limited：24 小时内最多提交 10 次。请稍后再试。',
              'invalid_url：请以 https://github.com/<owner>/<repository> 的形式指定仓库 URL。',
              'not_found：找不到该仓库。请确认 URL 以及仓库是否公开。',
              'unsupported_tag：发布标签只能使用字母、数字、“.”、“-”和“_”，且不超过 100 个字符。',
              'github_unavailable：GitHub 未正常响应。请稍后再试。',
            ],
          },
        ],
      },
      {
        heading: '发布或文件未被收录时',
        paragraphs: [
          'list_my_plugins 会显示发布或文件未被收录的原因。需要作者修正的主要原因如下。',
          {
            list: [
              'vst2_detected：压缩包中包含 VST 2 插件包或入口点。请从所有压缩包中移除 VST 2，然后发布新版本。',
              'no_plugin_detected、no_plugin_in_archive：压缩包中找不到受支持的插件包。请将构建好的插件包放入 zip 压缩包。源代码压缩包无需修改。',
              'content_undetermined：压缩包中包含无法检查的文件，例如安装程序或嵌套的压缩包。请将插件包直接放入 zip 压缩包。',
              'macos_not_signed、macos_adhoc、macos_not_developer_id、macos_not_notarized：请使用 Developer ID 证书为 macOS 插件包签名，并通过 Apple 公证。',
              'declaration_mismatch、not_declared：.audio-soko-kun/config.json 中的声明与检查的压缩包不一致。请修正声明，然后发布新版本。',
              'installer_not_guided：本平台不引导用户前往安装程序。用户从 zip 压缩包获取插件。',
              'macos_lv2_not_guided：压缩包中只有 macOS 的 LV2 插件包，本平台不会引导用户前往。请添加使用 Developer ID 证书签名并经过公证的 macOS VST 3、CLAP 或 Audio Unit 插件包。',
            ],
          },
        ],
      },
      {
        heading: '徽标与说明图片',
        paragraphs: [
          '作者可以各展示一张徽标和说明图片。请将图片放在仓库的 .audio-soko-kun 文件夹中。',
          { code: '.audio-soko-kun/logo.png\n.audio-soko-kun/image.gif' },
          {
            list: [
              '徽标：文件名为 logo。请将大小控制在 256 KB 以内，长和宽控制在 1,024 px 以内。',
              '说明图片：文件名为 image。请将大小控制在 1.5 MB 以内，长和宽控制在 4,096 px 以内。GIF 会以动画形式播放。',
            ],
          },
          '本平台不接受可包含脚本的 SVG，因此请使用 png、jpg、jpeg、gif 或 webp 扩展名。',
          '本平台获取最新发布标签时的图片，因此更改图片后请发布新版本。',
          '本平台不显示不符合条件的图片，因此如果图片未显示，请检查条件。',
        ],
      },
      {
        heading: '.audio-soko-kun/config.json',
        paragraphs: [
          '作者可以在 .audio-soko-kun/config.json 中声明显示名称、分类，以及每个压缩包的操作系统、架构和格式。请将该文件放在与图片相同的 .audio-soko-kun 文件夹中。',
          {
            code: '{\n  "name": "Simple Pitch Shift",\n  "category": "effect",\n  "assets": [\n    {\n      "pattern": "simple-pitchshift-*-windows-x64.zip",\n      "os": "windows",\n      "arch": ["x86_64"],\n      "formats": ["vst3", "clap"]\n    }\n  ]\n}',
          },
          {
            list: [
              'name：显示名称，1 到 60 个字符。未填写时，本平台显示仓库名称。',
              'category：instrument、effect、analyzer、midi、utility 之一。仅在本平台无法根据插件包推断分类时使用。',
              'assets：最多 20 条压缩包声明。pattern 与压缩包名称匹配，其中 * 匹配任意文本。os 为 windows、macos、linux 之一。arch 为由 x86_64、x86、arm64 组成的数组。formats 为由 vst3、clap、lv2、au 组成的数组。',
            ],
          },
          '所有字段都是可选的。本平台根据检查的插件包确定格式、操作系统和架构，声明仅用于核对这些信息以及选择要引导的压缩包。',
          '填写 assets 后，本平台只引导用户前往与 pattern 匹配的压缩包。如果文件无效、没有压缩包与任何 pattern 匹配，或检查的压缩包与声明不一致，本平台不会收录该发布。',
          '本平台读取每个新发布标签时的该文件，因此更改文件后请发布新版本。',
          '最简单的有效文件只声明显示名称：',
          { code: '{\n  "name": "Simple Pitch Shift"\n}' },
          '本平台按以下顺序决定类别。首先，根据检查过的插件包推断类别：依据是 Audio Unit 组件的 type（aumu、aufx、aumf、aumi）和 VST 3 插件包中 moduleinfo.json 的 Sub Categories。当线索指向多个类别时，按 instrument、midi、analyzer、effect 的顺序优先采用。无法推断时使用此文件中的 category，如果也没有则为 utility。推断出的类别优先于声明的类别。',
          '由于本平台不运行插件的二进制文件，CLAP 的 features 不用于判断类别。没有 moduleinfo.json 的 VST 3 插件包（例如用 clap-wrapper 构建的插件包）也无法提供线索。只以 CLAP 发布的插件，请在此文件中声明 category。',
          '作者还可以声明关于付费和随附素材的 4 个可选项目：',
          {
            code: '{\n  "name": "Simple Pitch Shift",\n  "paidFeatures": false,\n  "paidServices": ["Example Cloud"],\n  "restrictedAssets": true,\n  "supportUrl": "https://example.booth.pm/items/1"\n}',
          },
          {
            list: [
              'paidFeatures：如果有通过向作者付费解锁的功能则为 true，否则为 false。',
              'paidServices：用户需另行订阅的付费服务名称的数组，最多 5 个，每个最多 60 个字符。[] 表示声明没有此类服务。',
              'restrictedAssets：如果随附素材有禁止商业使用等使用限制则为 true，否则为 false。',
              'supportUrl：支持或购买页面，最多 500 个字符。只接受 booth.pm、gumroad.com、itch.io、patreon.com、ko-fi.com 及其子域名上的 https URL，以及 https://github.com/sponsors/<name>。',
            ],
          },
          '本平台将这些项目作为作者声明显示在插件页面上，不核实其内容。未填写的项目显示为作者未声明。值的格式有误时，只会把该项目视为未声明，不会停止收录。可以用 list_my_plugins 查看哪些项目被视为未声明。',
          '请从第一个发布起就写好 supportUrl 以及商店页面、支持页面、素材许可证页面等外部链接。如果在首个收录版本之后添加 supportUrl 或其他外部链接，该版本将等待管理员确认（diff-external-link）。商店链接请写在 supportUrl 中。',
          '使用条款中作者须遵守的“不发布虚假信息”也适用于这些声明：{{ORIGIN}}/terms',
        ],
      },
      {
        heading: '更新与撤下',
        paragraphs: [
          '更新收录内容时，请在 GitHub 上发布新版本。本平台会自动获取新版本，并在通过检查后收录。本平台也会根据仓库说明更新简介。',
          '如果新版本未被收录，请让 AI 代理用 list_my_plugins 确认。代理会显示原因和修改方法。',
          '撤下收录时，请将仓库设为私有或删除仓库。您也可以按举报页面的方法申请撤下。',
        ],
      },
      {
        heading: '保护你的发布',
        paragraphs: [
          '请把发布的标签打在默认分支的提交上。标签指向不在默认分支上的提交的发布，会等待管理员确认。',
          '对仓库有写入权限的人都可以创建发布。本平台建议用规则集保护默认分支，禁止删除和强制推送，并要求至少一人批准的拉取请求；同时用标签规则集保护发布标签，只允许仓库管理员创建、更新或删除标签。这些设置不是收录条件。如果你独自开发，请在分支规则集的绕过列表中，以 "For pull requests only" 添加仓库管理员（Repository admin）。这样可以合并自己的拉取请求，同时仍禁止强制推送和删除。请不要使用 "Always allow"，它也会允许强制推送和删除。',
        ],
      },
      {
        id: 'rename',
        heading: '重命名或转移仓库',
        paragraphs: [
          '本平台通过 GitHub 的仓库 ID 跟踪仓库，因此重命名仓库时无需任何操作。收录会在 15 分钟内转到新名称，指向旧名称的链接会重定向到新名称。',
          '请不要用旧名称创建另一个仓库。本平台会为已重命名的插件保留旧名称，不会以该名称登记其他仓库。',
          '如果将仓库转移到其他账号或组织，已收录的版本会继续收录，下一个版本由管理员确认后再收录。',
          '要更改显示名称，请修改 .audio-soko-kun/config.json 中的 name 并发布新版本。',
        ],
      },
    ],
  },
  security: {
    title: '安全与免责声明',
    sections: [
      {
        heading: '自动检查',
        paragraphs: [
          '本平台在收录每个新发布之前都会进行检查，只收录通过检查的发布。',
          { formats: '检查的格式' },
          {
            list: [
              '来源证明：每个文件都必须有构建来源证明。GitHub Actions 工作流会验证其签名，并确认证明与仓库、发布标签、标签的提交以及为该插件记录的发布工作流一致。',
              '不可变发布：发布必须是不可变的。不可变发布中的文件在发布后无法替换。',
              '压缩包检查：GitHub Actions 工作流会下载每个 zip 压缩包，并在不运行的情况下读取其中的插件包。此处显示的格式、操作系统和架构均来自这项检查。任何压缩包中包含 VST 2 的发布，以及包含无法检查的压缩包的发布，都不会被收录。',
              'macOS 签名与公证：包含 macOS 插件包的压缩包，只有在确认其插件包已使用 Developer ID 证书签名并通过 Apple 公证后，才会引导用户前往。',
              '恶意软件查询：在已知恶意软件样本数据库 MalwareBazaar 中查询 GitHub 公布的每个文件的 SHA-256。已收录的文件也会定期重新查询。',
              '与已收录发布的差异：按规则检查从已收录发布到新发布的变更。符合规则的发布将等待管理员确认。',
              '开发实践审查：由仓库文件即可判定的项目（例如 Action 的固定、发布工作流以及 README 中的安装步骤）按规则判定。只有需要阅读文字的项目（例如 README 中对插件发送数据的说明）才由 LLM 结合本平台计算的事实进行判定。关闭安全功能的说明和运行下载内容的命令，会在 README、发布说明和仓库中的其他文档中检查，包括上架后对发布说明的编辑。上架后，每天还会检查一次默认分支的 README；如果出现新的此类说明，在管理员确认之前，该插件的任何版本都不会上架。源代码仅用于以文本方式查找网络 API 的调用和这些说明，不会构建或运行。有严重问题的发布将等待管理员确认。',
            ],
          },
          '审查标准在 GitHub 上公开：https://github.com/AllegroMoltoV/audio-plugin-soko-kun/blob/main/docs/design/review-criteria.md',
          '未通过检查的发布不会显示。在新发布通过检查之前，之前收录的发布将继续收录。',
          '如有文件被报告为恶意软件，将暂停该插件的收录。管理员也可能暂停某个发布。',
          '被暂停的发布会在公告页面 {{ORIGIN}}/notices 上公布，并附上版本、每个文件的 SHA-256 以及在本平台收录的期间。插件页面也会显示警告。',
        ],
      },
      {
        heading: '检查的局限',
        paragraphs: [
          '恶意软件查询只能检出 MalwareBazaar 中已知的威胁。新型或定向的恶意软件可能无法检出，因此即使未检出任何问题，也请谨慎使用。',
          'Developer ID 签名和公证表明了 macOS 插件包的签名者，以及 Apple 已对其进行扫描，但并不能证明插件是安全的。',
          '压缩包检查根据插件包的结构及其导出的函数识别格式，无法判断实现了 VST 3 接口的插件是否使用 VST 3 SDK 构建。',
          'SHA-256 代表记录时 GitHub 提供的文件。请将下载文件的 SHA-256 与此处显示的值进行比对。',
        ],
      },
      {
        heading: '免责声明',
        paragraphs: ['本平台按现状提供，不作任何保证，安装插件的风险由用户自行承担。各插件由其作者负责。'],
      },
    ],
  },
  report: {
    title: '举报',
    sections: [
      {
        heading: '公开举报',
        paragraphs: [
          '错误信息或收录政策相关问题，请在 GitHub 仓库的 Issues 中提交：https://github.com/AllegroMoltoV/audio-plugin-soko-kun/issues',
          '作者关于付费功能、付费服务、素材限制或支持页面的错误声明，也请用同样的方式报告。',
        ],
      },
      {
        heading: '非公开举报',
        paragraphs: [
          '疑似恶意软件或安全问题，请通过 GitHub 的 Private vulnerability reporting 非公开举报：https://github.com/AllegroMoltoV/audio-plugin-soko-kun/security/advisories/new',
          '举报由人工确认。仅凭举报不会暂停收录。确认存在明确危险时将暂停收录，即使仓库更新也会继续暂停。',
        ],
      },
      {
        heading: '联系方式',
        paragraphs: ['其他咨询请发送至点击下方按钮显示的开发者联系方式。', { contact: true }],
      },
    ],
  },
  terms: {
    title: '使用条款',
    sections: [
      {
        heading: '适用范围',
        paragraphs: [
          '制定日期：2026 年 11 月 15 日',
          '本条款适用于所有使用音のプラグイン倉庫くん（以下称本平台）网站和 MCP 端点的人，请在同意本条款后使用本平台。',
          '本条款以日文版为准，其他语言版本仅供参考。',
        ],
      },
      {
        heading: '本平台提供的内容',
        paragraphs: [
          '本平台从 GitHub 收集并收录音频插件的信息，并引导用户前往作者在 GitHub 上发布的文件。',
          '本平台不保存文件，也不保证插件的安全性、质量和运行，请用户自行负责确认后再使用。',
        ],
      },
      {
        heading: '提交插件的作者须遵守的事项',
        paragraphs: [
          '提交插件的作者请遵守以下事项。',
          {
            list: [
              '只提交自己拥有管理权限的仓库。',
              '不发布虚假信息。',
              '不分发恶意软件或会伤害用户的程序。',
              '不侵犯第三方的权利。',
            ],
          },
        ],
      },
      {
        heading: '禁止行为',
        paragraphs: [
          '用户请勿进行以下行为。',
          {
            list: [
              '以大量提交或请求妨碍本平台的运营。',
              '进行未经授权的访问或利用漏洞。',
              '妨碍其他用户或运营者。',
              '违反法律法规。',
            ],
          },
        ],
      },
      {
        heading: '收录的暂停与删除',
        paragraphs: ['运营者确认违反本条款或对用户存在危险时，可以不经事先通知暂停或删除收录。'],
      },
      {
        heading: '免责',
        paragraphs: [
          '对于因使用本平台或安装插件而产生的损害，除运营者故意或重大过失的情形外，运营者不承担责任。',
          '运营者可能在不预先通知的情况下变更本平台的内容，或中断、终止提供。',
        ],
      },
      {
        heading: '条款的变更',
        paragraphs: ['运营者会根据需要变更本条款，并在本页面公布变更后的条款及生效日期，请用户定期查看本页面。'],
      },
      {
        heading: '准据法与管辖',
        paragraphs: [
          '本条款以日本法律为准据法。',
          '与本条款或本平台有关的纠纷，以管辖运营者住所地的地方法院为第一审专属协议管辖法院。',
        ],
      },
      {
        heading: '联系方式',
        paragraphs: ['关于本条款的咨询请发送至点击下方按钮显示的开发者联系方式。', { contact: true }],
      },
    ],
  },
  privacy: {
    title: '隐私政策',
    sections: [
      {
        heading: '隐私政策',
        paragraphs: ['本隐私政策以日文版为准，其他语言版本仅供参考。'],
      },
      {
        heading: '保存的信息',
        paragraphs: [
          '为提交插件而登录时，本平台会保存您的 GitHub 用户 ID 和登录名，以及用于确认仓库权限的 GitHub 访问令牌和用于更新该令牌的刷新令牌。本平台加密保存令牌，仅用于确认您所提交仓库的权限。',
          '为防止滥用，本平台会将 IP 地址进行单向哈希后短期保存。浏览目录时，除记住语言选择的 cookie 外不使用其他 cookie。',
        ],
      },
      {
        heading: '您可以做的事',
        paragraphs: [
          '您可以随时在 GitHub 设置的 Applications 中撤销访问权限。如需删除数据，请按举报页面的方法提交非公开举报。',
        ],
      },
      {
        heading: '联系方式',
        paragraphs: ['其他咨询请发送至点击下方按钮显示的开发者联系方式。', { contact: true }],
      },
    ],
  },
};
