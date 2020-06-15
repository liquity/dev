import { tint, shade, readableColor } from "polished";
import { Theme } from "theme-ui";

const baseColors = {
  black: "#000",
  white: "#FFF",
  blue: "#36ADF1",
  green: "#28C081",
  yellow: "#FD9D28",
  red: "#DC2C10",
  blurple: "#4E3FCE",
  consensysblue: "#3259D6"
};

const colors = {
  blurple: {
    base: baseColors.blurple,
    text: readableColor(baseColors.blurple),
    light: tint(0.2, baseColors.blurple),
    dark: shade(0.2, baseColors.blurple)
  },
  blue: {
    base: baseColors.blue,
    text: readableColor(baseColors.blue),
    light: tint(0.9, baseColors.blue),
    dark: shade(0.4, baseColors.blue)
  },
  green: {
    base: baseColors.green,
    text: baseColors.white,
    light: tint(0.9, baseColors.green),
    dark: shade(0.4, baseColors.green)
  },
  yellow: {
    base: baseColors.yellow,
    text: readableColor(baseColors.yellow),
    light: tint(0.9, baseColors.yellow),
    dark: shade(0.4, baseColors.yellow)
  },
  red: {
    base: baseColors.red,
    text: readableColor(baseColors.red),
    light: tint(0.9, baseColors.red),
    dark: shade(0.4, baseColors.red)
  }
};

const theme: Theme = {
  fontSizes: [12, 14, 16, 20, 24, 32, 48, 64],
  fontWeights: [0, 300, 400, 600, 700],
  letterSpacings: [0, 1, 2, 4, 8],
  breakpoints: ["40em", "52em", "64em"],
  lineHeights: {
    solid: 1,
    title: 1.25,
    copy: 1.5
  },
  fonts: {
    serif: "athelas, georgia, times, serif",
    sansSerif: '"Source Sans Pro", -apple-system, sans-serif'
  },
  space: [0, 4, 8, 16, 32, 64, 128, 256],
  radii: ["0", "4px", "8px", "16px"],
  borders: [0, "1px solid transparent"],
  borderWidths: ["0", "1px", "2px", "4px"],
  shadows: [
    "0",
    "0px 2px 4px rgba(0, 0, 0, 0.1)",
    "0px 8px 16px rgba(0, 0, 0, 0.1)",
    "0 7px 14px rgba(50,50,93,.1)"
  ],
  colors: {
    text: "#3F3D4B",
    background: "#fff",
    primary: colors.blurple.base,
    "primary-light": colors.blurple.light,
    "primary-dark": colors.blurple.dark,
    blue: baseColors.consensysblue,
    black: "#000",
    "near-black": "#111",
    "dark-gray": "#333",
    "mid-gray": "#555",
    grey: "#CCC",
    silver: "#999",
    "light-silver": "#aaa",
    "moon-gray": "#ccc",
    "light-gray": "#eee",
    "near-white": "#f4f4f4",
    white: "#fff",
    transparent: "transparent",
    blacks: [
      "rgba(0,0,0,.0125)",
      "rgba(0,0,0,.025)",
      "rgba(0,0,0,.05)",
      "rgba(0,0,0,.1)",
      "rgba(0,0,0,.2)",
      "rgba(0,0,0,.3)",
      "rgba(0,0,0,.4)",
      "rgba(0,0,0,.5)",
      "rgba(0,0,0,.6)",
      "rgba(0,0,0,.7)",
      "rgba(0,0,0,.8)",
      "rgba(0,0,0,.9)"
    ],
    whites: [
      "rgba(255,255,255,.0125)",
      "rgba(255,255,255,.025)",
      "rgba(255,255,255,.05)",
      "rgba(255,255,255,.1)",
      "rgba(255,255,255,.2)",
      "rgba(255,255,255,.3)",
      "rgba(255,255,255,.4)",
      "rgba(255,255,255,.5)",
      "rgba(255,255,255,.6)",
      "rgba(255,255,255,.7)",
      "rgba(255,255,255,.8)",
      "rgba(255,255,255,.9)"
    ],
    success: colors.green.base,
    warning: colors.yellow.base,
    danger: colors.red.base,
    info: colors.blue.base
  },
  zIndices: [0, 9, 99, 999, 9999],
  buttons: {
    primary: {
      color: colors.blurple.text,
      backgroundColor: colors.blurple.base
    },
    success: {
      color: colors.green.text,
      backgroundColor: colors.green.base
    },
    danger: {
      color: colors.red.text,
      backgroundColor: colors.red.base
    }
  }
};

export default theme;
