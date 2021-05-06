import cn from "classnames";

import Button from "../Button";

import classes from "./Modal.module.css";

const Modal = ({ title, content, confirm, decline, children, onClose, status, bigStatus }) => (
  <div className={classes.overlay} onClick={onClose}>
    <div className={cn(classes.wrapper, "scale-in-center")} onClick={e => e.stopPropagation()}>
      {status && (
        <div className={classes.statusWrapper}>
          <div
            className={cn(classes.status, {
              [classes.success]: status === "success",
              [classes.warning]: status === "warning",
              [classes.error]: status === "error"
            })}
          >
            <div className={classes.statusIcon}>
              {status === "success" ? (
                <ion-icon name="checkmark-outline"></ion-icon>
              ) : (
                <ion-icon name="alert-outline"></ion-icon>
              )}
            </div>
          </div>
        </div>
      )}

      {bigStatus && (
        <div
          className={cn(classes.bigStatus, {
            [classes.success]: bigStatus === "success",
            [classes.warning]: bigStatus === "warning",
            [classes.error]: bigStatus === "error"
          })}
        >
          <div className={classes.bigStatusIcon}>
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
              disabled={confirm.disabled}
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
