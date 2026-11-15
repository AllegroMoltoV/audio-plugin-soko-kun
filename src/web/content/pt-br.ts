// 固定ページのブラジルポルトガル語版。利用規約とプライバシーポリシーは日本語版、ほかのページは英語版の参考訳。
import type { PageContent, PageKey } from '../content';

export const ptBR: Record<PageKey, PageContent> = {
  about: {
    title: 'O que é o Audio Plugin Soko-kun?',
    sections: [
      {
        heading: 'O que é este serviço',
        paragraphs: [
          'O Audio Plugin Soko-kun é um registro independente e aberto de plugins de áudio de código aberto. É um serviço não oficial, sem vínculo com os criadores dos formatos de plugin nem com os desenvolvedores de DAWs.',
          { formats: 'Formatos suportados' },
          'O registro não hospeda arquivos. Ele registra informações de repositórios públicos do GitHub e aponta para os arquivos zip que os autores publicam no GitHub Releases.',
          'Esta plataforma não hospeda arquivos; por isso, baixe os arquivos diretamente do GitHub.',
        ],
      },
      {
        heading: 'Uso com agentes de IA (MCP)',
        paragraphs: [
          'Conecte um cliente MCP ao endereço /mcp deste site. No Claude Code, execute:',
          { code: 'claude mcp add --transport http audio-plugin-soko-kun {{ORIGIN}}/mcp' },
          'No Codex, execute:',
          { code: 'codex mcp add audio-plugin-soko-kun --url {{ORIGIN}}/mcp' },
          'Buscar e ver detalhes funciona sem login no GitHub. Para enviar um repositório, entre com o GitHub pelo cliente MCP (no Claude Code, execute /mcp; no Codex, execute codex mcp login audio-plugin-soko-kun). Esta plataforma em si nunca recebe acesso de escrita aos seus repositórios do GitHub.',
          'Exemplos: "Encontre um plugin de pitch shift que funcione no Windows", "Encontre um reverb CLAP para Macs com Apple Silicon", "Registre o plugin de áudio deste repositório do GitHub", "Verifique se a nova versão do meu plugin está listada".',
        ],
      },
      {
        heading: 'Apoiar o desenvolvimento',
        paragraphs: [
          'O Audio Plugin Soko-kun é gratuito. Se quiser ajudar com os custos de operação e o desenvolvimento, você pode patrocinar o desenvolvedor no GitHub Sponsors: https://github.com/sponsors/AllegroMoltoV',
          'O patrocínio é opcional e não afeta a listagem nem a verificação dos plugins.',
        ],
      },
    ],
  },
  policy: {
    title: 'Política de listagem',
    sections: [
      {
        heading: 'Condições de listagem',
        paragraphs: [
          'Esta plataforma lista plugins de áudio de código aberto enviados pelo autor que administra o repositório no GitHub e que cumprem todas as condições abaixo.',
          { formats: 'Formatos suportados' },
          {
            list: [
              'O repositório é público no GitHub e não está arquivado.',
              'A licença que o GitHub detecta na tag da versão é aprovada pela OSI ou reconhecida como livre pela FSF, segundo a SPDX License List.',
              'A versão é uma versão imutável (immutable release). Ative as versões imutáveis nas configurações do repositório antes de publicá-la.',
              'Todos os arquivos da versão, incluindo instaladores, têm uma atestação de procedência da build (build provenance attestation) criada pelo workflow de release do repositório, por exemplo com actions/attest-build-provenance.',
              'Os plugins são distribuídos como arquivos zip. Esta plataforma indica aos usuários apenas arquivos zip que contêm bundles VST 3, CLAP, LV2 ou Audio Unit. Ela não indica instaladores como arquivos exe, msi ou pkg.',
              'Nenhum arquivo compactado contém VST 2. Se algum arquivo compactado de uma versão contiver um bundle ou ponto de entrada VST 2, esta plataforma não lista a versão.',
              'Os bundles para macOS são assinados com um certificado Developer ID e notarizados pela Apple. Esta plataforma não indica arquivos compactados cujos bundles para macOS não passem nessa verificação. Bundles LV2 para macOS não são indicados, porque o Gatekeeper não avalia bundles LV2.',
              'A versão passa nas demais verificações automáticas descritas na página Segurança, incluindo a consulta a um banco de dados de malware conhecido.',
            ],
          },
          'A verificação de licença se baseia na licença que o GitHub detecta no repositório. Esta plataforma não garante as licenças de materiais incluídos, como samples, presets ou fontes.',
        ],
      },
      {
        heading: 'O que uma listagem significa',
        paragraphs: [
          'O uso de IA no desenvolvimento de um plugin não afeta a listagem. As mesmas condições valem para todos os plugins, e não é preciso declarar o uso de IA.',
          'Esta plataforma não certifica segurança nem qualidade ao listar um plugin; por isso, verifique os plugins antes de usá-los.',
        ],
      },
    ],
  },
  submit: {
    title: 'Enviar um plugin',
    sections: [
      {
        heading: 'Plugins que você pode enviar',
        paragraphs: [
          'Esta plataforma lista plugins de áudio de código aberto enviados pelo autor que administra o repositório no GitHub.',
          { formats: 'Formatos suportados' },
          'Antes de enviar, confira se o repositório e a versão mais recente cumprem as condições de listagem: {{ORIGIN}}/policy',
          'Esta plataforma determina os formatos, o SO, as arquiteturas e a categoria de um plugin a partir dos bundles nos arquivos zip. Você não precisa informá-los.',
          'Não inclua a palavra VST no nome do plugin nem do repositório. O VST 3 SDK não permite VST em nomes de produtos, e a revisão aponta esse tipo de nome como recomendação.',
        ],
      },
      {
        heading: 'Verifique seu repositório antes de uma versão',
        paragraphs: [
          'Antes de publicar uma versão, peça ao seu agente de IA para executar submit_plugin no modo de verificação. Ele avalia as condições de listagem na versão mais recente e revisa o commit mais recente do branch padrão. Ele não registra o plugin. Você pode usar o modo de verificação até 5 vezes em 24 horas. O modo de verificação também exige login com o GitHub. Mesmo antes da primeira versão, o modo de verificação retorna como não verificadas as condições que exigem uma versão, com a forma de atendê-las, e verifica o formato de .audio-soko-kun/config.json no branch padrão. Uma versão listada precisa ser uma versão imutável, e não é possível adicionar arquivos depois de publicá-la: anexe todos os arquivos a um rascunho de versão e só então publique. As regras que procuram instruções para desativar um recurso de segurança ou executar um comando baixado também detectam frases que pedem para não fazer isso.',
          'A revisão segue os critérios de revisão, que são públicos no GitHub: https://github.com/AllegroMoltoV/audio-plugin-soko-kun/blob/main/docs/design/review-criteria.md',
          'O modo de verificação não inspeciona os arquivos compactados nem as assinaturas do macOS, porque essas verificações baixam os arquivos no GitHub Actions depois do registro. O agente mostra o que essas verificações exigem.',
        ],
      },
      {
        heading: 'Como enviar',
        paragraphs: [
          'Conecte seu cliente MCP a {{ORIGIN}}/mcp. No Claude Code, execute:',
          { code: 'claude mcp add --transport http audio-plugin-soko-kun {{ORIGIN}}/mcp' },
          'Entre com sua conta do GitHub pelo cliente MCP. No Claude Code, execute /mcp e escolha audio-plugin-soko-kun. No Codex, conecte com codex mcp add audio-plugin-soko-kun --url {{ORIGIN}}/mcp e depois entre com codex mcp login audio-plugin-soko-kun. Esta plataforma em si nunca recebe acesso de escrita aos seus repositórios do GitHub.',
          'Peça ao agente de IA para enviar o repositório, por exemplo: "Registre o plugin de áudio em https://github.com/<owner>/<repository>".',
        ],
      },
      {
        heading: 'Depois do envio',
        paragraphs: [
          'Esta plataforma registra o plugin como aguardando verificação. Até que uma versão passe nas verificações, o plugin não aparece na busca nem tem página própria.',
          'As verificações rodam a cada 15 minutos e costumam terminar em algumas horas.',
          'Esta plataforma lista apenas versões que passam nas verificações. Quando você publica uma nova versão no GitHub, esta plataforma a obtém e a verifica automaticamente. Não é preciso enviá-la de novo.',
          'Para ver os resultados, peça ao agente de IA para verificar seu plugin com list_my_plugins, por exemplo: "Verifique se a nova versão do meu plugin está listada". O agente mostra o estado de cada versão, os motivos de uma versão ou um arquivo não estar listado, os apontamentos da revisão e como corrigi-los.',
          'Algumas versões aguardam a confirmação de um administrador. Para explicar as mudanças de uma versão assim, abra uma issue no repositório desta plataforma: https://github.com/AllegroMoltoV/audio-plugin-soko-kun/issues',
        ],
      },
      {
        heading: 'Quando o envio é recusado',
        paragraphs: [
          'O agente de IA mostra o código do motivo e como corrigir. Corrija a causa e envie de novo.',
          {
            list: [
              'not_admin: Você não tem permissão de administrador no repositório. Peça a um administrador do repositório para enviá-lo.',
              'private_repository, archived_repository: Torne o repositório público ou desarquive-o.',
              'no_license: Coloque um arquivo LICENSE com uma licença de código aberto na raiz do repositório e publique uma nova versão.',
              'license_unrecognized: O GitHub não consegue identificar a licença. Mantenha apenas o texto padrão da licença em LICENSE, mova os demais avisos para NOTICE ou README e publique uma nova versão.',
              'license_not_open: Licencie o plugin sob uma licença aprovada pela OSI ou reconhecida como livre pela FSF e publique uma nova versão.',
              'no_release, no_verifiable_asset: Publique uma versão com os arquivos do plugin anexados (até 30 arquivos).',
              'no_archive: Anexe os bundles do plugin à versão como arquivos zip.',
              'not_immutable: Ative as versões imutáveis nas configurações do repositório e publique uma nova versão.',
              'no_attestation: Adicione actions/attest-build-provenance ao workflow de release para que todos os arquivos, incluindo instaladores, tenham atestação, e publique uma nova versão.',
              'duplicate: O repositório já está registrado. Abra a página dele pela busca.',
              'name_reserved: Um plugin listado usava este nome de repositório antes de ser renomeado. Renomeie o repositório para um nome que nenhum plugin listado tenha usado.',
              'rate_limited: Você pode enviar até 10 vezes em 24 horas. Tente de novo mais tarde.',
              'invalid_url: Informe a URL do repositório no formato https://github.com/<owner>/<repository>.',
              'not_found: O repositório não foi encontrado. Verifique a URL e se o repositório é público.',
              'unsupported_tag: Use uma tag de versão apenas com letras, números, ".", "-" e "_", com até 100 caracteres.',
              'github_unavailable: O GitHub não respondeu normalmente. Tente de novo mais tarde.',
            ],
          },
        ],
      },
      {
        heading: 'Quando uma versão ou um arquivo não é listado',
        paragraphs: [
          'O list_my_plugins mostra por que uma versão ou um arquivo não está listado. Os principais motivos que o autor corrige são os seguintes.',
          {
            list: [
              'vst2_detected: Um arquivo compactado contém um bundle ou ponto de entrada VST 2. Remova o VST 2 de todos os arquivos compactados e publique uma nova versão.',
              'no_plugin_detected, no_plugin_in_archive: Nenhum bundle de plugin suportado foi encontrado nos arquivos compactados. Coloque os bundles compilados nos arquivos zip. Os arquivos de código-fonte não precisam de mudança.',
              'content_undetermined: Um arquivo compactado contém arquivos que não podem ser inspecionados, como instaladores ou arquivos compactados aninhados. Coloque os bundles do plugin diretamente no arquivo zip.',
              'macos_not_signed, macos_adhoc, macos_not_developer_id, macos_not_notarized: Assine os bundles para macOS com um certificado Developer ID e notarize-os com a Apple.',
              'declaration_mismatch, not_declared: As declarações em .audio-soko-kun/config.json não batem com os arquivos compactados inspecionados. Corrija as declarações e publique uma nova versão.',
              'installer_not_guided: Instaladores não são indicados. Os usuários obtêm os plugins pelos arquivos zip.',
              'macos_lv2_not_guided: Um arquivo compactado contém apenas bundles LV2 para macOS, que não são indicados. Adicione bundles VST 3, CLAP ou Audio Unit para macOS, assinados com um certificado Developer ID e notarizados.',
            ],
          },
        ],
      },
      {
        heading: 'Logotipo e imagem de descrição',
        paragraphs: [
          'Os autores podem exibir um logotipo e uma imagem de descrição. Coloque as imagens na pasta .audio-soko-kun do repositório.',
          { code: '.audio-soko-kun/logo.png\n.audio-soko-kun/image.gif' },
          {
            list: [
              'Logotipo: nomeie o arquivo como logo. Mantenha-o com até 256 KB e até 1.024 px em cada lado.',
              'Imagem de descrição: nomeie o arquivo como image. Mantenha-a com até 1,5 MB e até 4.096 px em cada lado. Imagens GIF são reproduzidas como animações.',
            ],
          },
          'Esta plataforma não aceita SVG, que pode conter scripts; por isso, use a extensão png, jpg, jpeg, gif ou webp.',
          'Esta plataforma obtém as imagens na tag da versão mais recente; por isso, publique uma nova versão depois de alterar uma imagem.',
          'Esta plataforma não exibe imagens que não atendem a essas condições; por isso, verifique as condições se uma imagem não aparecer.',
        ],
      },
      {
        heading: '.audio-soko-kun/config.json',
        paragraphs: [
          'Os autores podem declarar o nome de exibição, a categoria e o SO, as arquiteturas e os formatos de cada arquivo compactado em .audio-soko-kun/config.json. Coloque o arquivo na mesma pasta .audio-soko-kun das imagens.',
          {
            code: '{\n  "name": "Simple Pitch Shift",\n  "category": "effect",\n  "assets": [\n    {\n      "pattern": "simple-pitchshift-*-windows-x64.zip",\n      "os": "windows",\n      "arch": ["x86_64"],\n      "formats": ["vst3", "clap"]\n    }\n  ]\n}',
          },
          {
            list: [
              'name: O nome de exibição, de 1 a 60 caracteres. Sem ele, esta plataforma mostra o nome do repositório.',
              'category: Um entre instrument, effect, analyzer, midi e utility. Esta plataforma o usa apenas quando não consegue deduzir a categoria pelos bundles.',
              'assets: Até 20 declarações de arquivos compactados. pattern corresponde ao nome do arquivo compactado, e * corresponde a qualquer texto. os é um entre windows, macos e linux. arch é um array com x86_64, x86 e arm64. formats é um array com vst3, clap, lv2 e au.',
            ],
          },
          'Todos os campos são opcionais. Esta plataforma obtém os formatos, o SO e as arquiteturas dos bundles inspecionados e usa as declarações apenas para conferi-los e escolher os arquivos compactados a indicar.',
          'Com assets, esta plataforma indica aos usuários apenas os arquivos compactados que correspondem a um pattern. Ela não lista uma versão cujo arquivo seja inválido, cujos arquivos compactados não correspondam a nenhum pattern ou cujos arquivos compactados inspecionados não batam com as declarações.',
          'Esta plataforma lê o arquivo na tag de cada nova versão; por isso, publique uma nova versão depois de alterar o arquivo.',
          'O menor arquivo válido declara apenas o nome de exibição:',
          { code: '{\n  "name": "Simple Pitch Shift"\n}' },
          'Esta plataforma decide a categoria nesta ordem. Primeiro, ela infere a categoria a partir dos bundles inspecionados: o type dos componentes Audio Unit (aumu, aufx, aumf, aumi) e as Sub Categories no moduleinfo.json dos bundles VST 3. Quando os bundles indicam várias categorias, instrument, midi, analyzer e effect têm prioridade nessa ordem. Se nada puder ser inferido, ela usa category deste arquivo e, se não houver, utility. Uma categoria inferida tem prioridade sobre a declarada.',
          'As features do CLAP não são usadas para a categoria, porque esta plataforma não executa os binários dos plugins. Bundles VST 3 sem moduleinfo.json, como os gerados com clap-wrapper, também não dão pistas. Para um plugin distribuído apenas como CLAP, declare category neste arquivo.',
        ],
      },
      {
        heading: 'Atualizar e retirar',
        paragraphs: [
          'Para atualizar a listagem, publique uma nova versão no GitHub. Esta plataforma a obtém automaticamente e a lista depois que ela passa nas verificações. Esta plataforma também atualiza o resumo a partir da descrição do repositório.',
          'Se uma nova versão não for listada, peça ao agente de IA para verificá-la com list_my_plugins. O agente mostra o motivo e como corrigir.',
          'Para retirar a listagem, torne o repositório privado ou exclua-o, ou peça a retirada como descrito na página Denunciar.',
        ],
      },
      {
        heading: 'Proteger suas versões',
        paragraphs: [
          'Crie a tag de cada versão em um commit do branch padrão. Uma versão cuja tag aponta para um commit fora do branch padrão aguarda a confirmação de um administrador.',
          'Qualquer pessoa com permissão de escrita no repositório pode criar uma versão. Esta plataforma recomenda proteger o branch padrão com um ruleset que bloqueie a exclusão e o push forçado e exija um pull request com pelo menos uma aprovação, e proteger as tags de versão com um ruleset de tags que permita apenas aos administradores do repositório criar, atualizar ou excluir tags. Essas configurações não são condições de listagem. Se você desenvolve sozinho, adicione o papel Repository admin à lista de bypass do ruleset do branch com "For pull requests only", para mesclar seu próprio pull request enquanto o push forçado e a exclusão continuam bloqueados. Não use "Always allow", que também permite push forçado e exclusão.',
        ],
      },
      {
        id: 'rename',
        heading: 'Renomear ou transferir o repositório',
        paragraphs: [
          'Esta plataforma acompanha o repositório pelo ID do GitHub, então você não precisa fazer nada ao renomear o repositório. A listagem passa para o novo nome em até 15 minutos, e os links para o nome antigo redirecionam para o novo.',
          'Não crie outro repositório com o nome antigo. Esta plataforma reserva o nome antigo para o plugin renomeado e não registra outro repositório com ele.',
          'Se você transferir o repositório para outra conta ou organização, a versão listada continua listada, e um administrador revisa a próxima versão antes de listá-la.',
          'Para mudar o nome de exibição, altere name em .audio-soko-kun/config.json e publique uma nova versão.',
        ],
      },
    ],
  },
  security: {
    title: 'Segurança e isenção de responsabilidade',
    sections: [
      {
        heading: 'Verificações automáticas',
        paragraphs: [
          'Esta plataforma verifica cada nova versão antes de listá-la. Ela lista apenas versões que passam nas verificações.',
          { formats: 'Formatos inspecionados' },
          {
            list: [
              'Procedência: Todos os arquivos precisam ter uma atestação de procedência da build. Um workflow do GitHub Actions verifica a assinatura. O workflow também confirma que a atestação corresponde ao repositório, à tag da versão, ao commit da tag e ao workflow de release registrado para o plugin.',
              'Versão imutável: A versão precisa ser imutável. Os arquivos de uma versão imutável não podem ser substituídos depois da publicação.',
              'Inspeção dos arquivos compactados: Um workflow do GitHub Actions baixa cada arquivo zip e lê os bundles de plugin dentro dele sem executá-los. Os formatos, o SO e as arquiteturas mostrados aqui vêm dessa inspeção. Uma versão que contém VST 2 em algum arquivo compactado não é listada, nem um arquivo compactado que não pode ser inspecionado.',
              'Assinatura e notarização no macOS: Um arquivo compactado com bundles para macOS só é indicado depois de confirmado que os bundles estão assinados com um certificado Developer ID e notarizados pela Apple.',
              'Consulta de malware: O SHA-256 de cada arquivo, publicado pelo GitHub, é consultado no MalwareBazaar, um banco de dados de amostras de malware conhecido. Os arquivos listados são consultados de novo regularmente.',
              'Mudanças desde a versão listada: As mudanças da versão listada até a nova versão são verificadas com regras. Uma versão que corresponde a uma regra aguarda a confirmação de um administrador.',
              'Revisão das práticas de desenvolvimento: Itens que os arquivos do repositório decidem, como actions fixadas, workflows de release e instruções de instalação no README, são verificados por regras. Apenas os itens que exigem ler texto, como a explicação no README sobre os dados que o plugin envia, são avaliados por um LLM, com fatos calculados pelo catálogo. Instruções que desativam um recurso de segurança ou executam um comando baixado são verificadas no README, nas notas da versão e nos outros documentos do repositório, incluindo edições das notas da versão após a listagem. Após a listagem, o README do branch padrão também é verificado uma vez por dia; se surgir uma nova instrução, nenhuma versão do plugin é listada até que um administrador a confirme. O código-fonte só é pesquisado como texto em busca de chamadas a APIs de rede e dessas instruções. Ele nunca é compilado nem executado. Uma versão com um apontamento grave aguarda a confirmação de um administrador.',
            ],
          },
          'Os critérios da revisão são públicos no GitHub: https://github.com/AllegroMoltoV/audio-plugin-soko-kun/blob/main/docs/design/review-criteria.md',
          'Versões que não passaram nas verificações não são exibidas. Até que uma nova versão passe, a versão listada anteriormente continua listada.',
          'Um arquivo apontado como malicioso suspende o plugin. Um administrador também pode suspender uma versão.',
          'As versões suspensas são anunciadas na página de avisos {{ORIGIN}}/notices com a versão, o SHA-256 de cada arquivo e o período em que foram listadas aqui. A página do plugin também mostra um aviso.',
        ],
      },
      {
        heading: 'Limites das verificações',
        paragraphs: [
          'A consulta de malware detecta apenas ameaças já conhecidas pelo MalwareBazaar. Malwares novos ou direcionados podem não ser detectados; por isso, use os plugins com cuidado mesmo quando nada for detectado.',
          'Uma assinatura Developer ID e a notarização mostram quem assinou um bundle para macOS e que a Apple o analisou. Elas não são prova de que o plugin é seguro.',
          'A inspeção dos arquivos compactados identifica os formatos pela estrutura dos bundles e pelas funções que eles exportam. Ela não consegue dizer se um plugin que implementa a interface VST 3 foi compilado com o VST 3 SDK.',
          'O SHA-256 identifica o arquivo que o GitHub servia no momento do registro. Compare o SHA-256 do arquivo baixado com o valor mostrado aqui.',
        ],
      },
      {
        heading: 'Isenção de responsabilidade',
        paragraphs: [
          'Esta plataforma é fornecida como está, sem garantia de qualquer tipo; por isso, instale os plugins por sua conta e risco. Os autores de cada plugin são responsáveis por seu software.',
        ],
      },
    ],
  },
  report: {
    title: 'Denunciar',
    sections: [
      {
        heading: 'Denúncias públicas',
        paragraphs: [
          'Informe dados incorretos ou problemas de política como issue no repositório do GitHub: https://github.com/AllegroMoltoV/audio-plugin-soko-kun/issues',
        ],
      },
      {
        heading: 'Denúncias privadas',
        paragraphs: [
          'Informe suspeitas de malware ou problemas de segurança de forma privada pelo private vulnerability reporting do GitHub: https://github.com/AllegroMoltoV/audio-plugin-soko-kun/security/advisories/new',
          'As denúncias são analisadas por uma pessoa. Uma denúncia, por si só, não suspende uma listagem. Quando um perigo claro é confirmado, a listagem é suspensa e continua suspensa mesmo que o repositório mude.',
        ],
      },
      {
        heading: 'Contato',
        paragraphs: ['Envie outras dúvidas ao contato do desenvolvedor exibido pelo botão abaixo.', { contact: true }],
      },
    ],
  },
  terms: {
    title: 'Termos de uso',
    sections: [
      {
        heading: 'Aplicação',
        paragraphs: [
          'Data de criação: 15 de novembro de 2026',
          'Estes termos se aplicam a todos que usam o site e o endpoint MCP do Audio Plugin Soko-kun (doravante, esta plataforma); por isso, use esta plataforma somente após concordar com estes termos.',
          'A versão em japonês destes termos prevalece, e as outras versões são traduções de referência.',
        ],
      },
      {
        heading: 'O que esta plataforma oferece',
        paragraphs: [
          'Esta plataforma coleta no GitHub informações sobre plugins de áudio, as lista e orienta os usuários aos arquivos que os autores publicaram no GitHub.',
          'Esta plataforma não hospeda arquivos e não garante a segurança, a qualidade ou o funcionamento dos plugins; por isso, verifique os plugins por sua conta antes de usá-los.',
        ],
      },
      {
        heading: 'Obrigações dos autores que enviam plugins',
        paragraphs: [
          'Os autores que enviam plugins devem cumprir as regras abaixo.',
          {
            list: [
              'Enviar apenas repositórios em que tenham permissão de administrador.',
              'Não publicar informações falsas.',
              'Não distribuir malware nem programas que prejudiquem os usuários.',
              'Não violar direitos de terceiros.',
            ],
          },
        ],
      },
      {
        heading: 'Atos proibidos',
        paragraphs: [
          'Não pratique nenhum dos atos abaixo.',
          {
            list: [
              'Prejudicar a operação desta plataforma com envios ou solicitações em massa.',
              'Acessar sem autorização ou explorar vulnerabilidades.',
              'Interferir com outros usuários ou com o operador.',
              'Violar leis ou regulamentos.',
            ],
          },
        ],
      },
      {
        heading: 'Suspensão e remoção de listagens',
        paragraphs: [
          'O operador pode suspender ou remover uma listagem sem aviso prévio quando confirmar uma violação destes termos ou um perigo aos usuários.',
        ],
      },
      {
        heading: 'Isenção de responsabilidade',
        paragraphs: [
          'O operador não se responsabiliza por danos decorrentes do uso desta plataforma ou da instalação de plugins, exceto em casos de dolo ou culpa grave do operador.',
          'O operador pode alterar o conteúdo desta plataforma, ou interromper ou encerrar o serviço, sem aviso prévio.',
        ],
      },
      {
        heading: 'Alterações destes termos',
        paragraphs: [
          'O operador altera estes termos quando necessário e publica nesta página os termos alterados e a data de vigência; por isso, confira esta página regularmente.',
        ],
      },
      {
        heading: 'Lei aplicável e foro',
        paragraphs: [
          'Estes termos são regidos pelas leis do Japão.',
          'O tribunal distrital com jurisdição sobre o endereço do operador é o foro exclusivo de primeira instância para disputas sobre estes termos ou esta plataforma.',
        ],
      },
      {
        heading: 'Contato',
        paragraphs: [
          'Envie dúvidas sobre estes termos ao contato do desenvolvedor exibido pelo botão abaixo.',
          { contact: true },
        ],
      },
    ],
  },
  privacy: {
    title: 'Política de privacidade',
    sections: [
      {
        heading: 'Política de privacidade',
        paragraphs: [
          'A versão em japonês desta política de privacidade prevalece, e as outras versões são traduções de referência.',
        ],
      },
      {
        heading: 'O que é armazenado',
        paragraphs: [
          'Ao entrar para enviar um plugin, esta plataforma armazena seu ID de usuário e nome de login do GitHub, o token de acesso do GitHub usado para verificar as permissões do repositório e o token de atualização usado para renová-lo. Esta plataforma armazena os tokens criptografados e os usa apenas para verificar as permissões nos repositórios enviados.',
          'Para evitar abusos, esta plataforma armazena por pouco tempo um hash irreversível do seu endereço IP. Navegar pelo catálogo não usa cookies, exceto um que lembra o idioma escolhido.',
        ],
      },
      {
        heading: 'Suas opções',
        paragraphs: [
          'Você pode revogar o acesso a qualquer momento nas configurações do GitHub, em Applications. Para pedir a exclusão dos seus dados, envie uma denúncia privada como descrito na página Denunciar.',
        ],
      },
      {
        heading: 'Contato',
        paragraphs: ['Envie outras dúvidas ao contato do desenvolvedor exibido pelo botão abaixo.', { contact: true }],
      },
    ],
  },
};
