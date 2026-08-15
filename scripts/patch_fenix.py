from pathlib import Path
import shutil
import sys
import json
import re

ROOT = Path(sys.argv[1]).resolve()
KIT = Path(sys.argv[2]).resolve()
FENIX_APP = ROOT / "mobile/android/fenix/app"
APP_KT = FENIX_APP / "src/main/java/org/mozilla/fenix/FenixApplication.kt"
BUILD_GRADLE = FENIX_APP / "build.gradle"
ASSETS = FENIX_APP / "src/main/assets/bombacha"

for required in (APP_KT, BUILD_GRADLE):
    if not required.exists():
        raise SystemExit(f"Estrutura atual do Fenix não encontrada: {required}")

# Copia a Bombacha para dentro do APK.
if ASSETS.exists():
    shutil.rmtree(ASSETS)
shutil.copytree(KIT / "bombacha", ASSETS)

manifest = json.loads((ASSETS / "manifest.json").read_text(encoding="utf-8"))
BOMBACHA_ID = manifest["browser_specific_settings"]["gecko"]["id"]
BOMBACHA_VERSION = manifest["version"]

# App separado do Firefox oficial, mas mantendo toda a UI Fenix.
bg = BUILD_GRADLE.read_text(encoding="utf-8")
if 'applicationId "org.mozilla"' not in bg:
    raise SystemExit("applicationId base esperado não encontrado no Fenix release.")
bg = bg.replace('applicationId "org.mozilla"', 'applicationId "com.bombacha"', 1)

if 'applicationIdSuffix ".fenix.debug"' not in bg:
    raise SystemExit("applicationIdSuffix do debug não encontrado.")
bg = bg.replace('applicationIdSuffix ".fenix.debug"', 'applicationIdSuffix ".browser"', 1)

# Só ARM64: praticamente todos os celulares Android atuais e reduz build/artifact.
abi_old = 'include "armeabi-v7a", "arm64-v8a", "x86_64"'
if abi_old in bg:
    bg = bg.replace(abi_old, 'include "arm64-v8a"', 1)

BUILD_GRADLE.write_text(bg, encoding="utf-8")

# Nome do aplicativo na variante debug.
res_dir = FENIX_APP / "src/debug/res/values"
res_dir.mkdir(parents=True, exist_ok=True)
(res_dir / "bombacha_branding.xml").write_text(
    '''<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">Bombacha Navegador</string>\n</resources>\n''',
    encoding="utf-8",
)

text = APP_KT.read_text(encoding="utf-8")

# Precisamos do delay apenas para abrir o fórum depois da restauração de abas.
if "import kotlinx.coroutines.delay" not in text:
    anchor_import = "import kotlinx.coroutines.async\n"
    if anchor_import not in text:
        raise SystemExit("Import anchor de coroutines mudou no Fenix.")
    text = text.replace(anchor_import, anchor_import + "import kotlinx.coroutines.delay\n", 1)

# Instala a WebExtension logo depois do suporte de extensões estar pronto.
call_anchor = "        initializeWebExtensionSupport()\n"
if call_anchor not in text:
    raise SystemExit("initializeWebExtensionSupport() não encontrado.")
text = text.replace(call_anchor, call_anchor + "        installBombachaBuiltIn()\n", 1)

# Helpers. O fórum só é aberto após o Gecko confirmar que a extensão embutida está instalada.
helper_anchor = "    private fun initializeRemoteSettingsSupport() {"
if helper_anchor not in text:
    raise SystemExit("Ponto para inserir helpers Bombacha não encontrado.")

helpers = f'''    private fun installBombachaBuiltIn() {{
        components.core.engine.installBuiltInWebExtension(
            id = "{BOMBACHA_ID}",
            url = "resource://android/assets/bombacha/",
            onSuccess = {{
                logger.info("Bombacha built-in {BOMBACHA_VERSION} pronta")
                applicationScope.launch {{
                    // restoreBrowserState() também roda no Main; este pequeno atraso evita
                    // competir com a restauração inicial e garante que o primeiro tópico
                    // já seja aberto com os content scripts disponíveis.
                    delay(900)
                    openBombachaBoard()
                }}
            }},
            onError = {{ error ->
                logger.error("Falha ao instalar Bombacha built-in", error)
            }},
        )
    }}

    private fun openBombachaBoard() {{
        val boardDesktop = "https://vk.com/board111248001"
        val boardMobile = "https://m.vk.ru/board111248001"
        val existing = components.core.store.state.tabs.firstOrNull {{ tab ->
            tab.content.url.startsWith(boardDesktop) || tab.content.url.startsWith(boardMobile)
        }}
        if (existing != null) {{
            components.useCases.tabsUseCases.selectTab(existing.id)
        }} else {{
            components.useCases.tabsUseCases.addTab(boardDesktop, selectTab = true)
        }}
    }}

'''
text = text.replace(helper_anchor, helpers + helper_anchor, 1)
APP_KT.write_text(text, encoding="utf-8")

# Marcador útil dentro do fonte/build.
(FENIX_APP / "BOMBACHA_BUILD.txt").write_text(
    "\n".join([
        "Bombacha Navegador — Firefox Android/Fenix release",
        f"WebExtension {BOMBACHA_VERSION}",
        f"ID {BOMBACHA_ID}",
        "Página inicial https://vk.com/board111248001",
        "Canal fonte: mozilla-firefox/firefox release",
        "ABI: arm64-v8a",
        "",
    ]),
    encoding="utf-8",
)

print(f"Patch aplicado com sucesso: Bombacha {BOMBACHA_VERSION} / {BOMBACHA_ID}")
