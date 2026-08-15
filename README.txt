BOMBACHA NAVEGADOR — FIREFOX ANDROID / FENIX 0.2.4
===================================================

O QUE É
- Firefox Android/Fenix oficial da Mozilla, com a interface normal do Firefox.
- O workflow baixa a branch oficial "release" da Mozilla no momento da compilação.
- A Bombacha vem embutida como WebExtension dentro do APK.
- Abre/seleciona automaticamente https://vk.com/board111248001 depois que a extensão está pronta.
- APK separado do Firefox oficial: package com.bombacha.browser.
- Build somente ARM64 para reduzir tempo/tamanho.

BOMBACHA EMBUTIDA: 1.0.64
- Embed: YouTube, Instagram, TikTok, X/Twitter e Vocaroo.
- Proteção contra embeds duplicados.
- Links externos diretos.
- Autor original/cache mobile quando disponível.
- Botão Atualizar dentro do cabeçalho do fórum.

IMPORTANTE SOBRE A VERIFICAÇÃO "ROBÔ" DO VK
- Este projeto NÃO tenta burlar CAPTCHA/verificação anti-bot.
- Como agora é o Firefox/Fenix completo, cookies, armazenamento e comportamento do navegador são os normais do Firefox, o que pode reduzir verificações indevidas.
- Se o VK exigir uma verificação legítima, ela deve ser concluída pelo usuário.

COMO USAR NO SEU REPOSITÓRIO ATUAL
1. Extraia este ZIP.
2. GitHub > Add file > Upload files.
3. Arraste TODO o conteúdo extraído.
4. Commit changes.
5. O arquivo .github/workflows/build-apk.yml substitui o workflow antigo.
6. Abra Actions > Build Bombacha Firefox Android.
7. Quando ficar verde, baixe o artifact "Bombacha-Navegador-Firefox-Android".
8. Extraia e instale o APK no celular.

Se o build falhar, o workflow cria automaticamente:
Bombacha-Fenix-Diagnostics
com patch.log, bootstrap.log, build.log, commit da Mozilla, espaço em disco e diff aplicado.


CORRECAO 0.2.4
================
- Corrige falha "No space left on device" do mach bootstrap.
- Mozilla SDK, Android SDK, Gradle e caches agora ficam no volume grande do workspace.
- Reserva mais espaco na particao raiz do runner para ferramentas do sistema.
- O patch da Bombacha/Fenix permanece o mesmo, pois o diagnostico confirmou que ele foi aplicado com sucesso.


CORRECAO 0.2.4
- Bootstrap nao-interativo agora usa o nome oficial documentado pela Mozilla: GeckoView/Firefox for Android.
- Artifact Mode e ARM64 sao ativados explicitamente no .mozconfig.
- Executa ./mach build antes do Gradle, necessario para gerar buildid.h e instalar artefatos Gecko.
- Bootstrap, mach build e Gradle possuem timeout individual para nunca ficar horas travado silenciosamente.
- Logs separados de bootstrap, mach build e Gradle sao enviados no Diagnostics em caso de falha.


CORREÇÃO 0.2.4
- Diagnóstico confirmou que o bootstrap concluía, mas era encerrado pelo timeout de 35 minutos.
- Bootstrap agora tem limite de 65 minutos.
- mach build e Gradle continuam limitados a 35 minutos cada.
- O workflow grava bootstrap-ok.txt e estado do disco após o bootstrap.
