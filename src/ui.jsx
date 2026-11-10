import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export const tokens = {
  paper:'#FAF8F3', ink:'#1F2A2E', slate:'#5B6B70', teal:'#2C5F63', tealDeep:'#1E4448',
  coral:'#A84E32', coralSoft:'#FBEAE2', gold:'#C9A24B', line:'#E7E1D6', cardBg:'#FFFFFF',
  tealSoft:'#E4EEEC', successBg:'#E7F3E9', success:'#326B45', warnBg:'#FBF2DF', warn:'#80601C',
  dangerBg:'#FBEAE6', danger:'#A3422B',
};

export function Button({ children, variant='primary', icon:Icon, className='', style, ...props }) {
  return <button type="button" {...props} className={`button button--${variant} ${className}`} style={style}>
    {Icon && <Icon size={17} aria-hidden="true"/>}{children}
  </button>;
}

export function Field({ label, children, required, error, hint, id }) {
  const generatedId = useId();
  const controlId = id || generatedId;
  const directControl = React.isValidElement(children) && ['input','select','textarea'].includes(children.type);
  const description = [hint && `${controlId}-hint`, error && `${controlId}-error`].filter(Boolean).join(' ') || undefined;
  return <div className="field">
    {directControl ? <label htmlFor={children.props.id || controlId}>{label}{required && <span aria-hidden="true"> *</span>}</label>
      : <div className="field__label">{label}{required && <span aria-hidden="true"> *</span>}</div>}
    {directControl ? React.cloneElement(children, {
      id: children.props.id || controlId,
      required: required || children.props.required,
      'aria-invalid': !!error || undefined,
      'aria-describedby': [children.props['aria-describedby'], description].filter(Boolean).join(' ') || undefined,
    }) : children}
    {hint && <p id={`${controlId}-hint`} className="field__hint">{hint}</p>}
    {error && <p id={`${controlId}-error`} className="field__error">{error}</p>}
  </div>;
}

export function Modal({ title, onClose, children, wide }) {
  const dialog = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    // Native dialogs provide focus containment, inert background, and Escape.
    if (element.showModal) element.showModal();
    else element.setAttribute('open', '');
    return () => {
      if (element.open && element.close) element.close();
      if (previous?.isConnected) previous.focus?.();
    };
  }, []);
  return <dialog ref={dialog} className={`modal ${wide ? 'modal--wide' : ''}`} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    } }}>
    <div className="modal__heading"><h2 id={titleId}>{title}</h2><Button variant="ghost" aria-label="Close dialog" onClick={onClose}><X size={20}/></Button></div>
    {children}
  </dialog>;
}
