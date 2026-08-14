BOMBACHA NAVEGADOR ANDROID — TESTE 0.1.0

O que esta versão faz:
- Abre diretamente em: https://vk.com/board111248001
- Usa GeckoView, o motor Gecko/Firefox para apps Android.
- Leva a Bombacha Extensões 1.0.62 embutida dentro do APK.
- A extensão é instalada internamente pelo GeckoView; não depende de assinatura do AMO para funcionar dentro deste app.
- Possui Voltar, Avançar, Início, barra de endereço e Atualizar.
- Depuração remota do GeckoView fica habilitada nesta versão de TESTE.

IMPORTANTE:
Este pacote é o PROJETO Android Studio, não um APK já compilado.
O ambiente usado para gerar este pacote não possui o Android SDK/Gradle completo para produzir o APK localmente.

Para compilar no Android Studio:
1. Abra a pasta Bombacha_Navegador_Android_0.1.0.
2. Aguarde o Gradle sincronizar.
3. Build > Build APK(s).

A configuração usa:
- Android Gradle Plugin 8.13.0
- Gradle 8.13
- compileSdk/targetSdk 36
- Java 17
- GeckoView Nightly 156.0.20260814041239

A extensão embutida está em:
app/src/main/assets/bombacha/

Para atualizar a Bombacha no navegador no futuro:
substitua os arquivos dessa pasta pelos arquivos descompactados da nova versão da extensão e aumente a versão no manifest.json da extensão.
