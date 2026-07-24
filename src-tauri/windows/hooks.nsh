; Converte Facil — NSIS installer hooks (Tauri 2)
; Downloads/installs a pinned LibreOffice MSI after the app files are in place.
; LibreOffice is NOT removed on uninstall (shared Office dependency).

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "LibreOffice: checking whether document conversion is ready…"

  ; Already installed (common paths)
  IfFileExists "$PROGRAMFILES64\LibreOffice\program\soffice.exe" libreoffice_done
  IfFileExists "$PROGRAMFILES\LibreOffice\program\soffice.exe" libreoffice_done
  ReadEnvStr $R7 LOCALAPPDATA
  ${If} $R7 != ""
    IfFileExists "$R7\converte-facil\LibreOffice\program\soffice.exe" libreoffice_done
  ${EndIf}

  ; Script is bundled as an app resource next to the installed app files.
  StrCpy $R9 "$INSTDIR\install-libreoffice-setup.ps1"
  IfFileExists "$R9" 0 libreoffice_missing_script

  DetailPrint "LibreOffice: running setup helper (download ~350 MB if needed)…"

  ; Pass -Silent when the NSIS installer itself is silent (/S).
  ${If} ${Silent}
    ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$R9" -Silent' $R8
  ${Else}
    ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$R9"' $R8
  ${EndIf}

  DetailPrint "LibreOffice: setup helper exit code $R8"
  ${If} $R8 != 0
    DetailPrint "LibreOffice: not installed during setup — Documents mode can install it later."
    ${IfNot} ${Silent}
      MessageBox MB_ICONINFORMATION|MB_OK "LibreOffice was not installed during setup.$\r$\n$\r$\nYou can install it later from Documents mode in Converte Facil."
    ${EndIf}
  ${EndIf}
  Goto libreoffice_done

  libreoffice_missing_script:
    DetailPrint "LibreOffice: setup helper script missing at $R9"
  libreoffice_done:
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Intentionally empty — do not uninstall LibreOffice with Converte Facil.
!macroend
