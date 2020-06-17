import React, { useState } from "react";
import { usePopper } from "react-popper";
import { Card } from "theme-ui";

type TooltipProps = {
  children: JSX.Element;
  message: string;
  placement?: string;
};

export const Tooltip: React.FC<TooltipProps> = ({ children, message, placement = "top" }) => {
  const [show, setShow] = useState(false);
  const [referenceElement, setReferenceElement] = useState<HTMLDivElement | null>();
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>();
  //const [arrowElement, setArrowElement] = useState<HTMLDivElement | null>();

  const { styles, attributes } = usePopper(
    referenceElement,
    popperElement /*, {
    modifiers: [{ name: "arrow", options: { element: arrowElement } }]
  } */
  );

  return (
    <>
      <div
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        ref={setReferenceElement}
      >
        {children}
      </div>

      <Card
        variant="tooltip"
        sx={{ display: show ? "block" : "none" }}
        ref={setPopperElement}
        style={styles.popper}
        {...attributes.popper}
      >
        {message}
        {/* <div ref={setArrowElement} style={styles.arrow} /> */}
      </Card>
    </>
  );
};
