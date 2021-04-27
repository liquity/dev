import cn from "classnames";

import Button from "../Button";

import classes from "./Modal.module.css";

const Modal = ({ title, content, confirm, decline, children, onClose, status }) => (
  <div className={classes.overlay} onClick={onClose}>
    <div className={cn(classes.wrapper, "scale-in-center")} onClick={e => e.stopPropagation()}>
      {status && (
        <div className={classes.status}>
          <div
            className={cn(classes.statusIcon, {
              [classes.success]: status === "success",
              [classes.warning]: status === "warning",
              [classes.error]: status === "error"
            })}
          >
            {status === "success" ? (
              <ion-icon name="checkmark-outline"></ion-icon>
            ) : (
              <ion-icon name="alert-outline"></ion-icon>
            )}
          </div>
        </div>
      )}

      <h3 className={classes.title}>{title}</h3>

      {content && <div className={classes.content}>{content}</div>}

      <div className={classes.children}>{children}</div>

      {(confirm || decline) && (
        <div className={classes.actions}>
          {decline && (
            <Button
              medium
              tertiary
              onClick={() => {
                onClose && onClose();
                decline.action && decline.action();
              }}
            >
              {decline.text}
            </Button>
          )}

          {confirm && (
            <Button
              primary
              medium
              onClick={() => {
                onClose && onClose();
                confirm.action && confirm.action();
              }}
            >
              {confirm.text}
            </Button>
          )}
        </div>
      )}
    </div>
  </div>
);

export default Modal;
