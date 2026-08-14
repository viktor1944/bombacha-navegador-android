BOMBACHA NAVEGADOR ANDROID 0.1.3

PARA TESTAR:
1. Extraia este ZIP.
2. No repositório GitHub existente, use Add file > Upload files.
3. Arraste TODO o conteúdo extraído por cima do projeto.
4. Commit changes.
5. Actions inicia sozinho.

SE DER VERDE:
- Abra a execução.
- Baixe o artifact Bombacha-Navegador-APK-0.1.3.
- Extraia e instale app-debug.apk no Android.

SE DER VERMELHO:
- A própria execução agora gera o artifact Bombacha-Build-Diagnostics-0.1.3.
- Baixe esse ZIP e envie ao ChatGPT. Não precisa tirar print de log nem procurar a linha do erro.

MUDANÇAS DE BUILD:
- GeckoView ESTÁVEL e FIXO: 153.0.20260810162159.
- AndroidX ativado.
- Java 17 / Gradle 8.13 / compileSdk 36.
- Workflow guarda build.log e relatório de problemas automaticamente.
- Atualizado checkout/setup-java para v5.

MUDANÇAS MOBILE:
- Atualizar agora aparece no cabeçalho de Discussões como “↻ Atualizar”.
- Autor, quando encontrado/cacheado, aparece pequeno no lado direito como “Autor: Nome”.
- Embeds continuam com proteção contra duplicação.
