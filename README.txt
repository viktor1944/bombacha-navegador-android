BOMBACHA NAVEGADOR ANDROID — TESTE 0.1.2

PRONTO PARA GITHUB ACTIONS.

O que foi corrigido nesta versão:
- Adicionado o repositório oficial Mozilla Nightly: https://nightly.maven.mozilla.org/maven2
- GeckoView Nightly passa a usar a versão disponível mais recente automaticamente.
- Workflow .github/workflows/build-apk.yml incluído no pacote.
- Build configurado com Java 17, Gradle 8.13 e Android SDK 36.
- O APK gerado aparece em Actions > execução concluída > Artifacts > Bombacha-Navegador-APK.

Uso:
1. Extraia este ZIP.
2. No repositório GitHub, use Add file > Upload files.
3. Arraste TODO o conteúdo extraído, inclusive a pasta .github.
   OBS.: no Windows, a pasta .github pode parecer oculta. Ela já está dentro deste ZIP.
4. Faça Commit changes na branch main.
5. Vá para Actions. O build inicia automaticamente.
6. Quando ficar verde, baixe o artifact Bombacha-Navegador-APK.
7. Extraia o artifact e instale app-debug.apk no Android.

Página inicial:
https://vk.com/board111248001

A extensão Bombacha continua embutida em:
app/src/main/assets/bombacha/


CORRECAO 0.1.2:
- AndroidX habilitado para compatibilidade com GeckoView e dependencias Android modernas.
- Jetifier habilitado como compatibilidade adicional durante os testes.
