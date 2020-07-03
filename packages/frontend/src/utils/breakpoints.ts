const mobileBreakpoint = 1;
const wideBreakpoint = 3;

const breakOn = (breakpoint: number) => <T extends { [prop: string]: readonly [unknown, unknown] }>(
  fragment: T
) =>
  Object.fromEntries(
    Object.entries(fragment).map(([k, [v1, v2]]) => [
      k,
      [v1, ...new Array(breakpoint - 1).fill(null), v2]
    ])
  ) as {
    [P in keyof T]: (T[P][0] | T[P][1] | null)[];
  };

export const breakOnMobile = breakOn(mobileBreakpoint);
export const breakOnWide = breakOn(wideBreakpoint);

const displayOnOff = <
  T extends (fragment: { display: [string, string] }) => { display: (string | null)[] }
>(
  breakF: T
) =>
  Object.assign(
    (display: string) => breakF({ display: [display, "none"] }),
    breakF({ display: ["block", "none"] })
  );

const displayOffOn = <
  T extends (fragment: { display: [string, string] }) => { display: (string | null)[] }
>(
  breakF: T
) =>
  Object.assign(
    (display: string) => breakF({ display: ["none", display] }),
    breakF({ display: ["none", "block"] })
  );

export const displayOnMobile = displayOnOff(breakOnMobile);
export const displayOnNonMobile = displayOffOn(breakOnMobile);
export const displayOnWide = displayOffOn(breakOnWide);
export const displayOnNonWide = displayOnOff(breakOnWide);
