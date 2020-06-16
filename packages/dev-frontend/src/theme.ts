import { Theme } from "theme-ui";

const colors = {
  blue: "#1542cd",
  purple: "#745ddf",
  cyan: "#2eb6ea",
  green: "#28c081",
  yellow: "#fd9d28",
  red: "#dc2c10"
};

const heading = {
  color: "text",
  fontFamily: "heading",
  lineHeight: "heading",
  fontWeight: "heading"
};

const button = {
  px: "32px",
  py: "12px",

  fontWeight: "bold",
  color: "white"
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
    info: colors.blue,

    text: "#333",
    background: "white",
    muted: "#f0f1f2",

    "moon-gray": "#ccc",
    "light-gray": "#eee"
  },

  shadows: ["0", "0px 2px 4px rgba(0, 0, 0, 0.1)", "0px 8px 16px rgba(0, 0, 0, 0.1)"],

  buttons: {
    primary: {
      ...button,
      backgroundColor: "primary"
    },

    success: {
      ...button,
      backgroundColor: "success"
    },

    danger: {
      ...button,
      backgroundColor: "danger"
    }
  },

  cards: {
    primary: card,

    info: {
      ...card,
      background: "linear-gradient(200deg, rgba(147,161,248,0.4) 0%, rgba(122,199,240,0.4) 100%);"
    }
  },

  styles: {
    root: {
      fontFamily: "body",
      lineHeight: "body",
      fontWeight: "body"
    },

    h1: {
      ...heading,
      fontSize: 5
    },

    h2: {
      ...heading,
      fontSize: 4
    },

    h3: {
      ...heading,
      fontSize: 3
    },

    h4: {
      ...heading,
      fontSize: 2
    },

    h5: {
      ...heading,
      fontSize: 1
    },

    h6: {
      ...heading,
      fontSize: 0
    },

    p: {
      color: "text",
      fontFamily: "body",
      fontWeight: "body",
      lineHeight: "body"
    },

    a: {
      color: "primary",
      ":hover": { color: "red" }
    },

    table: {
      width: "100%",
      borderCollapse: "separate",
      borderSpacing: 0
    },

    th: {
      textAlign: "left",
      borderBottomStyle: "solid"
    },

    td: {
      textAlign: "left",
      borderBottomStyle: "solid"
    }
  }
};

export default theme;
