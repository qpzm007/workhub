@echo off
chcp 65001 > nul
title WorkHub 배포 초기화 도구
echo ===================================================
echo     WorkHub 배포용 초기화 스크립트
echo ===================================================
echo.
echo [주의] 이 스크립트는 API 키와 데이터를 초기화합니다.
echo        USB/압축 배포 전에만 실행하세요!
echo.
set /p CONFIRM=정말로 초기화하시겠습니까? (Y/N): 
if /i not "%CONFIRM%"=="Y" (
    echo 취소되었습니다.
    pause
    exit /b
)

echo.
echo [1/4] settings.json 초기화 중...
echo {"apiKey":"","aiContext":"","desktopSyncPath":"","dbPathTasks":"","dbPathWorkCards":"","customNames":{"dashboard":"대시보드","search":"통합 검색","vendors":"명함첩","components":"공유 자료실","orders":"프로젝트 & 업무 관리","allTasks":"전체 업무 리스트"}} > settings.json
echo       완료.

echo.
echo [2/4] 데이터베이스 초기화 중...
if exist "WorkHub_DB\workhub.sqlite" (
    del /f /q "WorkHub_DB\workhub.sqlite"
    echo       기존 DB 삭제 완료.
) else (
    echo       DB 파일 없음 (건너뜀).
)

echo.
echo [3/4] 백업 폴더 정리 중...
for /d %%D in (WorkHub_Backup_*) do (
    rmdir /s /q "%%D"
    echo       백업 삭제: %%D
)

echo.
echo [4/4] 임시 업데이트 폴더 정리 중...
if exist "WorkHub_Update_tmp" (
    rmdir /s /q "WorkHub_Update_tmp"
    echo       임시 폴더 삭제 완료.
)

echo.
echo ===================================================
echo   초기화 완료! 이제 USB 복사 또는 ZIP 압축하세요.
echo ===================================================
pause
