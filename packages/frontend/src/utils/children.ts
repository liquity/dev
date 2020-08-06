import React, { ReactNode, ReactElement } from "react";

export const partition = <T, U extends T>(a: T[], u: (t: T) => t is U) =>
  a.reduce<[U[], T[]]>(([uu, tt], t) => (u(t) ? [[...uu, t], tt] : [uu, [...tt, t]]), [[], []]);

export const isElement = <T extends React.JSXElementConstructor<any>>(t: T) => (
  node: ReactNode
): node is ReactElement<T extends React.JSXElementConstructor<infer P> ? P : any> =>
  React.isValidElement(node) && node.type === t;
