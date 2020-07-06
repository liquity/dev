import { ThemeUIExtendedCSSProperties } from "@theme-ui/css";

const mobileBreakpoint = 0;
const wideBreakpoint = 2;

type NullPaddedValues<T1, T2, N extends number> = N extends 0
  ? [T1, T2]
  : N extends 1
  ? [T1, null, T2]
  : N extends 2
  ? [T1, null, null, T2]
  : (T1 | T2 | null)[];

type NullPadded<T, N extends number> = {
  [P in keyof T]: Required<T>[P] extends [infer U1, infer U2] ? NullPaddedValues<U1, U2, N> : never;
};

type Responsive<T> = {
  [P in keyof T]: [Required<T>[P], Required<T>[P]];
};

const breakOn = <N extends number>(breakpoint: N) => (
  responsiveCss: Responsive<ThemeUIExtendedCSSProperties>
) =>
  Object.fromEntries(
    Object.entries(responsiveCss).map(([k, v]) => [
      k,
      v && [v[0], ...new Array(breakpoint).fill(null), v[1]]
    ])
  ) as NullPadded<Responsive<ThemeUIExtendedCSSProperties>, N>;

export const breakOnMobile = breakOn(mobileBreakpoint);
export const breakOnWide = breakOn(wideBreakpoint);

const displayBlockNone: Responsive<ThemeUIExtendedCSSProperties> = { display: ["block", "none"] };
const displayNoneBlock: Responsive<ThemeUIExtendedCSSProperties> = { display: ["none", "block"] };

export const displayOnMobile = breakOnMobile(displayBlockNone);
export const displayOnNonMobile = breakOnMobile(displayNoneBlock);
export const displayOnWide = breakOnWide(displayNoneBlock);
export const displayOnNonWide = breakOnWide(displayBlockNone);
