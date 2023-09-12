#!/bin/bash

VER=$(git rev-parse --short HEAD)
DATE=$(date "+%Y-%m-%d")
BUILD_PATH="build/$VER-$DATE"
if [ -e "$BUILD_PATH" ]; then
    rm -rf "$BUILD_PATH"
fi

# Compile typescript
npx tsc

NATIVE_BUILD="none"
if [ "$(uname)" == "Darwin" ]; then
    NATIVE_BUILD="osx"
elif [ "$(uname)" == "Linux" ]; then
    NATIVE_BUILD="linux"
fi

if [ ! "$NATIVE_BUILD" == "none" ]; then
    # Make linux/osx build
    if [ $NATIVE_BUILD == "osx" ]; then
        export MACOSX_DEPLOYMENT_TARGET=10.10
    fi
    mkdir -p "$BUILD_PATH/$NATIVE_BUILD"
    qjsc -o "$BUILD_PATH/$NATIVE_BUILD/shmupcc-sht" "dist/main.js"
    curl -s 'https://raw.githubusercontent.com/bellard/quickjs/master/LICENSE' > "$BUILD_PATH/$NATIVE_BUILD/LICENSE-quickjs.txt"
    tar -C "$BUILD_PATH" -czf "build/shmupcc-sht-$VER-$DATE-$NATIVE_BUILD.tar.gz" "$NATIVE_BUILD"
fi

if [ ! -e "win32-bin" ]; then
    echo "Please place qjs.exe and libwinpthread-1.dll from the qjs release into win32-bin directory in order to create the windows release" 
else
    # Create a windows bundle and launcher
    mkdir -p "$BUILD_PATH/win32"
    curl -s 'https://raw.githubusercontent.com/bellard/quickjs/master/LICENSE' > "$BUILD_PATH/win32/LICENSE-quickjs.txt"
    cp -r "dist" "$BUILD_PATH/win32"
    cp -r "win32-bin" "$BUILD_PATH/win32"
    echo -e "@echo off\r
%~dp0/win32-bin/qjs.exe %~dp0/dist/main.js %*\r" > "$BUILD_PATH/win32/shmupcc-sht.bat"

    tar -C "$BUILD_PATH" -czf "build/shmupcc-sht-$VER-$DATE-win32.zip" "win32"
fi
