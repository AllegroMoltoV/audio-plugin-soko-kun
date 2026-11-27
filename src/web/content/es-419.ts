// 固定ページの中南米スペイン語版。利用規約とプライバシーポリシーは日本語版、ほかのページは英語版の参考訳。
import type { PageContent, PageKey } from '../content';

export const es419: Record<PageKey, PageContent> = {
  about: {
    title: '¿Qué es Audio Plugin Soko-kun?',
    sections: [
      {
        heading: 'Qué es este servicio',
        paragraphs: [
          'Audio Plugin Soko-kun es un registro independiente y abierto de plugins de audio de código abierto. Es un servicio no oficial que no tiene relación con los creadores de los formatos de plugin ni con los desarrolladores de DAW.',
          { formats: 'Formatos compatibles' },
          'El registro no aloja archivos. Registra información de repositorios públicos de GitHub y enlaza a los archivos zip que los autores publican en GitHub Releases.',
          'Esta plataforma no aloja archivos; por eso, descarga los archivos directamente de GitHub.',
          'Los archivos de esta lista siempre se pueden descargar gratis desde las versiones públicas en GitHub. Algunos autores también venden sus plugins o aceptan donaciones en otros sitios. Las funciones de pago, los servicios de pago, las restricciones de los materiales incluidos y las páginas de apoyo que se muestran en la página de un plugin los declara el autor, y esta plataforma no los verifica. La política de la lista explica qué formas de distribución pueden estar en la lista: {{ORIGIN}}/policy',
        ],
      },
      {
        heading: 'Uso con agentes de IA (MCP)',
        paragraphs: [
          'Conecta un cliente MCP a la dirección /mcp de este sitio. En Claude Code, ejecuta:',
          { code: 'claude mcp add --transport http audio-plugin-soko-kun {{ORIGIN}}/mcp' },
          'En Codex, ejecuta:',
          { code: 'codex mcp add audio-plugin-soko-kun --url {{ORIGIN}}/mcp' },
          'Buscar y ver detalles funciona sin iniciar sesión en GitHub. Para enviar un repositorio, inicia sesión con GitHub desde el cliente MCP (en Claude Code, ejecuta /mcp; en Codex, ejecuta codex mcp login audio-plugin-soko-kun). Esta plataforma en sí nunca obtiene acceso de escritura a tus repositorios de GitHub.',
          'Ejemplos: "Busca un plugin de pitch shift que funcione en Windows", "Busca una reverb CLAP para Mac con Apple Silicon", "Registra el plugin de audio de este repositorio de GitHub", "Revisa si la nueva versión de mi plugin está en la lista".',
        ],
      },
      {
        heading: 'Apoyar el desarrollo',
        paragraphs: [
          'Audio Plugin Soko-kun es gratuito. Si quieres ayudar con los costos de operación y el desarrollo, puedes patrocinar al desarrollador en GitHub Sponsors: https://github.com/sponsors/AllegroMoltoV',
          'El patrocinio es opcional y no afecta la publicación ni la revisión de los plugins.',
        ],
      },
    ],
  },
  policy: {
    title: 'Política de la lista',
    sections: [
      {
        heading: 'Condiciones para estar en la lista',
        paragraphs: [
          { important: true },
          'Esta plataforma incluye plugins de audio de código abierto enviados por el autor que administra el repositorio de GitHub y que cumplen todas estas condiciones.',
          { formats: 'Formatos compatibles' },
          {
            list: [
              'El repositorio es público en GitHub y no está archivado.',
              'La licencia que GitHub detecta en la etiqueta de la versión está aprobada por la OSI o reconocida como libre por la FSF, según la SPDX License List.',
              'La versión es una versión inmutable (immutable release). Activa las versiones inmutables en la configuración del repositorio antes de publicarla.',
              'Todos los archivos de la versión, incluidos los instaladores, tienen una atestación de procedencia de la compilación (build provenance attestation) creada por el workflow de publicación del repositorio, por ejemplo con actions/attest-build-provenance.',
              'Los plugins se distribuyen como archivos zip. Esta plataforma solo guía a los usuarios a archivos zip que contienen bundles VST 3, CLAP, LV2 o Audio Unit. No guía a instaladores como archivos exe, msi o pkg.',
              'Ningún archivo comprimido contiene VST 2. Si algún archivo comprimido de una versión contiene un bundle o un punto de entrada VST 2, esta plataforma no incluye la versión.',
              'Los bundles para macOS están firmados con un certificado Developer ID y notarizados por Apple. Esta plataforma no guía a archivos comprimidos cuyos bundles para macOS no pasan esta revisión. No se guía a los bundles LV2 para macOS, porque Gatekeeper no evalúa los bundles LV2.',
              'La versión pasa las demás revisiones automáticas descritas en la página Seguridad, incluida la consulta en una base de datos de malware conocido.',
            ],
          },
          'La revisión de la licencia se basa en la licencia que GitHub detecta en el repositorio. Esta plataforma no garantiza las licencias de los materiales incluidos, como samples, presets o fuentes.',
          'Algunos autores también venden sus plugins o aceptan pagos por ellos. Que un plugin pueda estar en la lista depende de cómo se distribuyen sus archivos:',
          {
            list: [
              'A. Los mismos archivos son gratuitos en GitHub y también se venden u ofrecen a cambio de donaciones en otros sitios: el plugin puede estar en la lista.',
              'B. Algunas funciones se desbloquean con un pago: el plugin puede estar en la lista si el autor declara paidFeatures en .audio-soko-kun/config.json.',
              'C. Solo se distribuyen archivos de pago, sin código fuente público: el plugin no está en la lista, porque los usuarios no pueden revisar el contenido antes de comprarlo.',
            ],
          },
        ],
      },
      {
        heading: 'Qué significa estar en la lista',
        paragraphs: [
          'Haber usado IA en el desarrollo de un plugin no afecta la lista. Las mismas condiciones aplican a todos los plugins y no es necesario declarar el uso de IA.',
          'Esta plataforma no certifica la seguridad ni la calidad al incluir un plugin; por eso, revisa los plugins antes de usarlos.',
          'Los archivos de la lista siempre se pueden descargar gratis desde las versiones públicas en GitHub. Las funciones de pago, los servicios de pago, las restricciones de los materiales incluidos y las páginas de apoyo que se muestran en la página de un plugin los declara el autor en .audio-soko-kun/config.json. Esta plataforma no verifica estas declaraciones.',
        ],
      },
      {
        heading: 'Licencias para plugins de audio',
        paragraphs: [
          'Esta breve guía ayuda a los autores a elegir una licencia. No es asesoría legal, y esta plataforma no ofrece ninguna garantía legal.',
          {
            list: [
              'El VST 3 SDK y el CLAP SDK están disponibles bajo la licencia MIT; por eso, la licencia de tu plugin queda a tu elección.',
              'JUCE está disponible bajo la AGPLv3 o bajo una licencia comercial. Un plugin hecho con JUCE sin licencia comercial debe publicarse bajo la AGPLv3.',
              'Indica cada material incluido, como respuestas al impulso, datos HRTF, modelos, samples, fuentes e imágenes, con su origen y su licencia en el README o en el NOTICE.',
              'Si un material incluido prohíbe el uso comercial o tiene otras restricciones de uso, declara restrictedAssets como true en .audio-soko-kun/config.json.',
            ],
          },
        ],
      },
    ],
  },
  submit: {
    title: 'Enviar un plugin',
    sections: [
      {
        heading: 'Plugins que puedes enviar',
        paragraphs: [
          { important: true },
          'Esta plataforma incluye plugins de audio de código abierto enviados por el autor que administra el repositorio de GitHub.',
          { formats: 'Formatos compatibles' },
          'Antes de enviar, revisa que el repositorio y su versión más reciente cumplan las condiciones de la lista: {{ORIGIN}}/policy',
          'Esta plataforma determina los formatos, el SO, las arquitecturas y la categoría de un plugin a partir de los bundles de sus archivos zip. No necesitas indicarlos.',
          'No incluyas la palabra VST en el nombre de tu plugin ni de tu repositorio. El VST 3 SDK no permite VST en nombres de productos, y la revisión señala ese tipo de nombre como recomendación.',
        ],
      },
      {
        heading: 'Crea tu plugin con Claude Code',
        paragraphs: [
          'Si creas tu plugin con Claude Code, puedes instalar una skill que reúne lo que el desarrollador de esta plataforma aprendió al crear seis plugins de audio. Cubre la planificación, una plantilla de proyecto que compila CLAP y VST 3 desde el mismo código con clap-wrapper, la validación con pluginval y clap-validator en CI, las pruebas de una GUI sin pantalla, las versiones con atestaciones de procedencia de compilación y la inclusión en esta plataforma.',
          'Instálala ejecutando lo siguiente en una terminal:',
          {
            code: 'claude plugin marketplace add AllegroMoltoV/audio-plugin-soko-kun\nclaude plugin install audio-soko-kun-plugin-dev@audio-plugin-soko-kun',
          },
          'El plugin también conecta Claude Code con el servidor MCP de esta plataforma. La skill sigue las condiciones de la lista y los criterios de revisión de esta plataforma: https://github.com/AllegroMoltoV/audio-plugin-soko-kun/blob/main/docs/design/review-criteria.md',
        ],
      },
      {
        heading: 'Revisa tu repositorio antes de una versión',
        paragraphs: [
          'Antes de publicar una versión, pide a tu agente de IA que ejecute submit_plugin en modo de comprobación. Este modo evalúa las condiciones de la lista en la versión más reciente y revisa el commit más reciente de la rama predeterminada. No registra el plugin. Puedes usar el modo de comprobación hasta 5 veces en 24 horas. El modo de comprobación también requiere iniciar sesión con GitHub. Incluso antes de la primera versión, el modo de comprobación devuelve como no comprobadas las condiciones que requieren una versión, con cómo cumplirlas, y comprueba el formato de .audio-soko-kun/config.json en la rama predeterminada. Una versión publicada debe ser una versión inmutable y no se pueden añadir archivos después de publicarla: adjunta todos los archivos a un borrador de versión y luego publícala. Las reglas que buscan instrucciones para desactivar una función de seguridad o ejecutar un comando descargado también detectan frases que piden no hacerlo.',
          'La revisión sigue los criterios de revisión, que son públicos en GitHub: https://github.com/AllegroMoltoV/audio-plugin-soko-kun/blob/main/docs/design/review-criteria.md',
          'El modo de comprobación no inspecciona los archivos comprimidos ni las firmas de macOS, porque esas revisiones descargan los archivos en GitHub Actions después del registro. El agente muestra lo que exigen esas revisiones.',
        ],
      },
      {
        heading: 'Cómo enviar',
        paragraphs: [
          'Conecta tu cliente MCP a {{ORIGIN}}/mcp. En Claude Code, ejecuta:',
          { code: 'claude mcp add --transport http audio-plugin-soko-kun {{ORIGIN}}/mcp' },
          'Inicia sesión con tu cuenta de GitHub desde el cliente MCP. En Claude Code, ejecuta /mcp y elige audio-plugin-soko-kun. En Codex, conéctate con codex mcp add audio-plugin-soko-kun --url {{ORIGIN}}/mcp y luego inicia sesión con codex mcp login audio-plugin-soko-kun. Esta plataforma en sí nunca obtiene acceso de escritura a tus repositorios de GitHub.',
          'Pide al agente de IA que envíe tu repositorio, por ejemplo: "Registra el plugin de audio de https://github.com/<owner>/<repository>".',
        ],
      },
      {
        heading: 'Después de enviar',
        paragraphs: [
          'Esta plataforma registra el plugin en espera de revisión. Hasta que una versión pasa las revisiones, el plugin no aparece en la búsqueda ni tiene página propia.',
          'Las revisiones se ejecutan cada 15 minutos y suelen terminar en unas horas.',
          'Esta plataforma incluye solo versiones que pasan las revisiones. Cuando publicas una nueva versión en GitHub, esta plataforma la obtiene y la revisa automáticamente. No necesitas enviarla de nuevo.',
          'Para ver los resultados, pide a tu agente de IA que revise tu plugin con list_my_plugins, por ejemplo: "Revisa si la nueva versión de mi plugin está en la lista". El agente muestra el estado de cada versión, los motivos por los que una versión o un archivo no está en la lista, las observaciones de la revisión y cómo corregirlas.',
          'Algunas versiones esperan la confirmación de un administrador. Para explicar los cambios de una versión así, abre un issue en el repositorio de esta plataforma: https://github.com/AllegroMoltoV/audio-plugin-soko-kun/issues',
        ],
      },
      {
        heading: 'Cuando se rechaza un envío',
        paragraphs: [
          'El agente de IA muestra el código del motivo y cómo corregirlo. Corrige la causa y vuelve a enviar.',
          {
            list: [
              'not_admin: No tienes permiso de administrador en el repositorio. Pide a un administrador del repositorio que lo envíe.',
              'private_repository, archived_repository: Haz público el repositorio o desarchívalo.',
              'no_license: Coloca un archivo LICENSE con una licencia de código abierto en la raíz del repositorio y publica una nueva versión.',
              'license_unrecognized: GitHub no puede identificar la licencia. Deja solo el texto estándar de la licencia en LICENSE, mueve los demás avisos a NOTICE o README y publica una nueva versión.',
              'license_not_open: Licencia el plugin con una licencia aprobada por la OSI o reconocida como libre por la FSF y publica una nueva versión.',
              'no_release, no_verifiable_asset: Publica una versión con los archivos del plugin adjuntos (hasta 30 archivos).',
              'no_archive: Adjunta los bundles del plugin a la versión como archivos zip.',
              'not_immutable: Activa las versiones inmutables en la configuración del repositorio y publica una nueva versión.',
              'no_attestation: Agrega actions/attest-build-provenance al workflow de publicación para que todos los archivos, incluidos los instaladores, tengan atestación, y publica una nueva versión.',
              'duplicate: El repositorio ya está registrado. Abre su página desde la búsqueda.',
              'name_reserved: Un plugin de la lista usaba este nombre de repositorio antes de cambiar de nombre. Cambia el nombre del repositorio a uno que ningún plugin de la lista haya usado.',
              'rate_limited: Puedes enviar hasta 10 veces en 24 horas. Vuelve a intentarlo más tarde.',
              'invalid_url: Indica la URL del repositorio con el formato https://github.com/<owner>/<repository>.',
              'not_found: No se encontró el repositorio. Revisa la URL y que el repositorio sea público.',
              'unsupported_tag: Usa una etiqueta de versión solo con letras, números, ".", "-" y "_", de hasta 100 caracteres.',
              'github_unavailable: GitHub no respondió con normalidad. Vuelve a intentarlo más tarde.',
            ],
          },
        ],
      },
      {
        heading: 'Cuando una versión o un archivo no está en la lista',
        paragraphs: [
          'list_my_plugins muestra por qué una versión o un archivo no está en la lista. Los principales motivos que corrige el autor son los siguientes.',
          {
            list: [
              'vst2_detected: Un archivo comprimido contiene un bundle o un punto de entrada VST 2. Quita VST 2 de todos los archivos comprimidos y publica una nueva versión.',
              'no_plugin_detected, no_plugin_in_archive: No se encontró ningún bundle de plugin compatible en los archivos comprimidos. Coloca los bundles compilados en los archivos zip. Los archivos de código fuente no necesitan cambios.',
              'content_undetermined: Un archivo comprimido contiene elementos que no se pueden inspeccionar, como instaladores, archivos comprimidos anidados, rutas no seguras, enlaces que salen del bundle, nombres duplicados o entradas de carpeta con datos. Coloca los bundles del plugin directamente en el archivo zip y elimina estos elementos.',
              'macos_not_signed, macos_adhoc, macos_not_developer_id, macos_not_notarized: Firma los bundles para macOS con un certificado Developer ID y notarízalos con Apple.',
              'declaration_mismatch, not_declared: Las declaraciones de .audio-soko-kun/config.json no coinciden con los archivos comprimidos inspeccionados. Corrige las declaraciones y publica una nueva versión.',
              'installer_not_guided: No se guía a los instaladores. Los usuarios obtienen los plugins de los archivos zip.',
              'macos_lv2_not_guided: Un archivo comprimido solo contiene bundles LV2 para macOS, a los que no se guía. Añade bundles VST 3, CLAP o Audio Unit para macOS, firmados con un certificado Developer ID y notarizados.',
            ],
          },
        ],
      },
      {
        heading: 'Logotipo e imagen descriptiva',
        paragraphs: [
          'Los autores pueden mostrar un logotipo y una imagen descriptiva. Coloca las imágenes en la carpeta .audio-soko-kun del repositorio.',
          { code: '.audio-soko-kun/logo.png\n.audio-soko-kun/image.gif' },
          {
            list: [
              'Logotipo: nombra el archivo logo. Mantenlo en 256 KB como máximo y en 1,024 px por lado como máximo.',
              'Imagen descriptiva: nombra el archivo image. Mantenla en 1.5 MB como máximo y en 4,096 px por lado como máximo. Las imágenes GIF se reproducen como animaciones.',
            ],
          },
          'Esta plataforma no acepta SVG, que puede contener scripts; por eso, usa la extensión png, jpg, jpeg, gif o webp.',
          'Esta plataforma obtiene las imágenes en la etiqueta de la versión más reciente; por eso, publica una nueva versión después de cambiar una imagen.',
          'Esta plataforma no muestra imágenes que no cumplen estas condiciones; por eso, revisa las condiciones si una imagen no aparece.',
        ],
      },
      {
        heading: '.audio-soko-kun/config.json',
        paragraphs: [
          'Los autores pueden declarar el nombre visible, la categoría y el SO, las arquitecturas y los formatos de cada archivo comprimido en .audio-soko-kun/config.json. Coloca el archivo en la misma carpeta .audio-soko-kun que las imágenes.',
          {
            code: '{\n  "name": "Simple Pitch Shift",\n  "category": "effect",\n  "assets": [\n    {\n      "pattern": "simple-pitchshift-*-windows-x64.zip",\n      "os": "windows",\n      "arch": ["x86_64"],\n      "formats": ["vst3", "clap"]\n    }\n  ]\n}',
          },
          {
            list: [
              'name: El nombre visible, de 1 a 60 caracteres. Si no lo indicas, esta plataforma muestra el nombre del repositorio.',
              'category: Uno de instrument, effect, analyzer, midi y utility. Esta plataforma lo usa solo cuando no puede deducir la categoría a partir de los bundles.',
              'assets: Hasta 20 declaraciones de archivos comprimidos. pattern coincide con el nombre del archivo comprimido, y * coincide con cualquier texto. os es uno de windows, macos y linux. arch es un arreglo con x86_64, x86 y arm64. formats es un arreglo con vst3, clap, lv2 y au.',
            ],
          },
          'Todos los campos son opcionales. Esta plataforma toma los formatos, el SO y las arquitecturas de los bundles inspeccionados, y usa las declaraciones solo para comprobarlos y elegir los archivos comprimidos a los que guía.',
          'Con assets, esta plataforma solo guía a los usuarios a los archivos comprimidos que coinciden con un pattern. No incluye una versión cuyo archivo no es válido, cuyos archivos comprimidos no coinciden con ningún pattern o cuyos archivos comprimidos inspeccionados no coinciden con las declaraciones.',
          'Esta plataforma lee el archivo en la etiqueta de cada nueva versión; por eso, publica una nueva versión después de cambiar el archivo.',
          'El archivo válido más pequeño declara solo el nombre visible:',
          { code: '{\n  "name": "Simple Pitch Shift"\n}' },
          'Esta plataforma decide la categoría en este orden. Primero, la infiere a partir de los bundles inspeccionados: el type de los componentes Audio Unit (aumu, aufx, aumf, aumi) y las Sub Categories del moduleinfo.json de los bundles VST 3. Cuando los bundles indican varias categorías, instrument, midi, analyzer y effect tienen prioridad en ese orden. Si no se puede inferir nada, usa category de este archivo y, si no existe, utility. Una categoría inferida tiene prioridad sobre la declarada.',
          'Las features de CLAP no se usan para la categoría, porque esta plataforma no ejecuta los binarios de los plugins. Los bundles VST 3 sin moduleinfo.json, como los generados con clap-wrapper, tampoco dan pistas. Para un plugin distribuido solo como CLAP, declara category en este archivo.',
          'Los autores también pueden declarar cuatro datos opcionales sobre pagos y materiales incluidos:',
          {
            code: '{\n  "name": "Simple Pitch Shift",\n  "paidFeatures": false,\n  "paidServices": ["Example Cloud"],\n  "restrictedAssets": true,\n  "supportUrl": "https://example.booth.pm/items/1"\n}',
          },
          {
            list: [
              'paidFeatures: true si algunas funciones se desbloquean pagando al autor; si no, false.',
              'paidServices: Un arreglo de hasta 5 nombres, de hasta 60 caracteres cada uno, de servicios de pago que los usuarios contratan aparte. [] declara que no hay ninguno.',
              'restrictedAssets: true si un material incluido tiene restricciones de uso, como la prohibición del uso comercial; si no, false.',
              'supportUrl: Una página de apoyo o compra, de hasta 300 caracteres. Solo se aceptan URL https en booth.pm, gumroad.com, itch.io, patreon.com, ko-fi.com o sus subdominios, y https://github.com/sponsors/<name>.',
            ],
          },
          'Esta plataforma muestra estos datos en la página del plugin como declaraciones del autor y no los verifica. Un dato que no se escribe aparece como no declarado por el autor. Un valor no válido solo hace que ese dato se trate como no declarado, y no detiene la publicación en la lista. list_my_plugins muestra qué datos se trataron como no declarados.',
          'Escribe supportUrl y cualquier otro enlace externo, como una tienda, una página de apoyo o la página de licencia de un material, desde la primera versión. Si se agrega un supportUrl u otro enlace externo después de la primera versión en la lista, esa versión espera la confirmación de un administrador (diff-external-link). Pon los enlaces de tienda en supportUrl.',
          'La obligación "No publicar información falsa" de los términos de uso también abarca estas declaraciones: {{ORIGIN}}/terms',
        ],
      },
      {
        heading: 'Actualizar y retirar',
        paragraphs: [
          'Para actualizar la publicación, publica una nueva versión en GitHub. Esta plataforma la obtiene automáticamente y la incluye después de que pasa las revisiones. Esta plataforma también actualiza el resumen a partir de la descripción del repositorio.',
          'Si una nueva versión no aparece en la lista, pide a tu agente de IA que la revise con list_my_plugins. El agente muestra el motivo y cómo corregirlo.',
          'Para retirar la publicación, haz privado el repositorio o elimínalo, o pide el retiro como se describe en la página Reportar.',
        ],
      },
      {
        heading: 'Proteger tus versiones',
        paragraphs: [
          'Crea la etiqueta de cada versión en un commit de la rama predeterminada. Una versión cuya etiqueta apunta a un commit fuera de la rama predeterminada espera la confirmación de un administrador.',
          'Cualquier persona con permiso de escritura en el repositorio puede crear una versión. Esta plataforma recomienda proteger la rama predeterminada con un ruleset que bloquee la eliminación y el push forzado y exija un pull request con al menos una aprobación, y proteger las etiquetas de versión con un ruleset de etiquetas que solo permita a los administradores del repositorio crear, actualizar o eliminar etiquetas. Estos ajustes no son condiciones de publicación. Si desarrollas solo, añade el rol Repository admin a la lista de bypass del ruleset de la rama con "For pull requests only", para poder fusionar tu propio pull request mientras el push forzado y la eliminación siguen bloqueados. No uses "Always allow", que también permite el push forzado y la eliminación.',
        ],
      },
      {
        id: 'rename',
        heading: 'Cambiar el nombre o transferir el repositorio',
        paragraphs: [
          'Esta plataforma sigue el repositorio por su ID de GitHub, así que no necesitas hacer nada al cambiar el nombre del repositorio. La publicación pasa al nuevo nombre en un máximo de 15 minutos, y los enlaces al nombre anterior redirigen al nuevo.',
          'No crees otro repositorio con el nombre anterior. Esta plataforma reserva el nombre anterior para el plugin renombrado y no registra otro repositorio con ese nombre.',
          'Si transfieres el repositorio a otra cuenta u organización, la versión publicada sigue publicada, y un administrador revisa la siguiente versión antes de publicarla.',
          'Para cambiar el nombre visible, cambia name en .audio-soko-kun/config.json y publica una nueva versión.',
        ],
      },
    ],
  },
  security: {
    title: 'Seguridad y descargo de responsabilidad',
    sections: [
      {
        heading: 'Revisiones automáticas',
        paragraphs: [
          'Esta plataforma revisa cada nueva versión antes de incluirla. Solo incluye versiones que pasan las revisiones.',
          { formats: 'Formatos inspeccionados' },
          {
            list: [
              'Procedencia: Todos los archivos deben tener una atestación de procedencia de la compilación. Un workflow de GitHub Actions verifica su firma. El workflow también confirma que la atestación coincide con el repositorio, la etiqueta de la versión, el commit de la etiqueta y el workflow de publicación registrado para el plugin.',
              'Versión inmutable: La versión debe ser inmutable. Los archivos de una versión inmutable no se pueden reemplazar después de publicarla.',
              'Inspección de los archivos comprimidos: Un workflow de GitHub Actions descarga cada archivo zip y lee los bundles de plugin que contiene sin ejecutarlos. Los formatos, el SO y las arquitecturas que se muestran aquí provienen de esta inspección. No se incluye una versión que contenga VST 2 en algún archivo comprimido ni un archivo comprimido que no se pueda inspeccionar.',
              'Firma y notarización en macOS: Un archivo comprimido con bundles para macOS solo se guía después de confirmar que sus bundles están firmados con un certificado Developer ID y notarizados por Apple.',
              'Consulta de malware: El SHA-256 de cada archivo, publicado por GitHub, se consulta en MalwareBazaar, una base de datos de muestras de malware conocido. Los archivos incluidos se vuelven a consultar con regularidad.',
              'Cambios desde la versión incluida: Los cambios desde la versión incluida hasta la nueva versión se revisan con reglas. Una versión que coincide con una regla espera la confirmación de un administrador.',
              'Revisión de prácticas de desarrollo: Los elementos que deciden los archivos del repositorio, como las actions fijadas, los workflows de publicación y las instrucciones de instalación del README, se comprueban con reglas. Solo los elementos que requieren leer texto, como la explicación del README sobre los datos que envía el plugin, los evalúa un LLM, con hechos calculados por el catálogo. Las instrucciones que desactivan una función de seguridad o ejecutan un comando descargado se comprueban en el README, las notas de la versión y los otros documentos del repositorio, incluidas las ediciones de las notas de la versión después de publicarse. Después de publicarse, el README de la rama predeterminada también se comprueba una vez al día; si aparece una nueva instrucción, no se publica ninguna versión del plugin hasta que un administrador la confirme. El código fuente solo se busca como texto para encontrar llamadas a APIs de red y estas instrucciones. Nunca se compila ni se ejecuta. Una versión con una observación grave espera la confirmación de un administrador.',
            ],
          },
          'Los criterios de la revisión son públicos en GitHub: https://github.com/AllegroMoltoV/audio-plugin-soko-kun/blob/main/docs/design/review-criteria.md',
          'Las versiones que no pasaron las revisiones no se muestran. Hasta que una nueva versión pasa, la versión incluida anteriormente sigue en la lista.',
          'Un archivo marcado como malicioso suspende el plugin. Un administrador también puede suspender una versión.',
          'Las versiones suspendidas se anuncian en la página de avisos {{ORIGIN}}/notices con la versión, el SHA-256 de cada archivo y el período en que estuvieron en la lista aquí. La página del plugin también muestra una advertencia.',
        ],
      },
      {
        heading: 'Límites de las revisiones',
        paragraphs: [
          'La consulta de malware solo detecta amenazas ya conocidas por MalwareBazaar. El malware nuevo o dirigido podría no detectarse; por eso, usa los plugins con cuidado aunque no haya detecciones.',
          'Una firma Developer ID y la notarización muestran quién firmó un bundle para macOS y que Apple lo analizó. No son prueba de que el plugin sea seguro.',
          'La inspección de los archivos comprimidos identifica los formatos por la estructura de los bundles y las funciones que exportan. No puede saber si un plugin que implementa la interfaz VST 3 se compiló con el VST 3 SDK.',
          'El SHA-256 identifica el archivo que GitHub entregaba al momento del registro. Compara el SHA-256 del archivo descargado con el valor que se muestra aquí.',
        ],
      },
      {
        heading: 'Descargo de responsabilidad',
        paragraphs: [
          'Esta plataforma se ofrece tal cual, sin garantía de ningún tipo; por eso, instala los plugins bajo tu propio riesgo. Los autores de cada plugin son responsables de su software.',
        ],
      },
    ],
  },
  report: {
    title: 'Reportar',
    sections: [
      {
        heading: 'Reportes públicos',
        paragraphs: [
          'Reporta información incorrecta o problemas de política como issue en el repositorio de GitHub: https://github.com/AllegroMoltoV/audio-plugin-soko-kun/issues',
          'Reporta de la misma forma las declaraciones incorrectas de los autores sobre funciones de pago, servicios de pago, materiales con restricciones o páginas de apoyo.',
        ],
      },
      {
        heading: 'Reportes privados',
        paragraphs: [
          'Reporta sospechas de malware o problemas de seguridad en privado mediante el private vulnerability reporting de GitHub: https://github.com/AllegroMoltoV/audio-plugin-soko-kun/security/advisories/new',
          'Una persona revisa los reportes. Un reporte por sí solo no suspende una publicación. Cuando se confirma un peligro claro, la publicación se suspende y sigue suspendida aunque el repositorio cambie.',
        ],
      },
      {
        heading: 'Contacto',
        paragraphs: [
          'Envía otras consultas al contacto del desarrollador que muestra el botón de abajo.',
          { contact: true },
        ],
      },
    ],
  },
  terms: {
    title: 'Términos de uso',
    sections: [
      {
        heading: 'Aplicación',
        paragraphs: [
          'Fecha de establecimiento: 15 de noviembre de 2026',
          'Estos términos se aplican a todas las personas que usan el sitio web y el endpoint MCP de Audio Plugin Soko-kun (en adelante, esta plataforma); por eso, usa esta plataforma solo después de aceptar estos términos.',
          'La versión en japonés de estos términos prevalece, y las demás versiones son traducciones de referencia.',
        ],
      },
      {
        heading: 'Lo que ofrece esta plataforma',
        paragraphs: [
          'Esta plataforma recopila de GitHub información sobre plugins de audio, la publica y guía a los usuarios a los archivos que los autores publicaron en GitHub.',
          'Esta plataforma no aloja archivos ni garantiza la seguridad, la calidad o el funcionamiento de los plugins; por eso, revisa los plugins bajo tu propia responsabilidad antes de usarlos.',
        ],
      },
      {
        heading: 'Obligaciones de los autores que envían plugins',
        paragraphs: [
          'Los autores que envían plugins deben cumplir lo siguiente.',
          {
            list: [
              'Enviar solo repositorios en los que tengan permiso de administrador.',
              'No publicar información falsa.',
              'No distribuir malware ni programas que dañen a los usuarios.',
              'No infringir los derechos de terceros.',
            ],
          },
        ],
      },
      {
        heading: 'Actos prohibidos',
        paragraphs: [
          'No realices ninguno de los siguientes actos.',
          {
            list: [
              'Perjudicar la operación de esta plataforma con envíos o solicitudes masivos.',
              'Acceder sin autorización o aprovechar vulnerabilidades.',
              'Interferir con otros usuarios o con el operador.',
              'Infringir leyes o reglamentos.',
            ],
          },
        ],
      },
      {
        heading: 'Suspensión y retiro de publicaciones',
        paragraphs: [
          'El operador puede suspender o retirar una publicación sin aviso previo cuando confirme una infracción de estos términos o un peligro para los usuarios.',
        ],
      },
      {
        heading: 'Descargo de responsabilidad',
        paragraphs: [
          'El operador no es responsable de los daños derivados del uso de esta plataforma o de la instalación de plugins, salvo en casos de dolo o culpa grave del operador.',
          'El operador puede cambiar el contenido de esta plataforma, o interrumpir o terminar el servicio, sin aviso previo.',
        ],
      },
      {
        heading: 'Cambios en estos términos',
        paragraphs: [
          'El operador cambia estos términos cuando es necesario y publica en esta página los términos modificados y su fecha de vigencia; por eso, revisa esta página con regularidad.',
        ],
      },
      {
        heading: 'Ley aplicable y jurisdicción',
        paragraphs: [
          'Estos términos se rigen por las leyes de Japón.',
          'El tribunal de distrito con jurisdicción sobre el domicilio del operador es el tribunal exclusivo de primera instancia para las disputas sobre estos términos o esta plataforma.',
        ],
      },
      {
        heading: 'Contacto',
        paragraphs: [
          'Envía tus preguntas sobre estos términos al contacto del desarrollador que muestra el botón de abajo.',
          { contact: true },
        ],
      },
    ],
  },
  privacy: {
    title: 'Política de privacidad',
    sections: [
      {
        heading: 'Política de privacidad',
        paragraphs: [
          'La versión en japonés de esta política de privacidad prevalece, y las demás versiones son traducciones de referencia.',
        ],
      },
      {
        heading: 'Qué se guarda',
        paragraphs: [
          'Al iniciar sesión para enviar un plugin, esta plataforma guarda tu ID de usuario y nombre de inicio de sesión de GitHub, el token de acceso de GitHub que se usa para revisar los permisos del repositorio y el token de actualización que se usa para renovarlo. Esta plataforma guarda los tokens cifrados y solo los usa para revisar los permisos en los repositorios enviados.',
          'Para evitar abusos, esta plataforma guarda por poco tiempo un hash irreversible de tu dirección IP. Navegar por el catálogo no usa cookies, salvo una que recuerda el idioma elegido.',
          'El texto que envías con el botón Buscar con la IA de Google no se guarda en esta plataforma. Se pasa al Modo IA de Google, donde aplica la Política de Privacidad de Google.',
        ],
      },
      {
        heading: 'Tus opciones',
        paragraphs: [
          'Puedes revocar el acceso en cualquier momento en la configuración de GitHub, en Applications. Para pedir que se borren tus datos, envía un reporte privado como se describe en la página Reportar.',
        ],
      },
      {
        heading: 'Contacto',
        paragraphs: [
          'Envía otras consultas al contacto del desarrollador que muestra el botón de abajo.',
          { contact: true },
        ],
      },
    ],
  },
};
