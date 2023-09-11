#!/bin/bash

if [ ! -e "win32-bin" ]; then
    echo "Please place qjs.exe and libwinpthread-1.dll from the qjs release into win32-bin directory in order to create the windows release" 
    exit 1
fi

VER=$(git rev-parse --short HEAD)
DATE=$(date "+%Y-%m-%d")
BUILD_PATH="build/$VER-$DATE"
if [ -e "$BUILD_PATH" ]; then
    rm -rf "$BUILD_PATH"
fi

# Compile typescript
npx tsc

# Make linux build
mkdir -p "$BUILD_PATH/linux"
qjsc -o "$BUILD_PATH/linux/shmupcc-sht" "dist/main.js"
curl -s 'https://raw.githubusercontent.com/bellard/quickjs/master/LICENSE' > "$BUILD_PATH/linux/LICENSE-quickjs.txt"

# Create a windows bundle and launcher
mkdir -p "$BUILD_PATH/win32"
cp "$BUILD_PATH/linux/LICENSE-quickjs.txt" "$BUILD_PATH/win32/LICENSE-quickjs.txt"
cp -r "dist" "$BUILD_PATH/win32"
cp -r "win32-bin" "$BUILD_PATH/win32"
echo -e "@echo off\r
%~dp0/win32-bin/qjs.exe %~dp0/dist/main.js %*\r
" > "$BUILD_PATH/win32/shmupcc-sht.bat"

tar -C "$BUILD_PATH" -czf "build/shmupcc-sht-$VER-$DATE-linux.tar.gz" "linux"
tar -C "$BUILD_PATH" -czf "build/shmupcc-sht-$VER-$DATE-win32.zip" "win32"
