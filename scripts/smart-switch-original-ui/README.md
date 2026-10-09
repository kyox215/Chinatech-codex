# Original interface lab4 build inputs

First-party patch/build helpers only. These scripts use project-local `.local/` inputs and tools; they do not download OEM source or grant system privileges. Preserve authorized lab1/lab3 inputs and SHA values; keep keys outside source.

1. Prepare JDK21, Android37 android.jar/build tools16, shaded ZXing, the authorized lab1/lab3 public APKs and lab1 classes5 smali in `.local/smart-switch-experiment/final-smali`.
2. Run `python3 scripts/smart-switch-original-ui/build-original-shell.py` to restore launcher filters and original main navigation.
3. Run `python3 scripts/smart-switch-original-ui/patch-original-flow.py`. Assemble generated `.local/smart-switch-original-ui/flow-smali` with a compatible smali assembler into `.local/smart-switch-original-ui/classes5.dex`.
4. Run `python3 scripts/smart-switch-original-ui/build-candidate.py`; JDK/SDK/shaded library paths and private signing input paths are explicit in the script. The script builds both package variants, checks signatures and keeps compile stubs out of the APK.
5. Native acceptance is a separate gate. Building alone deliberately reports actualTransferVerified=false and does not authorize release. Do not replace frozen release bytes without fresh tests.

Complete OEM smali, APK inputs, private key/password and test APKs are not in the source archive. Verification and limitations are in `docs/smart-switch-original-ui.md`.
