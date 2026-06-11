@echo off
title Upload Automatico para o GitHub
color 0B

echo ========================================================
echo        BEM-VINDO AO UPLOADER DO COBBLESAS LAUNCHER
echo ========================================================
echo.
echo Preparando para empacotar e enviar seus arquivos...
echo Repositorio destino: https://github.com/dennyun/CobbleSaS
echo.

:: Inicializa o Git caso ainda nao exista (nao estraga nada se ja existir)
git init

:: Garante que a branch principal se chama "main" (padrao do github moderno)
git branch -M main

:: Configura o caminho do seu repositorio (remove o antigo se existir e coloca o novo)
git remote remove origin 2>nul
git remote add origin https://github.com/dennyun/CobbleSaS.git

:: Adiciona todas as pastas e arquivos modificados
echo [1/3] Detectando arquivos modificados...
git add .

:: Pega a data e hora do Windows nativamente
set mydate=%date%
set mytime=%time:~0,5%

echo [2/3] Salvando o historico (Commit)...
git commit -m "Atualizacao do Launcher - %mydate% as %mytime%"

:: Envia para os servidores da Microsoft/GitHub (Forçando o envio inicial)
echo [3/3] Enviando arquivos para a nuvem... (Isso pode demorar um pouco)
git push -u origin main --force

echo.
echo ========================================================
echo                    UPLOAD CONCLUIDO!
echo ========================================================
echo.
echo Verifique a aba "Actions" no seu GitHub para ver
echo o computador da Apple gerando o seu arquivo .dmg!
echo.
pause
