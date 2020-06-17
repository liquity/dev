import { Theme } from "theme-ui";

const colors = {
  blue: "#1542cd",
  purple: "#745ddf",
  cyan: "#2eb6ea",
  green: "#28c081",
  yellow: "#fd9d28",
  red: "#dc2c10",
  lightRed: "#ff755f"
};

const buttonBase = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  "&:enabled": { cursor: "pointer" }
} as const;

const button = {
  ...buttonBase,

  px: "32px",
  py: "12px",

  color: "white",

  fontWeight: "bold",

  "&:disabled": {
    opacity: 0.5
  }
} as const;

const iconButton = {
  ...buttonBase,

  padding: 0,
  width: "40px",
  height: "40px",

  background: "none",

  "&:disabled": {
    color: "text",
    opacity: 0.33
  }
} as const;

const card = {
  position: "relative",
  padding: 2,
  border: 1,
  boxShadow: 2
} as const;

const formBase = {
  display: "block",
  width: "auto",
  flexShrink: 0,
  padding: 2,
  fontSize: 3
} as const;

const formCell = {
  ...formBase,

  backgroundColor: "background",
  border: 1,
  borderColor: "muted",
  borderRadius: 0,
  boxShadow: 2
} as const;

const overlay = {
  left: 0,
  top: 0,
  width: "100%",
  height: "100%"
} as const;

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
    heading: 1.25
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
    invalid: "pink",

    text: "#333",
    background: "white",
    muted: "#f0f1f2",

    "moon-gray": "#ccc",
    "light-gray": "#d7d8d9"
  },

  borders: [0, "1px solid"],

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
      "&:enabled:hover": { backgroundColor: "secondary" }
    },

    success: {
      ...button,
      backgroundColor: "success"
    },

    danger: {
      ...button,
      backgroundColor: "danger",
      "&:enabled:hover": { backgroundColor: "dangerHover" }
    },

    icon: {
      ...iconButton,
      color: "primary",
      "&:enabled:hover": { color: "accent" }
    },

    dangerIcon: {
      ...iconButton,
      color: "danger",
      "&:enabled:hover": { color: "dangerHover" }
    },

    titleIcon: {
      ...iconButton,
      color: "text",
      "&:enabled:hover": { color: "success" }
    }
  },

  cards: {
    primary: {
      ...card,
      borderColor: "light-gray",
      backgroundColor: "background"
    },

    info: {
      ...card,
      borderColor: "rgba(122,199,240,0.4)",
      background: "linear-gradient(200deg, rgba(147,161,248,0.4) 0%, rgba(122,199,240,0.4) 100%);"
    }
  },

  forms: {
    label: {
      ...formBase
    },

    unit: {
      ...formCell,

      textAlign: "center",
      backgroundColor: "muted"
    },

    input: {
      ...formCell,

      flex: 1
    }
  },

  layout: {
    loadingOverlay: {
      ...overlay,

      zIndex: 2,
      position: "absolute",
      backgroundColor: "rgba(255, 255, 255, 0.5)"
    },

    modalOverlay: {
      ...overlay,

      zIndex: 3,
      position: "fixed",
      backgroundColor: "rgba(0, 0, 0, 0.8)",

      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    },

    modal: {
      p: 3,
      width: ["100%", "40em"]
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
