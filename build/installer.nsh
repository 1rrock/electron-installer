!macro customInstall
    ; 현재 실행 중인 installer.exe 경로를 기준으로 "publish" 경로 설정
    StrCpy $0 "$EXEPATH\..\"

    ; e-abr 폴더를 설치 디렉토리로 복사
    CopyFiles "$0\*.*" "$INSTDIRx"
!macroend
