import { Theme } from "theme-ui";

const colors = {
  blue: "#1542cd",
  purple: "#745ddf",
  cyan: "#2eb6ea",
  green: "#28c081",
  yellow: "#fd9d28",
  red: "#dc2c10",
  lightRed: "#f48371"
};

const button = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  px: "32px",
  py: "12px",

  color: "white",

  fontWeight: "bold"
};

const iconButton = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  padding: 0,
  width: "40px",
  height: "40px",

  background: "none"
};

const card = {
  padding: 2,

  boxShadow: 2,

  borderColor: "light-gray",
  borderStyle: "solid",
  borderWidth: "1px"
};

const theme: Theme = {
  breakpoints: ["40em", "52em", "64em"],

  space: [0, 4, 8, 16, 32, 64, 128, 256, 512],

  fonts: {
    body: [
      "system-ui",
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Helvetica Neue"',
      "sans-serif"
    ].join(", "),
    heading: "inherit",
    monospace: "Menlo, monospace"
  },

  fontSizes: [12, 14, 16, 20, 24, 32, 48, 64, 96],

  fontWeights: {
    body: 400,
    heading: 600,
    bold: 600
  },

  lineHeights: {
    body: 1.5,
    heading: 1.125
  },

  colors: {
    primary: colors.blue,
    secondary: colors.purple,
    accent: colors.cyan,

    success: colors.green,
    warning: colors.yellow,
    danger: colors.red,
    dangerHover: colors.lightRed,
    info: colors.blue,

    text: "#333",
    background: "white",
    muted: "#f0f1f2",

    "moon-gray": "#ccc",
    "light-gray": "#d7d8d9"
  },

  shadows: ["0", "0px 2px 4px rgba(0, 0, 0, 0.1)", "0px 8px 16px rgba(0, 0, 0, 0.1)"],

  text: {
    editorTitle: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",

      height: "56px",

      pl: 3,
      py: 2,
      pr: 2,

      bg: "light-gray",

      fontSize: "18.7167px"
    }
  },

  buttons: {
    primary: {
      ...button,
      backgroundColor: "primary",
      "&:hover": { backgroundColor: "secondary" }
    },

    success: {
      ...button,
      backgroundColor: "success"
    },

    danger: {
      ...button,
      backgroundColor: "danger"
    },

    icon: {
      ...iconButton,
      color: "primary",
      "&:hover": { color: "accent" }
    },

    dangerIcon: {
      ...iconButton,
      color: "danger",
      "&:hover": { color: "dangerHover" }
    },

    titleIcon: {
      ...iconButton,
      color: "text",
      "&:hover": { color: "success" }
    }
  },

  cards: {
    primary: card,

    info: {
      ...card,

      borderColor: "rgba(122,199,240,0.4)",
      background: "linear-gradient(200deg, rgba(147,161,248,0.4) 0%, rgba(122,199,240,0.4) 100%);"
    }
  },

  styles: {
    root: {
      fontFamily: "body",
      lineHeight: "body",
      fontWeight: "body"
    },

    a: {
      color: "primary",
      "&:hover": { color: "accent" },
      textDecoration: "none",
      fontWeight: "bold"
    }
  }
};

export default theme;
