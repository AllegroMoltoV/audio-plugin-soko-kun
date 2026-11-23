// 固定ページの繁体字中国語版。利用規約とプライバシーポリシーは日本語版、ほかのページは英語版の参考訳。
import type { PageContent, PageKey } from '../content';

export const zhHant: Record<PageKey, PageContent> = {
  about: {
    title: '什麼是音のプラグイン倉庫くん？',
    sections: [
      {
        heading: '關於本服務',
        paragraphs: [
          '音のプラグイン倉庫くん（Audio Plugin Soko-kun）是一個獨立、開放的開源音訊外掛收錄平台。本服務是與外掛格式的制定方及 DAW 開發商無關的非官方服務。',
          { formats: '支援的格式' },
          '本平台不保存檔案。它記錄公開 GitHub 儲存庫的資訊，並引導使用者前往作者在 GitHub Releases 發布的 zip 壓縮檔。',
          '本平台不保存檔案，請直接從 GitHub 下載檔案。',
          '本平台收錄的檔案隨時可以從 GitHub 的公開發行免費下載。有些作者也在其他地方販售外掛或接受捐款。外掛頁面上顯示的付費功能、付費服務、隨附素材的使用限制與支持頁面皆由作者聲明，本平台未加查核。哪些發布方式可以收錄，請參閱收錄政策：{{ORIGIN}}/policy',
        ],
      },
      {
        heading: '透過 AI 代理使用（MCP）',
        paragraphs: [
          '將 MCP 用戶端連接到本站的 /mcp。在 Claude Code 中執行：',
          { code: 'claude mcp add --transport http audio-plugin-soko-kun {{ORIGIN}}/mcp' },
          '在 Codex 中執行：',
          { code: 'codex mcp add audio-plugin-soko-kun --url {{ORIGIN}}/mcp' },
          '搜尋與查看詳情無需登入 GitHub。提交儲存庫時，請在 MCP 用戶端中以 GitHub 登入（在 Claude Code 中執行 /mcp，在 Codex 中執行 codex mcp login audio-plugin-soko-kun）。本平台本身不會取得 GitHub 儲存庫的寫入權限。',
          '範例：「幫我找一個能在 Windows 上使用的變調外掛」「幫我找一個能在 Apple Silicon Mac 上使用的 CLAP 殘響外掛」「把這個 GitHub 儲存庫的音訊外掛登記上去」「確認我的外掛的新版本是否已收錄」',
        ],
      },
      {
        heading: '支持開發',
        paragraphs: [
          '音のプラグイン倉庫くん可以免費使用。如果您願意支持營運費用和開發，可以透過 GitHub Sponsors 贊助開發者：https://github.com/sponsors/AllegroMoltoV',
          '贊助完全自願，不會影響外掛的收錄和檢查。',
        ],
      },
    ],
  },
  policy: {
    title: '收錄政策',
    sections: [
      {
        heading: '收錄條件',
        paragraphs: [
          { important: true },
          '本平台收錄由 GitHub 儲存庫管理員即作者本人提交、並滿足以下全部條件的開源音訊外掛。',
          { formats: '支援的格式' },
          {
            list: [
              '儲存庫在 GitHub 上公開，且未封存。',
              '根據 SPDX License List，GitHub 在發行標籤處偵測到的授權已獲 OSI 核准，或被 FSF 認定為自由授權。',
              '發行是不可變發行（immutable release）。發布前，請在儲存庫設定中啟用不可變發行。',
              '發行中的每個檔案（包括安裝程式）都有由儲存庫的發行工作流程產生的建置來源證明（build provenance attestation），例如使用 actions/attest-build-provenance 產生。',
              '外掛以 zip 壓縮檔發布。本平台只引導使用者前往包含 VST 3、CLAP、LV2 或 Audio Unit 外掛套件的 zip 壓縮檔，不引導使用者前往 exe、msi、pkg 等安裝程式。',
              '所有壓縮檔都不包含 VST 2。如果發行中的任何壓縮檔包含 VST 2 外掛套件或進入點，本平台不會收錄該發行。',
              'macOS 外掛套件已使用 Developer ID 憑證簽署，並通過 Apple 公證。如果壓縮檔中的 macOS 外掛套件未通過此項檢查，本平台不會引導使用者前往該壓縮檔。由於 Gatekeeper 不評估 LV2 外掛套件，本平台不會引導使用者前往 macOS 的 LV2 外掛套件。',
              '發行通過「安全與免責聲明」頁面所述的其他自動檢查，包括與已知惡意軟體資料庫的比對。',
            ],
          },
          '授權檢查依據 GitHub 為儲存庫偵測到的授權。本平台不保證取樣音色、預設、字型等隨附素材的授權。',
          '有些作者也會販售外掛或接受付款。能否收錄取決於檔案的發布方式：',
          {
            list: [
              'A. 相同的檔案在 GitHub 上免費提供，同時也在其他地方販售或接受捐款：可以收錄。',
              'B. 部分功能需付費解鎖：作者在 .audio-soko-kun/config.json 中聲明 paidFeatures 後即可收錄。',
              'C. 不公開原始碼，只發布付費檔案：由於使用者無法在購買前確認內容，因此不收錄。',
            ],
          },
        ],
      },
      {
        heading: '收錄的意義',
        paragraphs: [
          '是否使用 AI 開發不影響收錄。所有外掛適用相同條件，也不要求申報 AI 的使用。',
          '本平台不會因收錄而認證安全性或品質，請自行確認後再使用。',
          '收錄的檔案隨時可以從 GitHub 的公開發行免費下載。外掛頁面上顯示的付費功能、付費服務、隨附素材的使用限制與支持頁面，是作者在 .audio-soko-kun/config.json 中聲明的內容。本平台不查核這些聲明。',
        ],
      },
      {
        heading: '音訊外掛的授權',
        paragraphs: [
          '這是一份協助作者選擇授權的簡短指南。它不是法律建議，本平台不提供任何法律保證。',
          {
            list: [
              'VST 3 SDK 與 CLAP SDK 皆以 MIT 授權提供，因此外掛的授權可以由作者自由選擇。',
              'JUCE 以 AGPLv3 或商業授權提供。沒有商業授權而使用 JUCE 建置的外掛，必須以 AGPLv3 發布。',
              '對於脈衝響應、HRTF 資料、模型、取樣音色、字型、圖片等隨附素材，請在 README 或 NOTICE 中逐項寫明來源與授權。',
              '如果隨附素材禁止商業使用或有其他使用限制，請在 .audio-soko-kun/config.json 中將 restrictedAssets 聲明為 true。',
            ],
          },
        ],
      },
    ],
  },
  submit: {
    title: '提交外掛',
    sections: [
      {
        heading: '可以提交的外掛',
        paragraphs: [
          { important: true },
          '本平台收錄由 GitHub 儲存庫管理員即作者本人提交的開源音訊外掛。',
          { formats: '支援的格式' },
          '提交前，請確認儲存庫及其最新發行滿足收錄條件：{{ORIGIN}}/policy',
          '本平台根據 zip 壓縮檔中的外掛套件判斷外掛的格式、作業系統、架構和分類，您無需填寫這些資訊。',
          '請不要在外掛或儲存庫的名稱中使用 VST 一詞。VST 3 SDK 不允許在產品名稱中使用 VST，審查也會將此類名稱作為建議提出。',
        ],
      },
      {
        heading: '使用 Claude Code 製作外掛',
        paragraphs: [
          '如果使用 Claude Code 製作外掛，可以安裝一個技能。它彙整了本平台開發者製作 6 個音訊外掛時獲得的經驗，涵蓋規劃、以 clap-wrapper 從同一份程式碼建置 CLAP 與 VST 3 的專案範本、在 CI 中以 pluginval 與 clap-validator 進行驗證、在沒有顯示器的環境中測試 GUI、附建置來源證明的發行，以及在本平台上架。',
          '請在終端機中執行以下指令進行安裝：',
          {
            code: 'claude plugin marketplace add AllegroMoltoV/audio-plugin-soko-kun\nclaude plugin install audio-soko-kun-plugin-dev@audio-plugin-soko-kun',
          },
          '安裝此外掛後，Claude Code 也會連線到本平台的 MCP 伺服器。該技能遵循本平台的收錄條件與審查標準：https://github.com/AllegroMoltoV/audio-plugin-soko-kun/blob/main/docs/design/review-criteria.md',
        ],
      },
      {
        heading: '發行前檢查儲存庫',
        paragraphs: [
          '發布之前，請讓 AI 代理以檢查模式執行 submit_plugin。檢查模式會以最新發行判斷收錄條件，並審查預設分支的最新提交。檢查模式不會登記外掛。24 小時內最多可使用 5 次檢查模式。檢查模式也需要以 GitHub 登入。即使在第一次發行之前，檢查模式也會把需要發行才能判斷的條件作為未判斷傳回，並附上滿足方法，同時檢查預設分支上 .audio-soko-kun/config.json 的格式。上架的發行必須是不可變發行，發布後不能再新增檔案：請先把所有檔案附加到草稿發行，再公開發行。尋找關閉安全功能的說明和執行下載內容的指令的規則，也會比對告訴使用者不要這樣做的句子。',
          '審查遵循在 GitHub 上公開的審查標準：https://github.com/AllegroMoltoV/audio-plugin-soko-kun/blob/main/docs/design/review-criteria.md',
          '檢查模式不會檢查壓縮檔的內容和 macOS 簽署，因為這些檢查會在登記後於 GitHub Actions 中下載檔案進行。代理會說明這些檢查的要求。',
        ],
      },
      {
        heading: '提交步驟',
        paragraphs: [
          '請將 MCP 用戶端連接到 {{ORIGIN}}/mcp。在 Claude Code 中請執行：',
          { code: 'claude mcp add --transport http audio-plugin-soko-kun {{ORIGIN}}/mcp' },
          '請在 MCP 用戶端中以 GitHub 帳號登入。在 Claude Code 中請執行 /mcp 並選擇 audio-plugin-soko-kun。在 Codex 中請先以 codex mcp add audio-plugin-soko-kun --url {{ORIGIN}}/mcp 連接，再以 codex mcp login audio-plugin-soko-kun 登入。本平台本身不會取得 GitHub 儲存庫的寫入權限。',
          '請讓 AI 代理幫您提交，例如：「把 https://github.com/<owner>/<repository> 的音訊外掛登記上去」。',
        ],
      },
      {
        heading: '提交之後',
        paragraphs: [
          '本平台將外掛登記為等待檢查。在某個發行通過檢查之前，外掛不會出現在搜尋結果中，也沒有外掛頁面。',
          '檢查每 15 分鐘進行一次，通常在幾小時內完成。',
          '本平台只收錄通過檢查的發行。您在 GitHub 上發布新版本後，本平台會自動取得並檢查它，無需重新提交。',
          '要查看檢查結果，請讓 AI 代理以 list_my_plugins 確認您的外掛，例如：「確認我的外掛的新版本是否已收錄」。代理會顯示每個發行的狀態、發行或檔案未被收錄的原因、審查意見以及修改方法。',
          '有些發行需要等待管理員確認。如需說明此類發行中的變更，請在本平台的儲存庫中提交 Issue：https://github.com/AllegroMoltoV/audio-plugin-soko-kun/issues',
        ],
      },
      {
        heading: '提交被拒絕時',
        paragraphs: [
          'AI 代理會顯示原因代碼和修改方法，請修正原因後重新提交。',
          {
            list: [
              'not_admin：您沒有該儲存庫的管理權限。請讓儲存庫管理員提交。',
              'private_repository、archived_repository：請公開儲存庫或取消封存。',
              'no_license：請在儲存庫根目錄放置採用開源授權的 LICENSE 檔案，然後發布新版本。',
              'license_unrecognized：GitHub 無法識別授權。請在 LICENSE 中只保留標準授權文字，將其他聲明移至 NOTICE 或 README，然後發布新版本。',
              'license_not_open：請採用已獲 OSI 核准或被 FSF 認定為自由授權的授權，然後發布新版本。',
              'no_release、no_verifiable_asset：請發布附有外掛檔案的版本（最多 30 個檔案）。',
              'no_archive：請將外掛套件打包為 zip 壓縮檔並附加到發行中。',
              'not_immutable：請在儲存庫設定中啟用不可變發行，然後發布新版本。',
              'no_attestation：請在發行工作流程中加入 actions/attest-build-provenance，為包括安裝程式在內的每個檔案產生證明，然後發布新版本。',
              'duplicate：該儲存庫已登記。請透過搜尋開啟外掛頁面。',
              'name_reserved：某個已收錄的外掛在重新命名之前使用過此儲存庫名稱。請將儲存庫重新命名為已收錄外掛從未使用過的名稱。',
              'rate_limited：24 小時內最多提交 10 次。請稍後再試。',
              'invalid_url：請以 https://github.com/<owner>/<repository> 的形式指定儲存庫 URL。',
              'not_found：找不到該儲存庫。請確認 URL 以及儲存庫是否公開。',
              'unsupported_tag：發行標籤只能使用字母、數字、「.」、「-」和「_」，且不超過 100 個字元。',
              'github_unavailable：GitHub 未正常回應。請稍後再試。',
            ],
          },
        ],
      },
      {
        heading: '發行或檔案未被收錄時',
        paragraphs: [
          'list_my_plugins 會顯示發行或檔案未被收錄的原因。需要作者修正的主要原因如下。',
          {
            list: [
              'vst2_detected：壓縮檔中包含 VST 2 外掛套件或進入點。請從所有壓縮檔中移除 VST 2，然後發布新版本。',
              'no_plugin_detected、no_plugin_in_archive：壓縮檔中找不到受支援的外掛套件。請將建置好的外掛套件放入 zip 壓縮檔。原始碼壓縮檔無需修改。',
              'content_undetermined：壓縮檔中包含無法檢查的項目，例如安裝程式、巢狀的壓縮檔、不安全的路徑、指向外掛套件之外的連結、重複名稱的項目或帶有資料的資料夾項目。請將外掛套件直接放入 zip 壓縮檔，並移除這些項目。',
              'macos_not_signed、macos_adhoc、macos_not_developer_id、macos_not_notarized：請使用 Developer ID 憑證簽署 macOS 外掛套件，並通過 Apple 公證。',
              'declaration_mismatch、not_declared：.audio-soko-kun/config.json 中的宣告與檢查的壓縮檔不一致。請修正宣告，然後發布新版本。',
              'installer_not_guided：本平台不引導使用者前往安裝程式。使用者從 zip 壓縮檔取得外掛。',
              'macos_lv2_not_guided：壓縮檔中只有 macOS 的 LV2 外掛套件，本平台不會引導使用者前往。請新增使用 Developer ID 憑證簽署並通過公證的 macOS VST 3、CLAP 或 Audio Unit 外掛套件。',
            ],
          },
        ],
      },
      {
        heading: '標誌與說明圖片',
        paragraphs: [
          '作者可以各展示一張標誌和說明圖片。請將圖片放在儲存庫的 .audio-soko-kun 資料夾中。',
          { code: '.audio-soko-kun/logo.png\n.audio-soko-kun/image.gif' },
          {
            list: [
              '標誌：檔名為 logo。請將大小控制在 256 KB 以內，長和寬控制在 1,024 px 以內。',
              '說明圖片：檔名為 image。請將大小控制在 1.5 MB 以內，長和寬控制在 4,096 px 以內。GIF 會以動畫形式播放。',
            ],
          },
          '本平台不接受可包含指令碼的 SVG，因此請使用 png、jpg、jpeg、gif 或 webp 副檔名。',
          '本平台取得最新發行標籤時的圖片，因此變更圖片後請發布新版本。',
          '本平台不顯示不符合條件的圖片，因此如果圖片未顯示，請檢查條件。',
        ],
      },
      {
        heading: '.audio-soko-kun/config.json',
        paragraphs: [
          '作者可以在 .audio-soko-kun/config.json 中宣告顯示名稱、分類，以及每個壓縮檔的作業系統、架構和格式。請將該檔案放在與圖片相同的 .audio-soko-kun 資料夾中。',
          {
            code: '{\n  "name": "Simple Pitch Shift",\n  "category": "effect",\n  "assets": [\n    {\n      "pattern": "simple-pitchshift-*-windows-x64.zip",\n      "os": "windows",\n      "arch": ["x86_64"],\n      "formats": ["vst3", "clap"]\n    }\n  ]\n}',
          },
          {
            list: [
              'name：顯示名稱，1 到 60 個字元。未填寫時，本平台顯示儲存庫名稱。',
              'category：instrument、effect、analyzer、midi、utility 之一。僅在本平台無法根據外掛套件推斷分類時使用。',
              'assets：最多 20 筆壓縮檔宣告。pattern 與壓縮檔名稱比對，其中 * 符合任意文字。os 為 windows、macos、linux 之一。arch 為由 x86_64、x86、arm64 組成的陣列。formats 為由 vst3、clap、lv2、au 組成的陣列。',
            ],
          },
          '所有欄位皆為選填。本平台根據檢查的外掛套件決定格式、作業系統和架構，宣告僅用於核對這些資訊以及選擇要引導的壓縮檔。',
          '填寫 assets 後，本平台只引導使用者前往符合 pattern 的壓縮檔。如果檔案無效、沒有壓縮檔符合任何 pattern，或檢查的壓縮檔與宣告不一致，本平台不會收錄該發行。',
          '本平台讀取每個新發行標籤時的該檔案，因此變更檔案後請發布新版本。',
          '最簡單的有效檔案只宣告顯示名稱：',
          { code: '{\n  "name": "Simple Pitch Shift"\n}' },
          '本平台依以下順序決定類別。首先，根據檢查過的外掛套件推斷類別：依據是 Audio Unit 元件的 type（aumu、aufx、aumf、aumi）和 VST 3 外掛套件中 moduleinfo.json 的 Sub Categories。當線索指向多個類別時，依 instrument、midi、analyzer、effect 的順序優先採用。無法推斷時使用此檔案中的 category，如果也沒有則為 utility。推斷出的類別優先於宣告的類別。',
          '由於本平台不執行外掛的二進位檔，CLAP 的 features 不用於判斷類別。沒有 moduleinfo.json 的 VST 3 外掛套件（例如以 clap-wrapper 建置的外掛套件）也無法提供線索。只以 CLAP 發布的外掛，請在此檔案中宣告 category。',
          '作者也可以聲明關於付費與隨附素材的 4 個選用項目：',
          {
            code: '{\n  "name": "Simple Pitch Shift",\n  "paidFeatures": false,\n  "paidServices": ["Example Cloud"],\n  "restrictedAssets": true,\n  "supportUrl": "https://example.booth.pm/items/1"\n}',
          },
          {
            list: [
              'paidFeatures：如果有透過向作者付費解鎖的功能則為 true，否則為 false。',
              'paidServices：使用者需另行訂閱的付費服務名稱的陣列，最多 5 個，每個最多 60 個字元。[] 表示聲明沒有此類服務。',
              'restrictedAssets：如果隨附素材有禁止商業使用等使用限制則為 true，否則為 false。',
              'supportUrl：支持或購買頁面，最多 300 個字元。只接受 booth.pm、gumroad.com、itch.io、patreon.com、ko-fi.com 及其子網域上的 https URL，以及 https://github.com/sponsors/<name>。',
            ],
          },
          '本平台將這些項目作為作者聲明顯示在外掛頁面上，不查核其內容。未填寫的項目顯示為作者未聲明。值的格式有誤時，只會把該項目視為未聲明，不會停止收錄。可以用 list_my_plugins 查看哪些項目被視為未聲明。',
          '請從第一個發行起就寫好 supportUrl 以及商店頁面、支持頁面、素材授權頁面等外部連結。如果在首個收錄版本之後加入 supportUrl 或其他外部連結，該版本將等待管理員確認（diff-external-link）。商店連結請寫在 supportUrl 中。',
          '使用條款中作者須遵守的「不刊登虛假資訊」也適用於這些聲明：{{ORIGIN}}/terms',
        ],
      },
      {
        heading: '更新與撤下',
        paragraphs: [
          '更新收錄內容時，請在 GitHub 上發布新版本。本平台會自動取得新版本，並在通過檢查後收錄。本平台也會根據儲存庫說明更新簡介。',
          '如果新版本未被收錄，請讓 AI 代理以 list_my_plugins 確認。代理會顯示原因和修改方法。',
          '撤下收錄時，請將儲存庫設為私人或刪除儲存庫。您也可以依檢舉頁面的方法申請撤下。',
        ],
      },
      {
        heading: '保護你的發行版本',
        paragraphs: [
          '請把發行版本的標籤打在預設分支的提交上。標籤指向不在預設分支上的提交的發行版本，會等待管理員確認。',
          '對儲存庫有寫入權限的人都可以建立發行版本。本平台建議以規則集保護預設分支，禁止刪除與強制推送，並要求至少一人核准的拉取要求；同時以標籤規則集保護發行標籤，只允許儲存庫管理員建立、更新或刪除標籤。這些設定不是收錄條件。如果你獨自開發，請在分支規則集的略過清單中，以 "For pull requests only" 新增儲存庫管理員（Repository admin）。這樣可以合併自己的拉取要求，同時仍禁止強制推送與刪除。請不要使用 "Always allow"，它也會允許強制推送與刪除。',
        ],
      },
      {
        id: 'rename',
        heading: '重新命名或轉移儲存庫',
        paragraphs: [
          '本平台透過 GitHub 的儲存庫 ID 追蹤儲存庫，因此重新命名儲存庫時無需任何操作。收錄會在 15 分鐘內轉到新名稱，指向舊名稱的連結會重新導向到新名稱。',
          '請不要以舊名稱建立另一個儲存庫。本平台會為已重新命名的外掛保留舊名稱，不會以該名稱登記其他儲存庫。',
          '如果將儲存庫轉移到其他帳號或組織，已收錄的版本會繼續收錄，下一個版本由管理員確認後再收錄。',
          '要變更顯示名稱，請修改 .audio-soko-kun/config.json 中的 name 並發布新版本。',
        ],
      },
    ],
  },
  security: {
    title: '安全與免責聲明',
    sections: [
      {
        heading: '自動檢查',
        paragraphs: [
          '本平台在收錄每個新發行之前都會進行檢查，只收錄通過檢查的發行。',
          { formats: '檢查的格式' },
          {
            list: [
              '來源證明：每個檔案都必須有建置來源證明。GitHub Actions 工作流程會驗證其簽章，並確認證明與儲存庫、發行標籤、標籤的提交以及為該外掛記錄的發行工作流程一致。',
              '不可變發行：發行必須是不可變的。不可變發行中的檔案在發布後無法替換。',
              '壓縮檔檢查：GitHub Actions 工作流程會下載每個 zip 壓縮檔，並在不執行的情況下讀取其中的外掛套件。此處顯示的格式、作業系統和架構均來自這項檢查。任何壓縮檔中包含 VST 2 的發行，以及包含無法檢查的壓縮檔的發行，都不會被收錄。',
              'macOS 簽署與公證：包含 macOS 外掛套件的壓縮檔，只有在確認其外掛套件已使用 Developer ID 憑證簽署並通過 Apple 公證後，才會引導使用者前往。',
              '惡意軟體查詢：在已知惡意軟體樣本資料庫 MalwareBazaar 中查詢 GitHub 公布的每個檔案的 SHA-256。已收錄的檔案也會定期重新查詢。',
              '與已收錄發行的差異：依規則檢查從已收錄發行到新發行的變更。符合規則的發行將等待管理員確認。',
              '開發實務審查：由儲存庫檔案即可判定的項目（例如 Action 的固定、發行工作流程以及 README 中的安裝步驟）依規則判定。只有需要閱讀文字的項目（例如 README 中對外掛傳送資料的說明）才由 LLM 結合本平台計算的事實進行判定。關閉安全功能的說明和執行下載內容的指令，會在 README、發行說明和儲存庫中的其他文件中檢查，包括上架後對發行說明的編輯。上架後，每天還會檢查一次預設分支的 README；如果出現新的此類說明，在管理員確認之前，該外掛的任何版本都不會上架。原始碼僅用於以文字方式尋找網路 API 的呼叫和這些說明，不會建置或執行。有嚴重問題的發行將等待管理員確認。',
            ],
          },
          '審查標準在 GitHub 上公開：https://github.com/AllegroMoltoV/audio-plugin-soko-kun/blob/main/docs/design/review-criteria.md',
          '未通過檢查的發行不會顯示。在新發行通過檢查之前，之前收錄的發行將繼續收錄。',
          '如有檔案被回報為惡意軟體，將暫停該外掛的收錄。管理員也可能暫停某個發行。',
          '被暫停的發行會在公告頁面 {{ORIGIN}}/notices 上公布，並附上版本、每個檔案的 SHA-256 以及在本平台收錄的期間。外掛頁面也會顯示警告。',
        ],
      },
      {
        heading: '檢查的限制',
        paragraphs: [
          '惡意軟體查詢只能檢出 MalwareBazaar 中已知的威脅。新型或針對性的惡意軟體可能無法檢出，因此即使未檢出任何問題，也請謹慎使用。',
          'Developer ID 簽署和公證表明了 macOS 外掛套件的簽署者，以及 Apple 已對其進行掃描，但並不能證明外掛是安全的。',
          '壓縮檔檢查根據外掛套件的結構及其匯出的函式識別格式，無法判斷實作了 VST 3 介面的外掛是否使用 VST 3 SDK 建置。',
          'SHA-256 代表記錄時 GitHub 提供的檔案。請將下載檔案的 SHA-256 與此處顯示的值進行比對。',
        ],
      },
      {
        heading: '免責聲明',
        paragraphs: ['本平台按現狀提供，不作任何保證，安裝外掛的風險由使用者自行承擔。各外掛由其作者負責。'],
      },
    ],
  },
  report: {
    title: '檢舉',
    sections: [
      {
        heading: '公開檢舉',
        paragraphs: [
          '錯誤資訊或收錄政策相關問題，請在 GitHub 儲存庫的 Issues 中提交：https://github.com/AllegroMoltoV/audio-plugin-soko-kun/issues',
          '作者關於付費功能、付費服務、素材限制或支持頁面的錯誤聲明，也請以相同方式回報。',
        ],
      },
      {
        heading: '非公開檢舉',
        paragraphs: [
          '疑似惡意軟體或安全問題，請透過 GitHub 的 Private vulnerability reporting 非公開檢舉：https://github.com/AllegroMoltoV/audio-plugin-soko-kun/security/advisories/new',
          '檢舉由人工確認。僅憑檢舉不會暫停收錄。確認存在明確危險時將暫停收錄，即使儲存庫更新也會繼續暫停。',
        ],
      },
      {
        heading: '聯絡方式',
        paragraphs: ['其他詢問請寄送至點擊下方按鈕顯示的開發者聯絡方式。', { contact: true }],
      },
    ],
  },
  terms: {
    title: '使用條款',
    sections: [
      {
        heading: '適用範圍',
        paragraphs: [
          '制定日期：2026 年 11 月 15 日',
          '本條款適用於所有使用音のプラグイン倉庫くん（以下稱本平台）網站和 MCP 端點的人，請在同意本條款後使用本平台。',
          '本條款以日文版為準，其他語言版本僅供參考。',
        ],
      },
      {
        heading: '本平台提供的內容',
        paragraphs: [
          '本平台從 GitHub 收集並收錄音訊外掛的資訊，並引導使用者前往作者在 GitHub 上發布的檔案。',
          '本平台不保存檔案，也不保證外掛的安全性、品質和運作，請使用者自行負責確認後再使用。',
        ],
      },
      {
        heading: '提交外掛的作者須遵守的事項',
        paragraphs: [
          '提交外掛的作者請遵守以下事項。',
          {
            list: [
              '只提交自己擁有管理權限的儲存庫。',
              '不刊登虛假資訊。',
              '不散布惡意軟體或會傷害使用者的程式。',
              '不侵害第三方的權利。',
            ],
          },
        ],
      },
      {
        heading: '禁止行為',
        paragraphs: [
          '使用者請勿進行以下行為。',
          {
            list: [
              '以大量提交或請求妨礙本平台的營運。',
              '進行未經授權的存取或利用漏洞。',
              '妨礙其他使用者或營運者。',
              '違反法令。',
            ],
          },
        ],
      },
      {
        heading: '收錄的暫停與刪除',
        paragraphs: ['營運者確認違反本條款或對使用者存在危險時，可以不經事先通知暫停或刪除收錄。'],
      },
      {
        heading: '免責',
        paragraphs: [
          '對於因使用本平台或安裝外掛而產生的損害，除營運者故意或重大過失的情形外，營運者不承擔責任。',
          '營運者可能在不預先通知的情況下變更本平台的內容，或中斷、終止提供。',
        ],
      },
      {
        heading: '條款的變更',
        paragraphs: ['營運者會視需要變更本條款，並在本頁面公布變更後的條款及生效日期，請使用者定期查看本頁面。'],
      },
      {
        heading: '準據法與管轄',
        paragraphs: [
          '本條款以日本法律為準據法。',
          '與本條款或本平台有關的爭議，以管轄營運者住所地的地方法院為第一審專屬合意管轄法院。',
        ],
      },
      {
        heading: '聯絡方式',
        paragraphs: ['關於本條款的詢問請寄送至點擊下方按鈕顯示的開發者聯絡方式。', { contact: true }],
      },
    ],
  },
  privacy: {
    title: '隱私政策',
    sections: [
      {
        heading: '隱私政策',
        paragraphs: ['本隱私政策以日文版為準，其他語言版本僅供參考。'],
      },
      {
        heading: '保存的資訊',
        paragraphs: [
          '為提交外掛而登入時，本平台會保存您的 GitHub 使用者 ID 和登入名稱，以及用於確認儲存庫權限的 GitHub 存取權杖和用於更新該權杖的重新整理權杖。本平台加密保存權杖，僅用於確認您所提交儲存庫的權限。',
          '為防止濫用，本平台會將 IP 位址進行單向雜湊後短期保存。瀏覽目錄時，除記住語言選擇的 cookie 外不使用其他 cookie。',
        ],
      },
      {
        heading: '您可以做的事',
        paragraphs: [
          '您可以隨時在 GitHub 設定的 Applications 中撤銷存取權限。如需刪除資料，請依檢舉頁面的方法提交非公開檢舉。',
        ],
      },
      {
        heading: '聯絡方式',
        paragraphs: ['其他詢問請寄送至點擊下方按鈕顯示的開發者聯絡方式。', { contact: true }],
      },
    ],
  },
};
