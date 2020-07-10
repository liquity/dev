import { Theme } from "theme-ui";

import { breakOnWide } from "./utils/breakpoints";

const baseColors = {
  blue: "#1542cd",
  purple: "#745ddf",
  cyan: "#2eb6ea",
  green: "#28c081",
  yellow: "#fd9d28",
  red: "#dc2c10",
  lightRed: "#ff755f"
};

const colors = {
  primary: baseColors.blue,
  secondary: baseColors.purple,
  accent: baseColors.cyan,

  success: baseColors.green,
  warning: baseColors.yellow,
  danger: baseColors.red,
  dangerHover: baseColors.lightRed,
  info: baseColors.blue,
  invalid: "pink",

  text: "#293147",
  background: "white",
  border: "#c8cbd0",
  muted: "#eaebed",
  "muted-transparent": "rgba(45, 55, 75, 0.1)"
};

const cardBase = {
  bg: "rgba(255, 255, 255, 0.75)",
  borderRadius: 2,
  boxShadow: 2
} as const;

const buttonBase = {
  cursor: "pointer"
};

const theme: Theme = {
  breakpoints: ["40em", "52em", "64em"],
  space: [0, 4, 6, 8, 12, 16, 24, 32, 48, 64, 128, 256, 512],

  radii: [0, 8, 16],

  fonts: {
    body: "Montserrat, sans-serif",
    heading: "Karbon, sans-serif",
    monospace: "Menlo, monospace"
  },

  fontSizes: [13, 14, 16, 20, 24, 32, 48, 64, 96],

  fontWeights: {
    regular: 400,
    medium: 500,
    bold: 600,

    body: 400,
    heading: 600
  },

  lineHeights: {
    body: 1.5,
    heading: 1.25
  },

  colors,

  borders: [0, "1px solid"],

  shadows: ["0", "0px 4px 8px rgba(0, 0, 0, 0.1)", "0px 8px 16px rgba(0, 0, 0, 0.1)"],

  text: {
    logo: {
      fontFamily: "heading",
      fontWeight: "regular",
      letterSpacing: "-0.005em"
    },

    title: {
      textTransform: "uppercase",
      fontFamily: "body",
      fontWeight: "body",
      letterSpacing: "0.06em",
      lineHeight: 1
    }
  },

  cards: {
    primary: {
      ...cardBase,

      p: 5,

      h2: {
        fontSize: 3,
        mb: 3
      },

      table: {
        fontSize: 1,
        letterSpacing: "-0.02em",
        borderCollapse: "collapse",

        td: {
          p: 0
        }
      }
    }
  },

  buttons: {
    primary: {
      ...buttonBase,

      px: 7,
      py: 5,

      fontFamily: "body",
      fontWeight: "bold",
      borderRadius: 1,

      ":hover": {
        bg: "secondary"
      },

      ":focus": {
        bg: "secondary"
      },

      svg: {
        mr: 3
      }
    },

    icon: {
      ...buttonBase,

      color: "primary",

      ":hover": {
        color: "accent"
      },

      ":focus": {
        color: "accent"
      }
    },

    cardlike: {
      ...buttonBase,
      ...cardBase,

      display: "flex",

      px: 4,
      py: "0.5em",

      color: "text",
      fontFamily: "heading",
      fontWeight: "heading",
      fontSize: 3,
      lineHeight: 1,

      ":hover": {
        bg: "secondary",
        color: "white"
      },

      ":focus": {
        bg: "secondary",
        color: "white"
      }
    }
  },

  forms: {
    input: {
      p: 5,

      fontFamily: "heading",
      fontWeight: "medium",
      fontSize: 5,
      lineHeight: 1,

      border: 1,
      borderColor: "border",
      borderRadius: 1,
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
      borderRight: "none",

      ":disabled": {
        opacity: 1,
        WebkitTextFillColor: "text"
      }
    },

    unit: {
      p: 5,
      minWidth: "3.5em",
      bg: "muted-transparent",

      fontFamily: "heading",
      fontWeight: "medium",
      fontSize: 5,
      lineHeight: 1,

      textAlign: "center",
      justifyContent: "space-around",

      border: 1,
      borderColor: "border",
      borderRadius: 1,
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
      borderLeft: "none",

      button: {
        p: 0,
        width: "unset",
        height: "unset"
      }
    }
  },

  styles: {
    root: {
      fontSize: 2,
      fontFamily: "body",
      fontWeight: "body",
      lineHeight: "body",

      ...breakOnWide({ backgroundImage: ["url(blob-collapsed.svg)", "url(blob.svg)"] }),
      backgroundRepeat: "no-repeat",
      backgroundPosition: "100% 0%",

      height: "100%",

      "#root": {
        height: "100%",

        "> *": {
          ...breakOnWide({
            background: [
              "none",
              "linear-gradient(90deg, rgba(255, 255, 255, 1) 60%, rgba(255, 255, 255, 0) 90%)"
            ]
          })
        }
      }
    },

    a: {
      color: "primary",
      ":hover": { color: "accent" }
    }
  }
};

export default theme;
