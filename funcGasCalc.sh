#!/bin/bash

truffle.cmd migrate --reset
truffle.cmd exec ./utils/functionGasCalculator.js

