import React, { useState, useRef } from "react";
import { VirtualElement } from "@popperjs/core";
import { usePopper } from "react-popper";
import { Card } from "theme-ui";

export type Hoverable = {
  onMouseOver: () => void;
  onMouseOut: () => void;
  ref: (instance: Element | VirtualElement | null) => void;
};

export type TooltipProps<C> = {
  children: C;
  message: string;
  placement?: "top" | "bottom" | "left" | "right";
};

export function Tooltip<C extends React.ReactElement<Hoverable>>({
  children,
  message,
  placement = "top"
}: TooltipProps<C>) {
  const event = useRef<"over" | "out">();
  const [show, setShow] = useState(false);
  const [referenceElement, setReferenceElement] = useState<Element | VirtualElement | null>();
  const [popperElement, setPopperElement] = useState<HTMLElement | null>();

  const { styles, attributes } = usePopper(referenceElement, popperElement, { placement });

  return (
    <>
      {React.cloneElement(React.Children.only<C>(children), {
        // Use a debounced onMouseOver/onMouseOut instead of onMouseEnter/onMouseLeave to
        // work around https://github.com/facebook/react/issues/10109

        onMouseOver: () => {
          event.current = "over";

          if (!show) {
            setShow(true);
          }
        },

        onMouseOut: () => {
          event.current = "out";

          setTimeout(() => {
            if (event.current === "out") {
              setShow(false);
            }
          }, 0);
        },

        ref: setReferenceElement
      })}

      {show && (
        <Card variant="tooltip" ref={setPopperElement} style={styles.popper} {...attributes.popper}>
          {message}
        </Card>
      )}
    </>
  );
}
