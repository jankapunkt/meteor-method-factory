#!/usr/bin/env bash
meteor reset
METEOR_PACKAGE_DIRS=../../ meteor update --all-packages
METEOR_PACKAGE_DIRS=../../ meteor npm install
METEOR_PACKAGE_DIRS=../../ meteor test --driver-package practicalmeteor:mocha
