const mobileBreakpoint = 0;
const wideBreakpoint = 2;

type ResponsiveFragment<T1 = unknown, T2 = unknown> = {
  readonly [prop: string]: readonly [T1, T2];
};

type NullPadded<T1, T2, N extends number> = N extends 0
  ? [T1, T2]
  : N extends 1
  ? [T1, null, T2]
  : N extends 2
  ? [T1, null, null, T2]
  : (T1 | T2 | null)[];

type NullPaddedResponsiveFragment<T extends ResponsiveFragment, N extends number> = {
  [P in keyof T]: NullPadded<T[P][0], T[P][1], N>;
};

const breakOn = <N extends number>(breakpoint: N) => <T extends ResponsiveFragment>(fragment: T) =>
  Object.fromEntries(
    Object.entries(fragment).map(([k, [v1, v2]]) => [
      k,
      [v1, ...new Array(breakpoint).fill(null), v2]
    ])
  ) as NullPaddedResponsiveFragment<T, N>;

export const breakOnMobile = breakOn(mobileBreakpoint);
export const breakOnWide = breakOn(wideBreakpoint);

const displayBlockNone = { display: ["block", "none"] } as const;
const displayNoneBlock = { display: ["none", "block"] } as const;

export const displayOnMobile = breakOnMobile(displayBlockNone);
export const displayOnNonMobile = breakOnMobile(displayNoneBlock);
export const displayOnWide = breakOnWide(displayNoneBlock);
export const displayOnNonWide = breakOnMobile(displayBlockNone);
