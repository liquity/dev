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

  ":enabled": { cursor: "pointer" }
} as const;

const button = {
  ...buttonBase,

  px: "32px",
  py: "12px",

  color: "white",

  fontWeight: "bold",

  ":disabled": {
    opacity: 0.5
  }
} as const;

const iconButton = {
  ...buttonBase,

  padding: 0,
  width: "40px",
  height: "40px",

  background: "none",

  ":disabled": {
    color: "text",
    opacity: 0.33
  }
} as const;

const cardHeadingFontSize = 18.7167;

const cardGapX = [0, 3, 4] as const;
const cardGapY = [3, 3, 4] as const;

const card = {
  position: "relative",
  mt: cardGapY,
  border: 1,
  boxShadow: [1, null, 2]
} as const;

const infoCard = {
  ...card,

  padding: 3,

  borderColor: "rgba(122,199,240,0.4)",
  background: "linear-gradient(200deg, rgba(212,217,252,1) 0%, rgba(202,233,249,1) 100%)",

  h2: {
    mb: 2,
    fontSize: cardHeadingFontSize
  }
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
  boxShadow: [1, 2]
} as const;

const overlay = {
  left: 0,
  top: 0,
  width: "100%",
  height: "100%"
} as const;

const theme: Theme = {
  breakpoints: ["48em", "52em", "64em"],

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

  shadows: ["0", "0px 4px 8px rgba(0, 0, 0, 0.1)", "0px 8px 16px rgba(0, 0, 0, 0.1)"],

  text: {
    address: {
      fontFamily: "monospace",
      fontSize: 1
    }
  },

  buttons: {
    primary: {
      ...button,
      backgroundColor: "primary",
      ":enabled:hover": { backgroundColor: "secondary" }
    },

    success: {
      ...button,
      backgroundColor: "success"
    },

    danger: {
      ...button,
      backgroundColor: "danger",
      ":enabled:hover": { backgroundColor: "dangerHover" }
    },

    icon: {
      ...iconButton,
      color: "primary",
      ":enabled:hover": { color: "accent" }
    },

    dangerIcon: {
      ...iconButton,
      color: "danger",
      ":enabled:hover": { color: "dangerHover" }
    },

    titleIcon: {
      ...iconButton,
      color: "text",
      ":enabled:hover": { color: "success" }
    }
  },

  cards: {
    primary: {
      ...card,

      padding: 0,

      borderColor: "light-gray",
      backgroundColor: "background",

      "> h2": {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",

        height: "56px",

        pl: 3,
        py: 2,
        pr: 2,

        bg: "light-gray",

        fontSize: cardHeadingFontSize
      },

      "> :last-child": {
        padding: 2
      }
    },

    info: {
      ...infoCard,

      display: ["none", "block"]
    },

    infoPopup: {
      ...infoCard,

      position: "fixed",
      top: 0,
      right: 3,
      left: 3,
      mt: "72px"
    },

    tooltip: {
      padding: 2,

      border: 1,
      borderColor: "light-gray",
      borderRadius: "4px",
      backgroundColor: "muted",
      boxShadow: 2,

      fontSize: 1,

      zIndex: 3
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
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "stretch",

      position: ["fixed", "relative"],
      width: "100vw",
      top: 0,
      overflow: "hidden",
      zIndex: 2,

      px: [2, "12px", "12px", 5],
      py: [2, "12px", "12px"],

      backgroundColor: "muted",
      borderBottom: "1px solid lightgrey",
      boxShadow: [1, "none"]
    },

    footer: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",

      mt: cardGapY,
      px: 3,
      height: "72px",

      backgroundColor: "muted"
    },

    main: {
      width: "100%",
      maxWidth: "894px",
      mx: "auto",
      mt: ["40px", 0],
      px: cardGapX
    },

    columns: {
      display: "flex",
      flexWrap: "wrap",
      justifyItems: "center"
    },

    left: {
      pr: cardGapX,
      width: ["100%", "60%"]
    },

    right: {
      width: ["100%", "40%"]
    },

    actions: {
      mt: cardGapY,
      justifyContent: "center"
    },

    loadingOverlay: {
      ...overlay,

      zIndex: 2,
      position: "absolute",
      backgroundColor: "rgba(255, 255, 255, 0.5)"
    },

    modalOverlay: {
      ...overlay,

      zIndex: 4,
      position: "fixed",
      backgroundColor: "rgba(0, 0, 0, 0.8)",

      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    },

    modal: {
      padding: 3,
      width: ["100%", "40em"]
    },

    infoOverlay: {
      ...overlay,

      display: ["block", "none"],

      zIndex: 1,
      position: "fixed",
      backgroundColor: "rgba(255, 255, 255, 0.8)"
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
      ":hover": { color: "accent" },
      textDecoration: "none",
      fontWeight: "bold"
    }
  }
};

export default theme;
